#!/usr/bin/env python3
"""
Whisper Subtitle Generator for Inkwell LMS (whisper.cpp + ffmpeg)

Usage:
    python generate.py "/absolute/path/to/video.mp4"

Pipeline:
    1. ffmpeg: extract audio from video -> temporary 16kHz mono WAV
    2. whisper-cli.exe: transcribe WAV -> SRT (GPU-accelerated via CUDA)
    3. Clean up temp WAV

On success: prints SUCCESS:/path/to/output.srt to stdout
On failure: prints error to stderr, exits with code 1
"""

import sys
import os
import subprocess
import re
import tempfile

# ─── Paths ──────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
WHISPER_CLI = os.path.join(SCRIPT_DIR, "bin", "Release", "whisper-cli.exe")
MODEL_PATH = os.path.join(SCRIPT_DIR, "models", "ggml-small.bin")


def main():
    if len(sys.argv) != 2:
        print("Usage: python generate.py <video_path>", file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]

    if not os.path.isfile(video_path):
        print(f"Error: Video file not found at path: {video_path}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(WHISPER_CLI):
        print(f"Error: whisper-cli.exe not found at: {WHISPER_CLI}", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(MODEL_PATH):
        print(f"Error: Model file not found at: {MODEL_PATH}", file=sys.stderr)
        sys.exit(1)

    # Build output path: same directory as video, same base name, .srt extension
    base, _ = os.path.splitext(video_path)
    srt_path = base + ".srt"

    # Temp WAV file in the same directory as the video (avoids cross-drive issues)
    video_dir = os.path.dirname(video_path)
    video_basename = os.path.splitext(os.path.basename(video_path))[0]
    wav_path = os.path.join(video_dir, f".{video_basename}_temp_audio.wav")

    try:
        # ── Step 1: Extract audio with ffmpeg ─────────────────────
        print("INFO:Extracting audio with ffmpeg...", file=sys.stderr)
        print("PROGRESS:0", file=sys.stderr, flush=True)

        ffmpeg_cmd = [
            "ffmpeg", "-y",             # overwrite if exists
            "-i", video_path,           # input video
            "-ar", "16000",             # 16 kHz sample rate (Whisper requirement)
            "-ac", "1",                 # mono
            "-c:a", "pcm_s16le",        # 16-bit PCM WAV
            "-vn",                      # discard video stream
            wav_path
        ]

        result = subprocess.run(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=600  # 10 min timeout for extraction
        )

        if result.returncode != 0:
            print(f"Error: ffmpeg failed:\n{result.stderr.decode('utf-8', errors='replace')}", file=sys.stderr)
            sys.exit(1)

        wav_size_mb = os.path.getsize(wav_path) / (1024 * 1024)
        print(f"INFO:Audio extracted ({wav_size_mb:.1f} MB WAV)", file=sys.stderr)
        print("PROGRESS:5", file=sys.stderr, flush=True)

        # ── Step 2: Transcribe with whisper-cli (GPU) ─────────────
        print("INFO:Transcribing with whisper.cpp (CUDA GPU)...", file=sys.stderr)

        whisper_cmd = [
            WHISPER_CLI,
            "-m", MODEL_PATH,           # model path
            "-f", wav_path,             # input audio
            "-osrt",                    # output SRT format
            "-of", base,                # output file path (without extension)
            "-l", "auto",               # auto-detect language
            "-pp",                      # print progress
            "-t", "4",                  # threads
        ]

        proc = subprocess.Popen(
            whisper_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Read stderr line by line for progress updates
        last_pct = 5
        for line in proc.stderr:
            text = line.decode("utf-8", errors="replace").strip()

            # whisper.cpp progress format: "whisper_print_progress_callback: progress = XX%"
            progress_match = re.search(r'progress\s*=\s*(\d+)%', text)
            if progress_match:
                raw_pct = int(progress_match.group(1))
                # Scale whisper progress (0-100) to our range (5-99)
                pct = min(99, 5 + int(raw_pct * 0.94))
                if pct > last_pct:
                    last_pct = pct
                    print(f"PROGRESS:{pct}", file=sys.stderr, flush=True)

        proc.wait()

        if proc.returncode != 0:
            stdout_text = proc.stdout.read().decode("utf-8", errors="replace")
            print(f"Error: whisper-cli failed (code {proc.returncode}):\n{stdout_text}", file=sys.stderr)
            sys.exit(1)

        # ── Step 3: Verify output ─────────────────────────────────
        if not os.path.isfile(srt_path):
            print(f"Error: SRT file was not created at: {srt_path}", file=sys.stderr)
            sys.exit(1)

        print("PROGRESS:100", file=sys.stderr, flush=True)

        # Signal success to Node.js
        print(f"SUCCESS:{srt_path}")

    except subprocess.TimeoutExpired:
        print("Error: Process timed out", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error during transcription: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        # Clean up temp WAV file
        if os.path.isfile(wav_path):
            try:
                os.remove(wav_path)
            except OSError:
                pass


if __name__ == "__main__":
    main()
