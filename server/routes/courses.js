import { Router } from 'express';
import path from 'path';
import db from '../db.js';
import { scanCourseFolder } from '../utils/scanner.js';

const router = Router();

function attachResources(lessons) {
  if (lessons.length === 0) return lessons;

  const resources = db.prepare(`
    SELECT * FROM lesson_resources
    WHERE lesson_id IN (${lessons.map(() => '?').join(',')})
    ORDER BY sort_order, name
  `).all(...lessons.map((lesson) => lesson.id));

  const byLesson = new Map();
  for (const resource of resources) {
    const list = byLesson.get(resource.lesson_id) ?? [];
    list.push(resource);
    byLesson.set(resource.lesson_id, list);
  }

  return lessons.map((lesson) => ({
    ...lesson,
    resources: byLesson.get(lesson.id) ?? [],
  }));
}

// POST /api/courses/scan
router.post('/scan', (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath || typeof folderPath !== 'string') {
    return res.status(400).json({ error: 'folderPath is required', code: 'MISSING_FOLDER_PATH' });
  }

  const absPath = path.resolve(folderPath);

  try {
    const { flatLessons } = scanCourseFolder(absPath);

    if (flatLessons.length === 0) {
      return res.status(400).json({ error: 'No video files found in this folder', code: 'EMPTY_FOLDER' });
    }

    // Derive course title from the folder name
    const folderName = path.basename(absPath);
    const title = folderName
      .replace(/^[\d]+[\s._\-–—]+/, '')
      .replace(/[._]+/g, ' ')
      .trim();

    const now = new Date().toISOString();
    const totalDuration = flatLessons.reduce(
      (sum, l) => (l.duration_seconds ? sum + l.duration_seconds : sum),
      0
    );

    // Upsert course (update if folder already added)
    const existing = db.prepare('SELECT id FROM courses WHERE folder_path = ?').get(absPath);

    let courseId;
    if (existing) {
      db.prepare(`
        UPDATE courses SET title = ?, total_lessons = ?, duration_seconds = ?, status = 'not_started', last_accessed = NULL
        WHERE folder_path = ?
      `).run(title || folderName, flatLessons.length, totalDuration || null, absPath);
      courseId = existing.id;

      // Remove old lessons (cascade deletes progress, bookmarks, notes)
      db.prepare('DELETE FROM lessons WHERE course_id = ?').run(courseId);
    } else {
      const result = db.prepare(`
        INSERT INTO courses (title, folder_path, date_added, total_lessons, duration_seconds, tags, status)
        VALUES (?, ?, ?, ?, ?, '[]', 'not_started')
      `).run(title || folderName, absPath, now, flatLessons.length, totalDuration || null);
      courseId = result.lastInsertRowid;
    }

    // Insert lessons and their attached resources
    const insertLesson = db.prepare(`
      INSERT INTO lessons (course_id, title, file_path, subtitle_path, section_path, depth_level, sort_order, duration_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertResource = db.prepare(`
      INSERT INTO lesson_resources (lesson_id, name, file_path, file_type, size_bytes, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertAllLessons = db.transaction(() => {
      for (const lesson of flatLessons) {
        const result = insertLesson.run(
          courseId,
          lesson.title,
          lesson.file_path,
          lesson.subtitle_path,
          lesson.section_path,
          lesson.depth_level,
          lesson.sort_order,
          lesson.duration_seconds
        );

        for (const resource of lesson.resources ?? []) {
          insertResource.run(
            result.lastInsertRowid,
            resource.name,
            resource.file_path,
            resource.file_type,
            resource.size_bytes,
            resource.sort_order
          );
        }
      }
    });
    insertAllLessons();

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
    const lessons = attachResources(db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order').all(courseId));

    return res.json({ ...course, tags: JSON.parse(course.tags || '[]'), lessons });
  } catch (err) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: err.message, code: 'SCAN_FAILED' });
  }
});

// GET /api/courses
router.get('/', (req, res) => {
  const courses = db.prepare('SELECT * FROM courses ORDER BY last_accessed DESC, date_added DESC').all();

  const result = courses.map((course) => {
    const totalLessons = course.total_lessons || 0;
    const completedLessons = db
      .prepare('SELECT COUNT(*) as c FROM progress WHERE course_id = ? AND completed = 1')
      .get(course.id)?.c ?? 0;
    const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    return {
      ...course,
      tags: JSON.parse(course.tags || '[]'),
      progress,
      completed_lessons: completedLessons,
    };
  });

  res.json(result);
});

// GET /api/courses/:id
router.get('/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'COURSE_NOT_FOUND' });

  const lessons = attachResources(
    db.prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order')
      .all(course.id)
  );

  // Build nested tree from flat lesson list
  const tree = buildTree(lessons);

  const completedLessons = db
    .prepare('SELECT COUNT(*) as c FROM progress WHERE course_id = ? AND completed = 1')
    .get(course.id)?.c ?? 0;
  const progress =
    course.total_lessons > 0
      ? Math.round((completedLessons / course.total_lessons) * 100)
      : 0;

  res.json({
    ...course,
    tags: JSON.parse(course.tags || '[]'),
    lessons,
    tree,
    progress,
    completed_lessons: completedLessons,
  });
});

// PATCH /api/courses/:id
router.patch('/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'COURSE_NOT_FOUND' });

  const { title, tags, personal_rating, personal_review } = req.body;
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (tags !== undefined) updates.tags = JSON.stringify(tags);
  if (personal_rating !== undefined) updates.personal_rating = personal_rating;
  if (personal_review !== undefined) updates.personal_review = personal_review;

  if (Object.keys(updates).length === 0) {
    return res.json({ ...course, tags: JSON.parse(course.tags || '[]') });
  }

  const setClauses = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  db.prepare(`UPDATE courses SET ${setClauses} WHERE id = ?`).run(
    ...Object.values(updates),
    course.id
  );

  const updated = db.prepare('SELECT * FROM courses WHERE id = ?').get(course.id);
  res.json({ ...updated, tags: JSON.parse(updated.tags || '[]') });
});

// PATCH /api/courses/:id/lesson/:lessonId — update lesson duration from frontend
router.patch('/:id/lesson/:lessonId', (req, res) => {
  const { durationSeconds } = req.body;
  if (durationSeconds == null) return res.status(400).json({ error: 'durationSeconds required', code: 'MISSING_DURATION' });

  db.prepare('UPDATE lessons SET duration_seconds = ? WHERE id = ? AND course_id = ?').run(
    Math.round(durationSeconds),
    req.params.lessonId,
    req.params.id
  );

  // Recompute total course duration
  const total = db
    .prepare('SELECT SUM(duration_seconds) as total FROM lessons WHERE course_id = ?')
    .get(req.params.id);
  db.prepare('UPDATE courses SET duration_seconds = ? WHERE id = ?').run(
    total?.total || null,
    req.params.id
  );

  res.json({ ok: true });
});

// DELETE /api/courses/:id
router.delete('/:id', (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found', code: 'COURSE_NOT_FOUND' });

  db.prepare('DELETE FROM courses WHERE id = ?').run(course.id);
  res.json({ ok: true });
});

/**
 * Build a nested section tree from a flat lessons array.
 * Groups lessons by their section_path.
 */
function buildTree(lessons) {
  const root = { sections: {}, lessons: [] };

  for (const lesson of lessons) {
    if (!lesson.section_path) {
      root.lessons.push(lesson);
      continue;
    }

    const parts = lesson.section_path.split('/');
    let node = root;
    for (const part of parts) {
      if (!node.sections[part]) {
        node.sections[part] = { name: part, sections: {}, lessons: [] };
      }
      node = node.sections[part];
    }
    node.lessons.push(lesson);
  }

  return normalizeTree(root);
}

function normalizeTree(node) {
  return {
    name: node.name || null,
    lessons: node.lessons,
    sections: Object.values(node.sections).map(normalizeTree),
  };
}

export default router;
