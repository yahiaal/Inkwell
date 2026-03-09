import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastContainer } from './components/UI/Toast.jsx';
import { SubtitleQueuePanel } from './components/Subtitles/SubtitleQueuePanel.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CourseDetail from './pages/CourseDetail.jsx';
import CoursePlayer from './pages/CoursePlayer.jsx';
import Stats from './pages/Stats.jsx';
import Settings from './pages/Settings.jsx';
import useUIStore from './store/useUIStore.js';

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

const pageTransition = { duration: 0.2, ease: 'easeOut' };

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/course/:id" element={<CourseDetail />} />
          <Route path="/course/:id/play/:lessonId" element={<CoursePlayer />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function NavBar() {
  const location = useLocation();
  const isPlayer = location.pathname.includes('/play/');

  const isQueueOpen = useUIStore((s) => s.queuePanelOpen);
  const toggleQueue = useUIStore((s) => s.toggleQueuePanel);

  if (isPlayer) return null;

  const linkStyle = ({ isActive }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.35rem 0.75rem',
    borderRadius: '8px',
    border: isActive ? '2px solid var(--ink)' : '2px solid transparent',
    backgroundColor: isActive ? 'var(--accent)' : 'transparent',
    color: isActive ? 'var(--ink)' : 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontFamily: 'Nunito, sans-serif',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'all 80ms',
  });

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1.5rem',
        borderBottom: '2.5px solid rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(27,31,59,0.95)',
        backdropFilter: 'blur(8px)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <NavLink
        to="/"
        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
      >
        <img
          src="/logo.png"
          alt="Inkwell"
          style={{
            width: '36px',
            height: '36px',
            objectFit: 'contain',
            border: '2px solid var(--ink)',
            borderRadius: '10px',
            boxShadow: '2px 2px 0px var(--ink)',
          }}
        />
        <span
          className="font-display"
          style={{ fontSize: '1.2rem', color: 'var(--accent)', letterSpacing: '-0.02em' }}
        >
          Inkwell
        </span>
      </NavLink>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        <button
          onClick={toggleQueue}
          style={linkStyle({ isActive: isQueueOpen })}
          title="Subtitle Queue"
        >
          🎙 <span style={{ fontFamily: 'Baloo 2', fontSize: '1rem', lineHeight: 1 }}>CC Queue</span>
        </button>
        <NavLink to="/" end style={linkStyle}>
          🏠 Library
        </NavLink>
        <NavLink to="/stats" style={linkStyle}>
          📊 Stats
        </NavLink>
        <NavLink to="/settings" style={linkStyle}>
          ⚙️ Settings
        </NavLink>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <NavBar />
        <AnimatedRoutes />
        <ToastContainer />
        <SubtitleQueuePanel />
      </div>
    </BrowserRouter>
  );
}
