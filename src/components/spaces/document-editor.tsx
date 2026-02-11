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
import { DocumentAttachments } from './document-attachments'
import { FileViewerPopup } from './file-viewer-popup'
import { PDFViewer } from './pdf-viewer'
import type { Document } from './spaces-view'
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
} from 'docx'
import { saveAs } from 'file-saver'

// Convert TipTap JSON to docx elements
function tiptapToDocxElements(content: any): (Paragraph | DocxTable)[] {
  if (!content || !content.content) return [new Paragraph({ text: '' })]

  const elements: (Paragraph | DocxTable)[] = []

  for (const node of content.content) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level || 1
        const headingLevel = level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
        elements.push(
          new Paragraph({
            heading: headingLevel,
            children: extractTextRuns(node.content || []),
          })
        )
        break
      }
      case 'paragraph': {
        const alignment = node.attrs?.textAlign === 'center' ? AlignmentType.CENTER :
                         node.attrs?.textAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        elements.push(
          new Paragraph({
            alignment,
            children: extractTextRuns(node.content || []),
          })
        )
        break
      }
      case 'bulletList':
      case 'orderedList': {
        const isOrdered = node.type === 'orderedList'
        if (node.content) {
          node.content.forEach((listItem: any, index: number) => {
            if (listItem.content) {
              listItem.content.forEach((para: any) => {
                elements.push(
                  new Paragraph({
                    bullet: isOrdered ? undefined : { level: 0 },
                    numbering: isOrdered ? { reference: 'default-numbering', level: 0 } : undefined,
                    children: extractTextRuns(para.content || []),
                  })
                )
              })
            }
          })
        }
        break
      }
      case 'taskList': {
        if (node.content) {
          node.content.forEach((taskItem: any) => {
            const checked = taskItem.attrs?.checked ? '[x] ' : '[ ] '
            if (taskItem.content) {
              taskItem.content.forEach((para: any) => {
                elements.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: checked }),
                      ...extractTextRuns(para.content || []),
                    ],
                  })
                )
              })
            }
          })
        }
        break
      }
      case 'blockquote': {
        if (node.content) {
          node.content.forEach((child: any) => {
            elements.push(
              new Paragraph({
                indent: { left: 720 },
                children: [
                  new TextRun({ text: '| ', italics: true }),
                  ...extractTextRuns(child.content || [], true),
                ],
              })
            )
          })
        }
        break
      }
      case 'codeBlock': {
        const codeText = node.content?.map((c: any) => c.text || '').join('\n') || ''
        elements.push(
          new Paragraph({
            shading: { fill: 'EEEEEE' },
            children: [new TextRun({ text: codeText, font: 'Courier New', size: 20 })],
          })
        )
        break
      }
      case 'table': {
        if (node.content) {
          const rows = node.content.map((row: any) => {
            const cells = (row.content || []).map((cell: any) => {
              const cellContent = cell.content?.map((para: any) =>
                new Paragraph({ children: extractTextRuns(para.content || []) })
              ) || [new Paragraph({ text: '' })]
              return new DocxTableCell({
                children: cellContent,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1 },
                  bottom: { style: BorderStyle.SINGLE, size: 1 },
                  left: { style: BorderStyle.SINGLE, size: 1 },
                  right: { style: BorderStyle.SINGLE, size: 1 },
                },
              })
            })
            return new DocxTableRow({ children: cells })
          })
          if (rows.length > 0) {
            elements.push(new DocxTable({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }))
          }
        }
        break
      }
      default:
        // For unknown types, try to extract any text
        if (node.content) {
          elements.push(
            new Paragraph({
              children: extractTextRuns(node.content),
            })
          )
        }
    }
  }

  return elements.length > 0 ? elements : [new Paragraph({ text: '' })]
}

function extractTextRuns(content: any[], inheritItalic = false): TextRun[] {
  if (!content || content.length === 0) return []

  return content.map((item: any) => {
    if (item.type === 'text') {
      const marks = item.marks || []
      const isBold = marks.some((m: any) => m.type === 'bold')
      const isItalic = inheritItalic || marks.some((m: any) => m.type === 'italic')
      const isUnderline = marks.some((m: any) => m.type === 'underline')
      const isStrike = marks.some((m: any) => m.type === 'strike')
      const isCode = marks.some((m: any) => m.type === 'code')
      const link = marks.find((m: any) => m.type === 'link')

      return new TextRun({
        text: item.text || '',
        bold: isBold,
        italics: isItalic,
        underline: isUnderline ? {} : undefined,
        strike: isStrike,
        font: isCode ? 'Courier New' : undefined,
        size: isCode ? 20 : undefined,
      })
    }
    return new TextRun({ text: '' })
  })
}

async function exportToWord(document: Document) {
  const doc = new DocxDocument({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.LEFT,
        }],
      }],
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          heading: HeadingLevel.TITLE,
          children: [new TextRun({ text: document.title, bold: true })],
        }),
        new Paragraph({ text: '' }), // Spacer
        ...tiptapToDocxElements(document.content),
      ],
    }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${document.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
}

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

  // Check if document is a file type
  const isFileType = document.type === 'file'

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
          {!isFileType && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => exportToWord(document)}
              title="Download as Word document"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Word
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
        {/* Editor or File Viewer */}
        <div className="flex-1 overflow-auto">
          {isFileType ? (
            /* File Viewer for uploaded files */
            <FileDocumentViewer
              document={document}
              currentUser={currentUser}
            />
          ) : (
            <>
              {/* Toolbar - only show when editable */}
              {canEdit && <EditorToolbar editor={editor} />}
              {/* Attachments */}
              <DocumentAttachments
                documentId={document.id}
                canEdit={canEdit}
              />
              {/* Editor Content */}
              <div className="p-6 max-w-4xl mx-auto">
                <EditorContent editor={editor} />
              </div>
            </>
          )}
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

// File Document Viewer for file-type documents
function FileDocumentViewer({
  document,
  currentUser,
}: {
  document: Document
  currentUser: { id: string; name: string; role?: string }
}) {
  const [showFullscreen, setShowFullscreen] = useState(false)

  if (!document.fileUrl) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        File not found
      </div>
    )
  }

  const isPDF = document.mimeType === 'application/pdf'
  const isImage = document.mimeType?.startsWith('image/')
  const isVideo = document.mimeType?.startsWith('video/')
  const isAudio = document.mimeType?.startsWith('audio/')

  const formatSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown size'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDownload = () => {
    const link = window.document.createElement('a')
    link.href = document.fileUrl!
    link.download = document.title
    window.document.body.appendChild(link)
    link.click()
    window.document.body.removeChild(link)
  }

  return (
    <div className="h-full flex flex-col">
      {/* File Info Bar */}
      <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isPDF && (
            <div className="w-10 h-10 rounded bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isImage && (
            <div className="w-10 h-10 rounded bg-green-100 dark:bg-green-950/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isVideo && (
            <div className="w-10 h-10 rounded bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {isAudio && (
            <div className="w-10 h-10 rounded bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
          )}
          {!isPDF && !isImage && !isVideo && !isAudio && (
            <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{document.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(document.fileSize)} • {document.mimeType}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(document.fileUrl!, '_blank')}
            className="gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Tab
          </Button>
          {(isPDF || isImage) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullscreen(true)}
              className="gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Fullscreen
            </Button>
          )}
        </div>
      </div>

      {/* File Content */}
      <div className="flex-1 overflow-auto bg-muted/20">
        {isPDF ? (
          <PDFViewer fileUrl={document.fileUrl} className="h-full" />
        ) : isImage ? (
          <div className="flex items-center justify-center p-8 h-full">
            <img
              src={document.fileUrl}
              alt={document.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            />
          </div>
        ) : isVideo ? (
          <div className="flex items-center justify-center p-8 h-full">
            <video
              src={document.fileUrl}
              controls
              className="max-w-full max-h-full rounded-lg shadow-lg"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        ) : isAudio ? (
          <div className="flex flex-col items-center justify-center p-8 h-full gap-6">
            <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center">
              <svg className="w-16 h-16 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <audio
              src={document.fileUrl}
              controls
              className="w-full max-w-md"
            >
              Your browser does not support the audio tag.
            </audio>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 h-full text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-muted-foreground mb-4">
              This file type cannot be previewed in the browser.
            </p>
            <Button onClick={handleDownload}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download File
            </Button>
          </div>
        )}
      </div>

      {/* Fullscreen Popup */}
      {showFullscreen && document.fileUrl && document.mimeType && (
        <FileViewerPopup
          open={showFullscreen}
          onClose={() => setShowFullscreen(false)}
          fileUrl={document.fileUrl}
          filename={document.title}
          mimeType={document.mimeType}
        />
      )}
    </div>
  )
}
