import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Save, Eye, ArrowLeft, Loader2, ChevronDown, ChevronUp,
  Globe, Image as ImageIcon, Tag as TagIcon, Settings2, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import BlogEditor from '@/components/editor/BlogEditor'
import api from '@/lib/api'
import { slugify, formatDate } from '@/lib/utils'
import type { PostDetail, Category, Tag, PostStatus } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  slug: z.string().min(1, 'Slug required'),
  excerpt: z.string().max(500),
  featured_image: z.string().url().optional().or(z.literal('')),
  featured_image_alt: z.string().max(200),
  status: z.enum(['draft', 'published', 'scheduled', 'archived'] as const),
  is_featured: z.boolean(),
  category_id: z.number().nullable(),
  tag_ids: z.array(z.number()),
  seo_title: z.string().max(500),
  seo_description: z.string().max(1000),
  seo_keywords: z.string().max(500),
  canonical_url: z.string().url().optional().or(z.literal('')),
  scheduled_at: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const STATUSES: { value: PostStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'text-slate-400' },
  { value: 'published', label: 'Published', color: 'text-green-400' },
  { value: 'scheduled', label: 'Scheduled', color: 'text-blue-400' },
  { value: 'archived', label: 'Archived', color: 'text-yellow-400' },
]

export default function PostEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [content, setContent] = useState('')
  const [contentJson, setContentJson] = useState('')
  const [contentText, setContentText] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const [seoOpen, setSeoOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const { data: post, isLoading: postLoading } = useQuery<PostDetail>({
    queryKey: ['post', id],
    queryFn: async () => (await api.get(`/api/v1/posts/${id}`)).data,
    enabled: !isNew,
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/api/v1/categories')).data,
  })

  const { data: tags } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/api/v1/tags')).data,
  })

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', slug: '', excerpt: '', featured_image: '',
      featured_image_alt: '', status: 'draft', is_featured: false,
      category_id: null, tag_ids: [], seo_title: '', seo_description: '',
      seo_keywords: '', canonical_url: '',
    },
  })

  // Populate form from loaded post
  useEffect(() => {
    if (post) {
      reset({
        title: post.title, slug: post.slug, excerpt: post.excerpt,
        featured_image: post.featured_image, featured_image_alt: post.featured_image_alt,
        status: post.status, is_featured: post.is_featured,
        category_id: post.category?.id ?? null,
        tag_ids: post.tags.map(t => t.id),
        seo_title: post.seo_title, seo_description: post.seo_description,
        seo_keywords: post.seo_keywords, canonical_url: post.canonical_url,
      })
      setContent(post.content)
      setContentJson(post.content_json)
    }
  }, [post])

  // Auto-slug from title
  const title = watch('title')
  useEffect(() => {
    if (isNew && title) setValue('slug', slugify(title))
  }, [title, isNew])

  const saveMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ...data,
        content,
        content_json: contentJson,
        content_text: contentText,
        featured_image: data.featured_image || '',
        canonical_url: data.canonical_url || '',
      }
      if (isNew) return (await api.post('/api/v1/posts', payload)).data
      return (await api.patch(`/api/v1/posts/${id}`, payload)).data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      setLastSaved(new Date())
      if (isNew) navigate(`/posts/${data.id}/edit`, { replace: true })
      toast.success(isNew ? 'Post created!' : 'Saved')
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || 'Save failed'),
  })

  const onSubmit = handleSubmit((data) => saveMutation.mutate(data))

  const handleEditorChange = useCallback((html: string, json: string, text: string) => {
    setContent(html)
    setContentJson(json)
    setContentText(text)
  }, [])

  const watchedStatus = watch('status')
  const watchedTagIds = watch('tag_ids')

  if (!isNew && postLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-primary" />
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="max-w-7xl mx-auto space-y-0">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/posts')} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-heading font-semibold text-white">
            {isNew ? 'New Post' : 'Edit Post'}
          </h1>
          {lastSaved && (
            <span className="text-xs text-slate-500">Saved {formatDate(lastSaved.toISOString())}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              previewMode ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Eye size={15} />
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          {/* Status selector */}
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                className="bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-ring outline-none"
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            )}
          />
          <Button type="submit" variant="gradient" size="sm" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
            {isNew ? 'Create' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* Main editor column */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <Input
              {...register('title')}
              placeholder="Post title…"
              className="text-2xl font-heading font-bold h-auto py-3 px-4 bg-[#0d1117] border-border text-white placeholder:text-slate-600 focus-visible:ring-primary/50"
            />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>

          {/* Slug */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 shrink-0">Slug:</span>
            <Input
              {...register('slug')}
              placeholder="post-slug"
              className="font-mono text-xs h-7 bg-transparent border-0 border-b border-border rounded-none text-slate-400 focus-visible:ring-0 px-1"
            />
            {errors.slug && <span className="text-xs text-destructive">{errors.slug.message}</span>}
          </div>

          {/* Editor / Preview */}
          {!previewMode ? (
            <BlogEditor
              content={content}
              contentJson={contentJson}
              onChange={handleEditorChange}
              placeholder="Start writing your post…"
              autosaveKey={id || 'new'}
            />
          ) : (
            <div className="glass-card p-8 min-h-[520px]">
              <div
                className="prose-cms"
                dangerouslySetInnerHTML={{ __html: content || '<p class="text-slate-500">Nothing to preview yet.</p>' }}
              />
            </div>
          )}

          {/* Excerpt */}
          <div className="space-y-1.5">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              {...register('excerpt')}
              placeholder="Short description of the post (shown in listings)…"
              rows={3}
            />
          </div>

          {/* SEO section */}
          <div className="glass-card overflow-hidden">
            <button
              type="button"
              onClick={() => setSeoOpen(p => !p)}
              className="w-full flex items-center justify-between p-4 text-sm font-medium text-slate-300 hover:text-white"
            >
              <span className="flex items-center gap-2"><Globe size={15} /> SEO & Meta</span>
              {seoOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {seoOpen && (
              <div className="p-4 pt-0 space-y-3 border-t border-border">
                <div>
                  <Label htmlFor="seo_title">SEO Title</Label>
                  <Input id="seo_title" {...register('seo_title')} placeholder="Custom page title for search engines" />
                  <p className="text-xs text-slate-500 mt-1">{watch('seo_title')?.length ?? 0}/60 chars</p>
                </div>
                <div>
                  <Label htmlFor="seo_description">Meta Description</Label>
                  <Textarea id="seo_description" {...register('seo_description')} placeholder="Description shown in search results…" rows={2} />
                  <p className="text-xs text-slate-500 mt-1">{watch('seo_description')?.length ?? 0}/160 chars</p>
                </div>
                <div>
                  <Label htmlFor="seo_keywords">Keywords</Label>
                  <Input id="seo_keywords" {...register('seo_keywords')} placeholder="keyword1, keyword2, keyword3" />
                </div>
                <div>
                  <Label htmlFor="canonical_url">Canonical URL</Label>
                  <Input id="canonical_url" {...register('canonical_url')} placeholder="https://…" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar column */}
        <div className="space-y-4">
          {/* Featured image */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ImageIcon size={14} /> Featured Image
            </h3>
            <Input {...register('featured_image')} placeholder="Image URL" />
            {watch('featured_image') && (
              <img
                src={watch('featured_image')}
                alt="Featured"
                className="w-full h-36 object-cover rounded-lg border border-border"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <Input {...register('featured_image_alt')} placeholder="Alt text" />
          </div>

          {/* Category */}
          <div className="glass-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white">Category</h3>
            <Controller
              name="category_id"
              control={control}
              render={({ field }) => (
                <select
                  value={field.value ?? ''}
                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-ring outline-none"
                >
                  <option value="">No category</option>
                  {categories?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Tags */}
          <div className="glass-card p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <TagIcon size={14} /> Tags
            </h3>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {tags?.map(tag => {
                const selected = watchedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const curr = watchedTagIds
                      setValue('tag_ids', selected ? curr.filter(id => id !== tag.id) : [...curr, tag.id])
                    }}
                    className="px-2 py-0.5 rounded-full text-xs border transition-colors"
                    style={selected
                      ? { background: `${tag.color}30`, borderColor: tag.color, color: tag.color }
                      : { borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8' }}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Post settings */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Settings2 size={14} /> Post Settings
            </h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <Controller
                name="is_featured"
                control={control}
                render={({ field }) => (
                  <input type="checkbox" checked={field.value} onChange={field.onChange} className="accent-primary" />
                )}
              />
              <span className="text-sm text-slate-300 flex items-center gap-1">
                <Sparkles size={13} className="text-yellow-400" /> Featured post
              </span>
            </label>
            {watchedStatus === 'scheduled' && (
              <div>
                <Label htmlFor="scheduled_at">Schedule time</Label>
                <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
              </div>
            )}
          </div>

          {/* Post info */}
          {!isNew && post && (
            <div className="glass-card p-4 space-y-2 text-xs text-slate-400">
              <p>Created: <span className="text-slate-300">{formatDate(post.created_at)}</span></p>
              {post.published_at && <p>Published: <span className="text-slate-300">{formatDate(post.published_at)}</span></p>}
              <p>Views: <span className="text-slate-300">{post.view_count.toLocaleString()}</span></p>
              <p>Reading time: <span className="text-slate-300">{post.reading_time} min</span></p>
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
