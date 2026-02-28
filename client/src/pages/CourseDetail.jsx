import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ProgressBar } from '../components/UI/ProgressBar.jsx';
import { Badge } from '../components/UI/Badge.jsx';
import { Button } from '../components/UI/Button.jsx';
import { Modal } from '../components/UI/Modal.jsx';
import { LoadingSpinner } from '../components/UI/LoadingSpinner.jsx';
import { api } from '../utils/api.js';
import { formatDuration, formatTime, formatRelativeDate } from '../utils/formatters.js';
import useUIStore from '../store/useUIStore.js';

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '0.2rem' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(star === value ? null : star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.5rem',
            cursor: 'pointer',
            color: star <= (hovered || value || 0) ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'color 80ms',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useUIStore((s) => s.addToast);
  const refreshSubtitleQueue = useUIStore((s) => s.refreshSubtitleQueue);

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState([]);
  const [editTitle, setEditTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [review, setReview] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [resumeLessonId, setResumeLessonId] = useState(null);

  // Subtitle state
  const [missingSubtitles, setMissingSubtitles] = useState(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  const fetchCourse = useCallback(async () => {
    try {
      const [data, bmarks, resumeData] = await Promise.all([
        api.courses.get(id),
        api.bookmarks.getByCourse(id),
        api.progress.getResume(id),
      ]);
      setCourse(data);
      setEditTitle(data.title);
      setReview(data.personal_review ?? '');
      setBookmarks(bmarks);
      setResumeLessonId(resumeData?.lessonId ?? data.lessons?.[0]?.id ?? null);
    } catch (err) {
      addToast('Failed to load course: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  // Fetch missing subtitles
  useEffect(() => {
    api.subtitles.getMissing(id)
      .then((data) => setMissingSubtitles(data))
      .catch(() => { });
  }, [id]);

  const updateCourse = async (updates) => {
    try {
      const updated = await api.courses.update(id, updates);
      setCourse((c) => ({ ...c, ...updated }));
    } catch (err) {
      addToast('Failed to update: ' + err.message);
    }
  };

  const handleTitleSave = async () => {
    if (!editTitle.trim()) return;
    await updateCourse({ title: editTitle });
    setEditingTitle(false);
  };

  const handleAddTag = async (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    const tags = [...(course.tags ?? []), newTag.trim()];
    await updateCourse({ tags });
    setNewTag('');
  };

  const handleRemoveTag = async (tag) => {
    const tags = (course.tags ?? []).filter((t) => t !== tag);
    await updateCourse({ tags });
  };

  const handleRating = async (rating) => {
    await updateCourse({ personal_rating: rating });
  };

  const handleReviewBlur = async () => {
    await updateCourse({ personal_review: review });
  };

  const handleDelete = async () => {
    try {
      await api.courses.remove(id);
      navigate('/');
    } catch (err) {
      addToast('Failed to delete: ' + err.message);
    }
  };

  const handleGenerateAllSubtitles = async () => {
    if (!missingSubtitles || missingSubtitles.lessons.length === 0) return;
    setGeneratingAll(true);
    try {
      const result = await api.subtitles.generate(missingSubtitles.lessons.map((l) => l.lessonId));
      if (result.queued?.length > 0) {
        addToast(`${result.queued.length} lesson${result.queued.length !== 1 ? 's' : ''} added to subtitle queue`, 'success');
      } else {
        addToast('All lessons already have subtitles or are already queued', 'info');
      }
      await refreshSubtitleQueue();
    } catch (err) {
      addToast('Failed to queue subtitles: ' + err.message);
      setGeneratingAll(false);
    }
  };

  const targetLessonId = resumeLessonId || course?.lessons?.[0]?.id;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <LoadingSpinner size={40} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--surface)' }}>Course not found.</p>
        <Link to="/" style={{ color: 'var(--accent)' }}>← Back to Library</Link>
      </div>
    );
  }

  // targetLessonId is set above from the resume endpoint

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Back link */}
      <Link
        to="/"
        style={{ color: 'var(--surface)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}
      >
        ← Back to Library
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-flat" style={{ backgroundColor: 'var(--surface)', padding: '2rem' }}>
        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                className="ink-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false); }}
                autoFocus
                style={{ fontSize: '1.4rem', fontFamily: 'Baloo 2, cursive', fontWeight: 700 }}
              />
              <Button size="sm" onClick={handleTitleSave}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)}>Cancel</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <h1 className="font-display" style={{ fontSize: '1.8rem', color: 'var(--text)', lineHeight: 1.2 }}>
                {course.title}
              </h1>
              <button
                onClick={() => setEditingTitle(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem' }}
                title="Edit title"
              >
                ✏️
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <span>{course.completed_lessons ?? 0} of {course.total_lessons} lessons completed</span>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>{course.progress ?? 0}%</span>
          </div>
          <ProgressBar percent={course.progress ?? 0} height={12} />
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          <span>📚 {course.total_lessons} lessons</span>
          {course.duration_seconds && <span>⏱ {formatDuration(course.duration_seconds)}</span>}
          {course.last_accessed && <span>👁 Last watched {formatRelativeDate(course.last_accessed)}</span>}
        </div>

        {/* Tags */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontFamily: 'Baloo 2', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text)' }}>
            Tags
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {course.tags?.map((tag) => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <Badge variant="accent">{tag}</Badge>
                <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', fontSize: '0.8rem' }}>×</button>
              </span>
            ))}
          </div>
          <form onSubmit={handleAddTag} style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="ink-input" style={{ maxWidth: '180px' }} value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag..." />
            <Button size="sm" type="submit" variant="ghost">Add</Button>
          </form>
        </div>

        {/* Rating */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontFamily: 'Baloo 2', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.4rem', color: 'var(--text)' }}>
            My Rating
          </label>
          <StarRating value={course.personal_rating} onChange={handleRating} />
        </div>

        {/* Review */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontFamily: 'Baloo 2', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.4rem', color: 'var(--text)' }}>
            My Review
          </label>
          <textarea
            className="ink-input"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            onBlur={handleReviewBlur}
            rows={3}
            placeholder="Write your thoughts about this course..."
            style={{ resize: 'vertical' }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {targetLessonId && (
            <Button
              variant="primary"
              onClick={() => navigate(`/course/${id}/play/${targetLessonId}`)}
            >
              {course.status === 'not_started' ? '▶ Start Course' : '▶ Resume Course'}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmOpen(true)}>
            Remove Course
          </Button>
        </div>

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 className="font-display" style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
              Bookmarks
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="card-flat"
                  onClick={() => navigate(`/course/${id}/play/${bm.lesson_id}?t=${bm.timestamp_seconds}`)}
                  style={{ padding: '0.6rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                >
                  <span style={{ fontFamily: 'monospace', backgroundColor: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1.5px solid var(--ink)' }}>
                    {formatTime(bm.timestamp_seconds)}
                  </span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{bm.lesson_title}</span>
                  {bm.label && <span style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600 }}>{bm.label}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subtitles section */}
        {missingSubtitles && (
          <div
            className="card-flat"
            style={{
              padding: '1.25rem',
              marginBottom: '2rem',
              backgroundColor: 'var(--surface-alt)',
            }}
          >
            <h2
              className="font-display"
              style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              🎙 Subtitles
            </h2>
            {missingSubtitles.missingCount === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600 }}>
                ✅ All lessons have subtitles
              </p>
            ) : (
              <>
                {/* Subtitle coverage progress bar */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    <span>Subtitle coverage</span>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                      {(course?.total_lessons ?? 0) - missingSubtitles.missingCount} / {course?.total_lessons ?? 0}
                    </span>
                  </div>
                  <div style={{ height: '10px', borderRadius: '999px', border: '2px solid var(--ink)', backgroundColor: 'var(--surface)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${course?.total_lessons ? (((course.total_lessons - missingSubtitles.missingCount) / course.total_lessons) * 100) : 0}%`,
                        backgroundColor: 'var(--accent)',
                        borderRadius: '999px',
                        transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                      }}
                    />
                  </div>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  {missingSubtitles.missingCount} lesson{missingSubtitles.missingCount !== 1 ? 's are' : ' is'} missing subtitles
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                  {missingSubtitles.lessons.map((l) => (
                    <div key={l.lessonId} style={{ fontSize: '0.8rem', color: 'var(--text)', padding: '0.2rem 0.5rem' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>{l.sectionPath || '—'} ›</span>
                      {l.lessonTitle}
                    </div>
                  ))}
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleGenerateAllSubtitles}
                  disabled={generatingAll}
                >
                  {generatingAll ? 'Added to Queue ✓' : '✨ Generate All Missing Subtitles'}
                </Button>
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Delete confirmation */}
      <Modal open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Remove Course?">
        <p style={{ color: 'var(--text)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          This will remove <strong>{course.title}</strong> from your library along with all progress, bookmarks, and notes. Your video files will not be touched.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete}>Remove Course</Button>
        </div>
      </Modal>
    </div>
  );
}
