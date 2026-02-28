import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WHISPER_CLI = path.join(__dirname, '../whisper/bin/Release/whisper-cli.exe');
const MODEL_PATH = path.join(__dirname, '../whisper/models/ggml-small.bin');
const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ─── In-memory queue state ──────────────────────────────────
let queue = [];           // [{ jobId, lessonId, filePath }]
let isProcessing = false;
let currentJob = null;    // { jobId, lessonId, filePath }
let currentChild = null;  // child_process reference
let cancelledByUser = false;
let currentProgress = null;

// ─── Public API ──────────────────────────────────────────────

export function enqueue(jobId, lessonId, filePath) {
    queue.push({ jobId, lessonId, filePath });
    if (!isProcessing) {
        processNext();
    }
}

export function cancel(jobId) {
    const idx = queue.findIndex((j) => j.jobId === jobId);
    if (idx === -1) return false;

    queue.splice(idx, 1);

    db.prepare(
        `UPDATE subtitle_jobs SET status = 'cancelled', finished_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), jobId);

    return true;
}

export function cancelProcessing() {
    if (!currentChild || !currentJob) return false;
    cancelledByUser = true;
    currentChild.kill();
    return true;
}

export function getStatus() {
    return {
        currentJobId: currentJob?.jobId ?? null,
        isProcessing,
        queuedJobIds: queue.map((j) => j.jobId),
        progress: currentProgress,
    };
}

// ─── Internal processing ─────────────────────────────────────

function processNext() {
    if (queue.length === 0) {
        isProcessing = false;
        currentJob = null;
        return;
    }

    isProcessing = true;
    currentProgress = 0;
    currentJob = queue.shift();
    const { jobId, lessonId, filePath } = currentJob;
    const now = new Date().toISOString();

    // Mark as processing in DB
    db.prepare(
        `UPDATE subtitle_jobs SET status = 'processing', started_at = ? WHERE id = ?`
    ).run(now, jobId);

    // Build output paths
    const base = filePath.replace(/\.[^.]+$/, '');  // remove extension
    const srtPath = base + '.srt';
    const videoDir = path.dirname(filePath);
    const videoBasename = path.basename(filePath, path.extname(filePath));
    const wavPath = path.join(videoDir, `.${videoBasename}_temp_audio.wav`);

    cancelledByUser = false;

    // ── Step 1: Extract audio with ffmpeg ────────────────────
    console.log(`[Subtitle] Extracting audio: ${path.basename(filePath)}`);
    currentProgress = 0;

    const ffmpeg = spawn('ffmpeg', [
        '-y',                   // overwrite
        '-i', filePath,         // input video
        '-ar', '16000',         // 16 kHz
        '-ac', '1',             // mono
        '-c:a', 'pcm_s16le',   // 16-bit PCM WAV
        '-vn',                  // no video
        wavPath
    ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

    ffmpeg.on('close', (ffmpegCode) => {
        if (cancelledByUser) {
            cleanup(wavPath);
            finishJob(jobId, lessonId, 'cancelled', null, 'Stopped by user');
            return;
        }

        if (ffmpegCode !== 0) {
            cleanup(wavPath);
            finishJob(jobId, lessonId, 'failed', null, `ffmpeg failed with code ${ffmpegCode}`);
            return;
        }

        console.log(`[Subtitle] Audio extracted, transcribing with whisper.cpp (GPU)...`);
        currentProgress = 5;

        // ── Step 2: Transcribe with whisper-cli ──────────────
        const whisper = spawn(WHISPER_CLI, [
            '-m', MODEL_PATH,
            '-f', wavPath,
            '-osrt',
            '-of', base,            // output file (without extension)
            '-l', 'auto',           // auto-detect language
            '-pp',                  // print progress
            '-t', '4',              // threads
        ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });

        currentChild = whisper;

        // 30-minute timeout
        const timer = setTimeout(() => {
            whisper.kill();
            cleanup(wavPath);
            finishJob(jobId, lessonId, 'failed', null, 'Timed out after 30 minutes');
        }, TIMEOUT_MS);

        whisper.stderr.on('data', (data) => {
            const text = data.toString();
            // whisper.cpp format: "whisper_print_progress_callback: progress = XX%"
            const progressMatch = text.match(/progress\s*=\s*(\d+)%/);
            if (progressMatch) {
                const rawPct = parseInt(progressMatch[1], 10);
                // Scale whisper progress (0-100) to our range (5-99)
                const pct = Math.min(99, 5 + Math.floor(rawPct * 0.94));
                if (pct > (currentProgress || 0)) {
                    currentProgress = pct;
                }
            }
        });

        whisper.on('close', (whisperCode) => {
            clearTimeout(timer);
            currentChild = null;
            cleanup(wavPath);

            if (cancelledByUser) {
                finishJob(jobId, lessonId, 'cancelled', null, 'Stopped by user');
                return;
            }

            if (whisperCode === 0 && fs.existsSync(srtPath)) {
                currentProgress = 100;
                console.log(`[Subtitle] Done: ${path.basename(srtPath)}`);
                finishJob(jobId, lessonId, 'done', srtPath, null);
            } else {
                finishJob(jobId, lessonId, 'failed', null, `whisper-cli exited with code ${whisperCode}`);
            }
        });

        whisper.on('error', (err) => {
            clearTimeout(timer);
            currentChild = null;
            cleanup(wavPath);
            finishJob(jobId, lessonId, 'failed', null, `Failed to spawn whisper-cli: ${err.message}`);
        });
    });

    ffmpeg.on('error', (err) => {
        cleanup(wavPath);
        finishJob(jobId, lessonId, 'failed', null, `Failed to spawn ffmpeg: ${err.message}`);
    });

    // Keep reference so cancel can kill it during ffmpeg phase too
    currentChild = ffmpeg;
}

// ─── Helpers ─────────────────────────────────────────────────

function finishJob(jobId, lessonId, status, outputPath, errorMessage) {
    const finishedAt = new Date().toISOString();
    currentProgress = null;

    if (status === 'done' && outputPath) {
        db.prepare(
            `UPDATE subtitle_jobs SET status = 'done', finished_at = ?, output_path = ? WHERE id = ?`
        ).run(finishedAt, outputPath, jobId);
        db.prepare(
            `UPDATE lessons SET subtitle_path = ? WHERE id = ?`
        ).run(outputPath, lessonId);
    } else if (status === 'cancelled') {
        cancelledByUser = false;
        db.prepare(
            `UPDATE subtitle_jobs SET status = 'cancelled', finished_at = ?, error_message = ? WHERE id = ?`
        ).run(finishedAt, errorMessage || 'Stopped by user', jobId);
    } else {
        db.prepare(
            `UPDATE subtitle_jobs SET status = 'failed', finished_at = ?, error_message = ? WHERE id = ?`
        ).run(finishedAt, errorMessage, jobId);
    }

    currentJob = null;
    processNext();
}

function cleanup(wavPath) {
    try {
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    } catch { /* ignore cleanup errors */ }
}
