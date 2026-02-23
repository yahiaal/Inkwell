export function Badge({ children, variant = 'accent', className = '' }) {
  const cls = {
    accent: 'badge-accent',
    success: 'badge-success',
    muted: 'badge-muted',
    coral: 'badge-coral',
  }[variant] ?? 'badge-accent';

  return <span className={`badge ${cls} ${className}`}>{children}</span>;
}
