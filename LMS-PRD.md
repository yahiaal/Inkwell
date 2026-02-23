# Product Requirements Document
# Personal Local Learning Management System (LMS)

**Version:** 1.0  
**Status:** Draft  
**Last Updated:** February 2026  

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Backend API](#6-backend-api)
7. [Folder Scanning Logic](#7-folder-scanning-logic)
8. [Pages & Features](#8-pages--features)
9. [Visual Design System](#9-visual-design-system)
10. [Implementation Details](#10-implementation-details)
11. [State Management](#11-state-management)
12. [Routing](#12-routing)
13. [Error Handling](#13-error-handling)
14. [Deliverable Checklist](#14-deliverable-checklist)

---

## 1. Product Overview

A fully local, personal Learning Management System for managing and watching video courses stored on your device. It is a self-hosted Udemy — but with richer analytics, personal note-taking, bookmarks, and full ownership of your data. Everything runs on your machine. No cloud, no accounts, no internet dependency after setup (except Google Fonts).

### Who is this for?

One person. The developer/owner running it locally. Not a multi-user platform.

### Core Value Proposition

You have video courses scattered across folders on your hard drive. This app turns those folders into a structured, trackable, searchable learning environment with a polished interface — without moving or converting any of your files.

---

## 2. Goals & Non-Goals

### Goals

- Read local video course folders recursively, to any depth
- Build a visual course curriculum from folder structure automatically
- Play videos with full custom controls and subtitle support
- Track progress per lesson and per course persistently
- Support bookmarks with timestamps and personal notes per lesson
- Provide a learning stats dashboard (streak, hours watched, pace)
- Support search across all courses and lessons
- Run with a single command: `npm run dev`

### Non-Goals

- Cloud sync or remote access
- Multi-user support
- Video uploading or transcoding
- Mobile app
- DRM or content protection

---

## 3. Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend framework | React + Vite | Component-based UI, fast dev server |
| Routing | React Router v6 | Page navigation |
| State management | Zustand | Lightweight global state |
| Styling | Tailwind CSS + custom CSS | Utility-first + cartoon design system |
| Animation | Framer Motion | Page transitions, spring animations |
| Charts | Recharts | Stats page bar charts |
| Backend | Node.js + Express | Local API server |
| Database | SQLite via `better-sqlite3` | Persistent local storage |
| Dev tooling | Concurrently + Nodemon | Single dev command, auto-restart |
| Code quality | ESLint + Prettier | Consistent formatting |

**Ports:**
- Frontend: `localhost:5173`
- Backend: `localhost:3001`

**Start command:** `npm run dev` from the project root (runs both servers concurrently)

---

## 4. Project Structure

```
/
├── client/                        # React + Vite frontend
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── CourseDetail.jsx
│       │   ├── CoursePlayer.jsx
│       │   ├── Stats.jsx
│       │   └── Settings.jsx
│       ├── components/
│       │   ├── Sidebar/
│       │   │   ├── CurriculumSidebar.jsx
│       │   │   ├── SectionHeader.jsx
│       │   │   └── LessonItem.jsx
│       │   ├── Player/
│       │   │   ├── VideoPlayer.jsx
│       │   │   ├── PlayerControls.jsx
│       │   │   ├── SeekBar.jsx
│       │   │   └── SpeedSelector.jsx
│       │   ├── Dashboard/
│       │   │   ├── CourseCard.jsx
│       │   │   ├── ContinueWatching.jsx
│       │   │   ├── AddCourseDialog.jsx
│       │   │   └── QuickStats.jsx
│       │   └── UI/
│       │       ├── Button.jsx
│       │       ├── Modal.jsx
│       │       ├── ProgressBar.jsx
│       │       ├── Badge.jsx
│       │       └── ShortcutsModal.jsx
│       ├── store/
│       │   ├── useCourseStore.js
│       │   ├── usePlayerStore.js
│       │   ├── useProgressStore.js
│       │   └── useUIStore.js
│       ├── hooks/
│       │   ├── useProgress.js
│       │   ├── useKeyboardShortcuts.js
│       │   └── useDebounce.js
│       └── utils/
│           ├── api.js
│           └── formatters.js
│
├── server/
│   ├── index.js                   # Express entry point
│   ├── db.js                      # SQLite setup and migrations
│   ├── routes/
│   │   ├── courses.js
│   │   ├── progress.js
│   │   ├── bookmarks.js
│   │   ├── notes.js
│   │   └── stats.js
│   └── utils/
│       └── scanner.js             # Folder scanning logic
│
├── data/
│   └── lms.db                     # SQLite database (auto-created on first run)
│
├── package.json                   # Root — concurrently scripts
└── README.md
```

---

## 5. Database Schema

All tables are created automatically on first run via migration in `db.js`.

### `courses`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| title | TEXT | Cleaned folder name |
| folder_path | TEXT UNIQUE | Absolute path to the folder on disk |
| date_added | TEXT | ISO timestamp |
| total_lessons | INTEGER | Set after scan |
| duration_seconds | INTEGER | Total course duration, nullable |
| thumbnail_path | TEXT | Nullable — first video frame or null |
| tags | TEXT | JSON array stored as string |
| personal_rating | INTEGER | 1–5, nullable |
| personal_review | TEXT | Nullable |
| status | TEXT | `not_started` / `in_progress` / `completed` |
| last_accessed | TEXT | ISO timestamp, nullable |

### `lessons`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| course_id | INTEGER FK | References courses.id |
| title | TEXT | Cleaned filename |
| file_path | TEXT | Absolute path to video file |
| subtitle_path | TEXT | Absolute path to .vtt or .srt, nullable |
| section_path | TEXT | Relative folder hierarchy string (e.g. `Section 1/Subsection A`) |
| depth_level | INTEGER | 0 = root, 1 = first subfolder, etc. |
| sort_order | INTEGER | Global flat order for prev/next navigation |
| duration_seconds | INTEGER | Nullable until detected |

### `progress`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| course_id | INTEGER FK | |
| lesson_id | INTEGER FK | |
| watched_seconds | INTEGER | Last known playback position |
| duration_seconds | INTEGER | Cached lesson duration |
| completed | INTEGER | Boolean (0/1) |
| last_watched | TEXT | ISO timestamp |
| watch_count | INTEGER | How many times lesson was opened |

### `bookmarks`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| course_id | INTEGER FK | |
| lesson_id | INTEGER FK | |
| timestamp_seconds | INTEGER | Exact timestamp in the video |
| label | TEXT | Optional user label |
| created_at | TEXT | ISO timestamp |

### `notes`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| course_id | INTEGER FK | |
| lesson_id | INTEGER FK | UNIQUE (one note per lesson) |
| content | TEXT | |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

### `stats`

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| date | TEXT | `YYYY-MM-DD` format |
| minutes_watched | INTEGER | |
| lessons_completed | INTEGER | |
| course_id | INTEGER FK | |

### `settings`

| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | Setting identifier |
| value | TEXT | Setting value (cast as needed in app) |

**Default settings to seed on first run:**

| Key | Default Value |
|---|---|
| `default_speed` | `1` |
| `auto_advance` | `true` |
| `completion_threshold` | `85` |
| `theme` | `dark` |

---

## 6. Backend API

Base URL: `http://localhost:3001/api`

All responses use JSON. Errors return `{ "error": "message", "code": "ERROR_CODE" }`.

### 6.1 Courses

| Method | Route | Description |
|---|---|---|
| `POST` | `/courses/scan` | Accepts `{ folderPath: string }`. Recursively scans folder, inserts course + all lessons into DB, returns full course object. |
| `GET` | `/courses` | Returns all courses with aggregate progress percentage and status. |
| `GET` | `/courses/:id` | Returns one course with full lesson tree (nested) and flat lesson list. |
| `PATCH` | `/courses/:id` | Update `title`, `tags`, `personal_rating`, `personal_review`. |
| `DELETE` | `/courses/:id` | Removes course and all related data (progress, bookmarks, notes). Does NOT delete files. |

### 6.2 Video & Subtitle Serving

| Method | Route | Description |
|---|---|---|
| `GET` | `/video/:lessonId` | Streams the video file with full HTTP range request support (required for seeking). Responds `206 Partial Content`. |
| `GET` | `/subtitle/:lessonId` | Serves subtitle file. Converts `.srt` to `.vtt` on the fly if needed. Returns `Content-Type: text/vtt`. |

### 6.3 Progress

| Method | Route | Description |
|---|---|---|
| `POST` | `/progress` | Upsert `{ lessonId, courseId, watchedSeconds, durationSeconds, completed }` |
| `GET` | `/progress/:courseId` | All progress records for a course, keyed by lesson ID. |
| `POST` | `/progress/log-session` | Log daily stats entry `{ courseId, minutesWatched, lessonsCompleted, date }` |

### 6.4 Bookmarks

| Method | Route | Description |
|---|---|---|
| `GET` | `/bookmarks/:courseId` | All bookmarks for a course. |
| `POST` | `/bookmarks` | Create `{ lessonId, courseId, timestampSeconds, label }` |
| `DELETE` | `/bookmarks/:id` | Delete a bookmark. |

### 6.5 Notes

| Method | Route | Description |
|---|---|---|
| `GET` | `/notes/:lessonId` | Get note for a lesson. Returns `null` if none. |
| `POST` | `/notes` | Create or update `{ lessonId, courseId, content }` (upsert by lessonId). |
| `DELETE` | `/notes/:id` | Delete a note. |

### 6.6 Stats

| Method | Route | Description |
|---|---|---|
| `GET` | `/stats/overview` | Returns `{ totalHoursWatched, totalLessonsCompleted, totalCourses, totalCoursesCompleted, currentStreak }` |
| `GET` | `/stats/weekly` | Last 7 days: `[{ date, minutesWatched, lessonsCompleted }]` |
| `GET` | `/stats/per-course` | Per-course breakdown: `[{ courseId, title, timeSpentMinutes, lessonsCompleted, percentComplete, lastAccessed }]` |

### 6.7 Settings

| Method | Route | Description |
|---|---|---|
| `GET` | `/settings` | Returns all settings as `{ key: value }` object. |
| `PATCH` | `/settings` | Update one or more settings `{ key: value, ... }` |

---

## 7. Folder Scanning Logic

> File: `server/utils/scanner.js`
> This is the most critical piece of backend logic.

### Rules

**Rule 1 — Full recursion, no depth limit.**
The scanner traverses the entire folder tree depth-first. There is no maximum depth. The depth level of each folder is tracked as an integer (root = 0, first subfolder = 1, etc.).

**Rule 2 — Folders become sections.**
Every subfolder is a section in the curriculum. Nested subfolders are nested subsections. A folder that contains only other folders (no direct videos) is a pure section header with no playable lesson of its own.

**Rule 3 — Videos are always leaves.**
A video file found in any folder belongs to that folder's section. Supported formats: `.mp4`, `.webm`, `.mkv`, `.mov`, `.avi`. Videos are never section parents.

**Rule 4 — Natural sort everywhere.**
Within any folder, sort all items (subfolders and files) by numeric prefix using natural sort — `10` comes after `2`, not before. If no numeric prefix, sort alphabetically. Apply this sort at every level of the tree.

**Rule 5 — Build a flat lesson list alongside the tree.**
While building the nested tree structure, assign each lesson a global `sort_order` integer in depth-first traversal sequence. This is the order used by the player for previous/next navigation — so N/P always moves correctly across section boundaries.

**Rule 6 — Clean displayed titles.**
Strip leading numbers, dashes, underscores, and dots from both folder names and filenames for display purposes. Examples:
- `01 - Introduction` → `Introduction`
- `003_my_lesson.mp4` → `My lesson`
- `Section.02.React.Basics` → `React Basics`

Capitalize the first letter. The raw filesystem path is always preserved internally as the actual file reference.

**Rule 7 — Subtitle matching.**
For each video file, search in the same folder for a file with the same base name and a `.vtt` or `.srt` extension. Match case-insensitively. If no exact match, attempt fuzzy match (same folder, filename shares the majority of words). If still no match, `subtitle_path` is `null` — handle this gracefully in the player.

**Rule 8 — Edge case handling.**

| Situation | Behavior |
|---|---|
| Empty folder | Silently ignored, not shown in sidebar |
| Folder with no videos anywhere in subtree | Silently ignored |
| Non-video, non-subtitle files (`.pdf`, `.txt`, etc.) | Silently skipped |
| Root folder has videos directly, no subfolders | One flat section, no section headers shown |

**Rule 9 — Duration extraction.**
After scanning, attempt to extract video duration using `ffprobe` via `child_process.execSync`. If `ffprobe` is not installed, set `duration_seconds` to `null`. The frontend will detect duration from the HTML5 `<video>` element's `loadedmetadata` event and report it back via `POST /api/progress`.

---

## 8. Pages & Features

### 8.1 Dashboard (`/`)

The main home screen. Composed of four areas:

**Quick Stats Strip** — displayed prominently at the top:
- Total courses added
- Total hours of content
- Hours watched this week
- Current daily learning streak

**Continue Watching** — horizontally scrollable row of the 3 most recently accessed in-progress courses. Each card shows: course title, thumbnail, progress bar (percentage), and a "Resume" button that deep-links directly to the last watched lesson.

**My Courses Grid** — all added courses in a responsive card grid. Each card shows: title, total lessons, total duration, progress percentage, tags, and a status badge (`Not Started` / `In Progress` / `Completed`). Clicking a card navigates to the Course Detail page.

**Add Course Button** — a prominent call-to-action button. Clicking opens a modal dialog where the user types or pastes a local folder path (e.g. `/Users/me/Courses/Python Bootcamp`). On submit, it calls `POST /api/courses/scan`. A loading spinner is shown during scanning. On success, the grid updates immediately.

---

### 8.2 Course Detail (`/course/:id`)

A dedicated overview page for a single course before entering the player.

**Sections:**

- Course title (editable inline)
- Tags (editable — add/remove tag chips)
- Personal rating (1–5 star component, clickable)
- Personal review (auto-saving textarea)
- Overall progress bar with "X of Y lessons completed"
- Full curriculum tree (read-only version of the sidebar component)
- "Start Course" or "Resume" button deep-linking to the appropriate lesson in the player
- All bookmarks for this course listed with their lesson name and timestamp — clicking one opens the player at that exact moment
- Course stats block: total lessons, total duration, time spent, estimated time remaining based on average watching pace

---

### 8.3 Course Player (`/course/:id/play/:lessonId`)

The main watching experience. Two-panel layout: curriculum sidebar on the left, video and content on the right.

#### Curriculum Sidebar

- Full nested tree mirroring the folder structure
- Each nesting depth level gets 16px additional left indent
- Top-level sections: bold, large, distinct background color per depth level to make hierarchy instantly readable
- Section headers are collapsible with an animated chevron (▶ rotates 90° when expanded)
- The section containing the active lesson is auto-expanded on load — all others are collapsed
- Each lesson item shows: lesson number, clean title, duration, completion checkmark if done
- Active lesson has accent color background fill
- Completed lessons show a bold checkmark badge
- Sidebar collapses to a toggle-able drawer on screens narrower than 768px

#### Video Player

The native `<video>` element is used with `controls` set to `false`. All controls are custom-built.

**Custom Controls Bar:**

| Control | Behavior |
|---|---|
| Play / Pause button | Toggle playback |
| Seek bar | Click and drag; shows buffered region as a lighter fill |
| Current time / Duration | `MM:SS / MM:SS` format |
| Volume slider + Mute toggle | Full range 0–100%; clicking speaker icon mutes/unmutes |
| Playback speed selector | Options: `0.5×`, `0.75×`, `1×`, `1.25×`, `1.5×`, `1.75×`, `2×`. Preference saved per course. |
| CC button | Only shown if a subtitle file exists for this lesson. Toggles subtitle track on/off. |
| Fullscreen button | Enter/exit fullscreen |
| Previous / Next lesson buttons | Jump to adjacent lesson in the flat sort order |

**Video source:** `http://localhost:3001/api/video/:lessonId` (HTTP range streaming)

**Subtitle:** Injected as a `<track>` element pointing to `http://localhost:3001/api/subtitle/:lessonId`

**Auto-behaviors:**
- Auto-advance to next lesson when video ends (if `auto_advance` setting is enabled)
- Progress saved to DB every 5 seconds via `POST /api/progress`
- A lesson is marked `completed = true` when `watched_seconds / duration_seconds >= completion_threshold` (default 85%)
- On lesson load, seek to `last watched_seconds` for this lesson automatically

#### Below the Player — Two Tabs

**Bookmarks Tab:**
- Lists all bookmarks for the current lesson
- Each bookmark shows timestamp (formatted `MM:SS`) and label
- Clicking a bookmark seeks the video to that timestamp
- "Add Bookmark" button captures current timestamp and prompts for an optional label
- Delete button per bookmark

**Notes Tab:**
- Single textarea for lesson notes
- Auto-saves 1 second after the user stops typing (debounced)
- Shows a "Saved" confirmation with timestamp after each save
- Note content persists in the database

#### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` | Seek −10 seconds |
| `→` | Seek +10 seconds |
| `↑` | Volume +10% |
| `↓` | Volume −10% |
| `N` | Next lesson |
| `P` | Previous lesson |
| `F` | Toggle fullscreen |
| `B` | Add bookmark at current timestamp |
| `?` | Open keyboard shortcuts modal |

---

### 8.4 Stats Page (`/stats`)

Personal learning analytics dashboard.

**Sections:**

**Weekly Activity Chart** — a bar chart (Recharts) showing minutes watched per day for the last 7 days. Bars use the accent color. X-axis shows day names (Mon, Tue, etc.).

**Streak & Highlights:**
- Current consecutive daily learning streak with a flame icon
- Longest streak ever
- Total all-time hours watched
- Total lessons completed
- Total courses finished

**Per-Course Breakdown Table:**

| Column | Description |
|---|---|
| Course | Title |
| Time Spent | Total minutes watched |
| Lessons Done | `X / Y` |
| Progress | Percentage bar |
| Last Accessed | Relative date |
| Est. Remaining | Days to finish at current pace |

---

### 8.5 Settings Page (`/settings`)

**Preferences:**
- Default playback speed (dropdown)
- Auto-advance to next lesson (toggle)
- Lesson completion threshold (slider, 50%–100%, default 85%)
- Theme toggle (Light / Dark — both in cartoon style)

**Reference:**
- Keyboard shortcuts reference table (always visible, not behind a modal here)

**Danger Zone:**
- "Clear All Progress Data" — opens a confirmation dialog before wiping the `progress` and `stats` tables. Does not remove courses or notes.
- "Remove All Courses" — removes everything from the database. Files on disk are untouched.

---

## 9. Visual Design System

This is not a theme applied on top of the app — it is the app's core identity. Every component must reflect the cartoon / comic art aesthetic.

### 9.1 Core Principles

- Every bordered element has a **thick solid ink outline**: `border: 2.5px solid #1a1a2e`. This is the "ink line" that defines cartoon style. Never remove this from any visible element.
- Depth is created with **offset solid box-shadows only**: `box-shadow: 4px 4px 0px #1a1a2e`. Never use blurred box-shadows for elevation or depth. No `blur` value in shadows.
- No glass morphism. No frosted glass. Flat colors with cel-shading only (a single linear gradient on a shape simulating one directional light source).

### 9.2 Color Tokens

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#1b1f3b` | Main app background |
| `--surface` | `#fdf6e3` | Cards, panels, content areas |
| `--surface-alt` | `#f5edd8` | Slightly darker cream for nested surfaces |
| `--accent` | `#f5a623` | Primary accent — buttons, active state, highlights |
| `--accent-hover` | `#e09415` | Accent on hover |
| `--secondary` | `#ff6b6b` | Coral — destructive actions, secondary badges |
| `--success` | `#2ecc71` | Completed lesson indicators |
| `--ink` | `#1a1a2e` | All borders and shadows |
| `--text` | `#2c2c3e` | Primary text |
| `--text-muted` | `#7a7a9a` | Secondary / muted text |

**Section depth colors for sidebar background tints (applied per depth level):**

| Depth | Background |
|---|---|
| 0 (top-level) | `#fde8b0` |
| 1 | `#fdf6e3` |
| 2+ | `#f5edd8` |

### 9.3 Typography

| Role | Font | Weight | Usage |
|---|---|---|---|
| Display | Baloo 2 | 700–800 | App logo, page headings, section titles, stat numbers |
| Body | Nunito | 400–600 | Lesson titles, body text, labels, notes, UI labels |

Import via Google Fonts in `client/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@400;500;600&display=swap" rel="stylesheet">
```

### 9.4 Component Specifications

**Buttons:**
- Border: `2.5px solid var(--ink)`
- Border radius: `12px`
- Box shadow: `4px 4px 0px var(--ink)`
- Hover: `transform: translate(2px, 2px)` + shadow reduces to `2px 2px 0px var(--ink)`
- Active/click: `transform: translate(4px, 4px)` + shadow `0px 0px 0px var(--ink)`
- Transition: `all 80ms ease`
- Variants: Primary (accent background), Destructive (coral background), Ghost (transparent + ink border)

**Cards (Course cards, lesson items):**
- Border radius: `16px–20px`
- Border: `2.5px solid var(--ink)`
- Box shadow: `4px 4px 0px var(--ink)`
- Hover: `transform: translateY(-2px)` + shadow grows to `6px 6px 0px var(--ink)`
- Transition: `all 120ms ease`

**Active lesson in sidebar:**
- Background: `var(--accent)`
- Border: `2.5px solid var(--ink)`

**Sidebar section headers:**
- Background: depth-tinted color (see Section 9.2)
- Border bottom: `2px solid var(--ink)`
- Chevron: ▶ rotates `90deg` when section is expanded, CSS `transition: transform 200ms ease`
- Collapse/expand: animate via `max-height` transition

**Progress bars:**
- Thick ink border around the track: `2px solid var(--ink)`
- Fill color: `var(--accent)`
- Fill animation: `transition: width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)` (overshoot spring)

**Inputs & Textareas:**
- Border: `2.5px solid var(--ink)`
- Border radius: `10px`
- Box shadow: `3px 3px 0px var(--ink)`
- Focus: shadow grows to `5px 5px 0px var(--ink)`, no default browser outline

### 9.5 Animation Specifications

All animations use **Framer Motion** unless noted as pure CSS.

| Element | Animation |
|---|---|
| Page transitions | Slide + fade between routes (`x: 20 → 0`, `opacity: 0 → 1`, 200ms) |
| Dashboard course cards | Staggered fade-in on load (`staggerChildren: 0.06s`) |
| Sidebar lesson items | Stagger slide-in from left (`x: -16 → 0`, `staggerChildren: 0.04s`) |
| Progress bar fill | CSS `cubic-bezier(0.34, 1.56, 0.64, 1)` — spring overshoot |
| Button press | Spring physics (`stiffness: 400, damping: 17`) |
| Section collapse/expand | `max-height` CSS transition, `300ms ease-in-out` |
| Section header first render | Scale pop (`scale: 0.95 → 1.0`, spring) |
| Stats count-up numbers | Count-up on page enter using Framer Motion `useMotionValue` |

### 9.6 Background Texture

Apply a subtle repeating dot grid pattern to the main `--bg` background via an inline SVG `background-image` at `4%` opacity. This gives a hand-drawn sketchbook feel without visual weight.

```css
background-image: url("data:image/svg+xml,%3Csvg width='20' height='20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='2' cy='2' r='1' fill='white'/%3E%3C/svg%3E");
background-size: 20px 20px;
```

### 9.7 Custom Scrollbar (All Scrollable Areas)

```css
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: var(--surface-alt); border: 2px solid var(--ink); border-radius: 8px; }
::-webkit-scrollbar-thumb { background: var(--accent); border: 2px solid var(--ink); border-radius: 8px; }
```

---

## 10. Implementation Details

### 10.1 HTTP Range Video Streaming

The Express video route **must** implement HTTP range requests correctly. Without this, the HTML5 `<video>` element cannot seek to arbitrary positions.

Required implementation in `GET /api/video/:lessonId`:
1. Read the `Range` header from the request
2. Parse the byte range: `bytes=START-END`
3. Respond with `206 Partial Content`
4. Set headers: `Content-Range: bytes START-END/TOTAL`, `Accept-Ranges: bytes`, `Content-Length: CHUNK_SIZE`
5. Pipe only the requested byte range using `fs.createReadStream(path, { start, end })`

### 10.2 SRT to VTT Conversion

Pure JavaScript function used in the subtitle API route:

```js
function srtToVtt(srtString) {
  return 'WEBVTT\n\n' + srtString
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}
```

### 10.3 Progress Auto-Save

In the player, use a `setInterval` every 5 seconds to call `POST /api/progress` with the current `video.currentTime`. Additionally save on pause and on lesson change. Mark a lesson complete when `currentTime / duration >= completionThreshold`.

### 10.4 Notes Auto-Save

Debounce the textarea `onChange` handler by 1000ms. On the debounced callback, call `POST /api/notes`. Show a "Saved ✓" indicator that fades out after 2 seconds.

### 10.5 Lesson Duration from Frontend

When a video's `loadedmetadata` event fires and `duration_seconds` is `null` in the DB, immediately call `PATCH /api/courses/:id/lesson/:lessonId` with `{ durationSeconds: video.duration }` to persist it.

---

## 11. State Management

Four Zustand stores:

**`useCourseStore`**
- Current course data
- Nested lesson tree
- Flat ordered lesson list (for prev/next navigation)
- Actions: `setCourse`, `clearCourse`

**`usePlayerStore`**
- Current lesson object
- `isPlaying` boolean
- `currentTime` (seconds)
- `volume` (0–1)
- `playbackSpeed`
- `subtitlesEnabled` boolean
- Actions: `setLesson`, `setPlaying`, `setTime`, `setVolume`, `setSpeed`, `toggleSubtitles`

**`useProgressStore`**
- Map of `{ [lessonId]: { watchedSeconds, completed } }` for the active course
- Actions: `setProgress`, `markComplete`, `loadProgress`

**`useUIStore`**
- `sidebarOpen` boolean
- `activeModal` string or null
- `theme` (`light` / `dark`)
- Actions: `toggleSidebar`, `openModal`, `closeModal`, `setTheme`

---

## 12. Routing

| Path | Component | Description |
|---|---|---|
| `/` | `Dashboard` | Home — course library and stats strip |
| `/course/:id` | `CourseDetail` | Course overview, curriculum tree, bookmarks list |
| `/course/:id/play/:lessonId` | `CoursePlayer` | Video player with sidebar |
| `/stats` | `Stats` | Learning analytics |
| `/settings` | `Settings` | User preferences |

Use `<Navigate>` to redirect unknown paths back to `/`.

---

## 13. Error Handling

| Scenario | Behavior |
|---|---|
| Folder path no longer exists at playback | Friendly cartoon-styled error card with instructions to re-add the course |
| `ffprobe` not installed | Silent fallback — duration detected by frontend from `<video>` metadata event |
| File System Access API not supported | Banner message on dashboard explaining Chrome/Edge is required |
| Video file missing for a lesson | Lesson item shown in sidebar with a "File not found" indicator; clicking shows an inline error |
| API request fails | Toast notification in accent/coral color with error message; no full-page crashes |
| Empty course folder | Show friendly empty state in course library with a prompt to add a course |

All API error responses follow a consistent shape:
```json
{
  "error": "Human-readable error message",
  "code": "SCREAMING_SNAKE_CASE_CODE"
}
```

---

## 14. Deliverable Checklist

The completed implementation must satisfy all of the following before it is considered done:

- [ ] `npm install` from root installs all dependencies (client + server) without errors
- [ ] `npm run dev` starts both frontend and backend concurrently
- [ ] Folder scanning works for flat courses, one-level deep, and deeply nested (5+ levels) folder structures
- [ ] Natural sort is applied correctly at every level of the scan
- [ ] Videos play in Chrome and Edge without seeking issues (range requests working)
- [ ] Subtitle auto-loading works for both `.vtt` and `.srt` files
- [ ] Progress saves every 5 seconds and resumes on re-open
- [ ] Lesson completion triggers at the configured threshold
- [ ] Bookmarks create, display, and seek correctly
- [ ] Notes auto-save with debounce and show confirmation
- [ ] Dashboard shows Continue Watching, course grid, and quick stats
- [ ] Stats page shows weekly chart, streak, and per-course table
- [ ] All settings persist via the database
- [ ] All keyboard shortcuts work in the player
- [ ] Sidebar collapses on screens narrower than 768px
- [ ] Cartoon design system is applied consistently across all pages and components
- [ ] All animations are implemented (stagger, spring, page transitions, progress bar overshoot)
- [ ] No placeholder components, no TODOs, no commented-out code blocks
- [ ] Error states are handled gracefully with user-facing messages

---

*End of PRD*
