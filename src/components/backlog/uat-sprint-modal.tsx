'use client'

import { useState } from 'react'
import { Sprint, Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface UATSprintModalProps {
  sprint: Sprint
  availableSprints: Sprint[] // Planned sprints to move/split to
  onClose: () => void
  onUAT: (uatSprint: Sprint, action: string, targetSprintId?: string) => void
}

export function UATSprintModal({
  sprint,
  availableSprints,
  onClose,
  onUAT
}: UATSprintModalProps) {
  const [selectedAction, setSelectedAction] = useState<'close_all' | 'move_all' | 'split_all'>('split_all')
  const [targetSprintId, setTargetSprintId] = useState<string>(availableSprints[0]?.id || '')
  const [loading, setLoading] = useState(false)

  // UAT Sprint: Only handle TODO, IN_PROGRESS, BLOCKED
  // Keep READY_TO_TEST, DONE, LIVE in the sprint
  const tasksToHandle = sprint.tasks.filter(t =>
    t.status === 'TODO' || t.status === 'IN_PROGRESS' || t.status === 'BLOCKED'
  )
  const tasksToKeep = sprint.tasks.filter(t =>
    t.status === 'DONE' || t.status === 'LIVE' || t.status === 'READY_TO_TEST'
  )

  async function handleUAT() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/uat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          targetSprintId: selectedAction !== 'close_all' ? targetSprintId : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onUAT(data.sprint, selectedAction, targetSprintId)
        onClose()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to move sprint to UAT')
      }
    } catch (error) {
      console.error('Failed to move sprint to UAT:', error)
    } finally {
      setLoading(false)
    }
  }

  const needsTargetSprint = selectedAction === 'move_all' || selectedAction === 'split_all'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>UAT Sprint: {sprint.name}</DialogTitle>
          <DialogDescription>
            {tasksToHandle.length > 0 ? (
              <>
                This sprint has {tasksToHandle.length} task{tasksToHandle.length !== 1 ? 's' : ''} in
                Todo, In Progress, or Blocked status. Choose how to handle them before moving to UAT.
              </>
            ) : (
              <>No tasks need to be handled. Ready to move to UAT.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-2xl font-bold text-blue-600">{tasksToKeep.length}</div>
              <div className="text-xs text-blue-600/70">Staying in UAT</div>
              <div className="text-[10px] text-blue-600/50 mt-1">Testing, Done, Live</div>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-2xl font-bold text-amber-600">{tasksToHandle.length}</div>
              <div className="text-xs text-amber-600/70">To Handle</div>
              <div className="text-[10px] text-amber-600/50 mt-1">Todo, In Progress, Blocked</div>
            </div>
          </div>

          {/* Tasks to Handle List */}
          {tasksToHandle.length > 0 && (
            <>
              <div className="border rounded-lg max-h-32 overflow-y-auto">
                {tasksToHandle.slice(0, 10).map((task) => (
                  <div key={task.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0 text-sm">
                    <Badge variant="outline" className="text-[10px] flex-shrink-0 uppercase">
                      {task.status.replace('_', ' ')}
                    </Badge>
                    <span className="truncate">{task.title}</span>
                  </div>
                ))}
                {tasksToHandle.length > 10 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground text-center">
                    +{tasksToHandle.length - 10} more tasks
                  </div>
                )}
              </div>

              {/* Action Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">What would you like to do with these tasks?</label>

                <div className="space-y-2">
                  {/* Split option */}
                  <button
                    type="button"
                    onClick={() => setSelectedAction('split_all')}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all",
                      selectedAction === 'split_all'
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                        selectedAction === 'split_all' ? "border-primary bg-primary" : "border-muted-foreground/50"
                      )}>
                        {selectedAction === 'split_all' && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">Split to next sprint</div>
                        <div className="text-xs text-muted-foreground">
                          Create numbered continuations with all comments copied
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Move option */}
                  <button
                    type="button"
                    onClick={() => setSelectedAction('move_all')}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all",
                      selectedAction === 'move_all'
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                        selectedAction === 'move_all' ? "border-primary bg-primary" : "border-muted-foreground/50"
                      )}>
                        {selectedAction === 'move_all' && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">Move to next sprint</div>
                        <div className="text-xs text-muted-foreground">
                          Move tasks as-is to another sprint
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Close all option */}
                  <button
                    type="button"
                    onClick={() => setSelectedAction('close_all')}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all",
                      selectedAction === 'close_all'
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-accent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center",
                        selectedAction === 'close_all' ? "border-primary bg-primary" : "border-muted-foreground/50"
                      )}>
                        {selectedAction === 'close_all' && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">Close all tasks</div>
                        <div className="text-xs text-muted-foreground">
                          Mark all as Done
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Target Sprint Selection */}
              {needsTargetSprint && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Sprint</label>
                  {availableSprints.length > 0 ? (
                    <Select value={targetSprintId} onValueChange={setTargetSprintId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select sprint" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSprints.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-destructive">
                      No available sprints. Please create a new sprint first.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUAT}
            disabled={loading || (tasksToHandle.length > 0 && needsTargetSprint && !targetSprintId)}
          >
            {loading ? 'Moving to UAT...' : 'Move to UAT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
