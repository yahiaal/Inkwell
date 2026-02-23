import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

/**
 * GET /api/browse-folder/list?path=X
 * Lists subdirectories of the given path.
 * If no path, returns drives (Windows) or root dirs (Unix).
 */
router.get('/list', (req, res) => {
  const reqPath = req.query.path;

  try {
    if (!reqPath) {
      const entries = getTopLevelEntries();
      return res.json({ path: null, entries });
    }

    const abs = path.resolve(reqPath);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: 'Path does not exist' });
    }

    const stat = fs.statSync(abs);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const dirents = fs.readdirSync(abs, { withFileTypes: true });
    const entries = dirents
      .filter((d) => {
        try {
          return d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('$');
        } catch {
          return false;
        }
      })
      .map((d) => ({
        name: d.name,
        fullPath: path.join(abs, d.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    res.json({ path: abs, entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/browse-folder/quick-access
 * Returns common user folders (Desktop, Documents, Downloads, etc.)
 */
router.get('/quick-access', (_req, res) => {
  const home = os.homedir();
  const candidates = [
    { name: 'Desktop', fullPath: path.join(home, 'Desktop') },
    { name: 'Documents', fullPath: path.join(home, 'Documents') },
    { name: 'Downloads', fullPath: path.join(home, 'Downloads') },
    { name: 'Videos', fullPath: path.join(home, 'Videos') },
    { name: 'Home', fullPath: home },
  ];

  const results = candidates.filter((c) => {
    try {
      return fs.statSync(c.fullPath).isDirectory();
    } catch {
      return false;
    }
  });

  res.json({ entries: results });
});

function getTopLevelEntries() {
  if (process.platform === 'win32') {
    // Probe drive letters A-Z directly — much more reliable than wmic
    const drives = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const drivePath = letter + ':\\';
      try {
        fs.accessSync(drivePath);
        drives.push({ name: drivePath, fullPath: drivePath });
      } catch {
        // Drive doesn't exist or isn't accessible
      }
    }
    return drives.length > 0 ? drives : [{ name: 'C:\\', fullPath: 'C:\\' }];
  }

  // Unix
  const entries = fs.readdirSync('/', { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({ name: d.name, fullPath: '/' + d.name }));
  return entries;
}

export default router;
