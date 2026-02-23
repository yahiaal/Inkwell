import { SeekBar } from './SeekBar.jsx';
import { SpeedSelector } from './SpeedSelector.jsx';
import { formatTime } from '../../utils/formatters.js';

const iconBtn = {
  background: 'none',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  padding: '0.3rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '6px',
  transition: 'background 80ms',
  fontSize: '1.1rem',
};

export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  buffered,
  speed,
  subtitlesEnabled,
  hasSubtitle,
  onPlayPause,
  onSeek,
  onVolume,
  onMute,
  onSpeed,
  onToggleSubtitles,
  onFullscreen,
  onPrev,
  onNext,
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(26,26,46,0.95)',
        padding: '0.6rem 1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        borderTop: '2px solid var(--ink)',
      }}
    >
      {/* Seek bar row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', whiteSpace: 'nowrap', fontFamily: 'Nunito' }}>
          {formatTime(currentTime)}
        </span>
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          onSeek={onSeek}
        />
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.78rem', whiteSpace: 'nowrap', fontFamily: 'Nunito' }}>
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Prev */}
        <button style={iconBtn} onClick={onPrev} title="Previous lesson (P)">⏮</button>

        {/* Play/Pause */}
        <button
          style={{ ...iconBtn, fontSize: '1.5rem', padding: '0.25rem 0.5rem' }}
          onClick={onPlayPause}
          title="Play/Pause (Space)"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Next */}
        <button style={iconBtn} onClick={onNext} title="Next lesson (N)">⏭</button>

        {/* Volume */}
        <button style={iconBtn} onClick={onMute} title="Mute/Unmute">
          {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolume(parseFloat(e.target.value))}
          style={{ width: '80px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          title="Volume"
        />

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Speed */}
        <SpeedSelector speed={speed} onChange={onSpeed} />

        {/* CC */}
        {hasSubtitle && (
          <button
            style={{
              ...iconBtn,
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.4rem',
              border: subtitlesEnabled ? '1.5px solid var(--accent)' : '1.5px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              color: subtitlesEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
            }}
            onClick={onToggleSubtitles}
            title="Toggle subtitles"
          >
            CC
          </button>
        )}

        {/* Fullscreen */}
        <button style={iconBtn} onClick={onFullscreen} title="Fullscreen (F)">⛶</button>
      </div>
    </div>
  );
}
