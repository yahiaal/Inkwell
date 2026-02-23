import { useRef, useCallback } from 'react';

export function SeekBar({ currentTime, duration, buffered, onSeek }) {
  const trackRef = useRef(null);

  const getPercent = useCallback(
    (clientX) => {
      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return percent;
    },
    []
  );

  const handleClick = (e) => {
    if (!duration) return;
    const percent = getPercent(e.clientX);
    onSeek(percent * duration);
  };

  const handleMouseMove = (e) => {
    if (e.buttons !== 1 || !duration) return;
    const percent = getPercent(e.clientX);
    onSeek(percent * duration);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferWidth = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={trackRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        height: '6px',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: '999px',
        cursor: 'pointer',
        flex: 1,
      }}
    >
      {/* Buffered region */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${bufferWidth}%`,
          backgroundColor: 'rgba(255,255,255,0.35)',
          borderRadius: '999px',
          pointerEvents: 'none',
        }}
      />
      {/* Played region */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${progress}%`,
          backgroundColor: 'var(--accent)',
          borderRadius: '999px',
          pointerEvents: 'none',
          transition: 'width 200ms linear',
        }}
      />
      {/* Scrubber handle */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: `${progress}%`,
          transform: 'translate(-50%, -50%)',
          width: '14px',
          height: '14px',
          backgroundColor: 'var(--accent)',
          border: '2px solid var(--ink)',
          borderRadius: '50%',
          pointerEvents: 'none',
          boxShadow: '1px 1px 0px var(--ink)',
        }}
      />
    </div>
  );
}
