<div align="center">
  <img src="./Logo.png" alt="Inkwell Logo" width="450" style="border-radius: 24px; border: 4px solid #1a1a2e; box-shadow: 10px 10px 0px #1a1a2e;" />
  <h1>Inkwell</h1>
  <p><strong>Personal Local Learning Management System (LMS)</strong></p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![Local Only](https://img.shields.io/badge/Privacy-100%25_Local-brightgreen)](#)
  [![Built with AI](https://img.shields.io/badge/Built%20with-AI-%238A2BE2)](#)
</div>

---

> [!IMPORTANT]
> **Inkwell** is a fully local, personal Learning Management System designed to turn scattered video course folders into a structured, trackable learning environment with a cartoon-inspired aesthetic.

## Key Features

- **Cartoon Design System** - A bold, hand-drawn UI style with thick outlines and cel-shading.
- **Auto-Scan Magic** - Recursively imports video folders and builds a clean curriculum automatically.
- **Smart Lesson Resources** - Maps PDFs, HTML descriptions, links, images, text files, and other companion files to the right lesson, including Udemy-style numbered resources.
- **Resource Badges** - Shows a `RES` label in the lesson sidebar when a lesson has attached resources.
- **Pro Video Player** - Custom controls, HTTP range streaming for seamless seeking, and subtitle support.
- **Sidebar Completion Controls** - Mark any lesson as complete directly from the curriculum sidebar without opening the video.
- **Learning Stats** - Track daily streaks, hours watched, and weekly progress with charts.
- **Bookmarks & Notes** - Save exact timestamps and take per-lesson notes that auto-save while you learn.
- **100% Privacy** - Your data stays on your machine. No accounts, no cloud, no tracking.

## Quick Start (Windows)

Inkwell is zero-config and portable. Just download and run:

1. Double-click `start-inkwell.vbs` for a silent background start, or `start-inkwell.bat` to see the console.
2. The script will automatically install dependencies if they are missing.
3. Once ready, visit [http://localhost:5173](http://localhost:5173).

### Manual Start (Cross-Platform)

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
# Install everything: root, client, and server
npm run install:all

# Start the app
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)

> Re-scan an existing course folder after adding new resources so Inkwell can attach them to lessons.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React + Vite + Framer Motion |
| **Styling** | Tailwind CSS + Custom Comic Tokens |
| **State** | Zustand |
| **Database** | SQLite (better-sqlite3) |
| **Server** | Node.js + Express |

## Design Philosophy

Inkwell is a sketchbook for your learning. Every border is a thick ink line, every shadow is a solid offset, and every interaction is designed to feel tactile and alive.

---

<p align="center">
  Built by <b><a href="https://www.linkedin.com/in/yahia-z/">Yahia Almarafi</a></b> with the help of <b>AI</b>.
</p>
