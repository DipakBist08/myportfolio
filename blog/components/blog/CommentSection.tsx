'use client'

import { useState, useEffect, useCallback } from 'react'
import PostViews from './PostViews'
import { api, ApiError, API_URL, type Reader } from './engagement/api'
import { useReader } from './engagement/ReaderContext'
import { usePostEngagement } from './engagement/PostEngagement'

/** Likes and dislikes, and this reader's own reaction: 1, -1 or 0. */
interface Reacted {
  likes?: number
  dislikes?: number
  my_reaction?: number
}

interface Reply extends Reacted {
  id: number
  author_name: string
  /** The Google profile picture of a signed-in author; "" for older comments. */
  author_picture?: string
  content: string
  created_at: string
}

interface Comment extends Reply {
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

/** The API sends UTC times without a zone; read them as UTC. */
function toDate(dateStr: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dateStr) ? dateStr : `${dateStr}Z`)
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** When a response was posted: "3h ago" for the last week, then the date; the
 *  full date and time on hover. */
function Posted({ at }: { at: string }) {
  const date = toDate(at)
  const full = date.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })
  return (
    <time dateTime={date.toISOString()} title={`Posted ${full}`} className="text-xs text-muted">
      {timeAgo(date)}
    </time>
  )
}

function Avatar({ name, picture, size = 'md' }: { name: string; picture?: string; size?: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false)
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  if (picture && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- a Google profile picture: tiny, remote, not worth the image optimiser
      <img
        src={picture}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${box} shrink-0 rounded-full border border-line object-cover`}
      />
    )
  }
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className={`${box} flex shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-mono text-xs font-semibold text-primary-light`}>
      {initials || '?'}
    </div>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
      <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.65Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

// ── Response / reply form (signed-in readers) ────────────────────────────────
interface FormProps {
  postSlug: string
  reader: Reader
  parentId?: number
  onSuccess: (comment: Comment | Reply) => void
  onCancel?: () => void
  placeholder?: string
  compact?: boolean
  autoFocus?: boolean
}

function CommentForm({ postSlug, reader, parentId, onSuccess, onCancel, placeholder = 'What are your thoughts?', compact = false, autoFocus = false }: FormProps) {
  const { sessionExpired } = useReader()
  const [content, setContent] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!content.trim()) return
    setState('loading')
    setError('')
    try {
      const data = await api<Comment | Reply>('/api/public/comments', {
        method: 'POST',
        body: JSON.stringify({ post_slug: postSlug, parent_id: parentId ?? null, content }),
      })
      onSuccess(data)
      setContent('')
      setState('idle')
    } catch (err) {
      setState('error')
      if (err instanceof ApiError && err.status === 401) {
        setError('Your sign-in has ended. Sign in again to post; your text is kept.')
        sessionExpired(parentId ? 'reply' : 'respond')
        return
      }
      setError(err instanceof Error ? err.message : 'Could not post. Please try again.')
    }
  }

  const textId = `response-${parentId ?? 'new'}`
  return (
    <form onSubmit={submit} className={compact ? 'space-y-2' : 'space-y-3'}>
      {!compact && (
        <div className="flex items-center gap-2.5">
          <Avatar name={reader.name} picture={reader.picture} />
          <span className="text-sm font-semibold text-ink">{reader.name}</span>
        </div>
      )}
      <label htmlFor={textId} className="sr-only">{parentId ? 'Your reply' : 'Your response'}</label>
      <textarea
        id={textId}
        required
        maxLength={2000}
        autoFocus={autoFocus}
        rows={compact ? 2 : 4}
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
        placeholder={placeholder}
        className={`w-full resize-y rounded-lg border border-line bg-surface-card px-3 py-2 text-ink outline-none placeholder:text-subtle focus:border-primary light:bg-white ${compact ? 'text-sm' : 'text-[0.9375rem]'}`}
      />
      {error && <p role="alert" className="text-xs text-fail">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={state === 'loading' || !content.trim()}
          className={`rounded-full bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'min-h-8 text-xs' : 'min-h-10 text-sm'}`}>
          {state === 'loading' ? 'Posting…' : compact ? 'Reply' : 'Respond'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className={`rounded-full border border-line px-4 text-muted transition-colors hover:text-ink ${compact ? 'min-h-8 text-xs' : 'min-h-10 text-sm'}`}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Name-and-email form, used until Google sign-in is switched on ──────────────
interface AnonymousFormProps {
  postSlug: string
  parentId?: number
  onSuccess: (comment: Comment | Reply) => void
  onCancel?: () => void
  placeholder?: string
  compact?: boolean
}

function AnonymousForm({ postSlug, parentId, onSuccess, onCancel, placeholder = 'What are your thoughts?', compact = false }: AnonymousFormProps) {
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
      const data = await api<Comment | Reply>('/api/public/comments', {
        method: 'POST',
        body: JSON.stringify({ post_slug: postSlug, parent_id: parentId ?? null, author_name: name, author_email: email, content }),
      })
      onSuccess(data)
      setContent('')
      setState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post. Please try again.')
      setState('error')
    }
  }

  const field = `rounded-lg border border-line bg-surface-card px-3 py-2 text-ink outline-none placeholder:text-subtle focus:border-primary light:bg-white ${compact ? 'text-xs' : 'text-sm'}`
  const id = `anon-${parentId ?? 'new'}`
  return (
    <form onSubmit={submit} className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
        <label htmlFor={`${id}-name`} className="sr-only">Your name</label>
        <input id={`${id}-name`} required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your name *" autoComplete="name" className={field} />
        <label htmlFor={`${id}-email`} className="sr-only">Your email (not shown)</label>
        <input id={`${id}-email`} required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email (private) *" autoComplete="email" className={field} />
      </div>
      <label htmlFor={`${id}-text`} className="sr-only">{parentId ? 'Your reply' : 'Your response'}</label>
      <textarea id={`${id}-text`} required maxLength={2000} rows={compact ? 2 : 4} value={content} onChange={e => setContent(e.target.value)}
        placeholder={placeholder} className={`w-full resize-y ${field}`} />
      {error && <p role="alert" className="text-xs text-fail">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={state === 'loading'}
          className={`rounded-full bg-primary px-4 font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 ${compact ? 'min-h-8 text-xs' : 'min-h-10 text-sm'}`}>
          {state === 'loading' ? 'Posting…' : compact ? 'Reply' : 'Respond'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}
            className={`rounded-full border border-line px-4 text-muted transition-colors hover:text-ink ${compact ? 'min-h-8 text-xs' : 'min-h-10 text-sm'}`}>
            Cancel
          </button>
        )}
      </div>
      {!compact && <p className="text-xs text-muted">Your email address is never shown.</p>}
    </form>
  )
}

// ── What a signed-out reader sees instead of the form ──────────────────────────
function SignInPrompt() {
  const { ready, requireSignIn } = useReader()
  if (!ready) return <div className="h-[7.5rem] animate-pulse rounded-lg bg-surface-card light:bg-black/5" aria-hidden="true" />
  return (
    <div>
      <button
        type="button"
        onClick={() => requireSignIn('respond')}
        className="block w-full rounded-lg border border-line bg-surface-card px-3 py-3 text-left text-[0.9375rem] text-subtle transition-colors hover:border-line-strong light:bg-white"
      >
        What are your thoughts?
      </button>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => requireSignIn('respond')}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-sm font-medium text-[#1f1f1f] transition-shadow hover:shadow-card-hover"
        >
          <GoogleMark />
          Sign in with Google to respond
        </button>
        <p className="text-xs text-muted">Your name and picture are shown with your response; your email stays private.</p>
      </div>
    </div>
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
  const { reader, available, requireSignIn } = useReader()
  const [showReplyForm, setShowReplyForm] = useState(false)
  const openReply = () => (available ? requireSignIn('reply', () => setShowReplyForm(true)) : setShowReplyForm(true))

  return (
    <div className="flex gap-3">
      <Avatar name={comment.author_name} picture={comment.author_picture} />
      <div className="flex-1 min-w-0">
        {/* Comment bubble */}
        <div className="rounded-xl rounded-tl-none border border-line bg-white/3 px-4 py-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-2">
            <span className="text-sm font-semibold text-ink">{comment.author_name}</span>
            <Posted at={comment.created_at} />
          </div>
          <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap break-words">{comment.content}</p>
        </div>

        {/* Like / dislike, then reply */}
        <div className="mt-1.5 ml-1 flex flex-wrap items-center gap-3">
          <Reactions id={comment.id} author={comment.author_name} item={comment} onChange={onReaction} />
          <button
            type="button"
            onClick={() => (showReplyForm ? setShowReplyForm(false) : openReply())}
            className="min-h-8 text-xs text-muted transition-colors hover:text-ink"
            aria-expanded={showReplyForm}
          >
            {showReplyForm ? 'Cancel reply' : '↩ Reply'}
          </button>
        </div>

        {/* Inline reply form */}
        {showReplyForm && (reader || !available) && (
          <div className="mt-2">
            {reader ? (
              <CommentForm
                postSlug={postSlug}
                reader={reader}
                parentId={comment.id}
                compact
                autoFocus
                placeholder={`Replying to ${comment.author_name}…`}
                onCancel={() => setShowReplyForm(false)}
                onSuccess={(reply) => {
                  onReplyAdded(comment.id, reply as Reply)
                  setShowReplyForm(false)
                }}
              />
            ) : (
              <AnonymousForm
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
            )}
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l-2 border-line pl-4">
            {comment.replies.map(reply => (
              <div key={reply.id} className="flex gap-2.5">
                <Avatar name={reply.author_name} picture={reply.author_picture} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="rounded-xl rounded-tl-none border border-line bg-white/2 px-3 py-2.5">
                    <div className="mb-1 flex flex-wrap items-center gap-x-2">
                      <span className="text-xs font-semibold text-ink">{reply.author_name}</span>
                      <Posted at={reply.created_at} />
                    </div>
                    <p className="text-sm text-ink/90 leading-relaxed whitespace-pre-wrap break-words">{reply.content}</p>
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

const countAll = (list: Comment[]) => list.reduce((n, c) => n + 1 + c.replies.length, 0)

// ── Main export ───────────────────────────────────────────────────────────────
/** Responses to a post, Medium-style: anyone can read them; posting one, or a
 *  reply, needs a Google sign-in (ReaderProvider). Until sign-in is switched on
 *  (no Google client ID here or on the API), the name-and-email form is used. */
export default function CommentSection({ postSlug, postTitle = '' }: { postSlug: string; postTitle?: string }) {
  const { reader, available, signOut } = useReader()
  const { setResponses } = usePostEngagement()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/public/comments?slug=${encodeURIComponent(postSlug)}`)
      if (res.ok) {
        setComments(await res.json())
        setLoaded(true)
      }
    } catch {
      // Responses are optional: a blocked or offline API leaves the thread empty.
    } finally {
      setLoading(false)
    }
  }, [postSlug])

  useEffect(() => { fetchComments() }, [fetchComments])

  // The clap bars show the same count next to their responses link.
  useEffect(() => {
    if (loaded) setResponses(countAll(comments))
  }, [comments, loaded, setResponses])

  function handleNewComment(comment: Comment | Reply) {
    setComments(prev => [...prev, { replies: [], ...comment } as Comment])
    setLoaded(true)
    setSubmitted(true)
  }

  function handleReplyAdded(commentId: number, reply: Reply) {
    setComments(prev => prev.map(c => c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c))
  }

  function handleReaction(id: number, next: ReactionState) {
    setComments(prev => prev.map(c => c.id === id
      ? { ...c, ...next }
      : { ...c, replies: c.replies.map(r => (r.id === id ? { ...r, ...next } : r)) }))
  }

  const total = countAll(comments)

  return (
    <section id="responses" aria-labelledby="responses-heading" className="scroll-mt-[calc(var(--header-height)+1.5rem)]">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="responses-heading" className="text-xl font-semibold tracking-[-0.01em] text-ink">
          {loading ? 'Responses' : `Responses (${total})`}
        </h2>
        <p className="text-sm text-muted" aria-live="polite">
          <PostViews slug={postSlug} title={postTitle} />
        </p>
      </div>

      {/* New response */}
      <div className="mb-8 rounded-xl border border-line bg-white/2 p-5">
        {reader ? (
          <>
            {submitted && <p role="status" className="mb-3 text-sm text-pass">✓ Response posted. Thanks for adding to the discussion.</p>}
            <CommentForm postSlug={postSlug} reader={reader} onSuccess={handleNewComment} />
            <p className="mt-3 text-xs text-muted">
              Signed in with Google as {reader.name}.{' '}
              <button type="button" onClick={signOut} className="text-primary-light underline-offset-2 hover:underline">Sign out</button>
            </p>
          </>
        ) : available ? (
          <SignInPrompt />
        ) : (
          <>
            {submitted && <p role="status" className="mb-3 text-sm text-pass">✓ Response posted. Thanks for adding to the discussion.</p>}
            <AnonymousForm postSlug={postSlug} onSuccess={handleNewComment} />
          </>
        )}
      </div>

      {/* Response list */}
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
        <p className="text-sm text-muted">No responses yet. Be the first to share your thoughts.</p>
      )}
    </section>
  )
}
