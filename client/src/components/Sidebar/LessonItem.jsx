import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTime } from '../../utils/formatters.js';
import useProgressStore from '../../store/useProgressStore.js';

export const LessonItem = memo(function LessonItem({ lesson, courseId, activeLessonId }) {
  const navigate = useNavigate();
  const progress = useProgressStore((s) => s.progressMap[lesson.id]);
  const isActive = lesson.id === activeLessonId;
  const isCompleted = progress?.completed;

  const handleClick = () => {
    navigate(`/course/${courseId}/play/${lesson.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.45rem 0.75rem',
        paddingLeft: `${0.75 + (lesson.depth_level || 0) * 1}rem`,
        cursor: 'pointer',
        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
        border: isActive ? '2.5px solid var(--ink)' : '2.5px solid transparent',
        borderRadius: '8px',
        margin: '0.1rem 0.4rem',
        transition: 'background 80ms',
      }}
    >
      {/* Completion badge */}
      <span
        style={{
          minWidth: '1.4rem',
          height: '1.4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          border: `2px solid ${isActive ? 'var(--ink)' : isCompleted ? 'var(--success)' : 'var(--text-muted)'}`,
          backgroundColor: isCompleted ? 'var(--success)' : 'transparent',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: isCompleted ? 'white' : isActive ? 'var(--ink)' : 'var(--text-muted)',
          flexShrink: 0,
        }}
      >
        {isCompleted ? '✓' : (lesson.sort_order != null ? lesson.sort_order + 1 : '')}
      </span>

      {/* Title */}
      <span
        className="line-clamp-2"
        style={{
          flex: 1,
          fontSize: '0.82rem',
          fontFamily: 'Nunito, sans-serif',
          fontWeight: isActive ? 700 : 500,
          color: isActive ? 'var(--ink)' : 'var(--text)',
          lineHeight: 1.3,
        }}
      >
        {lesson.title}
        {!lesson.file_path && (
          <span style={{ color: 'var(--secondary)', fontSize: '0.72rem', marginLeft: '0.3rem' }}>
            (file missing)
          </span>
        )}
      </span>

      {/* Duration */}
      {lesson.duration_seconds && (
        <span
          style={{
            fontSize: '0.72rem',
            fontFamily: 'Nunito, sans-serif',
            color: isActive ? 'var(--ink)' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {formatTime(lesson.duration_seconds)}
        </span>
      )}
    </div>
  );
});
