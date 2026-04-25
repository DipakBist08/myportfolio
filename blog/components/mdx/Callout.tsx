import { ReactNode } from 'react'
import clsx from 'clsx'

type CalloutType = 'info' | 'warning' | 'success' | 'error' | 'tip'

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: ReactNode
}

const config: Record<CalloutType, { icon: string; label: string; classes: string; titleClass: string }> = {
  info: {
    icon: 'ℹ️',
    label: 'Info',
    classes: 'border-accent/40 bg-accent/5',
    titleClass: 'text-accent',
  },
  warning: {
    icon: '⚠️',
    label: 'Warning',
    classes: 'border-yellow-500/40 bg-yellow-500/5',
    titleClass: 'text-yellow-400',
  },
  success: {
    icon: '✅',
    label: 'Success',
    classes: 'border-green-500/40 bg-green-500/5',
    titleClass: 'text-green-400',
  },
  error: {
    icon: '❌',
    label: 'Error',
    classes: 'border-red-500/40 bg-red-500/5',
    titleClass: 'text-red-400',
  },
  tip: {
    icon: '💡',
    label: 'Tip',
    classes: 'border-primary/40 bg-primary/5',
    titleClass: 'text-primary-light',
  },
}

export default function Callout({ type = 'info', title, children }: CalloutProps) {
  const { icon, label, classes, titleClass } = config[type]

  return (
    <div className={clsx('my-5 rounded-xl border-l-4 p-4', classes)}>
      <div className={clsx('mb-1.5 flex items-center gap-2 text-sm font-semibold', titleClass)}>
        <span aria-hidden="true">{icon}</span>
        <span>{title ?? label}</span>
      </div>
      <div className="text-sm text-slate-300 light:text-slate-600 [&>p]:m-0 [&>p+p]:mt-2">
        {children}
      </div>
    </div>
  )
}
