import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { formatTime } from '../../utils/formatters.js';
import useProgressStore from '../../store/useProgressStore.js';
import useUIStore from '../../store/useUIStore.js';
import { api } from '../../utils/api.js';

export const LessonItem = memo(function LessonItem({ lesson, courseId, activeLessonId }) {
  const navigate = useNavigate();
  const progress = useProgressStore((s) => s.progressMap[lesson.id]);
  const subtitleQueue = useUIStore((s) => s.subtitleQueue);
  const openModal = useUIStore((s) => s.openModal);
  const refreshSubtitleQueue = useUIStore((s) => s.refreshSubtitleQueue);
  const isActive = lesson.id === activeLessonId;
  const isCompleted = progress?.completed;

  // Derive subtitle job status from shared queue state
  const isProcessing = subtitleQueue.processing?.lessonId === lesson.id;
  const isQueued = subtitleQueue.queued.some((j) => j.lessonId === lesson.id);
  const hasActiveJob = isProcessing || isQueued;

  const handleClick = () => {
    navigate(`/course/${courseId}/play/${lesson.id}`);
  };

  const handleGenerateSubtitle = async (e) => {
    e.stopPropagation(); // prevent navigating to the lesson
    try {
      await api.subtitles.generate([lesson.id]);
      await refreshSubtitleQueue(); // Instantly update UI state to show spinner
      openModal('subtitle-queue'); // Open the queue panel immediately
    } catch (err) {
      console.error('Network error triggering subtitle generation:', err);
    }
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

      {/* Subtitle badge */}
      {lesson.subtitle_path ? (
        <span
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '0.05rem 0.25rem',
            borderRadius: '3px',
            backgroundColor: 'var(--success)',
            color: 'white',
            border: '1px solid var(--ink)',
            flexShrink: 0,
            lineHeight: 1.3,
          }}
        >
          CC
        </span>
      ) : hasActiveJob ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '2px solid var(--accent)',
            borderTopColor: 'transparent',
            flexShrink: 0,
          }}
          title="Generating subtitles..."
        />
      ) : lesson.file_path ? (
        <button
          onClick={handleGenerateSubtitle}
          title="Generate Subtitles"
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            padding: '0.1rem 0.3rem',
            borderRadius: '4px',
            backgroundColor: 'transparent',
            color: 'var(--text-muted)',
            border: '1px solid var(--ink)',
            cursor: 'pointer',
            flexShrink: 0,
            lineHeight: 1.3,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-hover)';
            e.currentTarget.style.color = 'var(--text)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-muted)';
          }}
        >
          + CC
        </button>
      ) : null}

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
