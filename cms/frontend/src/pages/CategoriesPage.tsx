import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import api from '@/lib/api'
import { slugify } from '@/lib/utils'
import type { Category } from '@/types'

interface FormData { name: string; slug: string; description: string; color: string; icon: string }

const ICON_OPTIONS = ['Bot', 'ClipboardCheck', 'Globe', 'GitBranch', 'Settings', 'Code', 'FileText', 'Zap', 'Database', 'Shield', 'Terminal', 'Activity']
const COLOR_OPTIONS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#64748b', '#0ea5e9', '#d97706']

export default function CategoriesPage() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: async () => (await api.get('/api/v1/categories')).data,
  })

  const { register, handleSubmit, watch, setValue, reset } = useForm<FormData>({
    defaultValues: { name: '', slug: '', description: '', color: '#6366f1', icon: 'FolderOpen' },
  })

  const saveMutation = useMutation({
    mutationFn: (data: FormData) =>
      editing
        ? api.patch(`/api/v1/categories/${editing.id}`, data)
        : api.post('/api/v1/categories', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast.success(editing ? 'Updated' : 'Created')
      reset()
      setEditing(null)
      setShowForm(false)
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || 'Save failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/categories/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); toast.success('Deleted'); setDeleteId(null) },
  })

  const openEdit = (cat: Category) => {
    setEditing(cat)
    reset({ name: cat.name, slug: cat.slug, description: cat.description, color: cat.color, icon: cat.icon })
    setShowForm(true)
  }

  const openNew = () => { setEditing(null); reset({ name: '', slug: '', description: '', color: '#6366f1', icon: 'FolderOpen' }); setShowForm(true) }

  const name = watch('name')

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Categories</h1>
          <p className="text-sm text-slate-400">{categories.length} categories</p>
        </div>
        <Button variant="gradient" size="sm" onClick={openNew}>
          <Plus size={15} className="mr-1.5" /> New Category
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="glass-card p-5 space-y-4">
          <h3 className="font-semibold text-white">{editing ? 'Edit Category' : 'New Category'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input {...register('name', { required: true })}
                onChange={e => { setValue('name', e.target.value); if (!editing) setValue('slug', slugify(e.target.value)) }}
                placeholder="QA Automation" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input {...register('slug', { required: true })} placeholder="qa-automation" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea {...register('description')} placeholder="Category description…" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} type="button" onClick={() => setValue('color', c)}
                    className="w-7 h-7 rounded-full ring-2 transition-all"
                    style={{ background: c, ringColor: watch('color') === c ? c : 'transparent' }} />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Icon (Lucide name)</Label>
              <Input {...register('icon')} placeholder="FolderOpen" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" variant="gradient" disabled={saveMutation.isPending}>
              {editing ? 'Update' : 'Create'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 text-left">Category</th>
              <th className="py-3 px-4 text-left hidden md:table-cell">Slug</th>
              <th className="py-3 px-4 text-right">Posts</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <tr key={i} className="animate-pulse">
                <td className="py-3 px-4"><div className="h-4 bg-white/5 rounded w-32" /></td>
                <td className="py-3 px-4 hidden md:table-cell"><div className="h-4 bg-white/5 rounded w-24" /></td>
                <td className="py-3 px-4 text-right"><div className="h-4 bg-white/5 rounded w-8 ml-auto" /></td>
                <td className="py-3 px-4" />
              </tr>
            ))}
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-white/2 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cat.color }} />
                    <span className="text-sm font-medium text-slate-200">{cat.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 hidden md:table-cell">
                  <span className="text-xs font-mono text-slate-400">{cat.slug}</span>
                </td>
                <td className="py-3 px-4 text-right text-sm text-slate-400">{cat.post_count}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteId(cat.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && categories.length === 0 && (
              <tr><td colSpan={4} className="py-10 text-center text-slate-500">No categories yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}
        title="Delete category?" description="Posts in this category will be uncategorized."
        confirmLabel="Delete" destructive onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  )
}
