'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Sprint, Task, TaskStatus, Priority } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TaskDetailSidebar } from './task-detail-sidebar'
import { InlineTaskInput } from './inline-task-input'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'
import { useRowHeight } from '@/contexts/row-height-context'

interface SprintViewProps {
  sprint: Sprint
  users: { id: string; name: string; avatarUrl?: string | null }[]
  allSprints: Sprint[]
  currentUser?: { id: string; role: string }
  projectId?: string
  onBack: () => void
  onSprintUpdate?: (sprint: Sprint) => void
  onTaskUpdate?: (task: Task) => void
  onTaskCreate?: (task: Task) => void
  onTaskDelete?: (taskId: string) => void
  onOpenDocument?: (documentId: string) => void
}

const priorityConfig: Record<Priority, { label: string; icon: string; color: string }> = {
  LOW: { label: 'Low', icon: '↓', color: 'text-slate-600 dark:text-slate-300' },
  MEDIUM: { label: 'Medium', icon: '–', color: 'text-blue-600 dark:text-blue-300' },
  HIGH: { label: 'High', icon: '↑', color: 'text-orange-600 dark:text-orange-300' },
  URGENT: { label: 'Urgent', icon: '!!', color: 'text-red-700 dark:text-red-300' },
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Sortable Task Row Component
function SortableTaskRow({ 
  task, 
  onClick,
  canEdit,
}: { 
  task: Task
  onClick: () => void
  canEdit: boolean
}) {
  const { getStatusConfig, getTeamConfig } = useProjectSettings()
  const { getRowHeightClass, getTextSize, getAvatarSize, getScale, getIconSize } = useRowHeight()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !canEdit })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const status = getStatusConfig(task.status)
  const teamStyle = task.team ? getTeamConfig(task.team) : null
  const priority = priorityConfig[task.priority || 'MEDIUM']
  
  // Extract tags from title
  const tagRegex = /\[([^\]]+)\]/g
  const tags: string[] = []
  let displayTitle = task.title
  let match
  while ((match = tagRegex.exec(task.title)) !== null) {
    tags.push(match[1])
  }
  displayTitle = task.title.replace(tagRegex, '').trim()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
      className={cn(
        "flex items-center gap-4 px-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors",
        getRowHeightClass(),
        canEdit && "active:cursor-grabbing",
        isDragging && "opacity-50 bg-background shadow-lg cursor-grabbing"
      )}
    >
      {/* Drag handle indicator */}
      {canEdit && (
        <div
          className="text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0 pointer-events-none"
        >
          <svg className={getIconSize(3.5)} fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          </svg>
        </div>
      )}

      {/* Team */}
      <div className="w-20 flex-shrink-0">
        {teamStyle ? (
          <Badge 
            className={cn(getTextSize('xs'), "font-semibold px-2 py-0.5")}
            style={{ backgroundColor: teamStyle.bgColor, color: teamStyle.color }}
          >
            {teamStyle.shortLabel}
          </Badge>
        ) : (
          <span className={cn(getTextSize('xs'), "text-muted-foreground")}>—</span>
        )}
      </div>

      {/* Title */}
      <div 
        className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        {/* Task Key */}
        {task.taskKey && (
          <span className={cn(getTextSize('xs'), "font-mono text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0")}>
            {task.taskKey}
          </span>
        )}
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className={cn(getTextSize('xs'), "flex-shrink-0")}>
            {tag}
          </Badge>
        ))}
        <span className={cn(
          getTextSize('base'), "truncate",
          (task.status === 'DONE' || task.status === 'LIVE') && "line-through text-muted-foreground"
        )}>
          {displayTitle}
        </span>
        
        {/* Split indicators */}
        {task.splitFrom && (
          <span className={cn(getTextSize('xs'), "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded flex-shrink-0")}>
            cont.
          </span>
        )}
        {task.splitTasks && task.splitTasks.length > 0 && (
          <span className={cn(getTextSize('xs'), "text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded flex-shrink-0")}>
            ↔ {task.splitTasks.length}
          </span>
        )}
      </div>

      {/* Status */}
      <div className="w-32 flex-shrink-0">
        <span 
          className={cn("px-2 py-1 rounded", getTextSize('xs'), "font-semibold uppercase")}
          style={{ backgroundColor: status.bgColor, color: status.color }}
        >
          {status.label}
        </span>
      </div>

      {/* Priority */}
      <div className="w-10 flex-shrink-0 text-center ml-2">
        <span className={cn(getTextSize('base'), "font-bold", priority.color)}>
          {priority.icon}
        </span>
      </div>

      {/* Assignee */}
      <div className="flex-shrink-0" style={{ width: `${9 * getScale() * 0.25}rem`, height: `${9 * getScale() * 0.25}rem` }}>
        {task.assignee ? (
          <Avatar style={{ width: `${9 * getScale() * 0.25}rem`, height: `${9 * getScale() * 0.25}rem` }}>
            {task.assignee.avatarUrl ? (
              <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
            ) : null}
            <AvatarFallback className={cn(getTextSize('sm'), "bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold")}>
              {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="rounded-full border-2 border-dashed border-muted-foreground/30" style={{ width: `${9 * getScale() * 0.25}rem`, height: `${9 * getScale() * 0.25}rem` }} />
        )}
      </div>
    </div>
  )
}

export function SprintView({
  sprint,
  users,
  allSprints,
  currentUser,
  projectId,
  onBack,
  onSprintUpdate,
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onOpenDocument,
}: SprintViewProps) {
  const { statuses, getStatusConfig } = useProjectSettings()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [showAddTask, setShowAddTask] = useState(false)
  const [localSprint, setLocalSprint] = useState(sprint)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  // Update local sprint when prop changes
  if (sprint.id !== localSprint.id) {
    setLocalSprint(sprint)
  }

  // Admin can edit completed sprints
  const isAdmin = currentUser?.role === 'ADMIN'
  const isCompleted = sprint.status === 'COMPLETED'
  const canEdit = !isCompleted || isAdmin
  const [reactivating, setReactivating] = useState(false)

  const handleReactivateSprint = async () => {
    if (!isAdmin) return
    setReactivating(true)
    try {
      const res = await fetch(`/api/sprints/${localSprint.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (res.ok) {
        const updatedSprint = await res.json()
        setLocalSprint(updatedSprint)
        onSprintUpdate?.(updatedSprint)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to reactivate sprint')
      }
    } catch (error) {
      console.error('Failed to reactivate sprint:', error)
    } finally {
      setReactivating(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const completedTasks = localSprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length
  const totalTasks = localSprint.tasks.length
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const filteredTasks = filterStatus === 'ALL' 
    ? localSprint.tasks 
    : localSprint.tasks.filter(t => t.status === filterStatus)

  // Group tasks by status for summary
  const tasksByStatus: Record<TaskStatus | 'ALL', number> = {
    ALL: localSprint.tasks.length,
    TODO: localSprint.tasks.filter(t => t.status === 'TODO').length,
    IN_PROGRESS: localSprint.tasks.filter(t => t.status === 'IN_PROGRESS').length,
    READY_TO_TEST: localSprint.tasks.filter(t => t.status === 'READY_TO_TEST').length,
    BLOCKED: localSprint.tasks.filter(t => t.status === 'BLOCKED').length,
    DONE: localSprint.tasks.filter(t => t.status === 'DONE').length,
    LIVE: localSprint.tasks.filter(t => t.status === 'LIVE').length,
  }

  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    setLocalSprint(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
    }))
    onTaskUpdate?.(updatedTask)
    setSelectedTask(updatedTask)
  }, [onTaskUpdate])

  const handleTaskDelete = useCallback((taskId: string) => {
    setLocalSprint(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId),
    }))
    onTaskDelete?.(taskId)
    setSelectedTask(null)
  }, [onTaskDelete])

  const handleTaskCreate = useCallback((newTask: Task) => {
    setLocalSprint(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }))
    onTaskCreate?.(newTask)
    setShowAddTask(false)
  }, [onTaskCreate])

  const handleTaskSplit = useCallback((newTask: Task) => {
    if (newTask.sprintId === localSprint.id) {
      setLocalSprint(prev => ({
        ...prev,
        tasks: [...prev.tasks, newTask].sort((a, b) => a.order - b.order),
      }))
    }
    onTaskCreate?.(newTask)
  }, [localSprint.id, onTaskCreate])

  const handleDragStart = useCallback((event: any) => {
    const task = localSprint.tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
  }, [localSprint.tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || active.id === over.id) return

    const oldIndex = localSprint.tasks.findIndex(t => t.id === active.id)
    const newIndex = localSprint.tasks.findIndex(t => t.id === over.id)

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

    // Save original order for potential revert
    const originalTasks = [...localSprint.tasks]
    const newTasks = arrayMove(localSprint.tasks, oldIndex, newIndex)
    
    // Update local state immediately (optimistic update)
    setLocalSprint(prev => ({
      ...prev,
      tasks: newTasks,
    }))

    // Persist the new order automatically
    try {
      const taskId = active.id as string
      const response = await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: taskId,
          targetSprintId: localSprint.id,
          newOrder: newIndex,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save order')
      }
    } catch (error) {
      console.error('Failed to reorder tasks:', error)
      // Revert on error
      setLocalSprint(prev => ({
        ...prev,
        tasks: originalTasks,
      }))
    }
  }, [localSprint])

  const statusBadgeConfig: Record<string, { label: string; color: string }> = {
    ACTIVE: { label: 'Active', color: 'bg-green-500 text-white' },
    PLANNED: { label: 'Planned', color: 'bg-blue-500 text-white' },
    COMPLETED: { label: 'Completed', color: 'bg-gray-500 text-white' },
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 h-full">
        <ScrollArea className="h-full">
        <div className="p-6">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Backlog
            </button>

            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold">{localSprint.name}</h1>
                  <Badge className={statusBadgeConfig[localSprint.status]?.color}>
                    {statusBadgeConfig[localSprint.status]?.label}
                  </Badge>
                  {isCompleted && isAdmin && (
                    <>
                      <Badge variant="outline" className="text-[10px]">
                        Admin Edit Mode
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReactivateSprint}
                        disabled={reactivating}
                        className="h-7 text-xs"
                      >
                        {reactivating ? (
                          <>
                            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reactivating...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Reactivate Sprint
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
                {(localSprint.startDate || localSprint.endDate) && (
                  <p className="text-muted-foreground">
                    {formatDate(localSprint.startDate)} – {formatDate(localSprint.endDate)}
                  </p>
                )}
              </div>

              {/* Completion Badge */}
              <div className="text-right">
                <div className={cn(
                  "text-4xl font-bold",
                  completionRate === 100 ? "text-green-500" : completionRate >= 80 ? "text-amber-500" : "text-blue-500"
                )}>
                  {completionRate}%
                </div>
                <p className="text-sm text-muted-foreground">Complete</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-6 gap-3 mb-8">
            <div className="bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
              <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{tasksByStatus.TODO}</div>
              <div className="text-xs text-gray-600/70 dark:text-gray-400/70">To Do</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{tasksByStatus.IN_PROGRESS}</div>
              <div className="text-xs text-blue-600/70 dark:text-blue-400/70">In Progress</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{tasksByStatus.READY_TO_TEST}</div>
              <div className="text-xs text-yellow-600/70 dark:text-yellow-400/70">Ready to Test</div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{tasksByStatus.BLOCKED}</div>
              <div className="text-xs text-red-600/70 dark:text-red-400/70">Blocked</div>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{tasksByStatus.DONE}</div>
              <div className="text-xs text-green-600/70 dark:text-green-400/70">Done</div>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{tasksByStatus.LIVE}</div>
              <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70">Live</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Sprint Progress</span>
              <span className="text-sm text-muted-foreground">{completedTasks} of {totalTasks} tasks</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              {(tasksByStatus.DONE + tasksByStatus.LIVE) > 0 && (
                <div 
                  className="h-full bg-green-500" 
                  style={{ width: `${((tasksByStatus.DONE + tasksByStatus.LIVE) / totalTasks) * 100}%` }}
                />
              )}
              {tasksByStatus.IN_PROGRESS > 0 && (
                <div 
                  className="h-full bg-blue-500" 
                  style={{ width: `${(tasksByStatus.IN_PROGRESS / totalTasks) * 100}%` }}
                />
              )}
              {tasksByStatus.READY_TO_TEST > 0 && (
                <div 
                  className="h-full bg-yellow-500" 
                  style={{ width: `${(tasksByStatus.READY_TO_TEST / totalTasks) * 100}%` }}
                />
              )}
              {tasksByStatus.BLOCKED > 0 && (
                <div 
                  className="h-full bg-red-500" 
                  style={{ width: `${(tasksByStatus.BLOCKED / totalTasks) * 100}%` }}
                />
              )}
            </div>
          </div>

          {/* Filter Tabs & Add Task */}
          <div className="flex items-center justify-between mb-4 border-b pb-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-sm text-muted-foreground mr-2">Filter:</span>
              <Button
                variant={filterStatus === 'ALL' ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilterStatus('ALL')}
                className="text-xs h-7 px-2"
              >
                All
                <span className="ml-1 opacity-60">{tasksByStatus.ALL}</span>
              </Button>
              {statuses.map((status) => (
                <Button
                  key={status.key}
                  variant={filterStatus === status.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilterStatus(status.key as TaskStatus)}
                  className="text-xs h-7 px-2"
                >
                  {status.name}
                  <span className="ml-1 opacity-60">
                    {tasksByStatus[status.key as TaskStatus] || 0}
                  </span>
                </Button>
              ))}
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setShowAddTask(true)}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Task
              </Button>
            )}
          </div>

          {/* Add Task Input */}
          {showAddTask && (
            <div className="mb-4">
              <InlineTaskInput
                sprintId={localSprint.id}
                projectId={projectId}
                users={users}
                onSave={handleTaskCreate}
                onCancel={() => setShowAddTask(false)}
              />
            </div>
          )}

          {/* Task List with Drag & Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="border rounded-lg overflow-hidden">
              {filteredTasks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {totalTasks === 0 ? 'No tasks in this sprint yet' : 'No tasks match the selected filter'}
                </div>
              ) : (
                <SortableContext items={filteredTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {filteredTasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTask(task)}
                      canEdit={canEdit}
                    />
                  ))}
                </SortableContext>
              )}
            </div>

            <DragOverlay>
              {activeTask && (
                <div className="bg-background shadow-lg rounded-md border px-3 py-2 text-sm">
                  {activeTask.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </ScrollArea>
      </div>

      {/* Task detail sidebar - inline next to content */}
      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          users={users}
          sprints={allSprints}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
          projectId={projectId}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          onSplit={handleTaskSplit}
          onTaskSelect={async (taskId) => {
            try {
              const res = await fetch(`/api/tasks/${taskId}`)
              if (res.ok) {
                const task = await res.json()
                setSelectedTask(task)
              }
            } catch (error) {
              console.error('Failed to fetch task:', error)
            }
          }}
          onOpenDocument={onOpenDocument}
          readOnly={!canEdit}
        />
      )}
    </div>
  )
}
