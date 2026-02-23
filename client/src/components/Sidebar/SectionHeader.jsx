import { motion, AnimatePresence } from 'framer-motion';

const depthBg = ['var(--depth-0)', 'var(--depth-1)', 'var(--depth-2)'];

export function SectionHeader({ name, depth, expanded, onToggle, children }) {
  const bg = depthBg[Math.min(depth, 2)];

  return (
    <div>
      <motion.div
        initial={{ scale: 0.97 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: `0.45rem 0.75rem`,
          paddingLeft: `${0.75 + depth * 0.75}rem`,
          backgroundColor: bg,
          borderBottom: '2px solid var(--ink)',
          cursor: 'pointer',
          userSelect: 'none',
          fontFamily: 'Baloo 2, cursive',
          fontWeight: 700,
          fontSize: depth === 0 ? '0.95rem' : '0.85rem',
          color: 'var(--text)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.7rem',
            transition: 'transform 200ms ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          ▶
        </span>
        <span className="line-clamp-1">{name}</span>
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
