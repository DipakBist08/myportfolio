import { PIcon } from './icons'

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

const severityClass: Record<Severity, string> = {
  critical: 'status-fail',
  high: 'status-fail',
  medium: 'status-warn',
  low: 'status-neutral',
}

const statusClass: Record<Status, string> = {
  open: 'status-fail',
  'in-progress': 'status-warn',
  resolved: 'status-pass',
  closed: 'status-neutral',
  duplicate: 'status-neutral',
}

/* A worked bug report, laid out the way a tracker would show it. */
export default function BugReport({
  id, title, severity, priority, status = 'open', environment, reportedBy, assignedTo,
  steps, expected, actual, preconditions, testData, attachments, notes,
}: BugReportProps) {
  return (
    <section className="panel" aria-label={`Bug report: ${title}`}>
      <div className="panel-head">
        <p className="panel-title m-0"><PIcon name="bug" className="h-4 w-4 text-fail" /> Bug report</p>
        {id && <span className="mono-label">#{id}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <span className={`status ${severityClass[severity]}`}>Severity: {severity}</span>
          <span className="status status-info">{priority}</span>
          <span className={`status ${statusClass[status]}`}>{status}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <h3 className="m-0 text-base font-semibold text-ink">{title}</h3>

        {(environment || reportedBy || assignedTo) && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {environment && <Meta label="Environment" value={environment} />}
            {reportedBy && <Meta label="Reported by" value={reportedBy} />}
            {assignedTo && <Meta label="Assigned to" value={assignedTo} />}
          </dl>
        )}

        {preconditions && (
          <div><span className="panel-label">Preconditions</span><p className="m-0 text-sm text-ink/90">{preconditions}</p></div>
        )}

        {testData && (
          <div><span className="panel-label">Test data</span><code className="panel-code">{testData}</code></div>
        )}

        <div>
          <span className="panel-label">Steps to reproduce</span>
          <ol className="m-0 list-none space-y-2 p-0 text-sm text-ink/90">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[0.7rem] font-medium text-primary-light" aria-hidden="true">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <p className="m-0 mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-pass"><PIcon name="checkCircle" className="h-4 w-4" /> Expected result</p>
            <p className="m-0 text-sm text-ink/90">{expected}</p>
          </div>
          <div className="rounded-lg border border-line p-4">
            <p className="m-0 mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-fail"><PIcon name="xCircle" className="h-4 w-4" /> Actual result</p>
            <p className="m-0 text-sm text-ink/90">{actual}</p>
          </div>
        </div>

        {attachments && (
          <div><span className="panel-label">Attachments</span><p className="m-0 text-sm text-muted">{attachments}</p></div>
        )}
        {notes && (
          <div><span className="panel-label">Notes</span><p className="m-0 text-sm text-muted">{notes}</p></div>
        )}
      </div>
    </section>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="panel-label mb-0.5">{label}</dt>
      <dd className="m-0 text-ink/90">{value}</dd>
    </div>
  )
}
