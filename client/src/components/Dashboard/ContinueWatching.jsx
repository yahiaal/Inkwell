import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProgressBar } from '../UI/ProgressBar.jsx';
import { Button } from '../UI/Button.jsx';

export function ContinueWatching({ courses }) {
  const navigate = useNavigate();

  if (!courses || courses.length === 0) return null;

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2
        className="font-display"
        style={{ fontSize: '1.4rem', color: 'var(--surface)', marginBottom: '0.75rem' }}
      >
        Continue Watching
      </h2>
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
        }}
      >
        {courses.map((course, i) => (
          <motion.div
            key={course.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className="card"
            style={{
              minWidth: '260px',
              maxWidth: '260px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              flexShrink: 0,
            }}
          >
            <h3
              className="font-display line-clamp-2"
              style={{ fontSize: '0.95rem', color: 'var(--text)', lineHeight: 1.3 }}
            >
              {course.title}
            </h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{course.progress ?? 0}% complete</span>
              <span>{course.completed_lessons ?? 0}/{course.total_lessons}</span>
            </div>
            <ProgressBar percent={course.progress ?? 0} />
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate(`/course/${course.id}`)}
              style={{ alignSelf: 'stretch', marginTop: '0.25rem' }}
            >
              Resume →
            </Button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
