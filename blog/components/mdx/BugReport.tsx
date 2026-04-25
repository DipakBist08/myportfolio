import Badge from './Badge'

type Severity = 'critical' | 'high' | 'medium' | 'low'
type Priority = 'P1' | 'P2' | 'P3' | 'P4'
type Status = 'open' | 'in-progress' | 'resolved' | 'closed' | 'duplicate'

interface BugReportProps {
  id?: string
  title: string
  severity: Severity
  priority: Priority
  status?: Status
  environment?: string
  reportedBy?: string
  assignedTo?: string
  steps: string[]
  expected: string
  actual: string
  preconditions?: string
  testData?: string
  attachments?: string
  notes?: string
}

const severityColors: Record<Severity, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-green-400 bg-green-500/10 border-green-500/30',
}

const statusColors: Record<Status, string> = {
  open: 'text-red-400 bg-red-500/10 border-red-500/30',
  'in-progress': 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  resolved: 'text-green-400 bg-green-500/10 border-green-500/30',
  closed: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  duplicate: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
}

export default function BugReport({
  id,
  title,
  severity,
  priority,
  status = 'open',
  environment,
  reportedBy,
  assignedTo,
  steps,
  expected,
  actual,
  preconditions,
  testData,
  attachments,
  notes,
}: BugReportProps) {
  return (
    <div className="my-6 rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-sm font-bold text-red-400">Bug Report</span>
        </div>
        {id && <span className="font-mono text-xs text-slate-500">#{id}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${severityColors[severity]}`}>
            {severity}
          </span>
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-light">
            {priority}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusColors[status]}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Title */}
        <h4 className="text-base font-semibold text-slate-100 light:text-slate-800">{title}</h4>

        {/* Meta grid */}
        {(environment || reportedBy || assignedTo) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
            {environment && <MetaItem label="Environment" value={environment} />}
            {reportedBy && <MetaItem label="Reported By" value={reportedBy} />}
            {assignedTo && <MetaItem label="Assigned To" value={assignedTo} />}
          </div>
        )}

        {/* Preconditions */}
        {preconditions && (
          <Section label="Preconditions">
            <p className="text-sm text-slate-300 light:text-slate-600">{preconditions}</p>
          </Section>
        )}

        {/* Test Data */}
        {testData && (
          <Section label="Test Data">
            <code className="block text-xs font-mono bg-surface-card p-2.5 rounded-lg text-slate-300 whitespace-pre-wrap">
              {testData}
            </code>
          </Section>
        )}

        {/* Steps to Reproduce */}
        <Section label="Steps to Reproduce">
          <ol className="space-y-1.5 text-sm text-slate-300 light:text-slate-600">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary-light">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Section>

        {/* Expected vs Actual */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-green-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Expected Result
            </p>
            <p className="text-sm text-slate-300 light:text-slate-600">{expected}</p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-red-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              Actual Result
            </p>
            <p className="text-sm text-slate-300 light:text-slate-600">{actual}</p>
          </div>
        </div>

        {/* Notes / Attachments */}
        {attachments && (
          <Section label="Attachments">
            <p className="text-sm text-slate-400">{attachments}</p>
          </Section>
        )}
        {notes && (
          <Section label="Notes">
            <p className="text-sm text-slate-400">{notes}</p>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {children}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-slate-500">{label}</span>
      <span className="text-slate-300 light:text-slate-700">{value}</span>
    </div>
  )
}
