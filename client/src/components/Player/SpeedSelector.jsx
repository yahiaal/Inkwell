import { useState } from 'react';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function SpeedSelector({ speed, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((o) => !o)}
        style={{ minWidth: '3.5rem', fontSize: '0.8rem', fontWeight: 700 }}
        title="Playback speed"
      >
        {speed}×
      </button>

      {open && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          />
          <div
            className="card-flat"
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              minWidth: '5rem',
              overflow: 'hidden',
              padding: '0.25rem 0',
              backgroundColor: 'var(--surface)',
            }}
          >
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '0.4rem 0.75rem',
                  textAlign: 'center',
                  fontFamily: 'Nunito, sans-serif',
                  fontWeight: s === speed ? 700 : 400,
                  fontSize: '0.85rem',
                  backgroundColor: s === speed ? 'var(--accent)' : 'transparent',
                  color: 'var(--text)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {s}×
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
