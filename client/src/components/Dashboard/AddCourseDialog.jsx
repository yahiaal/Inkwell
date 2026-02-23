import { useState } from 'react';
import { Modal } from '../UI/Modal.jsx';
import { Button } from '../UI/Button.jsx';
import { LoadingSpinner } from '../UI/LoadingSpinner.jsx';
import { FolderPickerModal } from '../UI/FolderPickerModal.jsx';
import { api } from '../../utils/api.js';
import useUIStore from '../../store/useUIStore.js';

export function AddCourseDialog({ open, onClose, onSuccess }) {
  const [folderPath, setFolderPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState(null);
  const addToast = useUIStore((s) => s.addToast);

  const handleFolderSelected = (selectedPath) => {
    setFolderPath(selectedPath);
    setPickerOpen(false);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!folderPath.trim()) return;

    setError(null);
    setLoading(true);
    try {
      const course = await api.courses.scan(folderPath.trim());
      addToast(`"${course.title}" added successfully!`, 'success');
      setFolderPath('');
      onSuccess(course);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to scan folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Add Course">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'Baloo 2, cursive',
                fontWeight: 700,
                fontSize: '0.9rem',
                color: 'var(--text)',
                marginBottom: '0.4rem',
              }}
            >
              Folder Path
            </label>

            {/* Input + Browse button */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                className="ink-input"
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="e.g. C:\Users\Me\Courses\Python Bootcamp"
                disabled={loading}
                autoFocus
                style={{ flex: 1 }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPickerOpen(true)}
                disabled={loading}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                📂 Browse
              </Button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontFamily: 'Nunito' }}>
              Click Browse to navigate your folders, or paste the path directly.
            </p>
          </div>

          {error && (
            <div
              className="ink-border"
              style={{
                backgroundColor: '#fff0f0',
                borderColor: 'var(--secondary)',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
                color: 'var(--secondary)',
                fontSize: '0.85rem',
                fontFamily: 'Nunito',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={loading || !folderPath.trim()}
            >
              {loading ? (
                <>
                  <LoadingSpinner size={16} />
                  Scanning...
                </>
              ) : (
                'Add Course'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Folder picker appears on top of the Add Course modal */}
      <FolderPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFolderSelected}
      />
    </>
  );
}
