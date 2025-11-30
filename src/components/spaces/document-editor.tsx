'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DocumentComments } from './document-comments'
import type { Document } from './spaces-view'

interface DocumentEditorProps {
  document: Document
  currentUser: {
    id: string
    name: string
    role?: string
    avatarUrl?: string | null
  }
  onUpdate: (document: Document) => void
}

export function DocumentEditor({ document, currentUser, onUpdate }: DocumentEditorProps) {
  const [title, setTitle] = useState(document.title)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showComments, setShowComments] = useState(false)
  const [, setForceUpdate] = useState(0) // Used to force toolbar re-render on selection change
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const contentRef = useRef<any>(document.content)
  const documentIdRef = useRef<string>(document.id)
  const isSettingContentRef = useRef<boolean>(false)

  // Permission check: user can edit if they're the creator or an admin
  const isAdmin = currentUser.role === 'ADMIN'
  const isCreator = document.createdById === currentUser.id
  const canEdit = isCreator || isAdmin

  const editor = useEditor({
    immediatelyRender: false,
    editable: canEdit,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: canEdit ? 'Start writing your document...' : '',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-border',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted p-2 font-semibold',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-border p-2',
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'flex gap-2 items-start',
        },
      }),
    ],
    content: document.content || '',
    onUpdate: ({ editor }) => {
      // Skip auto-save if this update was triggered by programmatic setContent
      if (isSettingContentRef.current) return
      contentRef.current = editor.getJSON()
      debouncedSave()
    },
    onSelectionUpdate: () => {
      // Force toolbar re-render when selection changes (e.g., clicking into a table)
      setForceUpdate(n => n + 1)
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-lg dark:prose-invert max-w-none focus:outline-none min-h-[500px]',
          'prose-headings:mt-4 prose-headings:mb-2',
          'prose-p:my-2 prose-ul:my-2 prose-ol:my-2',
          'prose-li:my-1',
          '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:bg-muted/50 [&_blockquote]:py-2 [&_blockquote]:pr-4 [&_blockquote]:rounded-r',
          '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono',
          '[&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto',
          '[&_table]:w-full [&_th]:bg-muted [&_th]:p-3 [&_td]:p-3',
          '[&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl'
        ),
      },
    },
  })

  // Update editor when document changes
  useEffect(() => {
    // Cancel any pending saves from the previous document
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    // Update document ID ref immediately
    documentIdRef.current = document.id

    if (editor && document.id) {
      // Set flag to prevent onUpdate from triggering a save
      isSettingContentRef.current = true
      editor.commands.setContent(document.content || '')
      contentRef.current = document.content
      // Clear the flag after a short delay to ensure onUpdate has fired
      setTimeout(() => {
        isSettingContentRef.current = false
      }, 0)
      setTitle(document.title)
      setLastSaved(null) // Reset last saved indicator
    }
  }, [document.id, document.content, editor])

  // Save document
  const saveDocument = useCallback(async () => {
    if (!editor || !canEdit) return

    // Use ref to get current document ID to avoid race conditions
    const currentDocId = documentIdRef.current

    setSaving(true)
    try {
      const res = await fetch(`/api/documents/${currentDocId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content: contentRef.current,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        // Only update state if we're still on the same document
        if (documentIdRef.current === currentDocId) {
          setLastSaved(new Date())
          onUpdate(updated)
        }
      }
    } catch (error) {
      console.error('Failed to save document:', error)
    } finally {
      setSaving(false)
    }
  }, [editor, canEdit, title, onUpdate])

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (!canEdit) return
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument()
    }, 1000)
  }, [canEdit, saveDocument])

  // Save title on blur
  const handleTitleBlur = () => {
    if (canEdit && title !== document.title) {
      saveDocument()
    }
  }

  // Manual save handler (clears any pending auto-save)
  const handleManualSave = useCallback(() => {
    if (!canEdit) return
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    saveDocument()
  }, [canEdit, saveDocument])

  // Keyboard shortcut for save (Cmd/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-3 flex items-center justify-between bg-background">
        <div className="flex-1 max-w-2xl">
          {canEdit ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              className="text-xl font-semibold border-0 px-0 focus-visible:ring-0 bg-transparent"
              placeholder="Untitled Document"
            />
          ) : (
            <h1 className="text-xl font-semibold">{title}</h1>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {document.createdBy && (
              <span>Created by {document.createdBy.name}</span>
            )}
            {canEdit && lastSaved && (
              <span>Last saved {lastSaved.toLocaleTimeString()}</span>
            )}
            {saving && <span className="text-primary">Saving...</span>}
            {!canEdit && (
              <span className="text-amber-600 dark:text-amber-400">Read-only</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="default"
              size="sm"
              onClick={handleManualSave}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  Save
                </>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className={showComments ? 'bg-accent' : ''}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Comments
            {document._count?.comments ? (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                {document._count.comments}
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 overflow-auto">
          {/* Toolbar - only show when editable */}
          {canEdit && <EditorToolbar editor={editor} />}
          {/* Editor Content */}
          <div className="p-6 max-w-4xl mx-auto">
            <EditorContent editor={editor} />
          </div>
        </div>

        {/* Side Panel - Comments only */}
        {showComments && (
          <div className="w-80 border-l bg-muted/30 overflow-auto">
            <DocumentComments
              documentId={document.id}
              currentUser={currentUser}
              onClose={() => setShowComments(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const addTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const setLink = useCallback(() => {
    const url = window.prompt('Enter URL:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }, [editor])

  // Check if cursor is inside a table cell (more reliable than checking 'table')
  const isInTable = editor.isActive('tableCell') || editor.isActive('tableHeader')

  return (
    <div className="sticky top-0 z-10 bg-background border-b px-6 py-2">
      <div className="flex flex-wrap items-center gap-1">
        {/* Text Formatting */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
          >
            <span className="font-bold">B</span>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
          >
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
          >
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <span className="line-through">S</span>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Headings */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            H3
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Lists */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            title="Task List"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Blocks */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            active={false}
            onClick={setLink}
            title="Add Link"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </ToolbarButton>
        </div>

        <ToolbarDivider />

        {/* Table */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            active={isInTable}
            onClick={addTable}
            title="Insert Table (3x3)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </ToolbarButton>
          {isInTable && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Add Column After"
              >
                +Col
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().addRowAfter().run()}
                title="Add Row Below"
              >
                +Row
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Delete Column"
              >
                -Col
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteRow().run()}
                title="Delete Row"
              >
                -Row
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteTable().run()}
                title="Delete Table"
                className="text-destructive hover:text-destructive"
              >
                ×
              </ToolbarButton>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ToolbarButton({
  children,
  active,
  onClick,
  title,
  className,
  disabled,
}: {
  children: React.ReactNode
  active?: boolean
  onClick: () => void
  title: string
  className?: string
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 px-2.5 text-xs',
        active && 'bg-accent',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </Button>
  )
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border mx-1" />
}
