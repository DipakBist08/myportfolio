'use client'

import { useState } from 'react'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface APIRequestProps {
  method: HttpMethod
  url: string
  headers?: Record<string, string>
  body?: string
  response?: string
  status?: number
  description?: string
}

const methodColors: Record<HttpMethod, string> = {
  GET: 'text-green-400 bg-green-500/10 border-green-500/30',
  POST: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  PUT: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  PATCH: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  DELETE: 'text-red-400 bg-red-500/10 border-red-500/30',
}

const statusColor = (code: number) => {
  if (code >= 200 && code < 300) return 'text-green-400'
  if (code >= 400 && code < 500) return 'text-yellow-400'
  if (code >= 500) return 'text-red-400'
  return 'text-slate-400'
}

export default function APIRequest({
  method,
  url,
  headers,
  body,
  response,
  status,
  description,
}: APIRequestProps) {
  const [tab, setTab] = useState<'request' | 'response'>('request')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = tab === 'request' ? (body ?? url) : (response ?? '')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-5 rounded-xl border border-slate-700/50 bg-surface-card overflow-hidden">
      {/* URL Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/50 bg-surface-darker/50 px-4 py-3">
        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="flex-1 truncate text-xs font-mono text-slate-300 light:text-slate-700">{url}</code>
        {status && (
          <span className={`text-xs font-semibold ${statusColor(status)}`}>
            {status}
          </span>
        )}
      </div>

      {/* Tabs */}
      {(headers || body || response) && (
        <div className="flex border-b border-slate-700/50">
          <TabBtn active={tab === 'request'} onClick={() => setTab('request')}>Request</TabBtn>
          {response && <TabBtn active={tab === 'response'} onClick={() => setTab('response')}>Response</TabBtn>}
        </div>
      )}

      {/* Content */}
      <div className="relative p-4">
        {tab === 'request' ? (
          <div className="space-y-3">
            {description && <p className="text-sm text-slate-400">{description}</p>}
            {headers && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Headers</p>
                <pre className="rounded-lg bg-surface-darker p-3 text-xs font-mono text-slate-300 overflow-x-auto">
                  {Object.entries(headers)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join('\n')}
                </pre>
              </div>
            )}
            {body && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Body</p>
                <pre className="rounded-lg bg-surface-darker p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
                  {body}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <pre className="rounded-lg bg-surface-darker p-3 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">
            {response}
          </pre>
        )}

        {/* Copy button */}
        {(body || response) && (
          <button
            onClick={copy}
            className="absolute right-6 top-6 flex items-center gap-1.5 rounded-md border border-slate-600/50 bg-surface-darker/90 px-2 py-1 text-xs text-slate-400 hover:text-primary-light transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${
        active
          ? 'border-primary text-primary-light'
          : 'border-transparent text-slate-400 hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  )
}
