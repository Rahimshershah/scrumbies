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

interface CompleteSprintModalProps {
  sprint: Sprint
  availableSprints: Sprint[] // Planned sprints to move/split to
  onClose: () => void
  onComplete: (completedSprint: Sprint, action: string, targetSprintId?: string) => void
}

export function CompleteSprintModal({ 
  sprint, 
  availableSprints, 
  onClose, 
  onComplete 
}: CompleteSprintModalProps) {
  const [selectedAction, setSelectedAction] = useState<'close_all' | 'move_all' | 'split_all'>('split_all')
  const [targetSprintId, setTargetSprintId] = useState<string>(availableSprints[0]?.id || '')
  const [loading, setLoading] = useState(false)

  const openTasks = sprint.tasks.filter(t => t.status !== 'DONE' && t.status !== 'LIVE')
  const completedTasks = sprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE')

  async function handleComplete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sprints/${sprint.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          targetSprintId: selectedAction !== 'close_all' ? targetSprintId : undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        onComplete(data.sprint, selectedAction, targetSprintId)
        onClose()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to complete sprint')
      }
    } catch (error) {
      console.error('Failed to complete sprint:', error)
    } finally {
      setLoading(false)
    }
  }

  const needsTargetSprint = selectedAction === 'move_all' || selectedAction === 'split_all'

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete {sprint.name}</DialogTitle>
          <DialogDescription>
            This sprint has {openTasks.length} open task{openTasks.length !== 1 ? 's' : ''}. 
            Choose how to handle them before completing the sprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary */}
          <div className="flex gap-4">
            <div className="flex-1 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
              <div className="text-xs text-green-600/70">Completed</div>
            </div>
            <div className="flex-1 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="text-2xl font-bold text-amber-600">{openTasks.length}</div>
              <div className="text-xs text-amber-600/70">Open</div>
            </div>
          </div>

          {/* Open Tasks List */}
          {openTasks.length > 0 && (
            <div className="border rounded-lg max-h-40 overflow-y-auto">
              {openTasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
                  <Badge variant="outline" className="text-[10px]">
                    {task.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm truncate flex-1">{task.title}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">What would you like to do with open tasks?</label>
            
            <div className="space-y-2">
              <button
                onClick={() => setSelectedAction('split_all')}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-colors",
                  selectedAction === 'split_all' 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2",
                    selectedAction === 'split_all' ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {selectedAction === 'split_all' && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">Split to next sprint</div>
                    <div className="text-xs text-muted-foreground">
                      Create numbered continuations with all comments copied
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedAction('move_all')}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-colors",
                  selectedAction === 'move_all' 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2",
                    selectedAction === 'move_all' ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {selectedAction === 'move_all' && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">Move to next sprint</div>
                    <div className="text-xs text-muted-foreground">
                      Move tasks as-is to another sprint
                    </div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setSelectedAction('close_all')}
                className={cn(
                  "w-full p-3 rounded-lg border text-left transition-colors",
                  selectedAction === 'close_all' 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2",
                    selectedAction === 'close_all' ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {selectedAction === 'close_all' && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">Close all tasks</div>
                    <div className="text-xs text-muted-foreground">
                      Mark all open tasks as Done
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
                  <SelectTrigger>
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={loading || (needsTargetSprint && !targetSprintId)}
          >
            {loading ? 'Completing...' : 'Complete Sprint'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

