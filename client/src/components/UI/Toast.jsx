import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useUIStore from '../../store/useUIStore.js';

function ToastItem({ toast }) {
  const removeToast = useUIStore((s) => s.removeToast);

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  const bg = toast.type === 'success' ? 'var(--success)' : 'var(--secondary)';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      onClick={() => removeToast(toast.id)}
      className="ink-border ink-shadow cursor-pointer"
      style={{
        backgroundColor: bg,
        color: 'white',
        padding: '0.6rem 1rem',
        borderRadius: '12px',
        fontFamily: 'Nunito, sans-serif',
        fontWeight: 600,
        fontSize: '0.875rem',
        maxWidth: '360px',
        wordBreak: 'break-word',
      }}
    >
      {toast.message}
    </motion.div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'flex-end',
      }}
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
