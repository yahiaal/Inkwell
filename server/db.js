import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || '../data/lms.db');

// Ensure the data directory exists before opening the DB connection
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS courses (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    title            TEXT NOT NULL,
    folder_path      TEXT NOT NULL UNIQUE,
    date_added       TEXT NOT NULL,
    total_lessons    INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    thumbnail_path   TEXT,
    tags             TEXT DEFAULT '[]',
    personal_rating  INTEGER,
    personal_review  TEXT,
    status           TEXT NOT NULL DEFAULT 'not_started',
    last_accessed    TEXT
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title            TEXT NOT NULL,
    file_path        TEXT NOT NULL,
    subtitle_path    TEXT,
    section_path     TEXT NOT NULL DEFAULT '',
    depth_level      INTEGER NOT NULL DEFAULT 0,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER
  );

  CREATE TABLE IF NOT EXISTS progress (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id        INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id        INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    watched_seconds  INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    completed        INTEGER NOT NULL DEFAULT 0,
    last_watched     TEXT,
    watch_count      INTEGER NOT NULL DEFAULT 0,
    UNIQUE(course_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id         INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id         INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    timestamp_seconds INTEGER NOT NULL,
    label             TEXT,
    created_at        TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    lesson_id  INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE UNIQUE,
    content    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stats (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    date              TEXT NOT NULL,
    minutes_watched   INTEGER NOT NULL DEFAULT 0,
    lessons_completed INTEGER NOT NULL DEFAULT 0,
    course_id         INTEGER REFERENCES courses(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subtitle_jobs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id     INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'queued',
    created_at    TEXT NOT NULL,
    started_at    TEXT,
    finished_at   TEXT,
    error_message TEXT,
    output_path   TEXT
  );
`);

// Seed default settings (INSERT OR IGNORE so existing values are preserved)
const defaultSettings = [
  ['default_speed', '1'],
  ['auto_advance', 'true'],
  ['completion_threshold', '85'],
  ['theme', 'dark'],
];

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
const seedSettings = db.transaction(() => {
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }
});
seedSettings();

export default db;
