'use client'

import { useState } from 'react'
import { PIcon } from './icons'

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

const methodClass: Record<HttpMethod, string> = {
  GET: 'status-pass',
  POST: 'status-info',
  PUT: 'status-warn',
  PATCH: 'status-warn',
  DELETE: 'status-fail',
}

const statusClass = (code: number) => {
  if (code >= 200 && code < 300) return 'text-pass'
  if (code >= 400 && code < 500) return 'text-warn'
  if (code >= 500) return 'text-fail'
  return 'text-muted'
}

export default function APIRequest({ method, url, headers, body, response, status, description }: APIRequestProps) {
  const [tab, setTab] = useState<'request' | 'response'>('request')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const text = tab === 'request' ? (body ?? url) : (response ?? '')
    try { await navigator.clipboard.writeText(text) } catch { return }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="panel" aria-label={`${method} ${url}`}>
      <div className="panel-head">
        <span className={`status ${methodClass[method]}`}>{method}</span>
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{url}</code>
        {status && <span className={`font-mono text-xs font-semibold ${statusClass(status)}`}>{status}</span>}
      </div>

      {(headers || body || response) && (
        <div className="flex border-b border-line" role="tablist" aria-label="Request and response">
          <TabBtn active={tab === 'request'} onClick={() => setTab('request')}>Request</TabBtn>
          {response && <TabBtn active={tab === 'response'} onClick={() => setTab('response')}>Response</TabBtn>}
        </div>
      )}

      <div className="relative space-y-4 p-4">
        {tab === 'request' ? (
          <>
            {description && <p className="m-0 text-sm text-muted">{description}</p>}
            {headers && (
              <div>
                <span className="panel-label">Headers</span>
                <pre className="panel-code">{Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
              </div>
            )}
            {body && (
              <div>
                <span className="panel-label">Body</span>
                <pre className="panel-code">{body}</pre>
              </div>
            )}
          </>
        ) : (
          <pre className="panel-code">{response}</pre>
        )}

        {(body || response) && (
          <button
            type="button"
            onClick={copy}
            className="absolute right-4 top-3 inline-flex min-h-8 items-center gap-1 rounded-md border border-line bg-surface-card px-2.5 text-xs text-muted transition-colors hover:border-primary hover:text-ink light:bg-white"
          >
            <PIcon name={copied ? 'check' : 'copy'} className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
    </section>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${active ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink'}`}
    >
      {children}
    </button>
  )
}
