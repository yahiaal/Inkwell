import { Router } from 'express';
import db from '../db.js';

const router = Router();

// POST /api/progress — upsert progress for a lesson
router.post('/', (req, res) => {
  const { lessonId, courseId, watchedSeconds, durationSeconds, completed } = req.body;

  if (!lessonId || !courseId) {
    return res.status(400).json({ error: 'lessonId and courseId are required', code: 'MISSING_FIELDS' });
  }

  const now = new Date().toISOString();
  const existing = db
    .prepare('SELECT * FROM progress WHERE course_id = ? AND lesson_id = ?')
    .get(courseId, lessonId);

  if (existing) {
    db.prepare(`
      UPDATE progress
      SET watched_seconds = ?, duration_seconds = COALESCE(?, duration_seconds),
          completed = MAX(completed, ?), last_watched = ?,
          watch_count = watch_count + CASE WHEN ? = 1 AND completed = 0 THEN 1 ELSE 0 END
      WHERE course_id = ? AND lesson_id = ?
    `).run(
      Math.round(watchedSeconds ?? existing.watched_seconds),
      durationSeconds != null ? Math.round(durationSeconds) : null,
      completed ? 1 : 0,
      now,
      completed ? 1 : 0,
      courseId,
      lessonId
    );
  } else {
    db.prepare(`
      INSERT INTO progress (course_id, lesson_id, watched_seconds, duration_seconds, completed, last_watched, watch_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      courseId,
      lessonId,
      Math.round(watchedSeconds ?? 0),
      durationSeconds != null ? Math.round(durationSeconds) : null,
      completed ? 1 : 0,
      now,
      completed ? 1 : 0
    );
  }

  // Update course status and last_accessed
  const total = db.prepare('SELECT total_lessons FROM courses WHERE id = ?').get(courseId)?.total_lessons ?? 0;
  const done = db.prepare('SELECT COUNT(*) as c FROM progress WHERE course_id = ? AND completed = 1').get(courseId)?.c ?? 0;
  const status = done === 0 ? 'not_started' : done >= total ? 'completed' : 'in_progress';
  db.prepare('UPDATE courses SET status = ?, last_accessed = ? WHERE id = ?').run(status, now, courseId);

  const record = db.prepare('SELECT * FROM progress WHERE course_id = ? AND lesson_id = ?').get(courseId, lessonId);
  res.json(record);
});

// GET /api/progress/:courseId — all progress for a course, keyed by lessonId
router.get('/:courseId', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM progress WHERE course_id = ?')
    .all(req.params.courseId);

  const map = {};
  for (const row of rows) {
    map[row.lesson_id] = row;
  }
  res.json(map);
});

// DELETE /api/progress/clear-all — wipe all progress and stats (danger zone)
router.delete('/clear-all', (req, res) => {
  db.prepare('DELETE FROM progress').run();
  db.prepare('DELETE FROM stats').run();
  db.prepare("UPDATE courses SET status = 'not_started', last_accessed = NULL").run();
  res.json({ ok: true });
});

// DELETE /api/progress/course/:courseId — reset progress for a specific course
router.delete('/course/:courseId', (req, res) => {
  const courseId = req.params.courseId;

  db.transaction(() => {
    // Delete progress rows
    db.prepare('DELETE FROM progress WHERE course_id = ?').run(courseId);

    // Reset course status
    db.prepare("UPDATE courses SET status = 'not_started', last_accessed = NULL WHERE id = ?").run(courseId);

    // Optional: Also clear bookmarks and notes if desired, but user asked for "progress"
    // Usually progress = watched state. I'll stick to progress and course status.
  })();

  res.json({ ok: true });
});

// POST /api/progress/log-session — log daily stats
router.post('/log-session', (req, res) => {
  const { courseId, minutesWatched, lessonsCompleted, date } = req.body;
  if (!courseId || !date) {
    return res.status(400).json({ error: 'courseId and date are required', code: 'MISSING_FIELDS' });
  }

  const existing = db
    .prepare('SELECT * FROM stats WHERE course_id = ? AND date = ?')
    .get(courseId, date);

  if (existing) {
    db.prepare(`
      UPDATE stats SET minutes_watched = minutes_watched + ?, lessons_completed = lessons_completed + ?
      WHERE course_id = ? AND date = ?
    `).run(minutesWatched ?? 0, lessonsCompleted ?? 0, courseId, date);
  } else {
    db.prepare(`
      INSERT INTO stats (date, minutes_watched, lessons_completed, course_id)
      VALUES (?, ?, ?, ?)
    `).run(date, minutesWatched ?? 0, lessonsCompleted ?? 0, courseId);
  }

  res.json({ ok: true });
});

// GET /api/progress/:courseId/resume — which lesson to resume from
router.get('/:courseId/resume', (req, res) => {
  const courseId = req.params.courseId;

  // Get all lessons for this course, ordered by sort_order
  const lessons = db
    .prepare('SELECT id, sort_order FROM lessons WHERE course_id = ? ORDER BY sort_order')
    .all(courseId);

  if (lessons.length === 0) {
    return res.json({ lessonId: null });
  }

  // Get all progress for this course
  const progressRows = db
    .prepare('SELECT lesson_id, completed, watched_seconds, last_watched FROM progress WHERE course_id = ?')
    .all(courseId);

  const progressMap = {};
  for (const row of progressRows) {
    progressMap[row.lesson_id] = row;
  }

  // Find the first incomplete lesson (by sort_order)
  for (const lesson of lessons) {
    const prog = progressMap[lesson.id];
    if (!prog || !prog.completed) {
      return res.json({ lessonId: lesson.id });
    }
  }

  // All lessons are completed — return the first lesson
  return res.json({ lessonId: lessons[0].id });
});

export default router;
