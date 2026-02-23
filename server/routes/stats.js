import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /api/stats/overview
router.get('/overview', (req, res) => {
  const totalMinutes = db.prepare('SELECT SUM(minutes_watched) as total FROM stats').get()?.total ?? 0;
  const totalLessonsCompleted = db.prepare('SELECT COUNT(*) as c FROM progress WHERE completed = 1').get()?.c ?? 0;
  const totalCourses = db.prepare('SELECT COUNT(*) as c FROM courses').get()?.c ?? 0;
  const totalCoursesCompleted = db.prepare("SELECT COUNT(*) as c FROM courses WHERE status = 'completed'").get()?.c ?? 0;

  // Calculate streak: consecutive days with stats entries
  const dates = db
    .prepare("SELECT DISTINCT date FROM stats WHERE minutes_watched > 0 ORDER BY date DESC")
    .all()
    .map((r) => r.date);

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  const today = new Date().toISOString().slice(0, 10);
  const dateSet = new Set(dates);

  // Current streak from today backwards
  let checkDate = new Date(today);
  while (true) {
    const d = checkDate.toISOString().slice(0, 10);
    if (dateSet.has(d)) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak ever
  const allDates = db
    .prepare("SELECT DISTINCT date FROM stats WHERE minutes_watched > 0 ORDER BY date ASC")
    .all()
    .map((r) => r.date);

  for (let i = 0; i < allDates.length; i++) {
    if (i === 0) {
      tempStreak = 1;
    } else {
      const prev = new Date(allDates[i - 1]);
      const curr = new Date(allDates[i]);
      const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) longestStreak = tempStreak;
  }

  res.json({
    totalHoursWatched: Math.round((totalMinutes / 60) * 10) / 10,
    totalLessonsCompleted,
    totalCourses,
    totalCoursesCompleted,
    currentStreak,
    longestStreak,
  });
});

// GET /api/stats/weekly — last 7 days
router.get('/weekly', (req, res) => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const rows = db.prepare(`
    SELECT date, SUM(minutes_watched) as minutes_watched, SUM(lessons_completed) as lessons_completed
    FROM stats
    WHERE date >= ?
    GROUP BY date
  `).all(days[0]);

  const rowMap = {};
  for (const row of rows) {
    rowMap[row.date] = row;
  }

  const result = days.map((date) => ({
    date,
    day: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    minutesWatched: rowMap[date]?.minutes_watched ?? 0,
    lessonsCompleted: rowMap[date]?.lessons_completed ?? 0,
  }));

  res.json(result);
});

// GET /api/stats/per-course
router.get('/per-course', (req, res) => {
  const courses = db.prepare('SELECT * FROM courses').all();

  const result = courses.map((course) => {
    const timeSpent = db
      .prepare('SELECT SUM(minutes_watched) as t FROM stats WHERE course_id = ?')
      .get(course.id)?.t ?? 0;
    const lessonsCompleted = db
      .prepare('SELECT COUNT(*) as c FROM progress WHERE course_id = ? AND completed = 1')
      .get(course.id)?.c ?? 0;
    const percentComplete =
      course.total_lessons > 0
        ? Math.round((lessonsCompleted / course.total_lessons) * 100)
        : 0;

    // Estimate remaining: based on average minutes per lesson × remaining lessons
    const remainingLessons = course.total_lessons - lessonsCompleted;
    let estRemainingDays = null;
    if (timeSpent > 0 && lessonsCompleted > 0) {
      const avgMinPerLesson = timeSpent / lessonsCompleted;
      const remainingMinutes = avgMinPerLesson * remainingLessons;
      // Assume ~30 min/day study pace
      const dailyMinutes = db
        .prepare("SELECT AVG(daily) as avg FROM (SELECT SUM(minutes_watched) as daily FROM stats GROUP BY date HAVING SUM(minutes_watched) > 0)")
        .get()?.avg ?? 30;
      estRemainingDays = Math.ceil(remainingMinutes / dailyMinutes);
    }

    return {
      courseId: course.id,
      title: course.title,
      timeSpentMinutes: timeSpent,
      lessonsCompleted,
      totalLessons: course.total_lessons,
      percentComplete,
      lastAccessed: course.last_accessed,
      estRemainingDays,
    };
  });

  res.json(result);
});

export default router;
