import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { formatMinutes } from '../../utils/formatters.js';

function AnimatedNumber({ value, decimals = 0 }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString()
  );

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: 'easeOut' });
    return controls.stop;
  }, [value, mv]);

  return <motion.span>{display}</motion.span>;
}

function StatTile({ icon, label, value, sub }) {
  return (
    <div
      className="card-flat"
      style={{
        padding: '1rem 1.25rem',
        backgroundColor: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem',
        flex: 1,
        minWidth: '140px',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{icon}</span>
      <span
        className="font-display"
        style={{ fontSize: '1.8rem', color: 'var(--accent)', lineHeight: 1 }}
      >
        {value}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Nunito' }}>
        {label}
      </span>
      {sub && (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Nunito' }}>
          {sub}
        </span>
      )}
    </div>
  );
}

export function QuickStats({ stats }) {
  if (!stats) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '2rem',
      }}
    >
      <StatTile
        icon="📚"
        label="Total courses"
        value={<AnimatedNumber value={stats.totalCourses ?? 0} />}
      />
      <StatTile
        icon="⏱"
        label="Hours of content"
        value={<AnimatedNumber value={stats.totalHoursWatched ?? 0} decimals={1} />}
        sub="hours watched"
      />
      <StatTile
        icon="🔥"
        label="Day streak"
        value={<AnimatedNumber value={stats.currentStreak ?? 0} />}
        sub={`best: ${stats.longestStreak ?? 0} days`}
      />
      <StatTile
        icon="✅"
        label="Lessons done"
        value={<AnimatedNumber value={stats.totalLessonsCompleted ?? 0} />}
      />
    </div>
  );
}
