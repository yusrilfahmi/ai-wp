'use client'

import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback } from 'react'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  Quote,
  Link as LinkIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Minus,
} from 'lucide-react'

// ----------------------------------------------------------
// Toolbar button helper
// ----------------------------------------------------------
function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault() // keep editor focus
        onClick()
      }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors text-sm ${
        active
          ? 'bg-blue-100 text-blue-600'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

// ----------------------------------------------------------
// Minimal toolbar (for source-text editor)
// ----------------------------------------------------------
function MinimalToolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  )
}

// ----------------------------------------------------------
// Full toolbar (for article HTML editor)
// ----------------------------------------------------------
function FullToolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-xl flex-wrap">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      >
        <Bold className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      >
        <Italic className="w-3.5 h-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      >
        <Heading2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      >
        <Heading3 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      >
        <Quote className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Ordered List"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={setLink}
        active={editor.isActive('link')}
        title="Set Link"
      >
        <LinkIcon className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="w-3.5 h-3.5" />
      </ToolbarButton>
      <div className="w-px h-4 bg-gray-200 mx-1" />
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  )
}

// ----------------------------------------------------------
// Shared plain-text → HTML helper
// Plain scraped text (double-newline separated paragraphs) → <p> tags
// ----------------------------------------------------------
function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  // If it already looks like HTML (starts with an HTML tag), return as-is
  if (/^\s*<[a-z]/i.test(text)) return text
  return text
    .split(/\n\n+/)
    .map((para) => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

// ----------------------------------------------------------
// Source Text Editor (plain-text mode, minimal toolbar)
// ----------------------------------------------------------
interface SourceEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export function SourceTextEditor({
  value,
  onChange,
  placeholder = 'Klik \'Tarik Teks dari URL\' untuk mengisi otomatis, atau ketik/paste teks sumber di sini...',
  minHeight = '500px',
}: SourceEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // disable features we don't need for plain source text
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        code: false,
        codeBlock: false,
        strike: false,
        hardBreak: {
          keepMarks: false,
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: plainTextToHtml(value),
    onUpdate({ editor }) {
      // Export as plain text (strip tags, restore double-newlines between paragraphs)
      const html = editor.getHTML()
      // Convert <p> paragraphs back to plain text with double newlines
      const plain = html
        .replace(/<\/p>\s*<p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
      onChange(plain)
    },
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Sync external value changes (e.g., when scrape/translate updates the text)
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    const incoming = plainTextToHtml(value)
    // Only update if truly different to avoid cursor reset
    if (incoming !== currentHtml) {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div
      className="w-full border border-gray-300 rounded-xl shadow-inner bg-gray-50 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
      style={{ minHeight }}
    >
      <MinimalToolbar editor={editor} />
      <div
        className="overflow-y-auto"
        style={{ minHeight: `calc(${minHeight} - 44px)`, maxHeight: '700px' }}
      >
        <EditorContent
          editor={editor}
          className="prose prose-lg max-w-none px-8 py-6 text-gray-800 font-serif leading-loose focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror_p]:mb-4 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------
// Article HTML Editor (full toolbar, reads/writes raw HTML)
// ----------------------------------------------------------
interface ArticleEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

export function ArticleHtmlEditor({
  value,
  onChange,
  placeholder = 'Pratinjau artikel akan muncul di sini setelah diproses...',
  minHeight = '400px',
}: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        code: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-red-600 font-medium underline hover:text-red-800',
          target: '_blank',
          rel: 'noopener',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
    },
    immediatelyRender: false,
  })

  // Sync when the rawHtml state is updated externally (e.g. after AI generation)
  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.getHTML()
    // Normalize empty editor state
    const incoming = value || ''
    if (incoming !== currentHtml && incoming !== '<p></p>') {
      editor.commands.setContent(incoming, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  return (
    <div
      className="w-full border border-gray-300 rounded-xl bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
      style={{ minHeight }}
    >
      <FullToolbar editor={editor} />
      <div
        className="overflow-y-auto"
        style={{ minHeight: `calc(${minHeight} - 44px)`, maxHeight: '700px' }}
      >
        <EditorContent
          editor={editor}
          className={`
            prose prose-sm max-w-none px-5 py-4 focus:outline-none
            [&_.ProseMirror]:outline-none
            [&_.ProseMirror_p]:mb-4 [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_p]:text-gray-700
            [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mt-6 [&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:text-gray-900
            [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-5 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-gray-800
            [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-indigo-500 [&_.ProseMirror_blockquote]:bg-indigo-50 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:pr-4 [&_.ProseMirror_blockquote]:py-2 [&_.ProseMirror_blockquote]:rounded-r-md [&_.ProseMirror_blockquote]:text-gray-700 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:my-5
            [&_.ProseMirror_a]:text-red-600 [&_.ProseMirror_a]:font-medium [&_.ProseMirror_a]:underline
            [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:mb-4
            [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:mb-4
            [&_.ProseMirror_li]:mb-1
            [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:my-5
            [&_.ProseMirror_th]:bg-gray-100 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left
            [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2
            [&_.ProseMirror_hr]:my-6 [&_.ProseMirror_hr]:border-gray-200
            [&_.ProseMirror_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_.is-editor-empty:first-child::before]:text-gray-400 [&_.ProseMirror_.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_.is-editor-empty:first-child::before]:h-0
          `}
        />
      </div>
    </div>
  )
}
