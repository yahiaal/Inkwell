import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../utils/api.js';
import useUIStore from '../../store/useUIStore.js';
import useCourseStore from '../../store/useCourseStore.js';

const POLL_ACTIVE_MS = 3000;
const RECENT_DISMISS_MS = 30000;

export function SubtitleQueuePanel() {
    const { subtitleQueue, setSubtitleQueue } = useUIStore();
    const setLessonSubtitlePath = useCourseStore((s) => s.setLessonSubtitlePath);
    const activeIntervalRef = useRef(null);
    const dismissTimerRef = useRef(null);
    const prevCompletedRef = useRef([]);
    const [minimized, setMinimized] = useState(false);
    const addToast = useUIStore((s) => s.addToast);

    const hasActiveJobs =
        subtitleQueue.processing !== null ||
        subtitleQueue.queued.length > 0;

    const hasContent = hasActiveJobs || subtitleQueue.recentlyCompleted.length > 0;

    const poll = useRef(async () => {
        try {
            const data = await api.subtitles.getQueue();
            setSubtitleQueue(data);
        } catch {
            // Non-critical
        }
    }).current;

    // Poll only while active jobs exist (3s). No background poll.
    // New jobs are discovered via refreshSubtitleQueue() called after user actions.
    useEffect(() => {
        if (hasActiveJobs) {
            clearTimeout(dismissTimerRef.current);
            poll();
            activeIntervalRef.current = setInterval(poll, POLL_ACTIVE_MS);
        } else {
            clearInterval(activeIntervalRef.current);
        }
        return () => clearInterval(activeIntervalRef.current);
    }, [hasActiveJobs, poll]);

    // Auto-dismiss recently completed items after 30s with no active jobs
    useEffect(() => {
        if (!hasActiveJobs && subtitleQueue.recentlyCompleted.length > 0) {
            dismissTimerRef.current = setTimeout(() => {
                setSubtitleQueue({ processing: null, queued: [], recentlyCompleted: [] });
            }, RECENT_DISMISS_MS);
        }
        return () => clearTimeout(dismissTimerRef.current);
    }, [hasActiveJobs, subtitleQueue.recentlyCompleted.length, setSubtitleQueue]);

    // Sync newly completed jobs to course store so UI (like LessonItem) updates without reload
    useEffect(() => {
        const currentCompleted = subtitleQueue.recentlyCompleted;
        const previousCompleted = prevCompletedRef.current;

        // Find jobs that are in current but weren't in previous
        const newJobs = currentCompleted.filter(
            (c) => !previousCompleted.some((p) => p.jobId === c.jobId)
        );

        newJobs.forEach((job) => {
            if (job.status === 'done') {
                // Update local frontend state instantly
                setLessonSubtitlePath(job.lessonId, 'generated-path-placeholder');
            }
        });

        prevCompletedRef.current = currentCompleted;
    }, [subtitleQueue.recentlyCompleted, setLessonSubtitlePath]);

    const handleCancel = async (jobId) => {
        try {
            await api.subtitles.cancelJob(jobId);
            addToast('Subtitle generation cancelled', 'success');
            await poll();
        } catch {
            addToast('Failed to cancel job');
        }
    };

    const handleClearHistory = async () => {
        try {
            await api.subtitles.clearHistory();
            setSubtitleQueue({ processing: null, queued: [], recentlyCompleted: [] });
        } catch {
            addToast('Failed to clear history');
        }
    };

    const handleDismiss = () => {
        setSubtitleQueue({ processing: null, queued: [], recentlyCompleted: [] });
    };

    // Elapsed time ticker for the processing job
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!subtitleQueue.processing?.startedAt) {
            setElapsed(0);
            return;
        }
        const startTime = new Date(subtitleQueue.processing.startedAt).getTime();
        const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [subtitleQueue.processing?.startedAt]);

    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const elapsedStr = subtitleQueue.processing
        ? `${mins}:${secs.toString().padStart(2, '0')}`
        : '';

    // Per-job progress from server (0-100)
    const jobProgress = subtitleQueue.processing?.progress ?? null;

    // Batch progress: count completed + active
    const doneCount = subtitleQueue.recentlyCompleted.filter((j) => j.status === 'done').length;
    const activeCount = (subtitleQueue.processing ? 1 : 0) + subtitleQueue.queued.length;
    const totalJobs = doneCount + activeCount;
    const completedJobs = doneCount;

    return (
        <AnimatePresence>
            {hasContent && (
                <motion.div
                    initial={{ opacity: 0, y: 80, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 80, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    style={{
                        position: 'fixed',
                        bottom: '1.5rem',
                        right: '1.5rem',
                        width: '340px',
                        zIndex: 1000,
                        backgroundColor: 'var(--surface)',
                        border: '2.5px solid var(--ink)',
                        borderRadius: '16px',
                        boxShadow: '4px 4px 0px var(--ink)',
                        overflow: 'hidden',
                        fontFamily: 'Nunito, sans-serif',
                    }}
                >
                    {/* Header */}
                    <div
                        onClick={() => setMinimized((m) => !m)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            borderBottom: minimized ? 'none' : '2px solid var(--ink)',
                            cursor: 'pointer',
                            backgroundColor: 'var(--surface-alt)',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1rem' }}>🎙</span>
                            <span
                                style={{
                                    fontFamily: 'Baloo 2, cursive',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    color: 'var(--text)',
                                }}
                            >
                                {subtitleQueue.processing ? 'Generating Subtitles' : 'Subtitle Queue'}
                            </span>
                            {subtitleQueue.processing && (
                                <span
                                    style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--accent)',
                                        animation: 'pulse 1.5s infinite',
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {!hasActiveJobs && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-muted)',
                                        fontSize: '1rem',
                                        lineHeight: 1,
                                        padding: '0 0.15rem',
                                    }}
                                    title="Dismiss"
                                >
                                    ✕
                                </button>
                            )}
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {minimized ? '▲' : '▼'}
                            </span>
                        </div>
                    </div>

                    {!minimized && (
                        <div style={{ padding: '0.75rem 1rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {/* Batch progress bar */}
                            {totalJobs > 1 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                                        <span>Batch Progress</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                                            {completedJobs} of {totalJobs}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            height: '8px',
                                            borderRadius: '999px',
                                            border: '1.5px solid var(--ink)',
                                            backgroundColor: 'var(--surface-alt)',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0}%`,
                                                backgroundColor: 'var(--accent)',
                                                borderRadius: '999px',
                                                transition: 'width 600ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Currently processing */}
                            {subtitleQueue.processing && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div
                                        style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            color: 'var(--accent)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.3rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <span>Processing</span>
                                        <span style={{ fontWeight: 600, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>
                                            {elapsedStr}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            padding: '0.4rem 0.5rem',
                                            borderRadius: '8px',
                                            border: '2px solid var(--ink)',
                                            backgroundColor: 'var(--surface-alt)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: jobProgress !== null ? '0.4rem' : 0 }}>
                                            <span
                                                style={{
                                                    display: 'inline-block',
                                                    width: '14px',
                                                    height: '14px',
                                                    border: '2px solid var(--accent)',
                                                    borderTopColor: 'transparent',
                                                    borderRadius: '50%',
                                                    animation: 'spin 0.8s linear infinite',
                                                    flexShrink: 0,
                                                }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    className="line-clamp-1"
                                                    style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}
                                                >
                                                    {subtitleQueue.processing.lessonTitle}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {subtitleQueue.processing.courseTitle}
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancel(subtitleQueue.processing.jobId);
                                                }}
                                                style={{
                                                    background: 'none',
                                                    border: '1.5px solid var(--secondary)',
                                                    borderRadius: '5px',
                                                    cursor: 'pointer',
                                                    color: 'var(--secondary)',
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    padding: '0.15rem 0.4rem',
                                                    flexShrink: 0,
                                                    fontFamily: 'Nunito, sans-serif',
                                                }}
                                                title="Stop generating"
                                            >
                                                ■ Stop
                                            </button>
                                        </div>

                                        {/* Per-job progress bar */}
                                        {jobProgress !== null && (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                                    <span>Transcribing</span>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{jobProgress}%</span>
                                                </div>
                                                <div
                                                    style={{
                                                        height: '6px',
                                                        borderRadius: '999px',
                                                        border: '1px solid var(--ink)',
                                                        backgroundColor: 'var(--surface)',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            height: '100%',
                                                            width: `${jobProgress}%`,
                                                            backgroundColor: 'var(--accent)',
                                                            borderRadius: '999px',
                                                            transition: 'width 800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Queued jobs */}
                            {subtitleQueue.queued.length > 0 && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <div
                                        style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 700,
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.3rem',
                                        }}
                                    >
                                        Queued ({subtitleQueue.queued.length})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        {subtitleQueue.queued.map((job) => (
                                            <div
                                                key={job.jobId}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    padding: '0.3rem 0.5rem',
                                                    borderRadius: '6px',
                                                    backgroundColor: 'var(--surface-alt)',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                <span style={{ color: 'var(--text-muted)', fontWeight: 600, minWidth: '1.2rem' }}>
                                                    #{job.position}
                                                </span>
                                                <span
                                                    className="line-clamp-1"
                                                    style={{ flex: 1, color: 'var(--text)', minWidth: 0 }}
                                                >
                                                    {job.lessonTitle}
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancel(job.jobId);
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--secondary)',
                                                        fontSize: '1rem',
                                                        lineHeight: 1,
                                                        padding: '0 0.15rem',
                                                        flexShrink: 0,
                                                    }}
                                                    title="Cancel"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recently completed */}
                            {subtitleQueue.recentlyCompleted.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                        <div
                                            style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 700,
                                                color: 'var(--text-muted)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                            }}
                                        >
                                            Recent
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleClearHistory(); }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.65rem',
                                                fontFamily: 'Nunito, sans-serif',
                                                padding: '0 0.2rem',
                                                textDecoration: 'underline',
                                            }}
                                            title="Clear history"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                        {subtitleQueue.recentlyCompleted.slice(0, 3).map((job) => (
                                            <div
                                                key={job.jobId}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: '0.4rem',
                                                    padding: '0.25rem 0.5rem',
                                                    fontSize: '0.78rem',
                                                    color: 'var(--text-muted)',
                                                }}
                                            >
                                                <span style={{ flexShrink: 0, marginTop: '0.05rem' }}>
                                                    {job.status === 'done' ? '✅' : job.status === 'cancelled' ? '🚫' : '❌'}
                                                </span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <span className="line-clamp-1">{job.lessonTitle}</span>
                                                    {job.status === 'failed' && job.errorMessage && (
                                                        <div className="line-clamp-2" style={{ fontSize: '0.7rem', color: 'var(--secondary)', marginTop: '0.1rem' }}>
                                                            {job.errorMessage}
                                                        </div>
                                                    )}
                                                    {job.status === 'cancelled' && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                                                            Cancelled
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
