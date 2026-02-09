'use client'

import { useState } from 'react'
import { Sprint } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BulkMoveModalProps {
  isOpen: boolean
  onClose: () => void
  selectedCount: number
  sprints: Sprint[]
  onMove: (targetSprintId: string | null) => Promise<void>
}

export function BulkMoveModal({
  isOpen,
  onClose,
  selectedCount,
  sprints,
  onMove,
}: BulkMoveModalProps) {
  const [selectedSprintId, setSelectedSprintId] = useState<string | null | undefined>(undefined)
  const [isMoving, setIsMoving] = useState(false)

  // Filter to only show non-completed sprints
  const availableSprints = sprints.filter(s => s.status !== 'COMPLETED')

  async function handleMove() {
    if (selectedSprintId === undefined) return

    setIsMoving(true)
    try {
      await onMove(selectedSprintId)
      onClose()
    } finally {
      setIsMoving(false)
      setSelectedSprintId(undefined)
    }
  }

  function handleClose() {
    setSelectedSprintId(undefined)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {selectedCount} task{selectedCount !== 1 ? 's' : ''} to...</DialogTitle>
          <DialogDescription>
            Select a destination sprint or move to backlog.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-2 max-h-[300px] overflow-y-auto">
          {/* Backlog option */}
          <button
            type="button"
            onClick={() => setSelectedSprintId(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
              selectedSprintId === null
                ? "bg-primary/10 border-2 border-primary"
                : "hover:bg-muted border-2 border-transparent"
            )}
          >
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            <span className="font-medium">Backlog</span>
            <span className="text-muted-foreground text-sm ml-auto">No sprint</span>
          </button>

          {/* Sprint options */}
          {availableSprints.map((sprint) => (
            <button
              key={sprint.id}
              type="button"
              onClick={() => setSelectedSprintId(sprint.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
                selectedSprintId === sprint.id
                  ? "bg-primary/10 border-2 border-primary"
                  : "hover:bg-muted border-2 border-transparent"
              )}
            >
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  sprint.status === 'ACTIVE' ? "bg-green-500" :
                  sprint.status === 'UAT' ? "bg-blue-500" :
                  "bg-muted-foreground/40"
                )}
              />
              <span className="font-medium flex-1 truncate">{sprint.name}</span>
              {sprint.status === 'ACTIVE' && (
                <Badge className="bg-green-500 text-xs">Active</Badge>
              )}
              {sprint.status === 'UAT' && (
                <Badge className="bg-blue-500 text-xs">UAT</Badge>
              )}
              <span className="text-muted-foreground text-sm">
                {sprint.tasks?.length || 0} tasks
              </span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isMoving}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={selectedSprintId === undefined || isMoving}
          >
            {isMoving ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Moving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Move {selectedCount} task{selectedCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
