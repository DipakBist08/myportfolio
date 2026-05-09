'use client'

import { useState, useEffect, useCallback } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np'

interface Reply {
  id: number
  author_name: string
  content: string
  created_at: string
}

interface Comment {
  id: number
  author_name: string
  content: string
  created_at: string
  replies: Reply[]
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['bg-violet-600', 'bg-indigo-600', 'bg-sky-600', 'bg-teal-600', 'bg-rose-600', 'bg-amber-600']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color} text-xs font-bold text-white`}>
      {initials || '?'}
    </div>
  )
}

// ── Inline comment / reply form ───────────────────────────────────────────────
interface FormProps {
  postSlug: string
  parentId?: number
  onSuccess: (comment: Comment | Reply) => void
  onCancel?: () => void
  placeholder?: string
  compact?: boolean
}

function CommentForm({ postSlug, parentId, onSuccess, onCancel, placeholder = 'Share your thoughts…', compact = false }: FormProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [content, setContent] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/public/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_slug: postSlug, parent_id: parentId ?? null, author_name: name, author_email: email, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail = data.detail
        const msg = Array.isArray(detail) ? detail[0]?.msg ?? 'Invalid input' : detail ?? 'Failed to post'
        setError(msg)
        setState('error')
        return
      }
      onSuccess(data)
      setName('')
      setEmail('')
      setContent('')
      setState('idle')
    } catch {
      setError('Could not connect. Please try again.')
      setState('error')
    }
  }

  return (
    <form onSubmit={submit} className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Your name *"
            className="rounded-lg border border-slate-700/50 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (private) *"
            className="rounded-lg border border-slate-700/50 bg-white/5 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30" />
        </div>
      )}
      {compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Name *"
            className="rounded-lg border border-slate-700/50 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-primary/50" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (private) *"
            className="rounded-lg border border-slate-700/50 bg-white/5 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-primary/50" />
        </div>
      )}
      <textarea
        required
        rows={compact ? 2 : 4}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-slate-700/50 bg-white/5 px-3 py-2 text-slate-200 placeholder-slate-500 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 resize-y ${compact ? 'text-xs' : 'text-sm'}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={state === 'loading'}
          className={`rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}>
          {state === 'loading' ? 'Posting…' : compact ? 'Reply' : 'Post comment'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className={`rounded-lg border border-slate-700/50 px-4 text-slate-400 hover:text-slate-200 transition-colors ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Single comment with its replies ──────────────────────────────────────────
interface CommentItemProps {
  comment: Comment
  postSlug: string
  onReplyAdded: (commentId: number, reply: Reply) => void
}

function CommentItem({ comment, postSlug, onReplyAdded }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author_name} />
      <div className="flex-1 min-w-0">
        {/* Comment bubble */}
        <div className="rounded-xl rounded-tl-none border border-slate-700/40 bg-white/3 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-semibold text-slate-200">{comment.author_name}</span>
            <span className="text-xs text-slate-600">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        </div>

        {/* Reply button */}
        <button
          onClick={() => setShowReplyForm(v => !v)}
          className="mt-1.5 ml-1 text-xs text-slate-500 hover:text-primary-light transition-colors"
        >
          {showReplyForm ? 'Cancel reply' : '↩ Reply'}
        </button>

        {/* Inline reply form */}
        {showReplyForm && (
          <div className="mt-2">
            <CommentForm
              postSlug={postSlug}
              parentId={comment.id}
              compact
              placeholder={`Replying to ${comment.author_name}…`}
              onCancel={() => setShowReplyForm(false)}
              onSuccess={(reply) => {
                onReplyAdded(comment.id, reply as Reply)
                setShowReplyForm(false)
              }}
            />
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-slate-700/30 pl-4">
            {comment.replies.map(reply => (
              <div key={reply.id} className="flex gap-2.5">
                <Avatar name={reply.author_name} />
                <div className="flex-1 min-w-0 rounded-xl rounded-tl-none border border-slate-700/30 bg-white/2 px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-200">{reply.author_name}</span>
                    <span className="text-xs text-slate-600">{timeAgo(reply.created_at)}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CommentSection({ postSlug }: { postSlug: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/comments?slug=${encodeURIComponent(postSlug)}`)
      if (res.ok) setComments(await res.json())
    } finally {
      setLoading(false)
    }
  }, [postSlug])

  useEffect(() => { fetchComments() }, [fetchComments])

  function handleNewComment(comment: Comment | Reply) {
    setComments(prev => [...prev, comment as Comment])
    setSubmitted(true)
  }

  function handleReplyAdded(commentId: number, reply: Reply) {
    setComments(prev =>
      prev.map(c => c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c)
    )
  }

  return (
    <div className="mt-12 border-t border-slate-700/30 pt-8 light:border-slate-200">
      <h3 className="mb-6 font-heading text-lg font-bold text-slate-100 light:text-slate-900">
        {loading ? 'Comments' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
      </h3>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="h-16 rounded-xl bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} postSlug={postSlug} onReplyAdded={handleReplyAdded} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-slate-500">No comments yet — be the first!</p>
      )}

      {/* New comment form */}
      <div className="mt-8 rounded-xl border border-slate-700/40 bg-white/2 p-5">
        <h4 className="mb-4 text-sm font-semibold text-slate-300">
          {submitted ? '✓ Comment posted! Leave another:' : 'Leave a comment'}
        </h4>
        <CommentForm
          postSlug={postSlug}
          onSuccess={handleNewComment}
          placeholder="Share your thoughts, questions, or feedback…"
        />
        <p className="mt-3 text-xs text-slate-600">
          Your email is never shown publicly.
        </p>
      </div>
    </div>
  )
}
