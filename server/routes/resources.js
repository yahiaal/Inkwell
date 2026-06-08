import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';

const router = Router();

const MIME_TYPES = {
  '.bmp': 'image/bmp',
  '.csv': 'text/csv; charset=utf-8',
  '.gif': 'image/gif',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.url': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.zip': 'application/zip',
};

function readShortcutUrl(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^URL=(.+)$/im);
  if (!match) return null;

  try {
    const url = new URL(match[1].trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

router.get('/:resourceId', (req, res) => {
  const resource = db.prepare('SELECT * FROM lesson_resources WHERE id = ?').get(req.params.resourceId);
  if (!resource) {
    return res.status(404).json({ error: 'Resource not found', code: 'RESOURCE_NOT_FOUND' });
  }

  if (!fs.existsSync(resource.file_path)) {
    return res.status(404).json({ error: 'Resource file not found on disk', code: 'RESOURCE_FILE_MISSING' });
  }

  const ext = path.extname(resource.file_path).toLowerCase();
  const fileName = path.basename(resource.file_path);
  const disposition = req.query.download === '1' ? 'attachment' : 'inline';

  if (ext === '.url' && req.query.download !== '1') {
    const shortcutUrl = readShortcutUrl(resource.file_path);
    if (shortcutUrl) return res.redirect(shortcutUrl);
  }

  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${fileName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (ext === '.html' || ext === '.htm') {
    res.setHeader('Content-Security-Policy', 'sandbox');
  }

  res.sendFile(resource.file_path);
});

export default router;
