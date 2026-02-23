import { motion } from 'framer-motion';

const springTap = { scale: 0.96, transition: { type: 'spring', stiffness: 400, damping: 17 } };

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const variantClass = {
    primary: 'btn-primary',
    destructive: 'btn-destructive',
    ghost: 'btn-ghost',
    success: 'btn-success',
  }[variant] ?? 'btn-primary';

  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'icon' ? 'btn-icon' : '';

  return (
    <motion.button
      type={type}
      whileTap={disabled ? undefined : springTap}
      className={`btn ${variantClass} ${sizeClass} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  );
}
