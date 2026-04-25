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

const statusConfig: Record<TestStatus, { label: string; classes: string }> = {
  pass: { label: 'Pass', classes: 'text-green-400 bg-green-500/10 border-green-500/30' },
  fail: { label: 'Fail', classes: 'text-red-400 bg-red-500/10 border-red-500/30' },
  blocked: { label: 'Blocked', classes: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  pending: { label: 'Pending', classes: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  skip: { label: 'Skip', classes: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
}

export default function TestCase({
  id,
  title,
  objective,
  preconditions,
  testData,
  steps,
  priority = 'medium',
  type = 'Functional',
  author,
  notes,
}: TestCaseProps) {
  const priorityColor = {
    high: 'text-red-400 bg-red-500/10 border-red-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-green-400 bg-green-500/10 border-green-500/30',
  }[priority]

  return (
    <div className="my-6 rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-primary/20 bg-primary/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-primary-light shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
            <path d="M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" />
            <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm font-bold text-primary-light">Test Case</span>
        </div>
        {id && <span className="font-mono text-xs text-slate-500">TC-{id}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs text-accent">
            {type}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${priorityColor}`}>
            {priority}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <h4 className="text-base font-semibold text-slate-100 light:text-slate-800">{title}</h4>

        {/* Meta */}
        {(objective || author) && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            {objective && <MetaItem label="Objective" value={objective} />}
            {author && <MetaItem label="Author" value={author} />}
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

        {/* Steps table */}
        <Section label="Test Steps">
          <div className="overflow-x-auto rounded-lg border border-slate-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-surface-card/50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Action</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Expected Result</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step, i) => (
                  <tr key={i} className="border-b border-slate-700/30 last:border-0 hover:bg-surface-card/30 transition-colors">
                    <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5 text-slate-300 light:text-slate-700">{step.action}</td>
                    <td className="px-3 py-2.5 text-slate-400 light:text-slate-600">{step.expected}</td>
                    <td className="px-3 py-2.5">
                      {step.status ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${statusConfig[step.status].classes}`}>
                          {statusConfig[step.status].label}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

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
