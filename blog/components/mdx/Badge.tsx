import clsx from 'clsx'

type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'ghost'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
}

const variants: Record<BadgeVariant, string> = {
  primary: 'bg-primary/10 text-primary-light border-primary/30',
  secondary: 'bg-secondary/10 text-secondary border-secondary/30',
  accent: 'bg-accent/10 text-accent border-accent/30',
  success: 'bg-green-500/10 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  ghost: 'bg-slate-700/30 text-slate-400 border-slate-700/50',
}

const dotColors: Record<BadgeVariant, string> = {
  primary: 'bg-primary-light',
  secondary: 'bg-secondary',
  accent: 'bg-accent',
  success: 'bg-green-400',
  warning: 'bg-yellow-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
  ghost: 'bg-slate-400',
}

export default function Badge({ children, variant = 'primary', size = 'sm', dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variants[variant]
      )}
    >
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  )
}
