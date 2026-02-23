import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const router = Router();

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
};

// GET /api/video/:lessonId — HTTP range streaming (required for seeking)
router.get('/:lessonId', (req, res) => {
  const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(req.params.lessonId);
  if (!lesson) {
    return res.status(404).json({ error: 'Lesson not found', code: 'LESSON_NOT_FOUND' });
  }

  const filePath = lesson.file_path;

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video file not found on disk', code: 'VIDEO_FILE_MISSING' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'video/mp4';

  const rangeHeader = req.headers.range;

  if (!rangeHeader) {
    // No range — send the full file (fallback, shouldn't happen with a proper browser video element)
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Parse the Range header: "bytes=START-END"
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // Validate range
  if (start >= fileSize || end >= fileSize || start > end) {
    res.writeHead(416, {
      'Content-Range': `bytes */${fileSize}`,
    });
    return res.end();
  }

  const chunkSize = end - start + 1;

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': mimeType,
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
});

export default router;
