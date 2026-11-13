import clsx from 'clsx'

type BadgeVariant = 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'ghost'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  dot?: boolean
}

const variants: Record<BadgeVariant, string> = {
  primary: 'status-info',
  secondary: 'status-info',
  accent: 'status-info',
  info: 'status-info',
  success: 'status-pass',
  warning: 'status-warn',
  error: 'status-fail',
  ghost: 'status-neutral',
}

export default function Badge({ children, variant = 'primary', size = 'sm', dot }: BadgeProps) {
  return (
    <span className={clsx('status', variants[variant], size === 'md' && 'min-h-7 px-3 text-xs')}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  )
}
