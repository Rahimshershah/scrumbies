'use client'

import { useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Sprint, Task, Epic } from '@/types'
import { TaskCard } from './task-card'
import { InlineTaskInput } from './inline-task-input'
import { EditSprintModal } from './edit-sprint-modal'
import { CompleteSprintModal } from './complete-sprint-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface UATSprintSectionProps {
  sprint: Sprint
  users: { id: string; name: string; avatarUrl?: string | null }[]
  epics?: Epic[]
  allSprints?: Sprint[]
  availableSprints?: Sprint[]
  projectId?: string
  onTaskClick: (task: Task) => void
  onCreateTask: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
  onStatusChange?: (sprintId: string, status: string) => void
  onSprintUpdate?: (sprint: Sprint) => void
  onSprintComplete?: (completedSprint: Sprint, newTasks?: Task[]) => void
  onOpenInDedicatedView?: (sprint: Sprint) => void
  selectedTaskId?: string | null
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

// Local storage key for UAT sprint collapse state
const getCollapseKey = (sprintId: string) => `uat-sprint-collapsed-${sprintId}`

export function UATSprintSection({
  sprint,
  users,
  epics = [],
  allSprints = [],
  availableSprints = [],
  projectId,
  onTaskClick,
  onCreateTask,
  onTaskUpdate,
  selectedTaskId,
  onStatusChange,
  onSprintUpdate,
  onSprintComplete,
  onOpenInDedicatedView,
}: UATSprintSectionProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  // UAT sprints are collapsed by default
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // Load collapse state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(getCollapseKey(sprint.id))
    if (saved !== null) {
      setIsCollapsed(saved === 'true')
    }
  }, [sprint.id])

  // Save collapse state to localStorage
  const handleToggleCollapse = () => {
    const newState = !isCollapsed
    setIsCollapsed(newState)
    localStorage.setItem(getCollapseKey(sprint.id), String(newState))
  }

  const { setNodeRef, isOver } = useDroppable({
    id: sprint.id,
  })

  const sortedTasks = [...sprint.tasks].sort((a, b) => a.order - b.order)
  const taskCount = sprint.tasks.length
  const taskIds = sortedTasks.map((t) => t.id)
  const openTasksCount = sprint.tasks.filter(t => t.status !== 'DONE' && t.status !== 'LIVE').length

  // Calculate task status summary for collapsed view
  const testingCount = sprint.tasks.filter(t => t.status === 'READY_TO_TEST').length
  const doneCount = sprint.tasks.filter(t => t.status === 'DONE').length
  const liveCount = sprint.tasks.filter(t => t.status === 'LIVE').length

  async function handleStatusChange(newStatus: string) {
    try {
      await fetch(`/api/sprints/${sprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      onStatusChange?.(sprint.id, newStatus)
    } catch (error) {
      console.error('Failed to update sprint status:', error)
    }
  }

  function handleCompleteClick() {
    if (openTasksCount > 0) {
      setShowCompleteModal(true)
    } else {
      handleStatusChange('COMPLETED')
    }
  }

  function handleSprintCompleted(completedSprint: Sprint, action: string, targetSprintId?: string) {
    onSprintComplete?.(completedSprint)
    onStatusChange?.(sprint.id, 'COMPLETED')
  }

  const handleCreateTask = (task: Task) => {
    onCreateTask(task)
    setIsAddingTask(false)
  }

  const handleSprintUpdate = (updatedSprint: Sprint) => {
    onSprintUpdate?.(updatedSprint)
    setIsEditing(false)
  }

  return (
    <div className="mb-3">
      {/* Sprint header */}
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-t-md border cursor-pointer min-w-0",
          "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
        )}
        onClick={handleToggleCollapse}
      >
        <svg
          className={cn(
            "w-3.5 h-3.5 text-blue-600 dark:text-blue-400 transition-transform flex-shrink-0",
            isCollapsed && "-rotate-90"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>

        <h3 className="font-medium text-sm truncate min-w-0 max-w-[120px] sm:max-w-[200px] md:max-w-none">{sprint.name}</h3>

        {/* UAT badge */}
        <Badge className="bg-blue-500 hover:bg-blue-500 text-white text-[10px] h-5 px-2">
          UAT
        </Badge>

        {/* Date range */}
        {(sprint.startDate || sprint.endDate) && (
          <span className="hidden sm:flex text-[11px] text-muted-foreground items-center gap-1 flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
          </span>
        )}

        {/* Task count badge */}
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 sm:px-2 gap-1 flex-shrink-0">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="hidden sm:inline">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
          <span className="sm:hidden">{taskCount}</span>
        </Badge>

        {/* Summary stats (shown when collapsed) */}
        {isCollapsed && taskCount > 0 && (
          <span className="hidden md:flex text-[11px] text-muted-foreground items-center gap-1.5 flex-shrink-0">
            {testingCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">{testingCount} Testing</span>
            )}
            {testingCount > 0 && (doneCount > 0 || liveCount > 0) && <span>·</span>}
            {doneCount > 0 && (
              <span className="text-green-600 dark:text-green-400">{doneCount} Done</span>
            )}
            {doneCount > 0 && liveCount > 0 && <span>·</span>}
            {liveCount > 0 && (
              <span className="text-purple-600 dark:text-purple-400">{liveCount} Live</span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Eye icon for dedicated view */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onOpenInDedicatedView?.(sprint)}
            title="Open full view"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Sprint
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenInDedicatedView?.(sprint)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Open Full View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCompleteClick}>
                Complete Sprint
                {openTasksCount > 0 && (
                  <span className="ml-2 text-[10px] text-amber-600 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                    {openTasksCount} open
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('ACTIVE')}>
                Back to Active
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                Delete Sprint
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsAddingTask(true)}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Tasks */}
      {!isCollapsed && (
        <div
          ref={setNodeRef}
          className={cn(
            "border border-t-0 rounded-b-md transition-colors",
            "border-blue-200 dark:border-blue-800",
            isOver ? "bg-blue-50 dark:bg-blue-950/50" : "bg-card",
            sprint.tasks.length === 0 && !isAddingTask && "min-h-[40px]"
          )}
        >
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {sortedTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                users={users}
                epics={epics}
                sprints={allSprints}
                onClick={() => onTaskClick(task)}
                onUpdate={onTaskUpdate}
                isActive={selectedTaskId === task.id}
              />
            ))}
          </SortableContext>

          {isAddingTask && (
            <div className="px-2 py-1.5">
              <InlineTaskInput
                sprintId={sprint.id}
                projectId={projectId}
                users={users}
                onSave={handleCreateTask}
                onCancel={() => setIsAddingTask(false)}
              />
            </div>
          )}

          {sprint.tasks.length === 0 && !isAddingTask && (
            <div className="px-3 py-2 text-xs text-muted-foreground text-center">
              No tasks. Drag here or click +
            </div>
          )}
        </div>
      )}

      {/* Collapsed summary bar */}
      {isCollapsed && taskCount > 0 && (
        <div
          className={cn(
            "border border-t-0 rounded-b-md px-3 py-2",
            "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20"
          )}
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="md:hidden">
              {testingCount > 0 && <span className="text-amber-600">{testingCount} Testing</span>}
              {testingCount > 0 && (doneCount > 0 || liveCount > 0) && ' · '}
              {doneCount > 0 && <span className="text-green-600">{doneCount} Done</span>}
              {doneCount > 0 && liveCount > 0 && ' · '}
              {liveCount > 0 && <span className="text-purple-600">{liveCount} Live</span>}
            </span>
            <span className="hidden md:block">Click to expand and view all {taskCount} tasks</span>
            <span className="md:hidden">Click to expand</span>
          </div>
        </div>
      )}

      {/* Edit Sprint Modal */}
      {isEditing && (
        <EditSprintModal
          sprint={sprint}
          onClose={() => setIsEditing(false)}
          onUpdate={handleSprintUpdate}
        />
      )}

      {/* Complete Sprint Modal */}
      {showCompleteModal && (
        <CompleteSprintModal
          sprint={sprint}
          availableSprints={availableSprints}
          onClose={() => setShowCompleteModal(false)}
          onComplete={handleSprintCompleted}
        />
      )}
    </div>
  )
}
