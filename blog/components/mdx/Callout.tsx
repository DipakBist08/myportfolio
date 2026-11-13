import { ReactNode } from 'react'
import clsx from 'clsx'
import { PIcon, type IconName } from './icons'

type CalloutType = 'info' | 'warning' | 'success' | 'error' | 'tip'

interface CalloutProps {
  type?: CalloutType
  title?: string
  children: ReactNode
}

const config: Record<CalloutType, { icon: IconName; label: string; titleClass: string; barClass: string }> = {
  info: { icon: 'info', label: 'Info', titleClass: 'text-primary-light', barClass: 'border-l-primary' },
  warning: { icon: 'warning', label: 'Warning', titleClass: 'text-warn', barClass: 'border-l-[rgb(251_191_36)] light:border-l-[rgb(180_83_9)]' },
  success: { icon: 'checkCircle', label: 'Success', titleClass: 'text-pass', barClass: 'border-l-[rgb(74_222_128)] light:border-l-[rgb(21_128_61)]' },
  error: { icon: 'xCircle', label: 'Error', titleClass: 'text-fail', barClass: 'border-l-[rgb(248_113_113)] light:border-l-[rgb(185_28_28)]' },
  tip: { icon: 'lightbulb', label: 'Tip', titleClass: 'text-primary-light', barClass: 'border-l-primary' },
}

export default function Callout({ type = 'info', title, children }: CalloutProps) {
  const { icon, label, titleClass, barClass } = config[type]

  return (
    <aside className={clsx('my-6 rounded-r-xl border border-line border-l-2 bg-[rgb(var(--ink-rgb)/0.03)] py-4 pl-5 pr-5', barClass)}>
      <p className={clsx('mb-1.5 flex items-center gap-2 text-sm font-semibold', titleClass)}>
        <PIcon name={icon} className="h-4 w-4" />
        <span>{title ?? label}</span>
      </p>
      <div className="text-[0.9375rem] leading-relaxed text-ink/90 [&>p]:m-0 [&>p+p]:mt-2">
        {children}
      </div>
    </aside>
  )
}
