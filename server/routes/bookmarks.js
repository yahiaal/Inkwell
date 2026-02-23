import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/bookmarks/:courseId
router.get('/:courseId', (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, l.title as lesson_title, l.sort_order
    FROM bookmarks b
    JOIN lessons l ON b.lesson_id = l.id
    WHERE b.course_id = ?
    ORDER BY l.sort_order, b.timestamp_seconds
  `).all(req.params.courseId);
  res.json(rows);
});

// POST /api/bookmarks
router.post('/', (req, res) => {
  const { lessonId, courseId, timestampSeconds, label } = req.body;
  if (!lessonId || !courseId || timestampSeconds == null) {
    return res.status(400).json({ error: 'lessonId, courseId, and timestampSeconds are required', code: 'MISSING_FIELDS' });
  }

  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO bookmarks (course_id, lesson_id, timestamp_seconds, label, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(courseId, lessonId, Math.round(timestampSeconds), label ?? null, now);

  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(result.lastInsertRowid);
  res.json(bookmark);
});

// DELETE /api/bookmarks/:id
router.delete('/:id', (req, res) => {
  const bookmark = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(req.params.id);
  if (!bookmark) return res.status(404).json({ error: 'Bookmark not found', code: 'BOOKMARK_NOT_FOUND' });

  db.prepare('DELETE FROM bookmarks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
