import { useEffect } from 'react';

/**
 * Register keyboard shortcuts for the video player.
 * @param {object} handlers - Map of key → handler function
 * @param {boolean} enabled - Whether shortcuts are active
 */
export function useKeyboardShortcuts(handlers, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      // Don't fire shortcuts when typing in inputs or textareas
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      const key = e.key;
      const handler = handlers[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers, enabled]);
}
