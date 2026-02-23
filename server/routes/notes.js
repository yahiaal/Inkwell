import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/notes/:lessonId
router.get('/:lessonId', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE lesson_id = ?').get(req.params.lessonId);
  res.json(note ?? null);
});

// POST /api/notes — create or update (upsert by lessonId)
router.post('/', (req, res) => {
  const { lessonId, courseId, content } = req.body;
  if (!lessonId || !courseId) {
    return res.status(400).json({ error: 'lessonId and courseId are required', code: 'MISSING_FIELDS' });
  }

  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM notes WHERE lesson_id = ?').get(lessonId);

  if (existing) {
    db.prepare('UPDATE notes SET content = ?, updated_at = ? WHERE lesson_id = ?').run(
      content ?? '',
      now,
      lessonId
    );
  } else {
    db.prepare(`
      INSERT INTO notes (course_id, lesson_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(courseId, lessonId, content ?? '', now, now);
  }

  const note = db.prepare('SELECT * FROM notes WHERE lesson_id = ?').get(lessonId);
  res.json(note);
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found', code: 'NOTE_NOT_FOUND' });

  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
