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

const ccBtn = (extra = {}) => ({
  ...iconBtn,
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.15rem 0.45rem',
  borderRadius: '4px',
  cursor: 'pointer',
  gap: '0.25rem',
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
  ...extra,
});

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
  onGenerateSubtitle,
  onStopGenerating,
  subtitleStatus = { state: 'idle' },
}) {

  const renderCC = () => {
    // 1. Has subtitle → CC toggle
    if (hasSubtitle) {
      return (
        <button
          style={ccBtn({
            fontSize: '0.75rem',
            fontWeight: 700,
            border: subtitlesEnabled ? '1.5px solid var(--accent)' : '1.5px solid rgba(255,255,255,0.3)',
            color: subtitlesEnabled ? 'var(--accent)' : 'rgba(255,255,255,0.6)',
          })}
          onClick={onToggleSubtitles}
          title="Toggle subtitles"
        >
          CC
        </button>
      );
    }

    switch (subtitleStatus.state) {
      case 'processing':
        return (
          <button
            style={ccBtn({
              border: '1.5px solid var(--accent)',
              color: 'var(--accent)',
            })}
            onClick={onStopGenerating}
            title="Click to stop generating"
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                border: '2px solid var(--accent)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }}
            />
            Generating...
          </button>
        );

      case 'queued':
        return (
          <button
            style={ccBtn({
              border: '1.5px solid rgba(255,255,255,0.35)',
              color: 'rgba(255,255,255,0.5)',
            })}
            onClick={onStopGenerating}
            title="Click to cancel"
          >
            🕐 Queue #{subtitleStatus.position ?? ''}
          </button>
        );

      case 'failed':
        return (
          <button
            style={ccBtn({
              border: '1.5px solid var(--secondary)',
              color: 'var(--secondary)',
            })}
            onClick={onGenerateSubtitle}
            title={`Failed: ${subtitleStatus.error}\nClick to retry`}
          >
            ⚠ Retry CC
          </button>
        );

      default:
        // idle / cancelled → generate
        return (
          <button
            style={ccBtn({
              border: '1.5px solid rgba(255,255,255,0.3)',
              color: 'var(--text-muted)',
            })}
            onClick={onGenerateSubtitle}
            title="Generate subtitles with AI"
          >
            ✨ CC
          </button>
        );
    }
  };

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

        {/* CC — full status */}
        {renderCC()}

        {/* Fullscreen */}
        <button style={iconBtn} onClick={onFullscreen} title="Fullscreen (F)">⛶</button>
      </div>
    </div>
  );
}
