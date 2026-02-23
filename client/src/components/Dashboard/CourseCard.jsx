import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ProgressBar } from '../UI/ProgressBar.jsx';
import { Badge } from '../UI/Badge.jsx';
import { Button } from '../UI/Button.jsx';
import { formatDuration } from '../../utils/formatters.js';

const STATUS_LABELS = {
  not_started: { label: 'Not Started', variant: 'muted' },
  in_progress: { label: 'In Progress', variant: 'accent' },
  completed: { label: 'Completed', variant: 'success' },
};

export function CourseCard({ course, index }) {
  const navigate = useNavigate();
  const status = STATUS_LABELS[course.status] ?? STATUS_LABELS.not_started;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.06 }}
      className="card"
      style={{ cursor: 'pointer', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      onClick={() => navigate(`/course/${course.id}`)}
    >
      {/* Title row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3
          className="font-display line-clamp-2"
          style={{ fontSize: '1rem', color: 'var(--text)', lineHeight: 1.3, flex: 1 }}
        >
          {course.title}
        </h3>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          fontFamily: 'Nunito, sans-serif',
        }}
      >
        <span>📚 {course.total_lessons} lessons</span>
        {course.duration_seconds && (
          <span>⏱ {formatDuration(course.duration_seconds)}</span>
        )}
      </div>

      {/* Tags */}
      {course.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {course.tags.map((tag) => (
            <Badge key={tag} variant="muted">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Progress */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            fontFamily: 'Nunito, sans-serif',
          }}
        >
          <span>{course.completed_lessons ?? 0} / {course.total_lessons} completed</span>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{course.progress ?? 0}%</span>
        </div>
        <ProgressBar percent={course.progress ?? 0} />
      </div>

      {/* Action */}
      <Button
        variant={course.status === 'not_started' ? 'ghost' : 'primary'}
        size="sm"
        onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}`); }}
        style={{ alignSelf: 'flex-end', marginTop: '0.25rem' }}
      >
        {course.status === 'not_started' ? 'View Course' : course.status === 'completed' ? 'Review' : 'Continue'}
      </Button>
    </motion.div>
  );
}
