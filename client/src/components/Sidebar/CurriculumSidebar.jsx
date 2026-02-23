import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SectionHeader } from './SectionHeader.jsx';
import { LessonItem } from './LessonItem.jsx';
import useUIStore from '../../store/useUIStore.js';

/**
 * Collect all section names that contain the active lesson (anywhere in subtree).
 */
function findActiveSections(tree, activeLessonId, path = []) {
  const found = new Set();

  const search = (node, currentPath) => {
    for (const lesson of node.lessons ?? []) {
      if (lesson.id === activeLessonId) {
        currentPath.forEach((p) => found.add(p));
      }
    }
    for (const section of node.sections ?? []) {
      const key = currentPath.concat(section.name).join('||');
      search(section, currentPath.concat(section.name));
      // If any descendant found this, it'll be in `found`
    }
  };

  const searchWithTrack = (node, currentPath) => {
    let hasActive = false;
    for (const lesson of node.lessons ?? []) {
      if (lesson.id === activeLessonId) {
        hasActive = true;
      }
    }
    for (const section of node.sections ?? []) {
      const newPath = currentPath.concat(section.name);
      if (searchWithTrack(section, newPath)) {
        hasActive = true;
      }
    }
    if (hasActive && currentPath.length > 0) {
      found.add(currentPath.join('||'));
    }
    return hasActive;
  };

  searchWithTrack(tree, path);
  return found;
}

function SectionTree({ node, courseId, activeLessonId, expandedSections, toggleSection }) {
  if (!node) return null;

  const renderSection = (section, pathPrefix) => {
    const key = pathPrefix ? `${pathPrefix}||${section.name}` : section.name;
    const isExpanded = expandedSections.has(key);

    const hasLessons =
      (section.lessons?.length > 0) ||
      (section.sections?.some((s) => s.lessons?.length > 0 || s.sections?.length > 0));

    if (!hasLessons) return null;

    return (
      <SectionHeader
        key={key}
        name={section.name}
        depth={section.depth ?? 1}
        expanded={isExpanded}
        onToggle={() => toggleSection(key)}
      >
        {section.lessons?.map((lesson) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            courseId={courseId}
            activeLessonId={activeLessonId}
          />
        ))}
        {section.sections?.map((sub) => renderSection(sub, key))}
      </SectionHeader>
    );
  };

  return (
    <>
      {node.lessons?.map((lesson) => (
        <LessonItem
          key={lesson.id}
          lesson={lesson}
          courseId={courseId}
          activeLessonId={activeLessonId}
        />
      ))}
      {node.sections?.map((section) => renderSection(section, ''))}
    </>
  );
}

export function CurriculumSidebar({ tree, flatLessons, courseId, activeLessonId }) {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const [expandedSections, setExpandedSections] = useState(new Set());

  // Auto-expand the section containing the active lesson
  useEffect(() => {
    if (!tree || !activeLessonId) return;
    const activePaths = findActiveSections(tree, activeLessonId);
    setExpandedSections((prev) => {
      const next = new Set(prev);
      activePaths.forEach((p) => next.add(p));
      return next;
    });
  }, [tree, activeLessonId]);

  const toggleSection = useCallback((key) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }, []);

  const sidebar = (
    <div
      style={{
        width: '300px',
        minWidth: '300px',
        backgroundColor: 'var(--surface)',
        borderRight: '2.5px solid var(--ink)',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '2.5px solid var(--ink)',
          backgroundColor: 'var(--depth-0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'Baloo 2, cursive',
            fontWeight: 800,
            fontSize: '0.9rem',
            color: 'var(--text)',
          }}
        >
          Course Content
        </span>
        <button
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            color: 'var(--text-muted)',
          }}
          title="Close sidebar"
        >
          ✕
        </button>
      </div>

      {/* Lessons */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '1rem' }}>
        {tree ? (
          <SectionTree
            node={tree}
            courseId={courseId}
            activeLessonId={activeLessonId}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
          />
        ) : (
          flatLessons?.map((lesson) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              activeLessonId={activeLessonId}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ height: '100%' }}>
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', height: '100%' }}
            >
              {sidebar}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="md:hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              bottom: 0,
              zIndex: 100,
              boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
            }}
          >
            {sidebar}
            {/* Backdrop */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: -1,
              }}
              onClick={toggleSidebar}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button when closed */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          style={{
            position: 'fixed',
            top: '1rem',
            left: '1rem',
            zIndex: 50,
            backgroundColor: 'var(--accent)',
            border: '2.5px solid var(--ink)',
            boxShadow: '3px 3px 0px var(--ink)',
            borderRadius: '10px',
            padding: '0.4rem 0.75rem',
            cursor: 'pointer',
            fontFamily: 'Nunito, sans-serif',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: 'var(--ink)',
          }}
          title="Open sidebar"
        >
          ☰ Lessons
        </button>
      )}
    </>
  );
}
