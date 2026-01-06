'use client'

import { useState, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Epic } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EpicModal } from './epic-modal'
import { cn } from '@/lib/utils'

interface EpicPanelProps {
  epics: Epic[]
  selectedEpicId: string | null
  onSelectEpic: (epicId: string | null) => void
  onEpicCreated: (epic: Epic) => void
  onEpicUpdated: (epic: Epic) => void
  onEpicDeleted: (epicId: string) => void
  onViewTimeline: () => void
  projectId: string
  onEpicsReordered?: (epics: Epic[]) => void
}

interface SortableEpicItemProps {
  epic: Epic
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}

function SortableEpicItem({ epic, isSelected, onSelect, onEdit, onDelete }: SortableEpicItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: epic.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded transition-colors",
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted'
      )}
    >
      <div className="flex items-center gap-1 px-1.5 py-1">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "p-0.5 rounded cursor-grab active:cursor-grabbing",
            isSelected ? 'hover:bg-primary-foreground/20' : 'hover:bg-muted-foreground/20'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3 h-3 opacity-50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm2 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
          </svg>
        </button>

        {/* Main clickable area */}
        <button
          onClick={onSelect}
          className="flex-1 min-w-0 text-left flex items-center gap-1.5"
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: epic.color }}
          />
          <span className="text-xs font-medium truncate">{epic.name}</span>
          {epic._count && (
            <span className={cn(
              "text-[10px] ml-auto",
              isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
            )}>
              {epic._count.tasks}
            </span>
          )}
        </button>

        {/* Edit button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex-shrink-0 p-0.5 rounded",
                isSelected ? 'hover:bg-primary-foreground/20 text-primary-foreground' : 'hover:bg-muted-foreground/20 text-muted-foreground'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function EpicPanel({
  epics,
  selectedEpicId,
  onSelectEpic,
  onEpicCreated,
  onEpicUpdated,
  onEpicDeleted,
  onViewTimeline,
  projectId,
  onEpicsReordered,
}: EpicPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    // Default to collapsed if no epics
    return epics.length === 0
  })
  const [localEpics, setLocalEpics] = useState(epics)

  // Local storage key for collapse state per project
  const collapseKey = `epic-panel-collapsed-${projectId}`

  // Load collapse preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(collapseKey)
    if (saved !== null) {
      setCollapsed(saved === 'true')
    } else {
      // If no saved preference, collapse if no epics
      setCollapsed(epics.length === 0)
    }
  }, [collapseKey, epics.length])

  // Handle collapse toggle with localStorage persistence
  const handleCollapse = (newState: boolean) => {
    setCollapsed(newState)
    localStorage.setItem(collapseKey, String(newState))
  }

  // Sync local epics with props and auto-collapse when switching to project with no epics
  useEffect(() => {
    setLocalEpics(epics)
    // If switching to a project with no epics and no saved preference, collapse
    const saved = localStorage.getItem(collapseKey)
    if (saved === null && epics.length === 0) {
      setCollapsed(true)
    }
  }, [epics, collapseKey])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localEpics.findIndex(e => e.id === active.id)
    const newIndex = localEpics.findIndex(e => e.id === over.id)

    const reordered = arrayMove(localEpics, oldIndex, newIndex)
    setLocalEpics(reordered)
    onEpicsReordered?.(reordered)

    // Save to server
    try {
      await fetch('/api/epics/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          epicIds: reordered.map(e => e.id),
          projectId,
        }),
      })
    } catch (error) {
      console.error('Failed to save epic order:', error)
    }
  }

  const handleDelete = async (epicId: string) => {
    if (!confirm('Are you sure you want to delete this epic? Tasks will be preserved but unlinked.')) {
      return
    }

    try {
      const res = await fetch(`/api/epics/${epicId}`, { method: 'DELETE' })
      if (res.ok) {
        onEpicDeleted(epicId)
        setLocalEpics(prev => prev.filter(e => e.id !== epicId))
        if (selectedEpicId === epicId) {
          onSelectEpic(null)
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete epic')
      }
    } catch (error) {
      console.error('Failed to delete epic:', error)
    }
  }

  const handleSave = (epic: Epic) => {
    if (editingEpic) {
      onEpicUpdated(epic)
      setLocalEpics(prev => prev.map(e => e.id === epic.id ? epic : e))
    } else {
      onEpicCreated(epic)
      setLocalEpics(prev => [...prev, epic])
    }
    setEditingEpic(null)
  }

  if (collapsed) {
    return (
      <div className="border-r bg-muted/20 w-10 flex flex-col items-center py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleCollapse(false)}
          title="Show Epics"
          className="h-6 w-6 mb-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
        <div className="writing-mode-vertical text-[10px] text-muted-foreground font-medium rotate-180" style={{ writingMode: 'vertical-rl' }}>
          Epics ({localEpics.length})
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="border-r bg-muted/20 w-56 flex flex-col">
        <div className="px-2 py-1.5 border-b flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-xs">Epics</h3>
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{localEpics.length}</Badge>
          </div>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onViewTimeline}
              title="View Timeline"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowModal(true)}
              title="Create Epic"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleCollapse(true)}
              title="Collapse"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-1.5 space-y-0.5">
            {/* All Tasks option */}
            <button
              onClick={() => onSelectEpic(null)}
              className={cn(
                "w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-1.5",
                selectedEpicId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span className="font-medium">All Tasks</span>
            </button>

            {/* No Epic option */}
            <button
              onClick={() => onSelectEpic('none')}
              className={cn(
                "w-full text-left px-2 py-1 rounded text-xs transition-colors flex items-center gap-1.5",
                selectedEpicId === 'none'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <div className="w-2.5 h-2.5 rounded-full border border-dashed border-muted-foreground/50" />
              <span>No Epic</span>
            </button>

            {/* Draggable Epics */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={localEpics.map(e => e.id)} strategy={verticalListSortingStrategy}>
                {localEpics.map((epic) => (
                  <SortableEpicItem
                    key={epic.id}
                    epic={epic}
                    isSelected={selectedEpicId === epic.id}
                    onSelect={() => onSelectEpic(epic.id)}
                    onEdit={() => {
                      setEditingEpic(epic)
                      setShowModal(true)
                    }}
                    onDelete={() => handleDelete(epic.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {localEpics.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-xs">No epics yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="mt-0.5 h-auto p-0 text-xs"
                >
                  Create your first epic
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <EpicModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingEpic(null)
        }}
        onSave={handleSave}
        epic={editingEpic}
        projectId={projectId}
      />
    </>
  )
}
