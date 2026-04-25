import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Upload, Trash2, Search, Grid, List, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { formatFileSize, formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { PaginatedMedia, MediaItem } from '@/types'

export default function MediaPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [mimeFilter, setMimeFilter] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useQuery<PaginatedMedia>({
    queryKey: ['media', page, search, mimeFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, page_size: 24 }
      if (search) params.search = search
      if (mimeFilter) params.mime_type = mimeFilter
      return (await api.get('/api/v1/media', { params })).data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/v1/media/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['media'] }); toast.success('Deleted'); setDeleteId(null) },
  })

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    let ok = 0, fail = 0
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      try {
        await api.post('/api/v1/media/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        ok++
      } catch { fail++ }
    }
    setUploading(false)
    qc.invalidateQueries({ queryKey: ['media'] })
    if (ok) toast.success(`Uploaded ${ok} file${ok > 1 ? 's' : ''}`)
    if (fail) toast.error(`${fail} upload${fail > 1 ? 's' : ''} failed`)
    if (fileRef.current) fileRef.current.value = ''
  }

  const copyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
    toast.success('URL copied!')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      try { await api.post('/api/v1/media/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } }) } catch {}
    }
    setUploading(false)
    qc.invalidateQueries({ queryKey: ['media'] })
    toast.success(`Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-white">Media Library</h1>
          <p className="text-sm text-slate-400">{data?.total ?? 0} files</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('grid')} className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-white'}`}>
            <Grid size={16} />
          </button>
          <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-primary/20 text-primary-light' : 'text-slate-400 hover:text-white'}`}>
            <List size={16} />
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload}
            accept="image/*,application/pdf,text/plain,application/zip" />
          <Button variant="gradient" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} className="mr-1.5" />
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-xl p-8 text-center text-slate-500 hover:border-primary/50 hover:text-slate-400 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">Drop files here or click to upload</p>
        <p className="text-xs mt-1">Images, PDFs, text files, ZIPs · Max 10MB</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {['', 'image/', 'application/pdf'].map(m => (
          <button key={m} onClick={() => setMimeFilter(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mimeFilter === m ? 'bg-primary/20 text-primary-light border border-primary/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            {m === '' ? 'All' : m === 'image/' ? 'Images' : 'PDFs'}
          </button>
        ))}
      </div>

      {/* Grid view */}
      {view === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {isLoading && Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-square bg-white/5 rounded-lg animate-pulse" />
          ))}
          {data?.items.map(item => (
            <div key={item.id} className="group relative glass-card overflow-hidden aspect-square">
              {item.mime_type.startsWith('image/') ? (
                <img src={item.url} alt={item.alt_text || item.original_filename}
                  className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted text-slate-400 p-2">
                  <span className="text-2xl mb-1">📄</span>
                  <span className="text-xs text-center truncate w-full">{item.original_filename}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copyUrl(item)} className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors">
                  {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button onClick={() => setDeleteId(item.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60 text-xs text-slate-300 truncate">
                {formatFileSize(item.file_size)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && (
        <div className="glass-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4 text-left">File</th>
                <th className="py-3 px-4 text-left hidden md:table-cell">Type</th>
                <th className="py-3 px-4 text-right hidden sm:table-cell">Size</th>
                <th className="py-3 px-4 text-right hidden lg:table-cell">Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data?.items.map(item => (
                <tr key={item.id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {item.mime_type.startsWith('image/') ? (
                        <img src={item.url} alt={item.alt_text} className="w-10 h-10 object-cover rounded border border-border" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded border border-border flex items-center justify-center text-xl">📄</div>
                      )}
                      <div>
                        <p className="text-sm text-slate-200 truncate max-w-[200px]">{item.original_filename}</p>
                        {item.width && <p className="text-xs text-slate-500">{item.width} × {item.height}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-xs text-slate-400 font-mono">{item.mime_type}</td>
                  <td className="py-3 px-4 hidden sm:table-cell text-xs text-slate-400 text-right">{formatFileSize(item.file_size)}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-xs text-slate-400 text-right">{formatDate(item.created_at)}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => copyUrl(item)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
                        {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button onClick={() => setDeleteId(item.id)} className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Page {data.page} of {data.pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Previous</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}>Next</Button>
          </div>
        </div>
      )}

      <ConfirmDialog open={deleteId !== null} onOpenChange={o => !o && setDeleteId(null)}
        title="Delete file?" description="The file will be permanently deleted from disk."
        confirmLabel="Delete" destructive onConfirm={() => deleteId && deleteMutation.mutate(deleteId)} />
    </div>
  )
}
