import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const router = Router();

function srtToVtt(srtString) {
  return (
    'WEBVTT\n\n' +
    srtString
      .replace(/\r\n/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  );
}

// GET /api/subtitle/:lessonId
router.get('/:lessonId', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found', code: 'LESSON_NOT_FOUND' });
  }
  if (!lesson.subtitle_path) {
    return res.status(404).json({ error: 'No subtitle for this lesson', code: 'NO_SUBTITLE' });
  }
  if (!fs.existsSync(lesson.subtitle_path)) {
    return res.status(404).json({ error: 'Subtitle file not found on disk', code: 'SUBTITLE_FILE_MISSING' });
  }

  const ext = path.extname(lesson.subtitle_path).toLowerCase();
  const content = fs.readFileSync(lesson.subtitle_path, 'utf8');

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (ext === '.srt') {
    res.send(srtToVtt(content));
  } else {
    res.send(content);
  }
});

export default router;
