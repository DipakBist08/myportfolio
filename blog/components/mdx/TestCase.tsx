import { PIcon } from './icons'

type TestStatus = 'pass' | 'fail' | 'blocked' | 'pending' | 'skip'

interface TestStep {
  action: string
  expected: string
  status?: TestStatus
}

interface TestCaseProps {
  id?: string
  title: string
  objective?: string
  preconditions?: string
  testData?: string
  steps: TestStep[]
  priority?: 'high' | 'medium' | 'low'
  type?: string
  author?: string
  notes?: string
}

const statusConfig: Record<TestStatus, { label: string; cls: string }> = {
  pass: { label: 'Pass', cls: 'status-pass' },
  fail: { label: 'Fail', cls: 'status-fail' },
  blocked: { label: 'Blocked', cls: 'status-warn' },
  pending: { label: 'Pending', cls: 'status-neutral' },
  skip: { label: 'Skip', cls: 'status-neutral' },
}

const priorityClass = { high: 'status-fail', medium: 'status-warn', low: 'status-neutral' }

/* A worked test case with its steps table. */
export default function TestCase({
  id, title, objective, preconditions, testData, steps, priority = 'medium', type = 'Functional', author, notes,
}: TestCaseProps) {
  return (
    <section className="panel" aria-label={`Test case: ${title}`}>
      <div className="panel-head">
        <p className="panel-title m-0"><PIcon name="clipboardText" className="h-4 w-4 text-primary-light" /> Test case</p>
        {id && <span className="mono-label">TC-{id}</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <span className="status status-info">{type}</span>
          <span className={`status ${priorityClass[priority]}`}>Priority: {priority}</span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <h3 className="m-0 text-base font-semibold text-ink">{title}</h3>

        {(objective || author) && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {objective && <div><dt className="panel-label mb-0.5">Objective</dt><dd className="m-0 text-ink/90">{objective}</dd></div>}
            {author && <div><dt className="panel-label mb-0.5">Author</dt><dd className="m-0 text-ink/90">{author}</dd></div>}
          </dl>
        )}

        {preconditions && (
          <div><span className="panel-label">Preconditions</span><p className="m-0 text-sm text-ink/90">{preconditions}</p></div>
        )}

        {testData && (
          <div><span className="panel-label">Test data</span><code className="panel-code">{testData}</code></div>
        )}

        <div>
          <span className="panel-label">Test steps</span>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="m-0 w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-[rgb(var(--ink-rgb)/0.03)]">
                  <th className="w-8 px-3 py-2 text-left text-xs font-semibold text-muted">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted">Expected result</th>
                  <th className="w-24 px-3 py-2 text-left text-xs font-semibold text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs text-muted">{i + 1}</td>
                    <td className="px-3 py-2.5 text-ink/90">{step.action}</td>
                    <td className="px-3 py-2.5 text-muted">{step.expected}</td>
                    <td className="px-3 py-2.5">
                      {step.status ? (
                        <span className={`status ${statusConfig[step.status].cls}`}>{statusConfig[step.status].label}</span>
                      ) : (
                        <span className="text-subtle" aria-label="not run">&ndash;</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {notes && (
          <div><span className="panel-label">Notes</span><p className="m-0 text-sm text-muted">{notes}</p></div>
        )}
      </div>
    </section>
  )
}
