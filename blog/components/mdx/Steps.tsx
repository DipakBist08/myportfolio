import { ReactNode } from 'react'

interface Step {
  title: string
  description?: string
  code?: string
}

interface StepsProps {
  steps?: Step[]
  children?: ReactNode
  title?: string
}

export default function Steps({ steps, children, title }: StepsProps) {
  // If steps array provided, render structured steps
  if (steps) {
    return (
      <div className="my-5">
        {title && <p className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">{title}</p>}
        <ol className="space-y-4 border-l-2 border-primary/30 pl-6">
          {steps.map((step, i) => (
            <li key={i} className="relative">
              {/* Number dot */}
              <span className="absolute -left-[1.875rem] flex h-7 w-7 items-center justify-center rounded-full border border-primary/50 bg-surface-card text-xs font-bold text-primary-light">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <p className="text-sm font-semibold text-slate-200 light:text-slate-800">{step.title}</p>
                {step.description && (
                  <p className="mt-1 text-sm text-slate-400">{step.description}</p>
                )}
                {step.code && (
                  <code className="mt-2 block rounded-lg bg-surface-card px-3 py-2 text-xs font-mono text-slate-300 whitespace-pre-wrap">
                    {step.code}
                  </code>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  // If children provided, render as ordered list with custom styling
  return (
    <div className="my-5 [&>ol]:border-l-2 [&>ol]:border-primary/30 [&>ol]:pl-6 [&>ol]:space-y-4 [&>ol>li]:relative [&>ol>li]:text-sm [&>ol>li]:text-slate-300">
      {title && <p className="mb-3 text-sm font-semibold text-slate-300 light:text-slate-700">{title}</p>}
      {children}
    </div>
  )
}
