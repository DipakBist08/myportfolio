import type { Editor } from '@tiptap/react'
import { cn } from '@/lib/utils'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3, Heading4,
  List, ListOrdered, ListTodo, Quote, Minus, Link2, Link2Off,
  Image as ImageIcon, Table as TableIcon, Youtube, AlignLeft, AlignCenter,
  AlignRight, AlignJustify, Highlighter, Undo, Redo, Type, Pilcrow,
  Upload, Loader2,
} from 'lucide-react'
import { useState, useRef } from 'react'
import { useAuthStore } from '@/store/auth'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface EditorToolbarProps {
  editor: Editor | null
  onInsertImage: (url: string, alt?: string) => void
  onInsertYoutube: (url: string) => void
}

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
  className?: string
}

function ToolBtn({ onClick, active, disabled, title, children, className }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className={cn(
        'p-1.5 rounded text-sm transition-colors',
        active
          ? 'bg-primary/20 text-primary-light'
          : 'text-slate-400 hover:text-white hover:bg-white/8',
        disabled && 'opacity-30 pointer-events-none',
        className
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-5 bg-white/10 mx-0.5" />
}

const CODE_LANGUAGES = [
  'plaintext', 'javascript', 'typescript', 'python', 'bash', 'shell',
  'css', 'html', 'json', 'yaml', 'sql', 'java', 'go', 'rust',
  'csharp', 'php', 'ruby', 'kotlin', 'swift', 'dockerfile', 'xml',
]

export default function EditorToolbar({ editor, onInsertImage, onInsertYoutube }: EditorToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageAlt, setImageAlt] = useState('')
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [showCodeLangPicker, setShowCodeLangPicker] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const accessToken = useAuthStore(s => s.accessToken)

  if (!editor) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setUploadError('Only image files are supported.'); return }
    if (file.size > 10 * 1024 * 1024) { setUploadError('File must be under 10 MB.'); return }

    setUploading(true)
    setUploadError('')

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${API_BASE}/api/v1/media/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      })
      if (!res.ok) throw new Error(`Upload failed (${res.status})`)
      const data = await res.json()
      const url = data.url.startsWith('http') ? data.url : `${API_BASE}${data.url}`
      onInsertImage(url, file.name.replace(/\.[^.]+$/, ''))
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const setLink = () => {
    if (!linkUrl) { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkToLink()
      .setLink({ href: linkUrl, target: '_blank' }).run()
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const insertImg = () => {
    if (imageUrl) {
      onInsertImage(imageUrl, imageAlt)
      setShowImageInput(false)
      setImageUrl('')
      setImageAlt('')
    }
  }

  const insertYt = () => {
    if (youtubeUrl) {
      onInsertYoutube(youtubeUrl)
      setShowYoutubeInput(false)
      setYoutubeUrl('')
    }
  }

  const colors = [
    '#f1f5f9', '#6366f1', '#8b5cf6', '#06b6d4', '#10b981',
    '#f59e0b', '#ef4444', '#ec4899', '#64748b',
  ]

  return (
    <div className="bg-[#0a0f1e] border-b border-border">
      {/* Main toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2">
        {/* Undo/Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>
          <Undo size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()}>
          <Redo size={15} />
        </ToolBtn>
        <Divider />

        {/* Headings */}
        <ToolBtn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive('paragraph')} title="Paragraph">
          <Pilcrow size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <Heading1 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <Heading2 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
          <Heading3 size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })} title="Heading 4">
          <Heading4 size={15} />
        </ToolBtn>
        <Divider />

        {/* Text styles */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
          <UnderlineIcon size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">
          <Code size={15} />
        </ToolBtn>
        <Divider />

        {/* Highlight + Color */}
        <div className="relative">
          <ToolBtn onClick={() => setShowColorPicker(p => !p)} active={showColorPicker} title="Text color">
            <Type size={15} />
          </ToolBtn>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e293b] border border-border rounded-lg p-2 shadow-xl flex flex-wrap gap-1 w-36">
              {colors.map(c => (
                <button key={c} type="button"
                  className="w-6 h-6 rounded ring-1 ring-white/20 hover:ring-white/60"
                  style={{ background: c }}
                  onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false) }}
                />
              ))}
              <button type="button" className="text-xs text-slate-400 hover:text-white w-full mt-1"
                onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false) }}>
                Reset
              </button>
            </div>
          )}
        </div>
        <ToolBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} active={editor.isActive('highlight')} title="Highlight">
          <Highlighter size={15} />
        </ToolBtn>
        <Divider />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">
          <AlignLeft size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">
          <AlignCenter size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">
          <AlignRight size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
          <AlignJustify size={15} />
        </ToolBtn>
        <Divider />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">
          <List size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Ordered list">
          <ListOrdered size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task list">
          <ListTodo size={15} />
        </ToolBtn>
        <Divider />

        {/* Block elements */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">
          <Quote size={15} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
          <Minus size={15} />
        </ToolBtn>
        <Divider />

        {/* Code block with language */}
        <div className="relative">
          <ToolBtn onClick={() => setShowCodeLangPicker(p => !p)} active={editor.isActive('codeBlock')} title="Code block">
            <Code2 size={15} />
          </ToolBtn>
          {showCodeLangPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-[#1e293b] border border-border rounded-lg shadow-xl overflow-hidden w-36 max-h-52 overflow-y-auto">
              {CODE_LANGUAGES.map(lang => (
                <button key={lang} type="button"
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-primary/20 hover:text-white font-mono"
                  onClick={() => {
                    editor.chain().focus().setCodeBlock({ language: lang }).run()
                    setShowCodeLangPicker(false)
                  }}>
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>
        <Divider />

        {/* Table */}
        <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">
          <TableIcon size={15} />
        </ToolBtn>
        <Divider />

        {/* Link */}
        <ToolBtn onClick={() => setShowLinkInput(p => !p)} active={editor.isActive('link') || showLinkInput} title="Insert link">
          <Link2 size={15} />
        </ToolBtn>
        {editor.isActive('link') && (
          <ToolBtn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
            <Link2Off size={15} />
          </ToolBtn>
        )}
        <Divider />

        {/* Image URL */}
        <ToolBtn onClick={() => setShowImageInput(p => !p)} active={showImageInput} title="Insert image by URL">
          <ImageIcon size={15} />
        </ToolBtn>

        {/* Image Upload */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Upload image from device">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        </ToolBtn>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* YouTube */}
        <ToolBtn onClick={() => setShowYoutubeInput(p => !p)} active={showYoutubeInput} title="Embed YouTube video">
          <Youtube size={15} />
        </ToolBtn>
      </div>

      {/* Upload error */}
      {uploadError && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-red-950/40 text-xs text-red-400">
          <span>{uploadError}</span>
          <button type="button" onClick={() => setUploadError('')} className="ml-2 hover:text-white">✕</button>
        </div>
      )}

      {/* Sub-toolbars */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[#111827]">
          <input
            autoFocus
            type="url"
            placeholder="https://..."
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setShowLinkInput(false) }}
            className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <button type="button" onClick={setLink} className="px-3 py-1 bg-primary rounded text-xs text-white font-medium hover:bg-primary/90">Add</button>
          <button type="button" onClick={() => setShowLinkInput(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {showImageInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[#111827]">
          <input autoFocus type="url" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') insertImg(); if (e.key === 'Escape') setShowImageInput(false) }}
            className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
          <input type="text" placeholder="Alt text (optional)" value={imageAlt} onChange={e => setImageAlt(e.target.value)}
            className="w-36 bg-input border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
          <button type="button" onClick={insertImg} className="px-3 py-1 bg-primary rounded text-xs text-white font-medium hover:bg-primary/90">Insert</button>
          <button type="button" onClick={() => setShowImageInput(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {showYoutubeInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[#111827]">
          <input autoFocus type="url" placeholder="YouTube URL or video ID" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') insertYt(); if (e.key === 'Escape') setShowYoutubeInput(false) }}
            className="flex-1 bg-input border border-border rounded px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
          <button type="button" onClick={insertYt} className="px-3 py-1 bg-primary rounded text-xs text-white font-medium hover:bg-primary/90">Embed</button>
          <button type="button" onClick={() => setShowYoutubeInput(false)} className="px-2 py-1 text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}
    </div>
  )
}
