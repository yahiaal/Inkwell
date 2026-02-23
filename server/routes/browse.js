import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const router = Router();

/**
 * GET /api/browse-folder/list?path=X
 * Lists the direct children of the given path that are directories.
 * If no path given, returns the available drives (Windows) or / (Unix).
 */
router.get('/list', (req, res) => {
  const reqPath = req.query.path;

  try {
    // No path supplied → return drives on Windows, or root on Unix
    if (!reqPath) {
      const entries = getTopLevelEntries();
      return res.json({ path: null, entries });
    }

    const abs = path.resolve(reqPath);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: 'Path does not exist', code: 'PATH_NOT_FOUND' });
    }

    const stat = fs.statSync(abs);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory', code: 'NOT_A_DIRECTORY' });
    }

    const dirents = fs.readdirSync(abs, { withFileTypes: true });
    const entries = dirents
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({
        name: d.name,
        fullPath: path.join(abs, d.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    res.json({ path: abs, entries });
  } catch (err) {
    res.status(500).json({ error: err.message, code: 'FS_ERROR' });
  }
});

function getTopLevelEntries() {
  // Windows: list drive letters
  if (process.platform === 'win32') {
    try {
      const output = execSync('wmic logicaldisk get caption', { encoding: 'utf8', timeout: 3000 });
      const drives = output
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[A-Z]:$/.test(l));
      return drives.map((d) => ({ name: d + '\\', fullPath: d + '\\' }));
    } catch {
      return [{ name: 'C:\\', fullPath: 'C:\\' }];
    }
  }
  // Unix: start at root
  const entries = fs.readdirSync('/', { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => ({ name: d.name, fullPath: '/' + d.name }));
  return entries;
}

export default router;
