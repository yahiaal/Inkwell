import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { QuickStats } from '../components/Dashboard/QuickStats.jsx';
import { ContinueWatching } from '../components/Dashboard/ContinueWatching.jsx';
import { CourseCard } from '../components/Dashboard/CourseCard.jsx';
import { AddCourseDialog } from '../components/Dashboard/AddCourseDialog.jsx';
import { Button } from '../components/UI/Button.jsx';
import { LoadingSpinner } from '../components/UI/LoadingSpinner.jsx';
import { api } from '../utils/api.js';
import useUIStore from '../store/useUIStore.js';

export default function Dashboard() {
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [coursesData, statsData] = await Promise.all([
        api.courses.list(),
        api.stats.overview(),
      ]);
      setCourses(coursesData);
      setStats(statsData);
    } catch (err) {
      addToast('Failed to load courses: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const inProgress = courses
    .filter((c) => c.status === 'in_progress')
    .sort((a, b) => (b.last_accessed ?? '').localeCompare(a.last_accessed ?? ''))
    .slice(0, 3);

  const handleCourseAdded = () => {
    fetchData();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{ fontSize: '2.2rem', color: 'var(--surface)', lineHeight: 1 }}
          >
            My Courses
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Your personal learning library
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAddDialog(true)}>
          + Add Course
        </Button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner size={40} style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <QuickStats stats={stats} />

          {/* Continue Watching */}
          <ContinueWatching courses={inProgress} />

          {/* Course Grid */}
          <section>
            <h2
              className="font-display"
              style={{ fontSize: '1.4rem', color: 'var(--surface)', marginBottom: '1rem' }}
            >
              All Courses
            </h2>

            {courses.length === 0 ? (
              /* Empty state */
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="card-flat"
                style={{
                  backgroundColor: 'var(--surface)',
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                }}
              >
                <div style={{ fontSize: '4rem' }}>📂</div>
                <h3
                  className="font-display"
                  style={{ fontSize: '1.4rem', color: 'var(--text)' }}
                >
                  No courses yet
                </h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.5 }}>
                  Add your first course by pointing to a folder on your computer that contains video files.
                </p>
                <Button variant="primary" onClick={() => setShowAddDialog(true)}>
                  + Add Your First Course
                </Button>
              </motion.div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {courses.map((course, i) => (
                  <CourseCard key={course.id} course={course} index={i} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <AddCourseDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleCourseAdded}
      />
    </div>
  );
}
