import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { ProgressBar } from '../components/UI/ProgressBar.jsx';
import { LoadingSpinner } from '../components/UI/LoadingSpinner.jsx';
import { api } from '../utils/api.js';
import { formatRelativeDate, formatMinutes } from '../utils/formatters.js';
import useUIStore from '../store/useUIStore.js';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card-flat" style={{ backgroundColor: 'var(--surface)', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
      <p style={{ fontWeight: 700, color: 'var(--text)' }}>{label}</p>
      <p style={{ color: 'var(--accent)' }}>{payload[0]?.value ?? 0} min</p>
    </div>
  );
};

export default function Stats() {
  const [overview, setOverview] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [perCourse, setPerCourse] = useState([]);
  const [loading, setLoading] = useState(true);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, wk, pc] = await Promise.all([
          api.stats.overview(),
          api.stats.weekly(),
          api.stats.perCourse(),
        ]);
        setOverview(ov);
        setWeekly(wk);
        setPerCourse(pc);
      } catch (err) {
        addToast('Failed to load stats: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [addToast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <LoadingSpinner size={40} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <Link to="/" style={{ color: 'var(--surface)', fontSize: '0.875rem', textDecoration: 'none', display: 'inline-block', marginBottom: '1.5rem' }}>
        ← Back
      </Link>

      <h1 className="font-display" style={{ fontSize: '2rem', color: 'var(--surface)', marginBottom: '2rem' }}>
        Learning Stats
      </h1>

      {/* Highlights */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}
      >
        {[
          { icon: '🔥', label: 'Current Streak', value: `${overview?.currentStreak ?? 0} days`, sub: `Best: ${overview?.longestStreak ?? 0} days` },
          { icon: '⏱', label: 'Total Hours', value: `${overview?.totalHoursWatched ?? 0}h` },
          { icon: '✅', label: 'Lessons Done', value: overview?.totalLessonsCompleted ?? 0 },
          { icon: '🎓', label: 'Courses Finished', value: overview?.totalCoursesCompleted ?? 0 },
        ].map(({ icon, label, value, sub }) => (
          <div
            key={label}
            className="card-flat"
            style={{ backgroundColor: 'var(--surface)', padding: '1rem 1.25rem', flex: 1, minWidth: '130px' }}
          >
            <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{icon}</div>
            <div className="font-display" style={{ fontSize: '1.6rem', color: 'var(--accent)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{label}</div>
            {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>}
          </div>
        ))}
      </motion.div>

      {/* Weekly chart */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-flat"
        style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', marginBottom: '2rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '1rem' }}>
          Weekly Activity
        </h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
            <XAxis dataKey="day" tick={{ fontFamily: 'Nunito', fontSize: 12 }} />
            <YAxis tick={{ fontFamily: 'Nunito', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="minutesWatched" fill="var(--accent)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Per-course table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card-flat"
        style={{ backgroundColor: 'var(--surface)', padding: '1.5rem' }}
      >
        <h2 className="font-display" style={{ fontSize: '1.2rem', color: 'var(--text)', marginBottom: '1rem' }}>
          Per-Course Breakdown
        </h2>
        {perCourse.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No data yet. Start watching to see your stats here!
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'Nunito' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--ink)' }}>
                  {['Course', 'Time Spent', 'Lessons Done', 'Progress', 'Last Accessed', 'Est. Remaining'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.5rem', color: 'var(--text-muted)', fontFamily: 'Baloo 2', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perCourse.map((row) => (
                  <tr key={row.courseId} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                    <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600, color: 'var(--text)', maxWidth: '200px' }}>
                      <Link to={`/course/${row.courseId}`} style={{ color: 'var(--text)', textDecoration: 'none' }} className="line-clamp-1">
                        {row.title}
                      </Link>
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatMinutes(row.timeSpentMinutes)}
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {row.lessonsCompleted} / {row.totalLessons}
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', minWidth: '100px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <ProgressBar percent={row.percentComplete} style={{ flex: 1 }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.percentComplete}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {formatRelativeDate(row.lastAccessed)}
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {row.estRemainingDays != null ? `~${row.estRemainingDays}d` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
