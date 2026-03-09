import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/UI/Button.jsx';
import { Modal } from '../components/UI/Modal.jsx';
import { LoadingSpinner } from '../components/UI/LoadingSpinner.jsx';
import { api } from '../utils/api.js';
import useUIStore from '../store/useUIStore.js';

const SPEEDS = ['0.5', '0.75', '1', '1.25', '1.5', '1.75', '2'];

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
  { key: '?', action: 'Open keyboard shortcuts modal' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '48px',
        height: '26px',
        borderRadius: '999px',
        border: '2.5px solid var(--ink)',
        backgroundColor: checked ? 'var(--accent)' : 'var(--surface-alt)',
        position: 'relative',
        cursor: 'pointer',
        boxShadow: '2px 2px 0px var(--ink)',
        transition: 'background 120ms',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: 'var(--ink)',
          position: 'absolute',
          top: '3px',
          left: checked ? '25px' : '3px',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}

function WhisperStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.subtitles.check()
      .then((data) => setStatus(data))
      .catch(() => setStatus({ available: false, reason: 'Could not reach server' }));
  }, []);

  if (!status) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Checking Whisper availability...</p>;
  }

  return status.available ? (
    <p style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 600 }}>
      ✅ Whisper is ready
    </p>
  ) : (
    <div>
      <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>
        ❌ Whisper not found
      </p>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        Run: <code style={{ backgroundColor: 'var(--surface-alt)', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid var(--ink)', fontFamily: 'monospace', fontSize: '0.76rem' }}>pip install faster-whisper</code>
      </p>
    </div>
  );
}

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [clearProgressOpen, setClearProgressOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    api.settings.get()
      .then((data) => { setSettings(data); })
      .catch((err) => addToast('Failed to load settings: ' + err.message))
      .finally(() => setLoading(false));
  }, [addToast]);

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: String(value) };
    setSettings(newSettings);
    try {
      await api.settings.update({ [key]: value });
    } catch (err) {
      addToast('Failed to save: ' + err.message);
    }
  };

  const handleClearProgress = async () => {
    try {
      // We call a direct fetch since api module doesn't have a clear-progress endpoint
      await fetch(`http://localhost:3001/api/progress/clear-all`, { method: 'DELETE' });
      addToast('All progress cleared.', 'success');
    } catch {
      addToast('Failed to clear progress.');
    }
    setClearProgressOpen(false);
  };

  const handleClearAll = async () => {
    try {
      const courses = await api.courses.list();
      await Promise.all(courses.map((c) => api.courses.remove(c.id)));
      addToast('All courses removed.', 'success');
    } catch (err) {
      addToast('Failed: ' + err.message);
    }
    setClearAllOpen(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <LoadingSpinner size={40} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  const row = (label, desc, control) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 0',
        borderBottom: '1px solid var(--surface-alt)',
        gap: '1rem',
      }}
    >
      <div>
        <p style={{ fontFamily: 'Baloo 2', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>{label}</p>
        {desc && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{desc}</p>}
      </div>
      {control}
    </div>
  );

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <Link to="/" style={{ color: 'var(--surface)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '1.5rem' }}>
        ← Back
      </Link>
      <h1 className="font-display" style={{ fontSize: '2rem', color: 'var(--surface)', marginBottom: '2rem' }}>Settings</h1>

      {/* Preferences */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-flat"
        style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', marginBottom: '2rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '0.25rem' }}>Preferences</h2>

        {row('Default Playback Speed', 'Speed applied when you open a new lesson',
          <select
            className="ink-input"
            style={{ width: 'auto', minWidth: '80px' }}
            value={settings.default_speed ?? '1'}
            onChange={(e) => updateSetting('default_speed', e.target.value)}
          >
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        )}

        {row('Auto-advance', 'Automatically play the next lesson when the current one ends',
          <Toggle
            checked={settings.auto_advance !== 'false'}
            onChange={(v) => updateSetting('auto_advance', v)}
          />
        )}

        {row('Completion Threshold', `A lesson is marked complete when ${settings.completion_threshold ?? 85}% is watched`,
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={settings.completion_threshold ?? 85}
              onChange={(e) => updateSetting('completion_threshold', e.target.value)}
              style={{ accentColor: 'var(--accent)', width: '120px' }}
            />
            <span style={{ fontFamily: 'Nunito', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', minWidth: '36px' }}>
              {settings.completion_threshold ?? 85}%
            </span>
          </div>
        )}
      </motion.div>

      {/* Keyboard Shortcuts Reference */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="card-flat"
        style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', marginBottom: '2rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '1rem' }}>
          Keyboard Shortcuts
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <tbody>
            {SHORTCUTS.map(({ key, action }) => (
              <tr key={key} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                <td style={{ padding: '0.4rem 0.5rem', width: '80px' }}>
                  <kbd style={{ display: 'inline-block', padding: '0.1rem 0.5rem', borderRadius: '6px', backgroundColor: 'var(--accent)', border: '1.5px solid var(--ink)', fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, boxShadow: '2px 2px 0px var(--ink)' }}>
                    {key}
                  </kbd>
                </td>
                <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text)', fontFamily: 'Nunito' }}>{action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* AI Subtitle Generation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-flat"
        style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', marginBottom: '2rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '0.5rem' }}>
          AI Subtitle Generation
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Generate subtitles for lessons that don't have them. Uses Whisper (small model) running locally on your machine. Processing happens one video at a time in the background.
        </p>
        <WhisperStatus />
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="card-flat"
        style={{ backgroundColor: '#fff0f0', borderColor: 'var(--secondary)', padding: '1.5rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--secondary)', marginBottom: '1rem' }}>
          Danger Zone
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontFamily: 'Baloo 2', color: 'var(--text)' }}>Clear All Progress Data</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Wipes watch history and stats. Keeps courses and notes.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setClearProgressOpen(true)}>
              Clear Progress
            </Button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 700, fontFamily: 'Baloo 2', color: 'var(--text)' }}>Remove All Courses</p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Removes all courses from the database. Files on disk are untouched.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setClearAllOpen(true)}>
              Remove All
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Confirm modals */}
      <Modal open={clearProgressOpen} onClose={() => setClearProgressOpen(false)} title="Clear All Progress?">
        <p style={{ color: 'var(--text)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          This will permanently delete all watch history and learning stats. Courses, bookmarks, and notes will be kept.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setClearProgressOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleClearProgress}>Clear Progress</Button>
        </div>
      </Modal>

      <Modal open={clearAllOpen} onClose={() => setClearAllOpen(false)} title="Remove All Courses?">
        <p style={{ color: 'var(--text)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          This will remove every course and all associated data from the database. Your video files will not be touched.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={() => setClearAllOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={handleClearAll}>Remove Everything</Button>
        </div>
      </Modal>
    </div>
  );
}
