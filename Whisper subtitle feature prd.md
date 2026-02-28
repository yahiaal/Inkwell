# Feature PRD: AI Subtitle Generation (Whisper)
# LMS — Auto-Subtitle Feature

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** February 2026  
**Parent Document:** LMS PRD v1.0  

---

## Table of Contents

1. [Feature Overview](#1-feature-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [System Architecture](#3-system-architecture)
4. [Python Whisper Script](#4-python-whisper-script)
5. [Database Changes](#5-database-changes)
6. [Backend API — New Routes](#6-backend-api--new-routes)
7. [Job Queue System](#7-job-queue-system)
8. [Frontend Changes](#8-frontend-changes)
9. [File & Path Conventions](#9-file--path-conventions)
10. [Error Handling](#10-error-handling)
11. [Deliverable Checklist](#11-deliverable-checklist)

---

## 1. Feature Overview

Some video lessons in the LMS do not have subtitle files on disk. This feature allows the user to generate `.srt` subtitle files for those lessons using OpenAI Whisper running **fully locally** — no internet required, no API key, no cost.

The user can trigger subtitle generation for a single lesson or for all missing subtitles across an entire course. Jobs run sequentially in a background queue (one at a time) so the GPU is not overwhelmed. The user can continue using the LMS normally while generation runs in the background.

Once a subtitle is generated, it is saved as a `.srt` file next to the video file on disk, the `subtitle_path` column in the `lessons` table is updated, and the player's CC button becomes available for that lesson immediately.

---

## 2. Goals & Non-Goals

### Goals

- Detect which lessons have `subtitle_path = null` and surface them to the user
- Generate `.srt` subtitle files using Whisper `small` model locally
- Save generated `.srt` files next to the source video file on disk
- Update `subtitle_path` in the database after successful generation
- Process jobs one at a time via an in-memory sequential queue
- Show live queue status and per-job progress to the user in the UI
- Allow the user to cancel a queued job before it starts
- Support single-lesson generation (from the player) and batch generation (from Settings or Course Detail)

### Non-Goals

- Whisper model selection in the UI (always use `small`)
- Translation to other languages (transcription only, in the video's original language)
- Editing or correcting generated subtitles inside the app
- Cloud or remote processing
- Running multiple Whisper jobs in parallel
- Regenerating subtitles for lessons that already have a `subtitle_path`

---

## 3. System Architecture

The feature adds a **thin Python layer** alongside the existing Node.js backend. Node remains the primary server. Python is only invoked when a subtitle job runs.

```
Frontend (React)
     │
     │  HTTP requests (existing API pattern)
     ▼
Node.js Express Backend (localhost:3001)
     │
     │  child_process.spawn()  — called per job
     ▼
Python Script (server/whisper/generate.py)
     │
     │  openai-whisper library
     ▼
Whisper small model (runs on NVIDIA GPU via CUDA if available, CPU fallback)
     │
     │  writes file to disk
     ▼
.srt file saved next to video
     │
     ▼
Node updates subtitle_path in SQLite DB
```

**Why `child_process.spawn` and not a Python server?**  
Single user, local machine, sequential queue. Spawning a process per job is simpler, has no persistent Python process to manage, and is robust enough for this use case. No FastAPI or Flask server is needed.

---

## 4. Python Whisper Script

**File location:** `server/whisper/generate.py`

### Responsibilities

1. Accept a single argument: the absolute path to the video file
2. Load the Whisper `small` model
3. Transcribe the video (Whisper reads audio directly from video files — no separate audio extraction step needed)
4. Format the result as valid `.srt` content
5. Write the `.srt` file to the same folder as the video, with the same base name
6. Print a final status line to stdout so Node can confirm success

### CLI interface

```bash
python server/whisper/generate.py "/absolute/path/to/lesson.mp4"
```

### Output

- Writes: `/absolute/path/to/lesson.srt`
- Prints to stdout on success: `SUCCESS:/absolute/path/to/lesson.srt`
- Prints to stderr on failure: the Python exception message

### SRT formatting rules

- Each subtitle block must follow the standard `.srt` format:
```
1
00:00:01,000 --> 00:00:04,500
Subtitle text here.

2
00:00:05,000 --> 00:00:08,200
Next subtitle line.
```
- Index numbers start at `1` and increment sequentially
- Timestamps use the format `HH:MM:SS,mmm` (hours, minutes, seconds, milliseconds separated by a comma — not a period)
- One blank line between each subtitle block
- UTF-8 encoding

### Dependencies (Python)

These must be installed before using the feature:

```
openai-whisper
torch
```

The script should check on startup whether these are importable and print a clear error to stderr if not, rather than crashing with a Python traceback.

### GPU usage

Whisper will automatically use CUDA (NVIDIA GPU) if available via PyTorch. The script does not need to configure this manually — `whisper.load_model("small")` handles device selection automatically. This means on the user's machine (NVIDIA GeForce MX550), the GPU will be used and processing will be significantly faster than CPU-only.

---

## 5. Database Changes

### 5.1 `lessons` table — no schema change needed

The `subtitle_path` column already exists and is already `nullable TEXT`. No migration is required. The feature simply populates this column for lessons that currently have `null`.

### 5.2 New table: `subtitle_jobs`

This table tracks the history of all subtitle generation jobs. It is used for audit purposes and to avoid re-triggering already-completed jobs.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| lesson_id | INTEGER FK | References lessons.id |
| status | TEXT | `queued` / `processing` / `done` / `failed` / `cancelled` |
| created_at | TEXT | ISO timestamp — when job was added to queue |
| started_at | TEXT | ISO timestamp — when processing began, nullable |
| finished_at | TEXT | ISO timestamp — when job completed or failed, nullable |
| error_message | TEXT | Error text if status is `failed`, nullable |
| output_path | TEXT | Absolute path to the generated `.srt` file, nullable until done |

**Migration:** Add this table creation to the existing migration logic in `server/db.js` alongside the other `CREATE TABLE IF NOT EXISTS` statements.

---

## 6. Backend API — New Routes

All new routes follow the existing conventions: base URL `http://localhost:3001/api`, JSON responses, errors return `{ "error": "...", "code": "..." }`.

Add a new route file: `server/routes/subtitles.js`. Register it in `server/index.js` as `/api/subtitles`.

### 6.1 `POST /api/subtitles/generate`

Adds one or more lessons to the subtitle generation queue.

**Request body:**
```json
{ "lessonIds": [42] }
```
or for batch:
```json
{ "lessonIds": [42, 43, 44, 51] }
```

**Behavior:**
- For each `lessonId`, verify the lesson exists in the DB
- Skip any lesson that already has a non-null `subtitle_path` (do not re-generate)
- Skip any lesson that already has a `queued` or `processing` job in `subtitle_jobs`
- For eligible lessons, insert a row in `subtitle_jobs` with `status = queued`
- Add each job to the in-memory queue (see Section 7)
- Trigger the queue processor if it is not already running

**Response:**
```json
{
  "queued": [42, 43],
  "skipped": [44],
  "skipReason": "already has subtitle or already queued"
}
```

---

### 6.2 `GET /api/subtitles/queue`

Returns the current state of the queue — used by the frontend to poll for live updates.

**Response:**
```json
{
  "processing": {
    "jobId": 7,
    "lessonId": 42,
    "lessonTitle": "Introduction to React",
    "courseTitle": "React Bootcamp",
    "startedAt": "2026-02-27T14:00:00.000Z"
  },
  "queued": [
    {
      "jobId": 8,
      "lessonId": 43,
      "lessonTitle": "Components and Props",
      "courseTitle": "React Bootcamp",
      "position": 1
    }
  ],
  "recentlyCompleted": [
    {
      "jobId": 6,
      "lessonId": 41,
      "lessonTitle": "Course Setup",
      "status": "done",
      "finishedAt": "2026-02-27T13:58:10.000Z"
    }
  ]
}
```

`recentlyCompleted` returns the last 5 finished jobs (status `done` or `failed`), ordered by `finished_at` descending.

---

### 6.3 `DELETE /api/subtitles/queue/:jobId`

Cancels a queued job. Only works if the job's status is `queued` (not `processing` — a running job cannot be interrupted mid-process).

**Response on success:**
```json
{ "cancelled": true, "jobId": 8 }
```

**Response if job is currently processing:**
```json
{ "error": "Cannot cancel a job that is already processing", "code": "JOB_ALREADY_PROCESSING" }
```

---

### 6.4 `GET /api/subtitles/missing/:courseId`

Returns all lessons in a course that have no subtitle file.

**Response:**
```json
{
  "courseId": 3,
  "courseTitle": "React Bootcamp",
  "missingCount": 12,
  "lessons": [
    { "lessonId": 42, "lessonTitle": "Introduction to React", "sectionPath": "Section 1" },
    { "lessonId": 43, "lessonTitle": "Components and Props", "sectionPath": "Section 1" }
  ]
}
```

---

## 7. Job Queue System

**File location:** `server/utils/subtitleQueue.js`

This is a simple in-memory sequential queue. It is a plain JavaScript module — not a database queue, not a third-party library.

### State

The queue module maintains two pieces of private state:

- `queue`: an array of job objects `{ jobId, lessonId, filePath }` — ordered by insertion
- `isProcessing`: a boolean flag — `true` while a job is actively running

### Behavior

**`enqueue(jobId, lessonId, filePath)`**  
Pushes a new entry onto the queue array. If `isProcessing` is `false`, immediately calls `processNext()`.

**`processNext()`**  
If the queue is empty, sets `isProcessing = false` and returns. Otherwise:
1. Shifts the first item from the queue array
2. Sets `isProcessing = true`
3. Updates `subtitle_jobs` row: `status = processing`, `started_at = now`
4. Spawns the Python process: `python server/whisper/generate.py "<filePath>"`
5. Listens to stdout and stderr from the child process
6. On process exit:
   - If exit code is `0` and stdout contains `SUCCESS:<path>`:
     - Update `subtitle_jobs`: `status = done`, `finished_at = now`, `output_path = <path>`
     - Update `lessons`: `subtitle_path = <path>` for the lesson
   - If exit code is non-zero or stdout does not contain `SUCCESS`:
     - Update `subtitle_jobs`: `status = failed`, `finished_at = now`, `error_message = <stderr content>`
7. Calls `processNext()` recursively to process the next job

**`cancel(jobId)`**  
Finds the job in the queue array by `jobId`. If found (and not currently processing), removes it from the array and updates `subtitle_jobs` row: `status = cancelled`. Returns `true`. If not found, returns `false`.

**`getStatus()`**  
Returns the current in-memory queue state for use by `GET /api/subtitles/queue`.

### Important notes

- The queue is in-memory. If the Node server restarts, the in-memory queue is lost. However, any `queued` rows remaining in `subtitle_jobs` at server startup should be treated as stale and their status updated to `failed` with `error_message = "Server restarted before job could run"`. Add this cleanup step to the server startup logic in `server/index.js`.
- Timeout: If a Python process runs for more than **30 minutes**, kill it with `childProcess.kill()` and mark the job as `failed` with `error_message = "Timed out after 30 minutes"`.

---

## 8. Frontend Changes

### 8.1 New component: `SubtitleQueuePanel`

**File:** `client/src/components/Subtitles/SubtitleQueuePanel.jsx`

A floating panel (positioned bottom-right of the screen, above any other UI chrome) that shows the live queue status. It is only visible when there are active or recently completed jobs.

**Visual design** — matches the existing cartoon design system:
- Border: `2.5px solid var(--ink)`
- Box shadow: `4px 4px 0px var(--ink)`
- Border radius: `16px`
- Background: `var(--surface)`
- Width: `320px`
- Animated slide-in from bottom-right using Framer Motion when it first appears
- Animated slide-out when queue becomes empty and the panel is dismissed

**Content:**
- A header row: "🎙 Generating Subtitles" with a spinner icon while processing
- Currently processing job: lesson title, course name, animated pulsing indicator
- Queued jobs list (if any): lesson titles with position numbers and a ✕ cancel button per job
- Recently completed jobs (last 3): lesson title with ✅ (done) or ❌ (failed) icon

**Polling:**  
The component polls `GET /api/subtitles/queue` every **3 seconds** while visible. It stops polling when both `processing` is null and `queued` is empty.

**Placement:**  
Rendered in `App.jsx` outside the router, so it persists across page navigation.

---

### 8.2 Changes to `CoursePlayer.jsx`

**CC Button enhancement:**

The existing CC button in the player controls bar only shows when `subtitle_path` is not null. Add a second state to this button:

- `subtitle_path` is not null → existing behavior (CC button toggles subtitles on/off)
- `subtitle_path` is null AND no active/queued job for this lesson → show a "Generate CC" button (different styling — use `--text-muted` color and a ✨ icon to distinguish it from the active CC button)
- `subtitle_path` is null AND a job is queued or processing for this lesson → show a "Generating..." indicator (disabled, with a spinner) in place of the CC button

**"Generate CC" button behavior:**  
Clicking it calls `POST /api/subtitles/generate` with `{ lessonIds: [currentLessonId] }`. After the API responds, the button transitions to the "Generating..." state.

**After generation completes:**  
When the queue panel shows the job as `done`, the player should re-fetch the current lesson data from `GET /api/courses/:id` (or a targeted lesson endpoint) to pick up the newly populated `subtitle_path`. The CC button should then transition to its normal active state, and the subtitle track should become available without requiring a page reload.

---

### 8.3 Changes to `CurriculumSidebar.jsx` — `LessonItem.jsx`

Add a small subtitle status indicator to each lesson item in the sidebar:

- Lesson has a subtitle → show a small `CC` badge in `--success` green
- Lesson has no subtitle → no badge (don't clutter the sidebar)
- Lesson has an active/queued job → show a small animated spinner badge

This is purely informational. The badge should be small enough not to distract from the lesson title and duration.

---

### 8.4 Changes to `CourseDetail.jsx`

Add a **"Generate Missing Subtitles" section** to the Course Detail page, below the curriculum tree.

**Layout:**

- A card (styled consistently with other cards on the page) with the title "Subtitles"
- If all lessons have subtitles: show "✅ All lessons have subtitles"
- If some lessons are missing subtitles:
  - Show: "X lessons are missing subtitles"
  - List the missing lessons (lesson title + section path)
  - A primary button: "Generate All Missing Subtitles"
  - Clicking the button calls `POST /api/subtitles/generate` with all missing lesson IDs at once
  - After clicking, the button changes to "Added to Queue ✓" and the `SubtitleQueuePanel` appears

The missing lesson data comes from `GET /api/subtitles/missing/:courseId`, called when the Course Detail page loads.

---

### 8.5 Changes to `Settings.jsx`

Add a new **"Subtitles"** section to the Settings page (place it between the Preferences section and the Danger Zone).

**Content:**

- A heading: "AI Subtitle Generation"
- A short description: "Generate subtitles for lessons that don't have them. Uses Whisper (small model) running locally on your machine. Processing happens one video at a time in the background."
- A status indicator showing whether Python and Whisper are available:
  - This calls a new lightweight endpoint `GET /api/subtitles/check` on page load (see below)
  - ✅ "Whisper is ready" — if the check passes
  - ❌ "Whisper not found — run: `pip install openai-whisper torch`" — if the check fails
- A "View Queue" button that scrolls to or focuses the `SubtitleQueuePanel` if it is visible

### 8.6 New endpoint: `GET /api/subtitles/check`

Runs `python -c "import whisper; print('ok')"` via `child_process.execSync` with a 5-second timeout.

**Response if available:**
```json
{ "available": true }
```

**Response if not available:**
```json
{ "available": false, "reason": "Whisper not installed or Python not found" }
```

This is used only by the Settings page to show the readiness indicator. It does not need to be polled — call it once on Settings page mount.

---

## 9. File & Path Conventions

### Generated subtitle file naming

The generated `.srt` file is saved in the same directory as the video file, with the same base name and `.srt` extension.

Examples:

| Video file | Generated subtitle |
|---|---|
| `/courses/Python/01 - Intro.mp4` | `/courses/Python/01 - Intro.srt` |
| `/courses/React/Section 2/03_hooks.mkv` | `/courses/React/Section 2/03_hooks.srt` |

### Subtitle path stored in DB

The `subtitle_path` column stores the **absolute path** to the `.srt` file on disk, consistent with how `file_path` is stored for video files.

### Existing subtitle detection (scanner.js)

The existing scanner already checks for matching `.srt` files (Rule 7 in the PRD). The generated `.srt` file follows the exact same naming convention the scanner uses for matching, so if the user removes a course and re-adds it, the generated subtitle will be automatically picked up by the scanner and re-linked without needing to regenerate.

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| Python not installed | `GET /api/subtitles/check` returns `available: false`. Settings page shows an install instruction. Generate buttons are still shown but clicking them will result in a failed job with a clear error message in the queue panel. |
| Whisper not installed | Same as above |
| Video file no longer exists on disk when job starts | Job fails immediately with `error_message = "Video file not found at path: <path>"`. DB updated to `failed`. Next job in queue starts normally. |
| Disk full when writing `.srt` | Python script exits with a non-zero code. Node reads stderr, marks job as `failed` with the Python error as `error_message`. |
| User cancels a queued job | Job removed from in-memory queue. `subtitle_jobs` row updated to `cancelled`. No file is written. |
| Server restart with jobs in queue | On startup, all `queued` and `processing` rows in `subtitle_jobs` are updated to `status = failed` with `error_message = "Server restarted before job could run"`. The in-memory queue starts empty. |
| Python process exceeds 30-minute timeout | Node kills the child process. Job marked as `failed` with `error_message = "Timed out after 30 minutes"`. |
| `POST /api/subtitles/generate` called for a lesson that already has a subtitle | Lesson is silently skipped. Included in the `skipped` array of the response. |
| Whisper generates an empty transcript | Python script exits with code `0` but writes an empty or near-empty `.srt` file. Node marks the job as `done` and updates `subtitle_path` normally. The user will see the CC button but subtitles will appear empty — this is expected behavior for silent or music-only videos. |

All error messages shown in the `SubtitleQueuePanel` follow the existing cartoon toast/notification style: coral (`--secondary`) background, ink border, clear human-readable text.

---

## 11. Deliverable Checklist

- [ ] `server/whisper/generate.py` exists and accepts a video path as a CLI argument
- [ ] Python script writes a valid `.srt` file next to the video file on success
- [ ] Python script prints `SUCCESS:<path>` to stdout on success
- [ ] Python script prints a clear error to stderr and exits with code 1 on failure
- [ ] `subtitle_jobs` table is created automatically on first run in `server/db.js`
- [ ] Stale `queued`/`processing` jobs are marked `failed` on server startup
- [ ] `server/utils/subtitleQueue.js` implements enqueue, processNext, cancel, getStatus
- [ ] Queue processes jobs strictly one at a time — never two Python processes simultaneously
- [ ] 30-minute job timeout is implemented and kills the child process on trigger
- [ ] `server/routes/subtitles.js` implements all 5 routes: `POST /generate`, `GET /queue`, `DELETE /queue/:jobId`, `GET /missing/:courseId`, `GET /check`
- [ ] Route file is registered in `server/index.js`
- [ ] `POST /api/subtitles/generate` skips lessons that already have a subtitle or an active job
- [ ] After a job completes, `lessons.subtitle_path` is updated in the database
- [ ] `SubtitleQueuePanel` component renders in `App.jsx` outside the router
- [ ] Queue panel polls every 3 seconds while active, stops when queue is empty
- [ ] Queue panel is hidden when there are no active or recent jobs
- [ ] Queue panel shows currently processing job, queued jobs with cancel buttons, and recent completions
- [ ] Cancel button calls `DELETE /api/subtitles/queue/:jobId` and updates panel immediately
- [ ] Player CC button shows "Generate CC" state when lesson has no subtitle and no active job
- [ ] Player CC button shows "Generating..." state when a job is active for the current lesson
- [ ] Player reloads lesson data after job completes and activates the CC button without page reload
- [ ] Sidebar `LessonItem` shows CC badge for lessons with subtitles
- [ ] Sidebar `LessonItem` shows spinner badge for lessons with active jobs
- [ ] Course Detail page shows missing subtitle count and lesson list
- [ ] "Generate All Missing Subtitles" button on Course Detail queues all missing lessons at once
- [ ] Settings page shows Whisper availability status (calls `GET /api/subtitles/check` on mount)
- [ ] All new UI components follow the existing cartoon design system (ink borders, offset shadows, accent colors)
- [ ] All new UI components use Framer Motion for entrance/exit animations consistent with the rest of the app
- [ ] All error states are surfaced to the user with clear messages — no silent failures

---

*End of Feature PRD*