import { Modal } from './Modal.jsx';

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: '←', action: 'Seek −10 seconds' },
  { key: '→', action: 'Seek +10 seconds' },
  { key: '↑', action: 'Volume +10%' },
  { key: '↓', action: 'Volume −10%' },
  { key: 'N', action: 'Next lesson' },
  { key: 'P', action: 'Previous lesson' },
  { key: 'F', action: 'Toggle fullscreen' },
  { key: 'B', action: 'Add bookmark at current time' },
  { key: '?', action: 'Open this shortcuts modal' },
];

export function ShortcutsModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Keyboard Shortcuts" maxWidth="max-w-md">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--ink)' }}>
            <th
              style={{
                textAlign: 'left',
                padding: '0.4rem 0.75rem',
                fontFamily: 'Baloo 2, cursive',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
              }}
            >
              Key
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '0.4rem 0.75rem',
                fontFamily: 'Baloo 2, cursive',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
              }}
            >
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map(({ key, action }) => (
            <tr key={key} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
              <td style={{ padding: '0.5rem 0.75rem' }}>
                <kbd
                  className="ink-border"
                  style={{
                    display: 'inline-block',
                    padding: '0.1rem 0.5rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--accent)',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--ink)',
                    boxShadow: '2px 2px 0px var(--ink)',
                  }}
                >
                  {key}
                </kbd>
              </td>
              <td
                style={{
                  padding: '0.5rem 0.75rem',
                  fontFamily: 'Nunito, sans-serif',
                  color: 'var(--text)',
                }}
              >
                {action}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
