# Inkwell — Personal Local LMS

A fully local, personal Learning Management System for managing and watching video courses stored on your device.

## Quick Start

```bash
npm run install:all   # Install all dependencies (run once)
npm run dev           # Start both frontend and backend
```

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3001

## Features

- Scan local folders to import video courses automatically
- Custom video player with full controls and subtitle support
- Progress tracking — resumes where you left off
- Bookmarks with timestamps
- Per-lesson notes with auto-save
- Learning stats dashboard with weekly charts and streaks
- Cartoon / comic art design system

## Adding a Course

1. Click **+ Add Course** on the dashboard
2. Paste the absolute path to a folder containing video files
3. The scanner will recursively find all videos and build the curriculum

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS + Framer Motion + Zustand
- **Backend:** Node.js + Express + SQLite (better-sqlite3)
- **Charts:** Recharts

## Requirements

- Node.js 18+
- (Optional) `ffprobe` in PATH for instant duration detection — falls back gracefully to frontend detection if missing
