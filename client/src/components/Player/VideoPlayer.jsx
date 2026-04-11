import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { api } from '../../utils/api.js';
import { todayDate } from '../../utils/formatters.js';
import usePlayerStore from '../../store/usePlayerStore.js';
import useProgressStore from '../../store/useProgressStore.js';
import useUIStore from '../../store/useUIStore.js';
import useCourseStore from '../../store/useCourseStore.js';
import { PlayerControls } from './PlayerControls.jsx';

const SAVE_INTERVAL_MS = 5000;

export function VideoPlayer({ lesson, courseId, completionThreshold, onNext, onPrev, settings }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const sessionStartRef = useRef(Date.now());
  const lastLoggedMinuteRef = useRef(0);
  const hideControlsTimer = useRef(null);
  const hasSeekedRef = useRef(false);
  const wasFullscreenRef = useRef(false);

  const [videoError, setVideoError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const {
    isPlaying, setPlaying,
    currentTime, setTime,
    duration, setDuration,
    volume, setVolume,
    playbackSpeed, setSpeed,
    subtitlesEnabled, toggleSubtitles,
    buffered, setBuffered,
  } = usePlayerStore();

  const { progressMap, setProgress, markComplete } = useProgressStore();
  const subtitleQueue = useUIStore((s) => s.subtitleQueue);
  const refreshSubtitleQueue = useUIStore((s) => s.refreshSubtitleQueue);
  const addToast = useUIStore((s) => s.addToast);
  const setCourse = useCourseStore((s) => s.setCourse);
  const lessonProgress = progressMap[lesson?.id];
  const threshold = parseFloat(completionThreshold ?? 85) / 100;

  // Derive full subtitle job status for this lesson from shared queue state
  const subtitleStatus = useMemo(() => {
    if (!lesson) return { state: 'idle' };

    // Check if currently processing
    if (subtitleQueue.processing?.lessonId === lesson.id) {
      return {
        state: 'processing',
        jobId: subtitleQueue.processing.jobId,
        startedAt: subtitleQueue.processing.startedAt,
      };
    }

    // Check if queued
    const queuedJob = subtitleQueue.queued.find((j) => j.lessonId === lesson.id);
    if (queuedJob) {
      return {
        state: 'queued',
        jobId: queuedJob.jobId,
        position: queuedJob.position,
      };
    }

    // Check recently completed
    const recentJob = subtitleQueue.recentlyCompleted.find((j) => j.lessonId === lesson.id);
    if (recentJob) {
      if (recentJob.status === 'failed') {
        return {
          state: 'failed',
          jobId: recentJob.jobId,
          error: recentJob.errorMessage || 'Generation failed',
        };
      }
      if (recentJob.status === 'cancelled') {
        return { state: 'cancelled' };
      }
      // done
      return { state: 'done' };
    }

    return { state: 'idle' };
  }, [lesson, subtitleQueue]);

  // ─── Auto-refresh when subtitle generation completes ─────────
  useEffect(() => {
    if (!lesson || !courseId) return;
    const done = subtitleQueue.recentlyCompleted.find(
      (j) => j.lessonId === lesson.id && j.status === 'done'
    );
    if (done && !lesson.subtitle_path) {
      api.courses.get(courseId).then((courseData) => {
        setCourse(courseData);
      }).catch(() => { });
    }
  }, [subtitleQueue.recentlyCompleted, lesson, courseId, setCourse]);

  // ─── Generate subtitle handler ────────────────────────────────
  const handleGenerateSubtitle = useCallback(async (force = false) => {
    if (!lesson) return;
    try {
      const result = await api.subtitles.generate([lesson.id], force);
      if (result.queued?.length > 0) {
        addToast(force ? 'Regeneration started' : 'Subtitle generation started', 'success');
      } else if (result.skipped?.length > 0) {
        addToast('Lesson already has subtitles or is already queued', 'info');
      }
      await refreshSubtitleQueue();
    } catch (err) {
      addToast('Failed to start subtitle generation: ' + err.message);
    }
  }, [lesson, addToast, refreshSubtitleQueue]);

  // ─── Stop/cancel subtitle generation handler ──────────────────
  const handleStopGenerating = useCallback(async () => {
    if (!lesson) return;
    try {
      const processingJob = subtitleQueue.processing;
      if (processingJob && processingJob.lessonId === lesson.id) {
        await api.subtitles.cancelJob(processingJob.jobId);
        addToast('Subtitle generation stopped', 'success');
        await refreshSubtitleQueue();
        return;
      }
      const queuedJob = subtitleQueue.queued.find((j) => j.lessonId === lesson.id);
      if (queuedJob) {
        await api.subtitles.cancelJob(queuedJob.jobId);
        addToast('Subtitle generation cancelled', 'success');
        await refreshSubtitleQueue();
      }
    } catch (err) {
      addToast('Failed to cancel: ' + err.message);
    }
  }, [lesson, subtitleQueue, addToast, refreshSubtitleQueue]);

  // ─── Track fullscreen state ───────────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setControlsVisible(true); // always show controls when leaving fullscreen
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ─── Auto-hide controls in fullscreen ────────────────────────
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideControlsTimer.current);
    if (isFullscreen) {
      hideControlsTimer.current = setTimeout(() => setControlsVisible(false), 2000);
    }
  }, [isFullscreen]);

  useEffect(() => {
    return () => clearTimeout(hideControlsTimer.current);
  }, []);

  // ─── Save progress ────────────────────────────────────────────
  const saveProgress = useCallback(async (forceComplete = false) => {
    const video = videoRef.current;
    if (!video || !lesson || !courseId) return;

    const watched = Math.round(video.currentTime);
    const dur = Math.round(video.duration) || null;
    const completed = forceComplete || (dur && watched / dur >= threshold) ? 1 : 0;

    try {
      await api.progress.upsert({
        lessonId: lesson.id,
        courseId,
        watchedSeconds: watched,
        durationSeconds: dur,
        completed,
      });

      setProgress(lesson.id, { watchedSeconds: watched, completed: !!completed });
      if (completed) markComplete(lesson.id);

      const elapsedMinutes = Math.floor((Date.now() - sessionStartRef.current) / 60000);
      if (elapsedMinutes > lastLoggedMinuteRef.current) {
        lastLoggedMinuteRef.current = elapsedMinutes;
        await api.progress.logSession({
          courseId,
          minutesWatched: 1,
          lessonsCompleted: 0,
          date: todayDate(),
        });
      }
    } catch {
      // Non-critical
    }
  }, [lesson, courseId, threshold, setProgress, markComplete]);

  // ─── Load new lesson ──────────────────────────────────────────
  useEffect(() => {
    if (!lesson) return;
    setVideoError(null);
    hasSeekedRef.current = false;
    if (document.fullscreenElement) wasFullscreenRef.current = true;
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.load();
    sessionStartRef.current = Date.now();
    lastLoggedMinuteRef.current = 0;
  }, [lesson?.id]);

  // ─── Apply saved progress when available ──────────────────────
  useEffect(() => {
    const video = videoRef.current;
    // Backend returns watched_seconds (snake_case), but in-session saves use watchedSeconds (camelCase)
    const savedSeconds = lessonProgress?.watchedSeconds ?? lessonProgress?.watched_seconds;

    // Wait until we have both the video loaded and the progress data
    if (!video || hasSeekedRef.current || savedSeconds == null || !duration) return;

    if (video.readyState >= 1) { // HAVE_METADATA or higher
      if (savedSeconds > 5 && savedSeconds < duration * 0.98) {
        video.currentTime = savedSeconds;
      }
      hasSeekedRef.current = true;
    }
  }, [lessonProgress, duration]);

  // ─── Apply speed / volume ─────────────────────────────────────
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  // ─── 5-second interval save ───────────────────────────────────
  useEffect(() => {
    clearInterval(saveIntervalRef.current);
    if (isPlaying) {
      saveIntervalRef.current = setInterval(saveProgress, SAVE_INTERVAL_MS);
    }
    return () => clearInterval(saveIntervalRef.current);
  }, [isPlaying, saveProgress]);

  // ─── Save progress on tab close / app quit ────────────────────
  useEffect(() => {
    const saveBeacon = () => {
      const video = videoRef.current;
      if (!video || !lesson || !courseId) return;
      const watched = Math.round(video.currentTime);
      const dur = Math.round(video.duration) || null;
      if (watched < 2) return; // Don't save if barely started
      const url = `${window.location.protocol}//${window.location.hostname}:3001/api/progress`;
      const body = JSON.stringify({
        lessonId: lesson.id,
        courseId,
        watchedSeconds: watched,
        durationSeconds: dur,
        completed: 0,
      });
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    };

    const handleBeforeUnload = () => saveBeacon();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveBeacon();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lesson, courseId]);

  // ─── Video event handlers ─────────────────────────────────────
  const handleLoadedMetadata = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration;
    setDuration(dur);

    if (lesson && courseId && !lesson.duration_seconds) {
      try { await api.courses.updateLessonDuration(courseId, lesson.id, dur); } catch { }
    }

    video.play().catch(() => { });

    if (wasFullscreenRef.current) {
      wasFullscreenRef.current = false;
      const el = containerRef.current;
      if (el) {
        requestAnimationFrame(() => {
          el.requestFullscreen?.().catch(() => { });
        });
      }
    }
  }, [lesson, courseId, setDuration]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setTime(video.currentTime);
    if (video.buffered.length > 0) {
      setBuffered(video.buffered.end(video.buffered.length - 1));
    }
  };

  const handlePlay = () => setPlaying(true);
  const handlePause = () => { setPlaying(false); saveProgress(); };

  const handleEnded = async () => {
    setPlaying(false);
    if (document.fullscreenElement) wasFullscreenRef.current = true;
    await saveProgress(true);
    if (settings?.auto_advance !== 'false') onNext?.();
  };

  const handleError = () => {
    setVideoError('Video file could not be loaded. The file may be missing or unsupported.');
    setPlaying(false);
  };

  // ─── Control handlers ─────────────────────────────────────────
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) { video.play(); } else { video.pause(); }
  };

  // Click on the video area (not controls) toggles play
  const handleVideoClick = (e) => {
    if (e.target.closest('[data-controls]')) return;
    togglePlay();
  };

  // Double-click on video area toggles fullscreen
  const handleDoubleClick = (e) => {
    if (e.target.closest('[data-controls]')) return;
    handleFullscreen();
  };

  const handleSeek = (seconds) => {
    const video = videoRef.current;
    if (video) video.currentTime = seconds;
  };

  const handleVolume = (v) => {
    setVolume(v);
    if (videoRef.current) videoRef.current.volume = v;
  };

  const handleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.volume > 0) {
      video._prevVolume = video.volume;
      handleVolume(0);
    } else {
      handleVolume(video._prevVolume || 0.8);
    }
  };

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const handleSpeed = (s) => {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
  };

  if (!lesson) return null;

  const videoSrc = api.videoUrl(lesson.id);
  const subtitleSrc = lesson.subtitle_path ? api.subtitleUrl(lesson.id) : null;

  const containerStyle = isFullscreen
    ? {
      position: 'relative',
      backgroundColor: '#000',
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }
    : {
      position: 'relative',
      backgroundColor: '#000',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
    };

  const videoStyle = isFullscreen
    ? {
      flex: 1,
      width: '100%',
      backgroundColor: '#000',
      display: 'block',
      objectFit: 'contain',
      cursor: 'pointer',
      minHeight: 0,
    }
    : {
      width: '100%',
      maxHeight: '44vh',
      backgroundColor: '#000',
      display: 'block',
      objectFit: 'contain',
      cursor: 'pointer',
    };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onMouseMove={isFullscreen ? resetHideTimer : undefined}
      onClick={handleVideoClick}
      onDoubleClick={handleDoubleClick}
    >
      {videoError ? (
        <div
          className="card-flat"
          style={{ margin: '2rem', padding: '2rem', textAlign: 'center', backgroundColor: 'var(--surface)' }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h3 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>
            Video Unavailable
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{videoError}</p>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            style={videoStyle}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={handleError}
            preload="metadata"
            crossOrigin="anonymous"
          >
            <source src={videoSrc} />
            {subtitleSrc && subtitlesEnabled && (
              <track kind="subtitles" src={subtitleSrc} default />
            )}
          </video>

          {/* Controls — in fullscreen: absolute bottom overlay with auto-hide */}
          <div
            data-controls="true"
            style={isFullscreen ? {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              transition: 'opacity 300ms ease',
              opacity: controlsVisible ? 1 : 0,
              pointerEvents: controlsVisible ? 'auto' : 'none',
            } : {}}
            onClick={(e) => e.stopPropagation()}
          >
            <PlayerControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              buffered={buffered}
              speed={playbackSpeed}
              subtitlesEnabled={subtitlesEnabled}
              hasSubtitle={!!subtitleSrc}
              onPlayPause={togglePlay}
              onSeek={handleSeek}
              onVolume={handleVolume}
              onMute={handleMute}
              onSpeed={handleSpeed}
              onToggleSubtitles={toggleSubtitles}
              onFullscreen={handleFullscreen}
              onPrev={onPrev}
              onNext={onNext}
              onGenerateSubtitle={handleGenerateSubtitle}
              onStopGenerating={handleStopGenerating}
              subtitleStatus={subtitleStatus}
            />
          </div>
        </>
      )}
    </div>
  );
}
