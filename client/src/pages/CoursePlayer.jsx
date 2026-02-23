import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VideoPlayer } from '../components/Player/VideoPlayer.jsx';
import { CurriculumSidebar } from '../components/Sidebar/CurriculumSidebar.jsx';
import { ShortcutsModal } from '../components/UI/ShortcutsModal.jsx';
import { Button } from '../components/UI/Button.jsx';
import { LoadingSpinner } from '../components/UI/LoadingSpinner.jsx';
import { Modal } from '../components/UI/Modal.jsx';
import { api } from '../utils/api.js';
import { formatTime, formatRelativeDate } from '../utils/formatters.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';
import { useProgress } from '../hooks/useProgress.js';
import { useDebounce } from '../hooks/useDebounce.js';
import useCourseStore from '../store/useCourseStore.js';
import usePlayerStore from '../store/usePlayerStore.js';
import useProgressStore from '../store/useProgressStore.js';
import useUIStore from '../store/useUIStore.js';

export default function CoursePlayer() {
  const { id, lessonId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useUIStore((s) => s.addToast);

  const { course, lessons, setCourse, clearCourse } = useCourseStore();
  const playerStore = usePlayerStore();
  const { progressMap } = useProgressStore();

  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('bookmarks');

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [addingBookmark, setAddingBookmark] = useState(false);

  // Notes state
  const [noteContent, setNoteContent] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [noteId, setNoteId] = useState(null);

  // Load progress for this course
  useProgress(id);

  const currentLesson = lessons.find((l) => String(l.id) === String(lessonId));
  const currentIndex = lessons.findIndex((l) => String(l.id) === String(lessonId));

  // ─── Load course data ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [courseData, settingsData] = await Promise.all([
          api.courses.get(id),
          api.settings.get(),
        ]);
        if (!cancelled) {
          setCourse(courseData);
          setSettings(settingsData);
        }
      } catch (err) {
        if (!cancelled) addToast('Failed to load course: ' + err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; clearCourse(); };
  }, [id, setCourse, clearCourse, addToast]);

  // ─── Load bookmarks for this lesson ──────────────────────────
  useEffect(() => {
    if (!id || !lessonId) return;
    api.bookmarks.getByCourse(id)
      .then((bms) => setBookmarks(bms.filter((b) => String(b.lesson_id) === String(lessonId))))
      .catch(() => {});
  }, [id, lessonId]);

  // ─── Load note for this lesson ────────────────────────────────
  useEffect(() => {
    if (!lessonId) return;
    api.notes.getByLesson(lessonId)
      .then((note) => {
        setNoteContent(note?.content ?? '');
        setNoteId(note?.id ?? null);
      })
      .catch(() => {});
  }, [lessonId]);

  // ─── Handle ?t= timestamp from bookmarks ─────────────────────
  useEffect(() => {
    const t = searchParams.get('t');
    if (t && playerStore.duration) {
      // Seek happens on video load; we store the target in player store
    }
  }, [searchParams, playerStore.duration]);

  // ─── Navigation helpers ───────────────────────────────────────
  const goToLesson = useCallback((lesson) => {
    if (lesson) navigate(`/course/${id}/play/${lesson.id}`);
  }, [id, navigate]);

  const goNext = useCallback(() => {
    if (currentIndex < lessons.length - 1) goToLesson(lessons[currentIndex + 1]);
  }, [currentIndex, lessons, goToLesson]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) goToLesson(lessons[currentIndex - 1]);
  }, [currentIndex, lessons, goToLesson]);

  // ─── Keyboard shortcuts ───────────────────────────────────────
  useKeyboardShortcuts({
    ' ': () => {
      const video = document.querySelector('video');
      if (video) { video.paused ? video.play() : video.pause(); }
    },
    'ArrowLeft': () => {
      const video = document.querySelector('video');
      if (video) video.currentTime = Math.max(0, video.currentTime - 10);
    },
    'ArrowRight': () => {
      const video = document.querySelector('video');
      if (video) video.currentTime = Math.min(video.duration, video.currentTime + 10);
    },
    'ArrowUp': () => {
      const v = Math.min(1, (playerStore.volume || 0) + 0.1);
      playerStore.setVolume(v);
      const video = document.querySelector('video');
      if (video) video.volume = v;
    },
    'ArrowDown': () => {
      const v = Math.max(0, (playerStore.volume || 1) - 0.1);
      playerStore.setVolume(v);
      const video = document.querySelector('video');
      if (video) video.volume = v;
    },
    'n': goNext,
    'N': goNext,
    'p': goPrev,
    'P': goPrev,
    'f': () => {
      const el = document.querySelector('.player-container');
      if (!document.fullscreenElement) el?.requestFullscreen?.();
      else document.exitFullscreen?.();
    },
    'F': () => {
      const el = document.querySelector('.player-container');
      if (!document.fullscreenElement) el?.requestFullscreen?.();
      else document.exitFullscreen?.();
    },
    'b': () => handleAddBookmark(),
    'B': () => handleAddBookmark(),
    '?': () => setShortcutsOpen(true),
  }, !shortcutsOpen && !addingBookmark);

  // ─── Bookmarks ────────────────────────────────────────────────
  const handleAddBookmark = useCallback(async () => {
    const video = document.querySelector('video');
    if (!video || !currentLesson) return;
    const ts = Math.round(video.currentTime);
    try {
      const bm = await api.bookmarks.create({
        lessonId: currentLesson.id,
        courseId: id,
        timestampSeconds: ts,
        label: null,
      });
      setBookmarks((prev) => [...prev, bm]);
      addToast(`Bookmark added at ${formatTime(ts)}`, 'success');
    } catch (err) {
      addToast('Failed to add bookmark: ' + err.message);
    }
  }, [currentLesson, id, addToast]);

  const handleDeleteBookmark = async (bmId) => {
    try {
      await api.bookmarks.remove(bmId);
      setBookmarks((prev) => prev.filter((b) => b.id !== bmId));
    } catch (err) {
      addToast('Failed to delete bookmark: ' + err.message);
    }
  };

  const handleSeekToBookmark = (ts) => {
    const video = document.querySelector('video');
    if (video) video.currentTime = ts;
  };

  // ─── Notes auto-save ──────────────────────────────────────────
  const saveNote = useCallback(async (content) => {
    if (!currentLesson) return;
    try {
      const saved = await api.notes.upsert({
        lessonId: currentLesson.id,
        courseId: id,
        content,
      });
      setNoteId(saved.id);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch {
      // Non-critical
    }
  }, [currentLesson, id]);

  const debouncedSave = useDebounce(saveNote, 1000);

  const handleNoteChange = (e) => {
    setNoteContent(e.target.value);
    setNoteSaved(false);
    debouncedSave(e.target.value);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <LoadingSpinner size={48} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (!course || !currentLesson) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1rem' }}>
        <div style={{ fontSize: '4rem' }}>😵</div>
        <h2 className="font-display" style={{ color: 'var(--surface)', fontSize: '1.4rem' }}>Lesson Not Found</h2>
        <p style={{ color: 'var(--text-muted)' }}>This lesson might have been removed or the path changed.</p>
        <Button variant="primary" onClick={() => navigate(`/course/${id}`)}>Back to Course</Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'auto' }}>
      {/* Curriculum Sidebar */}
      <CurriculumSidebar
        tree={course.tree}
        flatLessons={lessons}
        courseId={id}
        activeLessonId={currentLesson?.id}
      />

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <div
          style={{
            padding: '0.6rem 1rem',
            borderBottom: '2px solid var(--ink)',
            backgroundColor: 'var(--surface)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <Link
            to={`/course/${id}`}
            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.8rem' }}
          >
            ← {course.title}
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span
            className="line-clamp-1"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', flex: 1 }}
          >
            {currentLesson.title}
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {currentIndex + 1} / {lessons.length}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setShortcutsOpen(true)} title="Keyboard shortcuts">
            ?
          </Button>
        </div>

        {/* Video player */}
        <div className="player-container" style={{ flexShrink: 0, backgroundColor: '#000' }}>
          <VideoPlayer
            lesson={currentLesson}
            courseId={id}
            completionThreshold={settings.completion_threshold}
            settings={settings}
            onNext={goNext}
            onPrev={goPrev}
          />
        </div>

        {/* Lesson title below player */}
        <div
          style={{
            padding: '0.4rem 1rem',
            backgroundColor: 'var(--surface)',
            borderBottom: '2px solid var(--ink)',
            flexShrink: 0,
          }}
        >
          <h1 className="font-display" style={{ fontSize: '1rem', color: 'var(--text)' }}>
            {currentLesson.title}
          </h1>
          {currentLesson.section_path && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {currentLesson.section_path.replace(/\//g, ' › ')}
            </p>
          )}
        </div>

        {/* Tabs: Bookmarks / Notes */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--surface)', minHeight: '180px' }}>
          {/* Tab headers */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--ink)', flexShrink: 0 }}>
            {['bookmarks', 'notes'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '3px solid var(--accent)' : '3px solid transparent',
                  fontFamily: 'Baloo 2, cursive',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 120ms',
                  textTransform: 'capitalize',
                }}
              >
                {tab === 'bookmarks' ? `🔖 Bookmarks (${bookmarks.length})` : '📝 Notes'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {activeTab === 'bookmarks' && (
              <div>
                <Button size="sm" variant="primary" onClick={handleAddBookmark} style={{ marginBottom: '0.75rem' }}>
                  + Add Bookmark at Current Time
                </Button>
                {bookmarks.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    No bookmarks yet. Press <kbd style={{ backgroundColor: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1.5px solid var(--ink)' }}>B</kbd> or the button above to add one.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', borderRadius: '8px', border: '2px solid var(--ink)', backgroundColor: 'var(--surface-alt)' }}
                      >
                        <button
                          onClick={() => handleSeekToBookmark(bm.timestamp_seconds)}
                            style={{ background: 'none', cursor: 'pointer', fontFamily: 'monospace', backgroundColor: 'var(--accent)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem', border: '1.5px solid var(--ink)', fontWeight: 700 }}
                        >
                          {formatTime(bm.timestamp_seconds)}
                        </button>
                        <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text)' }}>{bm.label || '—'}</span>
                        <button
                          onClick={() => handleDeleteBookmark(bm.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--secondary)', fontSize: '1rem' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <textarea
                  className="ink-input"
                  value={noteContent}
                  onChange={handleNoteChange}
                  placeholder="Write notes for this lesson..."
                  style={{ flex: 1, resize: 'none', minHeight: '120px', fontSize: '0.875rem', lineHeight: 1.6 }}
                />
                {noteSaved && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{ fontSize: '0.78rem', color: 'var(--success)', fontFamily: 'Nunito', fontWeight: 600 }}
                  >
                    ✓ Saved
                  </motion.span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
