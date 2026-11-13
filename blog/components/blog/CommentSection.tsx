'use client'

import { useState, useEffect, useCallback } from 'react'
import PostViews from './PostViews'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.dipakbist.com.np'

/** Likes and dislikes, and this reader's own reaction: 1, -1 or 0. */
interface Reacted {
  likes?: number
  dislikes?: number
  my_reaction?: number
}

interface Reply extends Reacted {
  id: number
  author_name: string
  content: string
  created_at: string
}

interface Comment extends Reacted {
  id: number
  author_name: string
  content: string
  created_at: string
  replies: Reply[]
}

type ReactionState = { likes: number; dislikes: number; my_reaction: number }

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {down ? (
        <>
          <path d="M17 14V2" />
          <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </>
      ) : (
        <>
          <path d="M7 10v12" />
          <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </>
      )}
    </svg>
  )
}

// ── Like / dislike ───────────────────────────────────────────────────────────
// Pressing your current reaction again takes it back. The counts change at
// once and are corrected (or rolled back) by the API's answer.
function Reactions({ id, author, item, onChange }: {
  id: number
  author: string
  item: Reacted
  onChange: (id: number, next: ReactionState) => void
}) {
  const [error, setError] = useState('')
  const now: ReactionState = { likes: item.likes ?? 0, dislikes: item.dislikes ?? 0, my_reaction: item.my_reaction ?? 0 }

  async function react(value: 1 | -1) {
    const next = now.my_reaction === value ? 0 : value
    const optimistic = { ...now, my_reaction: next }
    if (now.my_reaction === 1) optimistic.likes -= 1
    if (now.my_reaction === -1) optimistic.dislikes -= 1
    if (next === 1) optimistic.likes += 1
    if (next === -1) optimistic.dislikes += 1
    setError('')
    onChange(id, optimistic)
    try {
      const res = await fetch(`${API_URL}/api/public/comments/${id}/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: next }),
      })
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many reactions. Try again in a minute.' : 'Could not save that.')
      const data = await res.json()
      onChange(id, { likes: data.likes, dislikes: data.dislikes, my_reaction: data.my_reaction })
    } catch (err) {
      onChange(id, now)
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Could not connect. Please try again.')
    }
  }

  const button = 'inline-flex min-h-[2rem] items-center gap-1.5 rounded-full border px-2.5 text-xs tabular-nums transition-colors'
  const idle = 'border-line text-muted hover:text-ink hover:border-line-strong'
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={() => react(1)} aria-pressed={now.my_reaction === 1}
        aria-label={`Like the comment by ${author} (${now.likes} like${now.likes === 1 ? '' : 's'})`}
        className={`${button} ${now.my_reaction === 1 ? 'border-primary/40 bg-primary/10 text-primary-light' : idle}`}>
        <ThumbIcon />{now.likes}
      </button>
      <button type="button" onClick={() => react(-1)} aria-pressed={now.my_reaction === -1}
        aria-label={`Dislike the comment by ${author} (${now.dislikes} dislike${now.dislikes === 1 ? '' : 's'})`}
        className={`${button} ${now.my_reaction === -1 ? 'border-line-strong bg-white/5 text-ink' : idle}`}>
        <ThumbIcon down />{now.dislikes}
      </button>
      {error && <span role="status" className="text-xs text-fail">{error}</span>}
    </span>
  )
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
    return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary-light">
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
            className="rounded-lg border border-line bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-subtle outline-none focus:border-primary " />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (private) *"
            className="rounded-lg border border-line bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-subtle outline-none focus:border-primary " />
        </div>
      )}
      {compact && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Name *"
            className="rounded-lg border border-line bg-surface-card px-3 py-2 text-xs text-ink placeholder:text-subtle outline-none focus:border-primary" />
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (private) *"
            className="rounded-lg border border-line bg-surface-card px-3 py-2 text-xs text-ink placeholder:text-subtle outline-none focus:border-primary" />
        </div>
      )}
      <textarea
        required
        rows={compact ? 2 : 4}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-line bg-surface-card px-3 py-2 text-ink placeholder:text-subtle outline-none focus:border-primary  resize-y ${compact ? 'text-xs' : 'text-sm'}`}
      />
      {error && <p className="text-xs text-fail">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={state === 'loading'}
          className={`rounded-lg bg-primary px-4 font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}>
          {state === 'loading' ? 'Posting…' : compact ? 'Reply' : 'Post comment'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className={`rounded-lg border border-line px-4 text-muted hover:text-ink transition-colors ${compact ? 'py-1.5 text-xs' : 'py-2 text-sm'}`}>
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
  onReaction: (id: number, next: ReactionState) => void
}

function CommentItem({ comment, postSlug, onReplyAdded, onReaction }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author_name} />
      <div className="flex-1 min-w-0">
        {/* Comment bubble */}
        <div className="rounded-xl rounded-tl-none border border-line bg-white/3 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-semibold text-ink">{comment.author_name}</span>
            <span className="text-xs text-muted">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        </div>

        {/* Like / dislike, then reply */}
        <div className="mt-1.5 ml-1 flex flex-wrap items-center gap-3">
          <Reactions id={comment.id} author={comment.author_name} item={comment} onChange={onReaction} />
          <button
            type="button"
            onClick={() => setShowReplyForm(v => !v)}
            className="text-xs text-muted hover:text-ink transition-colors"
          >
            {showReplyForm ? 'Cancel reply' : '↩ Reply'}
          </button>
        </div>

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
          <div className="mt-3 space-y-3 border-l-2 border-line pl-4">
            {comment.replies.map(reply => (
              <div key={reply.id} className="flex gap-2.5">
                <Avatar name={reply.author_name} />
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl rounded-tl-none border border-line bg-white/2 px-3 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-ink">{reply.author_name}</span>
                      <span className="text-xs text-muted">{timeAgo(reply.created_at)}</span>
                    </div>
                    <p className="text-xs text-ink/90 leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                  </div>
                  <div className="mt-1.5 ml-1">
                    <Reactions id={reply.id} author={reply.author_name} item={reply} onChange={onReaction} />
                  </div>
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
export default function CommentSection({ postSlug, postTitle = '' }: { postSlug: string; postTitle?: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/comments?slug=${encodeURIComponent(postSlug)}`)
      if (res.ok) setComments(await res.json())
    } catch {
      // Comments are optional: a blocked or offline API leaves the thread empty.
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

  function handleReaction(id: number, next: ReactionState) {
    setComments(prev => prev.map(c => c.id === id
      ? { ...c, ...next }
      : { ...c, replies: c.replies.map(r => (r.id === id ? { ...r, ...next } : r)) }))
  }

  return (
    <div className="mt-12 border-t border-line pt-8 light:border-line">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-heading text-lg font-bold text-ink light:text-muted">
          {loading ? 'Comments' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
        </h3>
        <p className="text-sm text-muted" aria-live="polite">
          <PostViews slug={postSlug} title={postTitle} />
        </p>
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 shrink-0 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-white/10" />
                <div className="h-16 rounded-xl bg-surface-card" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-6">
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} postSlug={postSlug} onReplyAdded={handleReplyAdded} onReaction={handleReaction} />
          ))}
        </div>
      ) : (
        <p className="mb-6 text-sm text-muted">No comments yet — be the first!</p>
      )}

      {/* New comment form */}
      <div className="mt-8 rounded-xl border border-line bg-white/2 p-5">
        <h4 className="mb-4 text-sm font-semibold text-ink/90">
          {submitted ? '✓ Comment posted! Leave another:' : 'Leave a comment'}
        </h4>
        <CommentForm
          postSlug={postSlug}
          onSuccess={handleNewComment}
          placeholder="Share your thoughts, questions, or feedback…"
        />
        <p className="mt-3 text-xs text-muted">
          Your email is never shown publicly.
        </p>
      </div>
    </div>
  )
}
