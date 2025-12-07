'use client'

import { useState } from 'react'
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

interface EpicPanelProps {
  epics: Epic[]
  selectedEpicId: string | null
  onSelectEpic: (epicId: string | null) => void
  onEpicCreated: (epic: Epic) => void
  onEpicUpdated: (epic: Epic) => void
  onEpicDeleted: (epicId: string) => void
  onViewTimeline: () => void
  projectId: string
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
}: EpicPanelProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingEpic, setEditingEpic] = useState<Epic | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const handleDelete = async (epicId: string) => {
    if (!confirm('Are you sure you want to delete this epic? Tasks will be preserved but unlinked.')) {
      return
    }

    try {
      const res = await fetch(`/api/epics/${epicId}`, { method: 'DELETE' })
      if (res.ok) {
        onEpicDeleted(epicId)
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
    } else {
      onEpicCreated(epic)
    }
    setEditingEpic(null)
  }

  if (collapsed) {
    return (
      <div className="border-r bg-muted/20 w-12 flex flex-col items-center py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          title="Show Epics"
          className="mb-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
        <div className="writing-mode-vertical text-xs text-muted-foreground font-medium rotate-180" style={{ writingMode: 'vertical-rl' }}>
          Epics ({epics.length})
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="border-r bg-muted/20 w-64 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">Epics</h3>
            <Badge variant="secondary" className="text-xs">{epics.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onViewTimeline}
              title="View Timeline"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowModal(true)}
              title="Create Epic"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setCollapsed(true)}
              title="Collapse"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {/* All Tasks option */}
            <button
              onClick={() => onSelectEpic(null)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedEpicId === null
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <span className="font-medium">All Tasks</span>
              </div>
            </button>

            {/* No Epic option */}
            <button
              onClick={() => onSelectEpic('none')}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedEpicId === 'none'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-dashed border-muted-foreground/50" />
                <span>No Epic</span>
              </div>
            </button>

            {/* Epics */}
            {epics.map((epic) => (
              <div
                key={epic.id}
                className={`rounded-md transition-colors ${
                  selectedEpicId === epic.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-start gap-1 p-2">
                  {/* Main clickable area for filtering */}
                  <button
                    onClick={() => onSelectEpic(epic.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: epic.color }}
                      />
                      <span className="font-medium text-sm line-clamp-2 break-words">{epic.name}</span>
                    </div>
                    {epic._count && (
                      <div className={`text-xs mt-1 ml-5 ${selectedEpicId === epic.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {epic._count.tasks} task{epic._count.tasks !== 1 ? 's' : ''}
                      </div>
                    )}
                  </button>

                  {/* Edit button - always visible */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`flex-shrink-0 p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                          selectedEpicId === epic.id ? 'text-primary-foreground' : 'text-muted-foreground'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                        title="Edit epic"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingEpic(epic)
                        setShowModal(true)
                      }}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(epic.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {epics.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-sm">No epics yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="mt-1"
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

