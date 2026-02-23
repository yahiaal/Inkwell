import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner.jsx';

const BASE_URL = import.meta.env.VITE_API_URL;

async function listDir(dirPath) {
  const url = dirPath
    ? `${BASE_URL}/api/browse-folder/list?path=${encodeURIComponent(dirPath)}`
    : `${BASE_URL}/api/browse-folder/list`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to list directory');
  return res.json();
}

export function FolderPickerModal({ open, onClose, onSelect }) {
  const [currentPath, setCurrentPath] = useState(null); // null = drives/root
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]); // for back navigation

  const navigate = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDir(dirPath);
      setCurrentPath(data.path);
      setEntries(data.entries);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load root on open
  useEffect(() => {
    if (open) {
      setHistory([]);
      navigate(null);
    }
  }, [open, navigate]);

  const handleEnter = (entry) => {
    setHistory((h) => [...h, currentPath]);
    navigate(entry.fullPath);
  };

  const handleBack = () => {
    const prev = history[history.length - 1] ?? null;
    setHistory((h) => h.slice(0, -1));
    navigate(prev);
  };

  const handleSelect = () => {
    if (currentPath) onSelect(currentPath);
  };

  // Build breadcrumb parts from currentPath
  const breadcrumbs = currentPath
    ? currentPath.replace(/\\/g, '/').split('/').filter(Boolean)
    : [];

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(26,26,46,0.7)' }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.93, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            style={{
              position: 'relative', zIndex: 1,
              backgroundColor: 'var(--surface)',
              border: '2.5px solid var(--ink)',
              boxShadow: '6px 6px 0px var(--ink)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '2px solid var(--ink)',
              backgroundColor: 'var(--depth-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'Baloo 2, cursive', fontWeight: 800, fontSize: '1rem', color: 'var(--text)' }}>
                📂 Browse for Folder
              </span>
              <button
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-muted)', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Breadcrumb / current path */}
            <div style={{
              padding: '0.5rem 1rem',
              borderBottom: '2px solid var(--ink)',
              backgroundColor: 'var(--surface-alt)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0,
              flexWrap: 'wrap',
              minHeight: '2.5rem',
            }}>
              <button
                onClick={() => { setHistory([]); navigate(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Nunito', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 700, padding: '0.1rem 0.2rem' }}
              >
                🖥 My Computer
              </button>
              {breadcrumbs.map((part, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>›</span>
                  <span style={{ fontFamily: 'Nunito', fontSize: '0.8rem', color: 'var(--text)', fontWeight: 500 }}>
                    {part}
                  </span>
                </span>
              ))}
            </div>

            {/* Directory listing */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                  <LoadingSpinner size={28} style={{ color: 'var(--accent)' }} />
                </div>
              ) : error ? (
                <div style={{ padding: '1rem', color: 'var(--secondary)', fontSize: '0.875rem', fontFamily: 'Nunito' }}>
                  ⚠️ {error}
                </div>
              ) : entries.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', fontFamily: 'Nunito' }}>
                  This folder is empty.
                </div>
              ) : (
                entries.map((entry) => (
                  <button
                    key={entry.fullPath}
                    onClick={() => handleEnter(entry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.45rem 0.6rem',
                      background: 'none',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'Nunito, sans-serif',
                      fontSize: '0.875rem',
                      color: 'var(--text)',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-alt)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>📁</span>
                    <span className="line-clamp-1" style={{ flex: 1 }}>{entry.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>›</span>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '2px solid var(--ink)',
              backgroundColor: 'var(--surface-alt)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexShrink: 0,
            }}>
              {/* Current path display */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Nunito', marginBottom: '0.1rem' }}>
                  Selected folder:
                </p>
                <p
                  className="line-clamp-1"
                  style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: currentPath ? 'var(--text)' : 'var(--text-muted)', fontWeight: currentPath ? 600 : 400 }}
                >
                  {currentPath || 'No folder selected'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {history.length > 0 && (
                  <button
                    onClick={handleBack}
                    className="btn btn-ghost btn-sm"
                  >
                    ← Back
                  </button>
                )}
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSelect}
                  className="btn btn-primary btn-sm"
                  disabled={!currentPath}
                  style={{ opacity: !currentPath ? 0.5 : 1, cursor: !currentPath ? 'not-allowed' : 'pointer' }}
                >
                  Select This Folder
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
