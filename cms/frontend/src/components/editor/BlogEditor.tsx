import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Youtube from '@tiptap/extension-youtube'
import Typography from '@tiptap/extension-typography'
import { createLowlight, common } from 'lowlight'
import EditorToolbar from './EditorToolbar'
import { useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

const lowlight = createLowlight(common)

interface BlogEditorProps {
  content: string
  contentJson?: string
  onChange: (html: string, json: string, text: string) => void
  placeholder?: string
  className?: string
  autosaveKey?: string
}

export default function BlogEditor({
  content, contentJson, onChange, placeholder = 'Start writing your post…', className, autosaveKey,
}: BlogEditorProps) {
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>()

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [1, 2, 3, 4] },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', class: 'text-primary underline' } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: 'code-block' },
        defaultLanguage: 'plaintext',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Youtube.configure({ HTMLAttributes: { class: 'rounded-lg' } }),
      Typography,
      CharacterCount,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: contentJson ? JSON.parse(contentJson) : content || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const json = JSON.stringify(editor.getJSON())
      const text = editor.getText()
      onChange(html, json, text)

      // Autosave to localStorage
      if (autosaveKey) {
        clearTimeout(autosaveTimer.current)
        autosaveTimer.current = setTimeout(() => {
          localStorage.setItem(`cms_autosave_${autosaveKey}`, JSON.stringify({ html, json, text, savedAt: new Date().toISOString() }))
        }, 2000)
      }
    },
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
  })

  // Restore autosave on mount
  useEffect(() => {
    if (!autosaveKey || !editor || content) return
    const saved = localStorage.getItem(`cms_autosave_${autosaveKey}`)
    if (saved) {
      const { json } = JSON.parse(saved)
      if (json) {
        try { editor.commands.setContent(JSON.parse(json)) } catch {}
      }
    }
  }, [editor])

  const insertImage = useCallback((url: string, alt?: string) => {
    editor?.chain().focus().setImage({ src: url, alt: alt || '' }).run()
  }, [editor])

  const insertYoutube = useCallback((url: string) => {
    editor?.chain().focus().setYoutubeVideo({ src: url }).run()
  }, [editor])

  const wordCount = editor?.storage.characterCount?.words() ?? 0
  const charCount = editor?.storage.characterCount?.characters() ?? 0

  return (
    <div className={cn('flex flex-col border border-border rounded-xl overflow-hidden', className)}>
      <EditorToolbar editor={editor} onInsertImage={insertImage} onInsertYoutube={insertYoutube} />
      <div className="tiptap-editor flex-1 overflow-y-auto bg-[#0d1117] px-8 py-4 min-h-[520px] max-h-[calc(100vh-320px)]">
        <EditorContent editor={editor} />
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
          <span>~{Math.max(1, Math.round(wordCount / 200))} min read</span>
        </div>
        {autosaveKey && (
          <span className="text-green-400/60">Auto-save enabled</span>
        )}
      </div>
    </div>
  )
}

export { BlogEditor }
