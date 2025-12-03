'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task, TaskStatus, Priority } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'
import { useRowHeight } from '@/contexts/row-height-context'

interface KanbanViewProps {
  tasks: Task[]
  users: { id: string; name: string; avatarUrl?: string | null }[]
  onTaskClick: (task: Task) => void
  onTaskStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>
  canEdit: boolean
}

const priorityConfig: Record<Priority, { label: string; icon: string; color: string }> = {
  LOW: { label: 'Low', icon: '↓', color: 'text-slate-600 dark:text-slate-300' },
  MEDIUM: { label: 'Medium', icon: '–', color: 'text-blue-600 dark:text-blue-300' },
  HIGH: { label: 'High', icon: '↑', color: 'text-orange-600 dark:text-orange-300' },
  URGENT: { label: 'Urgent', icon: '!!', color: 'text-red-700 dark:text-red-300' },
}

function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  canEdit,
  wasDragging,
  selectedTaskId,
}: {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (task: Task) => void
  canEdit: boolean
  wasDragging: boolean
  selectedTaskId?: string | null
}) {
  const { getStatusConfig } = useProjectSettings()
  const { getTextSize, getAvatarSize, getScale, getIconSize } = useRowHeight()
  const statusConfig = getStatusConfig(status)
  
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${status}`,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full min-h-[400px] rounded-lg border-2 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      )}
    >
      {/* Column Header */}
      <div
        className="p-3 border-b rounded-t-lg"
        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
      >
        <div className="flex items-center justify-between">
          <span className={cn(getTextSize('sm'), "font-semibold uppercase")}>
            {statusConfig.label}
          </span>
          <Badge variant="secondary" className={cn(getTextSize('xs'), "ml-2")}>
            {tasks.length}
          </Badge>
        </div>
      </div>

      {/* Tasks */}
      <div className={cn(
        "flex-1 p-2 overflow-y-auto min-h-0",
        isOver && "bg-primary/5"
      )}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onTaskClick={onTaskClick}
                canEdit={canEdit}
                wasDragging={wasDragging}
                isActive={selectedTaskId === task.id}
              />
            ))}
            {tasks.length === 0 && (
              <div className={cn(
                getTextSize('xs'), 
                "text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg border-muted-foreground/20"
              )}>
                Drop tasks here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

function KanbanCard({
  task,
  onTaskClick,
  canEdit,
  wasDragging,
  isActive,
}: {
  task: Task
  onTaskClick: (task: Task) => void
  canEdit: boolean
  wasDragging: boolean
  isActive: boolean
}) {
  const { getStatusConfig, getTeamConfig } = useProjectSettings()
  const { getTextSize, getAvatarSize, getScale, getIconSize } = useRowHeight()
  const priority = priorityConfig[task.priority || 'MEDIUM']
  
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

  // Extract tags from title
  const tagRegex = /\[([^\]]+)\]/g
  const tags: string[] = []
  let displayTitle = task.title
  let match
  while ((match = tagRegex.exec(task.title)) !== null) {
    tags.push(match[1])
  }
  displayTitle = task.title.replace(tagRegex, '').trim()

  const teamStyle = task.team ? getTeamConfig(task.team) : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? { ...attributes, ...listeners } : {})}
      onDoubleClick={(e) => {
        // Don't open detail panel if we just finished dragging
        if (!isDragging && !wasDragging) {
          e.stopPropagation()
          onTaskClick(task)
        }
      }}
      className={cn(
        "bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-all",
        isDragging && "opacity-50 shadow-lg rotate-2",
        canEdit && "active:cursor-grabbing cursor-grab",
        isActive && "bg-blue-50 dark:bg-blue-950/20"
      )}
    >
      {/* Task Key and Tags */}
      <div className="flex items-start gap-2 mb-2">
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
      </div>

      {/* Title */}
      <h3 className={cn(
        getTextSize('sm'),
        "font-medium mb-2 line-clamp-2",
        (task.status === 'DONE' || task.status === 'LIVE') && "line-through text-muted-foreground"
      )}>
        {displayTitle}
      </h3>

      {/* Split indicators */}
      {(task.splitFrom || (task.splitTasks && task.splitTasks.length > 0)) && (
        <div className="flex gap-1 mb-2">
          {task.splitFrom && (
            <span className={cn(getTextSize('xs'), "text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded")}>
              cont.
            </span>
          )}
          {task.splitTasks && task.splitTasks.length > 0 && (
            <span className={cn(getTextSize('xs'), "text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded")}>
              ↔ {task.splitTasks.length}
            </span>
          )}
        </div>
      )}

      {/* Footer: Team, Priority, Assignee */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t">
        <div className="flex items-center gap-2">
          {teamStyle && (
            <Badge 
              className={cn(getTextSize('xs'), "font-semibold px-1.5 py-0.5")}
              style={{ backgroundColor: teamStyle.bgColor, color: teamStyle.color }}
            >
              {teamStyle.shortLabel}
            </Badge>
          )}
          <span className={cn(getTextSize('xs'), "font-bold", priority.color)}>
            {priority.icon}
          </span>
        </div>
        {task.assignee ? (
          <Avatar style={{ width: `${6 * getScale() * 0.25}rem`, height: `${6 * getScale() * 0.25}rem` }}>
            {task.assignee.avatarUrl ? (
              <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
            ) : null}
            <AvatarFallback className={cn(getTextSize('xs'), "bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold")}>
              {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="rounded-full border-2 border-dashed border-muted-foreground/30" style={{ width: `${6 * getScale() * 0.25}rem`, height: `${6 * getScale() * 0.25}rem` }} />
        )}
      </div>

      {/* Comment count */}
      {task._count && task._count.comments > 0 && (
        <div className="mt-2 flex items-center gap-1 text-muted-foreground">
          <svg className={getIconSize(3)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className={cn(getTextSize('xs'))}>{task._count.comments}</span>
        </div>
      )}
    </div>
  )
}

export function KanbanView({
  tasks,
  users,
  onTaskClick,
  onTaskStatusChange,
  canEdit,
  selectedTaskId,
}: KanbanViewProps & { selectedTaskId?: string | null }) {
  const { statuses } = useProjectSettings()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [wasDragging, setWasDragging] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Group tasks by status
  const tasksByStatus: Record<TaskStatus, Task[]> = {
    TODO: [],
    IN_PROGRESS: [],
    READY_TO_TEST: [],
    BLOCKED: [],
    DONE: [],
    LIVE: [],
  }

  tasks.forEach(task => {
    if (tasksByStatus[task.status]) {
      tasksByStatus[task.status].push(task)
    }
  })

  // Sort tasks within each status by order
  Object.keys(tasksByStatus).forEach(status => {
    tasksByStatus[status as TaskStatus].sort((a, b) => a.order - b.order)
  })

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
    setWasDragging(true)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) {
      // Reset dragging flag after a short delay to prevent double-click from firing
      setTimeout(() => setWasDragging(false), 100)
      return
    }

    const taskId = active.id as string
    const overId = over.id as string

    // Check if dropping on a column (status change)
    if (overId.startsWith('column-')) {
      const newStatus = overId.replace('column-', '') as TaskStatus
      const task = tasks.find(t => t.id === taskId)
      
      if (task && task.status !== newStatus) {
        await onTaskStatusChange(taskId, newStatus)
      }
      // Reset dragging flag after a short delay to prevent double-click from firing
      setTimeout(() => setWasDragging(false), 100)
      return
    }

    // Check if dropping on another task
    const targetTask = tasks.find(t => t.id === overId)
    const draggedTask = tasks.find(t => t.id === taskId)
    
    if (!targetTask || !draggedTask) {
      setTimeout(() => setWasDragging(false), 100)
      return
    }

    // If dropping on a task in a different column, change status
    if (targetTask.status !== draggedTask.status) {
      await onTaskStatusChange(taskId, targetTask.status)
    }

    // Reset dragging flag after a short delay to prevent double-click from firing
    setTimeout(() => setWasDragging(false), 100)
  }, [tasks, onTaskStatusChange])

  // Get ordered statuses from project settings
  const orderedStatuses = statuses
    .filter(s => ['TODO', 'IN_PROGRESS', 'READY_TO_TEST', 'BLOCKED', 'DONE', 'LIVE'].includes(s.key))
    .sort((a, b) => a.order - b.order)
    .map(s => s.key as TaskStatus)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-6 gap-4 h-full overflow-x-auto">
        {orderedStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onTaskClick={onTaskClick}
            canEdit={canEdit}
            wasDragging={wasDragging}
            selectedTaskId={selectedTaskId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-background shadow-lg rounded-lg border p-3 max-w-xs">
            <div className="text-sm font-medium">{activeTask.title}</div>
            {activeTask.taskKey && (
              <div className="text-xs text-muted-foreground mt-1">{activeTask.taskKey}</div>
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

