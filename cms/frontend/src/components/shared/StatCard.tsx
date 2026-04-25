import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  className?: string
}

export default function StatCard({
  title, value, subtitle, icon: Icon, iconColor = 'text-primary',
  trend, className,
}: StatCardProps) {
  return (
    <div className={cn(
      'glass-card p-5 hover:border-white/20 transition-all duration-250',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          'bg-current/10',
          iconColor,
        )}>
          <Icon size={20} className={iconColor} />
        </div>
        {trend && (
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            trend.value >= 0
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          )}>
            {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-heading font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
    </div>
  )
}
