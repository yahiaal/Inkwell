import { Router } from 'express';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { enqueue, cancel, cancelProcessing, getStatus } from '../utils/subtitleQueue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WHISPER_CLI = path.join(__dirname, '..', 'whisper', 'bin', 'Release', 'whisper-cli.exe');
const MODEL_PATH = path.join(__dirname, '..', 'whisper', 'models', 'ggml-small.bin');

const router = Router();

// ─── POST /api/subtitles/generate ────────────────────────────
router.post('/generate', (req, res) => {
    const { lessonIds, force } = req.body;
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
        return res.status(400).json({ error: 'lessonIds must be a non-empty array', code: 'INVALID_INPUT' });
    }

    const queued = [];
    const skipped = [];

    for (const lessonId of lessonIds) {
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
        if (!lesson) {
            skipped.push(lessonId);
            continue;
        }

        // Skip if already has subtitle, UNLESS force is true
        if (lesson.subtitle_path && !force) {
            skipped.push(lessonId);
            continue;
        }

        // Skip if already has an active job — but verify against in-memory queue
        // to avoid stale DB rows from blocking new requests
        const activeJob = db.prepare(
            `SELECT id FROM subtitle_jobs WHERE lesson_id = ? AND status IN ('queued', 'processing')`
        ).get(lessonId);
        const queueStatus = getStatus();
        const isReallyActive = activeJob && (
            queueStatus.currentJobId === activeJob.id ||
            queueStatus.queuedJobIds.includes(activeJob.id)
        );
        if (isReallyActive) {
            skipped.push(lessonId);
            continue;
        }

        // If we found a stale active job in DB, mark it as failed
        if (activeJob && !isReallyActive) {
            db.prepare(
                `UPDATE subtitle_jobs SET status = 'failed', finished_at = ?, error_message = 'Stale job cleaned up' WHERE id = ?`
            ).run(new Date().toISOString(), activeJob.id);
        }

        // Insert job row
        const now = new Date().toISOString();
        const result = db.prepare(
            `INSERT INTO subtitle_jobs (lesson_id, status, created_at) VALUES (?, 'queued', ?)`
        ).run(lessonId, now);

        const jobId = result.lastInsertRowid;
        queued.push(lessonId);

        // Enqueue for processing
        enqueue(Number(jobId), lessonId, lesson.file_path);
    }

    res.json({
        queued,
        skipped,
        skipReason: skipped.length > 0 ? 'already has subtitle or already queued' : undefined,
    });
});

// ─── GET /api/subtitles/queue ────────────────────────────────
router.get('/queue', (req, res) => {
    const queueStatus = getStatus();

    // Currently processing
    let processing = null;
    if (queueStatus.currentJobId) {
        const row = db.prepare(`
      SELECT sj.id AS jobId, sj.lesson_id AS lessonId, sj.started_at AS startedAt,
             l.title AS lessonTitle, c.title AS courseTitle
      FROM subtitle_jobs sj
      JOIN lessons l ON l.id = sj.lesson_id
      JOIN courses c ON c.id = l.course_id
      WHERE sj.id = ?
    `).get(queueStatus.currentJobId);
        processing = row || null;
    }
    if (processing) {
        processing.progress = queueStatus.progress;
    }

    // Queued jobs
    const queuedJobs = [];
    for (let i = 0; i < queueStatus.queuedJobIds.length; i++) {
        const row = db.prepare(`
      SELECT sj.id AS jobId, sj.lesson_id AS lessonId,
             l.title AS lessonTitle, c.title AS courseTitle
      FROM subtitle_jobs sj
      JOIN lessons l ON l.id = sj.lesson_id
      JOIN courses c ON c.id = l.course_id
      WHERE sj.id = ?
    `).get(queueStatus.queuedJobIds[i]);
        if (row) {
            queuedJobs.push({ ...row, position: i + 1 });
        }
    }

    // Recently completed (last 5)
    const recentlyCompleted = db.prepare(`
    SELECT sj.id AS jobId, sj.lesson_id AS lessonId, sj.status, sj.finished_at AS finishedAt,
           sj.error_message AS errorMessage, l.title AS lessonTitle
    FROM subtitle_jobs sj
    JOIN lessons l ON l.id = sj.lesson_id
    WHERE sj.status IN ('done', 'failed', 'cancelled') AND sj.finished_at IS NOT NULL
    ORDER BY sj.finished_at DESC
    LIMIT 5
  `).all();

    res.json({ processing, queued: queuedJobs, recentlyCompleted });
});

// ─── DELETE /api/subtitles/queue/:jobId ──────────────────────
router.delete('/queue/:jobId', (req, res) => {
    const jobId = Number(req.params.jobId);

    const job = db.prepare('SELECT * FROM subtitle_jobs WHERE id = ?').get(jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found', code: 'JOB_NOT_FOUND' });
    }

    // Stop a currently processing job (kill the whisper process)
    if (job.status === 'processing') {
        const stopped = cancelProcessing();
        if (stopped) {
            return res.json({ cancelled: true, jobId });
        }
        return res.status(400).json({ error: 'Could not stop the running job', code: 'STOP_FAILED' });
    }

    if (job.status !== 'queued') {
        return res.status(400).json({ error: 'Job is not in queued or processing state', code: 'JOB_NOT_ACTIVE' });
    }

    const cancelled = cancel(jobId);
    if (cancelled) {
        res.json({ cancelled: true, jobId });
    } else {
        res.status(400).json({ error: 'Job could not be cancelled', code: 'CANCEL_FAILED' });
    }
});

// ─── DELETE /api/subtitles/history ───────────────────────────
router.delete('/history', (req, res) => {
    db.prepare(
        `DELETE FROM subtitle_jobs WHERE status IN ('done', 'failed', 'cancelled')`
    ).run();
    res.json({ cleared: true });
});

// ─── GET /api/subtitles/missing/:courseId ─────────────────────
router.get('/missing/:courseId', (req, res) => {
    const courseId = Number(req.params.courseId);

    const course = db.prepare('SELECT id, title FROM courses WHERE id = ?').get(courseId);
    if (!course) {
        return res.status(404).json({ error: 'Course not found', code: 'COURSE_NOT_FOUND' });
    }

    const lessons = db.prepare(
        `SELECT id AS lessonId, title AS lessonTitle, section_path AS sectionPath
     FROM lessons WHERE course_id = ? AND subtitle_path IS NULL`
    ).all(courseId);

    res.json({
        courseId: course.id,
        courseTitle: course.title,
        missingCount: lessons.length,
        lessons,
    });
});

// ─── GET /api/subtitles/check ────────────────────────────────
router.get('/check', (req, res) => {
    const hasCli = existsSync(WHISPER_CLI);
    const hasModel = existsSync(MODEL_PATH);

    let hasFfmpeg = false;
    try {
        execSync('ffmpeg -version', { timeout: 5000, stdio: 'ignore' });
        hasFfmpeg = true;
    } catch { /* ffmpeg not found */ }

    if (hasCli && hasModel && hasFfmpeg) {
        res.json({ available: true });
    } else {
        const missing = [];
        if (!hasCli) missing.push('whisper-cli.exe');
        if (!hasModel) missing.push('ggml-small.bin model');
        if (!hasFfmpeg) missing.push('ffmpeg');
        res.json({ available: false, reason: `Missing: ${missing.join(', ')}` });
    }
});

export default router;
