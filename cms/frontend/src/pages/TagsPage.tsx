import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import api from '@/lib/api'
import { slugify } from '@/lib/utils'
import type { Tag } from '@/types'

interface FormData { name: string; slug: string; color: string }
const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#64748b','#0ea5e9','#d97706']

export default function TagsPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Tag | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: tags = [], isLoading } = useQuery<Tag[]>({
    queryKey: ['tags'],
    queryFn: async () => (await api.get('/api/v1/tags')).data,
  })

  const { register, handleSubmit, watch, setValue, reset } = useForm<FormData>({
    defaultValues: { name: '', slug: '', color: '#06b6d4' },
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      editing ? api.patch(`/api/v1/tags/${editing.id}`, data) : api.post('/api/v1/tags', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success(editing ? 'Updated' : 'Created')
      reset(); setEditing(null); setShowForm(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/tags/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); toast.success('Deleted'); setDeleteId(null) },
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Tags</h1>
          <p className="text-sm text-slate-400">{tags.length} tags</p>
        </div>
        <Button variant="gradient" size="sm" onClick={() => { setEditing(null); reset({ name: '', slug: '', color: '#06b6d4' }); setShowForm(true) }}>
          <Plus size={15} className="mr-1.5" /> New Tag
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="glass-card p-5 space-y-4">
          <h3 className="font-semibold text-white">{editing ? 'Edit Tag' : 'New Tag'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register('name', { required: true })}
                onChange={e => { setValue('name', e.target.value); if (!editing) setValue('slug', slugify(e.target.value)) }}
                placeholder="Playwright" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input {...register('slug', { required: true })} placeholder="playwright" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setValue('color', c)}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{ background: c, outline: watch('color') === c ? `2px solid ${c}` : '2px solid transparent', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="gradient" disabled={saveMutation.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {isLoading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-white/5 rounded-full animate-pulse" />
        ))}
        {tags.map(tag => (
          <div key={tag.id} className="flex items-center gap-1 px-3 py-1 rounded-full border text-sm"
            style={{ borderColor: `${tag.color}50`, background: `${tag.color}15`, color: tag.color }}>
            <span>{tag.name}</span>
            <span className="text-xs opacity-60">({tag.post_count})</span>
            <button onClick={() => { setEditing(tag); reset({ name: tag.name, slug: tag.slug, color: tag.color }); setShowForm(true) }}
              className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
              <Pencil size={11} />
            </button>
            <button onClick={() => setDeleteId(tag.id)} className="opacity-60 hover:opacity-100 transition-opacity hover:text-red-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {!isLoading && tags.length === 0 && <p className="text-sm text-slate-500">No tags yet.</p>}
      </div>

      <ConfirmDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}
        title="Delete tag?" description="The tag will be removed from all posts."
        confirmLabel="Delete" destructive onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  )
}
