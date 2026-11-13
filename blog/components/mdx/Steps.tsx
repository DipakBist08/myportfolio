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
  if (steps) {
    return (
      <div className="my-6">
        {title && <p className="mb-3 text-sm font-semibold text-ink">{title}</p>}
        <ol className="m-0 list-none space-y-5 border-l border-line p-0 pl-7">
          {steps.map((step, i) => (
            <li key={i} className="relative m-0">
              <span className="absolute -left-[2.3rem] top-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface-card font-mono text-xs font-medium text-primary-light light:bg-white" aria-hidden="true">
                {i + 1}
              </span>
              <p className="m-0 pt-0.5 text-[0.9375rem] font-semibold text-ink">{step.title}</p>
              {step.description && <p className="m-0 mt-1 text-sm text-muted">{step.description}</p>}
              {step.code && <code className="panel-code mt-2">{step.code}</code>}
            </li>
          ))}
        </ol>
      </div>
    )
  }

  return (
    <div className="my-6 [&>ol]:border-l [&>ol]:border-line [&>ol]:pl-6 [&>ol>li]:relative [&>ol>li]:text-[0.9375rem]">
      {title && <p className="mb-3 text-sm font-semibold text-ink">{title}</p>}
      {children}
    </div>
  )
}
