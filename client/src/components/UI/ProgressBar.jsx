export function ProgressBar({ percent = 0, className = '', height = 10 }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className={`progress-track ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
