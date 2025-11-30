'use client'

import { useEditor, EditorContent, Editor, ReactRenderer } from '@tiptap/react'
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
import Mention from '@tiptap/extension-mention'
import { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { Instance as TippyInstance } from 'tippy.js'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react'

export interface MentionUser {
  id: string
  name: string
  avatarUrl?: string | null
}

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  onMentionsChange?: (mentionIds: string[]) => void
  placeholder?: string
  className?: string
  editable?: boolean
  minHeight?: string
  minimal?: boolean // When true, show collapsed state by default
  users?: MentionUser[] // Users available for mentions
}

// Mention list component
interface MentionListProps {
  items: MentionUser[]
  command: (item: { id: string; label: string }) => void
}

interface MentionListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const MentionList = forwardRef<MentionListRef, MentionListProps>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = items[index]
    if (item) {
      command({ id: item.id, label: item.name })
    }
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  useEffect(() => setSelectedIndex(0), [items])

  if (items.length === 0) {
    return (
      <div className="bg-popover border rounded-lg shadow-lg p-2 text-sm text-muted-foreground">
        No users found
      </div>
    )
  }

  return (
    <div className="bg-popover border rounded-lg shadow-lg overflow-hidden min-w-[180px]">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => selectItem(index)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent",
            index === selectedIndex && "bg-accent"
          )}
        >
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden">
            {item.avatarUrl ? (
              <img src={item.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              item.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
            )}
          </div>
          <span>{item.name}</span>
        </button>
      ))}
    </div>
  )
})

function MenuBar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const addTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  const isInTable = editor.isActive('table')

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1 border-b bg-muted/30">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('bold') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold text-xs">B</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('italic') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic text-xs">I</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('underline') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="underline text-xs">U</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('strike') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through text-xs">S</span>
      </Button>
      
      <div className="w-px h-5 bg-border mx-1" />
      
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('bulletList') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('orderedList') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
        </svg>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('taskList') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('heading', { level: 1 }) && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <span className="text-xs font-bold">H1</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('heading', { level: 2 }) && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="text-xs font-bold">H2</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('blockquote') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", editor.isActive('codeBlock') && 'bg-accent')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      </Button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Table Controls */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", isInTable && 'bg-accent')}
        onClick={addTable}
        title="Insert Table"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </Button>

      {/* Show table controls when cursor is in a table */}
      {isInTable && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add Column"
          >
            +Col
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete Column"
          >
            -Col
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add Row"
          >
            +Row
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete Row"
          >
            -Row
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete Table"
          >
            ×Table
          </Button>
        </>
      )}
    </div>
  )
}

export function RichTextEditor({
  content,
  onChange,
  onMentionsChange,
  placeholder = 'Write something...',
  className,
  editable = true,
  minHeight = '100px',
  minimal = false,
  users = [],
}: RichTextEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  
  // Check if content has actual text (not just empty HTML)
  const hasContent = content && content !== '<p></p>' && content.replace(/<[^>]*>/g, '').trim().length > 0

  // Create suggestion plugin for mentions
  const suggestion = {
    items: ({ query }: { query: string }) => {
      return users
        .filter(user => user.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5)
    },
    render: () => {
      let component: ReactRenderer<MentionListRef> | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: SuggestionProps<MentionUser>) => {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },
        onUpdate: (props: SuggestionProps<MentionUser>) => {
          component?.updateProps(props)
          if (!props.clientRect) return
          popup?.[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          })
        },
        onKeyDown: (props: SuggestionKeyDownProps) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return component?.ref?.onKeyDown(props) || false
        },
        onExit: () => {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  }

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
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
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-primary/10 text-primary px-1 py-0.5 rounded font-medium',
        },
        suggestion: users.length > 0 ? suggestion : undefined,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      
      // Extract mentioned user IDs
      if (onMentionsChange) {
        const mentionIds: string[] = []
        editor.state.doc.descendants((node) => {
          if (node.type.name === 'mention' && node.attrs.id) {
            mentionIds.push(node.attrs.id)
          }
        })
        onMentionsChange([...new Set(mentionIds)])
      }
    },
    onFocus: () => {
      setIsFocused(true)
      setIsExpanded(true)
    },
    onBlur: () => {
      setIsFocused(false)
      // Only collapse if there's no content
      if (!hasContent) {
        // Delay to allow click on toolbar buttons
        setTimeout(() => {
          setIsExpanded(false)
        }, 200)
      }
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none p-3',
          'prose-headings:mt-2 prose-headings:mb-1',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
          'prose-li:my-0.5',
          '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
          '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto',
          '[&_table]:w-full [&_th]:bg-muted [&_th]:p-2 [&_td]:p-2'
        ),
        style: `min-height: ${minimal && !isExpanded && !hasContent ? '40px' : minHeight}`,
      },
    },
  })

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Keep expanded if has content
  useEffect(() => {
    if (hasContent) {
      setIsExpanded(true)
    }
  }, [hasContent])

  const showToolbar = editable && (!minimal || isExpanded || isFocused || hasContent)

  return (
    <div 
      className={cn(
        "border rounded-md overflow-hidden bg-background transition-all",
        minimal && !isExpanded && !hasContent && "cursor-text hover:border-primary/50",
        className
      )}
      onClick={() => {
        if (minimal && !isExpanded) {
          setIsExpanded(true)
          editor?.commands.focus()
        }
      }}
    >
      {showToolbar && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// Read-only renderer for displaying rich text
export function RichTextDisplay({ content, className }: { content: string; className?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Underline,
      Table.configure({
        HTMLAttributes: {
          class: 'border-collapse border border-border w-full',
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-border bg-muted p-2 font-semibold text-left',
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
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention bg-primary/10 text-primary px-1 py-0.5 rounded font-medium',
        },
      }),
    ],
    content,
    editable: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'prose-headings:mt-2 prose-headings:mb-1',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
          'prose-li:my-0.5',
          '[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-4 [&_ol]:pl-4',
          '[&_blockquote]:border-l-4 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic',
          '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm',
          '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded [&_pre]:overflow-x-auto',
          className
        ),
      },
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  return <EditorContent editor={editor} />
}

