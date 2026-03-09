import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LoadingSpinner } from './LoadingSpinner.jsx';

const BASE = 'http://localhost:3001';

async function listDir(dirPath) {
  const url = dirPath
    ? `${BASE}/api/browse-folder/list?path=${encodeURIComponent(dirPath)}`
    : `${BASE}/api/browse-folder/list`;
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to list directory');
  }
  return res.json();
}

async function getQuickAccess() {
  const res = await fetch(`${BASE}/api/browse-folder/quick-access`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.entries || [];
}

const QUICK_ICONS = {
  Desktop: '🖥️',
  Documents: '📄',
  Downloads: '⬇️',
  Videos: '🎬',
  Home: '🏠',
};

export function FolderPickerModal({ open, onClose, onSelect }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [quickAccess, setQuickAccess] = useState([]);
  const [addressValue, setAddressValue] = useState('');
  const [editingAddress, setEditingAddress] = useState(false);
  const addressRef = useRef(null);

  // Navigate to a directory
  const navigate = async (dirPath, pushHistory = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listDir(dirPath);
      if (pushHistory && currentPath !== null) {
        setHistory((h) => [...h, currentPath]);
      }
      setCurrentPath(data.path);
      setEntries(data.entries);
      setAddressValue(data.path || '');
      setEditingAddress(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load root + quick access on open
  useEffect(() => {
    if (open) {
      setHistory([]);
      setError(null);
      navigate(null);
      getQuickAccess().then(setQuickAccess);
    }
  }, [open]);

  const handleEnter = (entry) => {
    navigate(entry.fullPath, true);
  };

  const handleBack = () => {
    if (history.length === 0) {
      navigate(null);
      setHistory([]);
    } else {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      navigate(prev);
    }
  };

  const handleSelect = () => {
    if (currentPath) {
      onSelect(currentPath);
    }
  };

  // Navigate to a specific breadcrumb segment
  const handleBreadcrumbClick = (targetPath) => {
    if (targetPath === currentPath) return;
    navigate(targetPath, true);
  };

  // Address bar submit
  const handleAddressSubmit = (e) => {
    e.preventDefault();
    const trimmed = addressValue.trim();
    if (trimmed) {
      navigate(trimmed, true);
    }
  };

  // Build breadcrumb segments
  const getBreadcrumbs = () => {
    if (!currentPath) return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);
    const crumbs = [];

    // On Windows, first part is like "C:" — reconstruct proper paths
    const isWindows = /^[A-Za-z]:/.test(currentPath);

    parts.forEach((part, i) => {
      let fullPath;
      if (isWindows) {
        if (i === 0) {
          fullPath = part + '\\';
        } else {
          fullPath = parts.slice(0, i + 1).join('\\');
          // Ensure drive letter has backslash
          fullPath = fullPath.replace(/^([A-Za-z]:)([^\\])/, '$1\\$2');
        }
      } else {
        fullPath = '/' + parts.slice(0, i + 1).join('/');
      }
      crumbs.push({ name: part, fullPath });
    });

    return crumbs;
  };

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const breadcrumbs = getBreadcrumbs();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 60,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
          }}
        >
          {/* Backdrop */}
          <div
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(10,10,30,0.75)' }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'relative', zIndex: 1,
              backgroundColor: 'var(--surface)',
              border: '2.5px solid var(--ink)',
              boxShadow: '6px 6px 0px var(--ink)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '700px',
              display: 'flex',
              flexDirection: 'column',
              height: '75vh',
              maxHeight: '600px',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '0.6rem 1rem',
              borderBottom: '2px solid var(--ink)',
              backgroundColor: 'var(--depth-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: 'Baloo 2, cursive', fontWeight: 800,
                fontSize: '1rem', color: 'var(--text)',
              }}>
                Select a Folder
              </span>
              <button
                onClick={onClose}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '1.3rem', color: 'var(--text-muted)', lineHeight: 1,
                  padding: '0.2rem',
                }}
              >×</button>
            </div>

            {/* Toolbar: Back + Breadcrumbs/Address */}
            <div style={{
              padding: '0.4rem 0.75rem',
              borderBottom: '1.5px solid rgba(255,255,255,0.06)',
              backgroundColor: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexShrink: 0,
            }}>
              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={currentPath === null && history.length === 0}
                style={{
                  background: 'none', border: '1.5px solid var(--ink)',
                  borderRadius: '8px', cursor: currentPath === null && history.length === 0 ? 'default' : 'pointer',
                  padding: '0.25rem 0.5rem', fontSize: '0.85rem',
                  color: currentPath === null && history.length === 0 ? 'var(--text-muted)' : 'var(--text)',
                  opacity: currentPath === null && history.length === 0 ? 0.4 : 1,
                  fontFamily: 'Nunito', fontWeight: 600,
                  display: 'flex', alignItems: 'center',
                }}
                title="Go back"
              >
                ←
              </button>

              {/* Breadcrumb / Address bar */}
              <div
                onClick={() => {
                  setEditingAddress(true);
                  setAddressValue(currentPath || '');
                  setTimeout(() => addressRef.current?.select(), 0);
                }}
                style={{
                  flex: 1, minWidth: 0,
                  border: '1.5px solid var(--ink)',
                  borderRadius: '8px',
                  padding: '0.3rem 0.6rem',
                  backgroundColor: editingAddress ? '#fff' : 'rgba(255,255,255,0.04)',
                  cursor: 'text',
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: '2rem',
                }}
              >
                {editingAddress ? (
                  <form onSubmit={handleAddressSubmit} style={{ width: '100%' }}>
                    <input
                      ref={addressRef}
                      autoFocus
                      type="text"
                      value={addressValue}
                      onChange={(e) => setAddressValue(e.target.value)}
                      onBlur={() => setEditingAddress(false)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditingAddress(false); }}
                      style={{
                        width: '100%', border: 'none', outline: 'none',
                        fontFamily: 'monospace', fontSize: '0.82rem',
                        background: 'transparent', color: '#1b1f3b',
                      }}
                    />
                  </form>
                ) : (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.15rem',
                    overflow: 'hidden', whiteSpace: 'nowrap',
                    fontFamily: 'Nunito', fontSize: '0.82rem',
                  }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(null); setHistory([]); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent)', fontWeight: 700, fontSize: '0.82rem',
                        padding: '0 0.2rem', fontFamily: 'Nunito', flexShrink: 0,
                      }}
                    >
                      💻 This PC
                    </button>
                    {breadcrumbs.map((crumb, i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', margin: '0 0.1rem', fontSize: '0.7rem' }}>›</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBreadcrumbClick(crumb.fullPath); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: i === breadcrumbs.length - 1 ? 'var(--text)' : 'var(--accent)',
                            fontWeight: i === breadcrumbs.length - 1 ? 700 : 500,
                            fontSize: '0.82rem', padding: '0 0.15rem',
                            fontFamily: 'Nunito',
                          }}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Body: Quick access sidebar + Directory listing */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Quick Access sidebar */}
              <div style={{
                width: '160px', flexShrink: 0,
                borderRight: '1.5px solid rgba(255,255,255,0.06)',
                overflowY: 'auto',
                padding: '0.5rem 0',
              }}>
                <p style={{
                  padding: '0.2rem 0.75rem 0.4rem',
                  fontSize: '0.7rem', fontFamily: 'Nunito',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 700,
                }}>
                  Quick Access
                </p>
                {quickAccess.map((qa) => (
                  <button
                    key={qa.fullPath}
                    onClick={() => navigate(qa.fullPath, true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      width: '100%', padding: '0.35rem 0.75rem',
                      background: currentPath === qa.fullPath ? 'var(--accent)' : 'none',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'Nunito', fontSize: '0.8rem',
                      color: currentPath === qa.fullPath ? 'var(--ink)' : 'var(--text)',
                      fontWeight: currentPath === qa.fullPath ? 700 : 500,
                      borderRadius: '6px', margin: '0 0.3rem',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => { if (currentPath !== qa.fullPath) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={(e) => { if (currentPath !== qa.fullPath) e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>
                      {QUICK_ICONS[qa.name] || '📁'}
                    </span>
                    <span>{qa.name}</span>
                  </button>
                ))}

                {/* Drives section */}
                <p style={{
                  padding: '0.6rem 0.75rem 0.4rem',
                  fontSize: '0.7rem', fontFamily: 'Nunito',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.05em', fontWeight: 700,
                }}>
                  Drives
                </p>
                {entries.length > 0 && currentPath === null && entries.map((drive) => (
                  <button
                    key={drive.fullPath}
                    onClick={() => navigate(drive.fullPath, true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      width: '100%', padding: '0.35rem 0.75rem',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', fontFamily: 'Nunito', fontSize: '0.8rem',
                      color: 'var(--text)', fontWeight: 500,
                      borderRadius: '6px', margin: '0 0.3rem',
                      transition: 'background 80ms',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '0.9rem' }}>💾</span>
                    <span>{drive.name}</span>
                  </button>
                ))}
              </div>

              {/* Main directory listing */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <LoadingSpinner size={28} style={{ color: 'var(--accent)' }} />
                  </div>
                ) : error ? (
                  <div style={{
                    padding: '1.5rem', textAlign: 'center',
                    color: 'var(--secondary)', fontSize: '0.85rem', fontFamily: 'Nunito',
                  }}>
                    <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚠️</p>
                    <p>{error}</p>
                    <button
                      onClick={handleBack}
                      className="btn btn-ghost btn-sm"
                      style={{ marginTop: '0.75rem' }}
                    >
                      ← Go Back
                    </button>
                  </div>
                ) : currentPath === null ? (
                  /* Drives view */
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '0.5rem', padding: '0.5rem',
                  }}>
                    {entries.map((drive) => (
                      <button
                        key={drive.fullPath}
                        onClick={() => handleEnter(drive)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: '0.4rem', padding: '1rem 0.5rem',
                          background: 'none', border: '1.5px solid rgba(255,255,255,0.08)',
                          borderRadius: '12px', cursor: 'pointer',
                          fontFamily: 'Nunito', fontSize: '0.85rem',
                          color: 'var(--text)', transition: 'all 80ms',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.borderColor = 'var(--accent)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                      >
                        <span style={{ fontSize: '2rem' }}>💾</span>
                        <span style={{ fontWeight: 600 }}>{drive.name}</span>
                      </button>
                    ))}
                  </div>
                ) : entries.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', height: '100%',
                    color: 'var(--text-muted)', fontFamily: 'Nunito', fontSize: '0.875rem',
                  }}>
                    <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📂</p>
                    <p>No subfolders here</p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.3rem' }}>You can select this folder</p>
                  </div>
                ) : (
                  entries.map((entry) => (
                    <button
                      key={entry.fullPath}
                      onClick={() => handleEnter(entry)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        width: '100%', padding: '0.4rem 0.6rem',
                        background: 'none', border: 'none', borderRadius: '8px',
                        cursor: 'pointer', textAlign: 'left',
                        fontFamily: 'Nunito', fontSize: '0.85rem',
                        color: 'var(--text)', transition: 'background 80ms',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '1rem', flexShrink: 0 }}>📁</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>›</span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '0.6rem 1rem',
              borderTop: '2px solid var(--ink)',
              backgroundColor: 'var(--depth-0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexShrink: 0,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: '0.78rem', fontFamily: 'monospace',
                    color: currentPath ? 'var(--text)' : 'var(--text-muted)',
                    fontWeight: currentPath ? 600 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={currentPath || ''}
                >
                  {currentPath || 'Navigate to a folder and click Select'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button onClick={onClose} className="btn btn-ghost btn-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSelect}
                  className="btn btn-primary btn-sm"
                  disabled={!currentPath}
                  style={{
                    opacity: !currentPath ? 0.5 : 1,
                    cursor: !currentPath ? 'not-allowed' : 'pointer',
                  }}
                >
                  Select Folder
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
