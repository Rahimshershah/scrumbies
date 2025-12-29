'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { Sprint, Task, TaskStatus, Priority, Epic } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TaskDetailSidebar } from './task-detail-sidebar'
import { InlineTaskInput } from './inline-task-input'
import { KanbanView } from './kanban-view'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'
import { useRowHeight } from '@/contexts/row-height-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SprintViewProps {
  sprint: Sprint
  users: { id: string; name: string; avatarUrl?: string | null }[]
  allSprints: Sprint[]
  epics?: Epic[]
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

// Sortable Task Row Component with Inline Editing
function SortableTaskRow({ 
  task, 
  onClick,
  canEdit,
  isSelected,
  isActive,
  onSelect,
  index,
  users,
  epics,
  onInlineUpdate,
}: { 
  task: Task
  onClick: () => void
  canEdit: boolean
  isSelected: boolean
  isActive: boolean
  onSelect: (e: React.MouseEvent, index: number) => void
  index: number
  users: { id: string; name: string; avatarUrl?: string | null }[]
  epics: Epic[]
  onInlineUpdate: (taskId: string, field: string, value: string | null) => Promise<void>
}) {
  const { statuses, teams, getStatusConfig, getTeamConfig } = useProjectSettings()
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
      onMouseDown={(e) => {
        // Handle shift-click for multi-select
        if (e.shiftKey && canEdit && !isDragging) {
          e.stopPropagation()
          onSelect(e as any, index)
        }
      }}
      onClick={(e) => {
        // Regular click opens task details (but not if shift was held)
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !isDragging) {
          onClick()
        }
      }}
      className={cn(
        "relative flex items-center gap-3 px-3 border-b last:border-b-0 hover:bg-accent/50 transition-colors",
        getRowHeightClass(),
        canEdit && "active:cursor-grabbing",
        isDragging && "opacity-50 bg-background shadow-lg cursor-grabbing",
        isSelected && "bg-primary/10 border-primary/20 ring-1 ring-primary/30",
        isActive && "bg-blue-50 dark:bg-blue-950/20"
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

      {/* Team - Inline Dropdown */}
      <div className="w-20 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left hover:opacity-80 transition-opacity">
              {teamStyle ? (
                <Badge 
                  className={cn(getTextSize('xs'), "font-semibold px-2 py-0.5 cursor-pointer")}
                  style={{ backgroundColor: teamStyle.bgColor, color: teamStyle.color }}
                >
                  {teamStyle.shortLabel}
                </Badge>
              ) : (
                <span className={cn(getTextSize('xs'), "text-muted-foreground hover:text-foreground cursor-pointer")}>—</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'team', null) }}>
              <span className="text-muted-foreground">No Team</span>
            </DropdownMenuItem>
            {teams.map((team) => (
              <DropdownMenuItem
                key={team.key}
                onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'team', team.key) }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2"
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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

      {/* Right columns container - ABSOLUTE: always visible, pins to right edge, overlays title */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 flex items-center gap-2 z-10 pl-8 pr-3",
        // Match row background states
        "bg-card",
        isSelected && "!bg-primary/10",
        isActive && "!bg-blue-50 dark:!bg-blue-950/20",
        // Left fade gradient to show content underneath
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-8 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:to-card",
        isSelected && "before:!bg-gradient-to-r before:!from-transparent before:!to-primary/10",
        isActive && "before:!bg-gradient-to-r before:!from-transparent before:!to-blue-50 dark:before:!to-blue-950/20"
      )}>

      {/* Epic - Inline Dropdown - responsive width, full text on large screens */}
      <div className="w-24 sm:w-28 md:w-32 lg:w-auto lg:min-w-[120px] lg:max-w-[200px] xl:max-w-[280px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left hover:opacity-80 transition-opacity">
              {task.epic ? (
                <Badge
                  className={cn(getTextSize('xs'), "font-medium px-2.5 py-1 cursor-pointer max-w-full truncate lg:overflow-visible lg:text-clip lg:whitespace-nowrap")}
                  style={{
                    backgroundColor: `${task.epic.color}20`,
                    color: task.epic.color,
                    borderColor: task.epic.color
                  }}
                  variant="outline"
                >
                  {task.epic.name}
                </Badge>
              ) : (
                <Badge variant="outline" className={cn(getTextSize('xs'), "text-muted-foreground hover:text-foreground cursor-pointer px-2.5 py-1 border-dashed")}>
                  No Epic
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'epicId', null) }}>
              <span className="text-muted-foreground">No Epic</span>
            </DropdownMenuItem>
            {epics.map((epic) => (
              <DropdownMenuItem
                key={epic.id}
                onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'epicId', epic.id) }}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: epic.color }}
                />
                <span className="truncate">{epic.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status - Inline Dropdown */}
      <div className="w-20 sm:w-24 md:w-28" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:opacity-80 transition-opacity">
              <span 
                className={cn("px-2 py-1 rounded cursor-pointer", getTextSize('xs'), "font-semibold uppercase")}
                style={{ backgroundColor: status.bgColor, color: status.color }}
              >
                {status.label}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {statuses.map((s) => {
              const sConfig = getStatusConfig(s.key as TaskStatus)
              return (
                <DropdownMenuItem
                  key={s.key}
                  onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'status', s.key) }}
                >
                  <span
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: sConfig.color }}
                  />
                  {s.name}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Priority - Inline Dropdown */}
      <div className="w-8 sm:w-10 text-center" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:opacity-80 transition-opacity">
              <span className={cn(getTextSize('base'), "font-bold cursor-pointer", priority.color)}>
                {priority.icon}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-32">
            {Object.entries(priorityConfig).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'priority', key) }}
              >
                <span className={cn("font-bold mr-2", config.color)}>{config.icon}</span>
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Assignee - Inline Dropdown */}
      <div style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="hover:opacity-80 transition-opacity">
              {task.assignee ? (
                <Avatar style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }} className="cursor-pointer">
                  {task.assignee.avatarUrl ? (
                    <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                  ) : null}
                  <AvatarFallback className={cn(getTextSize('sm'), "bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold")}>
                    {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground cursor-pointer" style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }} />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'assigneeId', null) }}>
              <span className="text-muted-foreground">Unassigned</span>
            </DropdownMenuItem>
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={(e) => { e.stopPropagation(); onInlineUpdate(task.id, 'assigneeId', user.id) }}
              >
                <Avatar className="w-5 h-5 mr-2">
                  {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{user.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      </div>{/* End right columns container */}
    </div>
  )
}

export function SprintView({
  sprint,
  users,
  allSprints,
  epics = [],
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
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [showAddTask, setShowAddTask] = useState(false)
  const [localSprint, setLocalSprint] = useState(sprint)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')

  // Update local sprint when prop changes
  useEffect(() => {
    if (sprint.id !== localSprint.id) {
      setLocalSprint(sprint)
      setSelectedTaskIds(new Set())
      setLastSelectedIndex(null)
    }
  }, [sprint.id, localSprint.id])

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

  // Sort tasks by order field to ensure correct drag-drop calculations
  const sortedTasks = [...localSprint.tasks].sort((a, b) => a.order - b.order)

  const filteredTasks = filterStatus === 'ALL'
    ? sortedTasks
    : sortedTasks.filter(t => t.status === filterStatus)

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

  const handleTaskClick = useCallback((task: Task) => {
    setSelectedTask(task)
    // Update URL to show task parameter
    const url = new URL(window.location.href)
    url.searchParams.set('task', task.id)
    window.history.pushState({}, '', url.toString())
  }, [])

  const handleTaskClose = useCallback(() => {
    setSelectedTask(null)
    // Clear task parameter from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('task')
    window.history.pushState({}, '', url.toString())
  }, [])

  const handleTaskDelete = useCallback((taskId: string) => {
    setLocalSprint(prev => ({
      ...prev,
      tasks: prev.tasks.filter(t => t.id !== taskId),
    }))
    onTaskDelete?.(taskId)
    setSelectedTask(null)
    // Clear task parameter from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('task')
    window.history.pushState({}, '', url.toString())
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

  // Handle inline updates with auto-save
  const handleInlineUpdate = useCallback(async (taskId: string, field: string, value: string | null) => {
    // Optimistic update
    const originalTask = localSprint.tasks.find(t => t.id === taskId)
    if (!originalTask) return

    // Build update payload
    const updatePayload: Record<string, any> = { [field]: value }
    
    // If updating epicId, also update the epic relation for optimistic UI
    let optimisticEpic = undefined
    if (field === 'epicId') {
      optimisticEpic = value ? epics.find(e => e.id === value) : null
    }
    
    // If updating assigneeId, also update the assignee relation for optimistic UI
    let optimisticAssignee = undefined
    if (field === 'assigneeId') {
      optimisticAssignee = value ? users.find(u => u.id === value) : null
    }

    // Optimistic local update
    setLocalSprint(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => {
        if (t.id !== taskId) return t
        const updated = { ...t, [field]: value }
        if (field === 'epicId' && optimisticEpic !== undefined) {
          updated.epic = optimisticEpic ? { id: optimisticEpic.id, name: optimisticEpic.name, color: optimisticEpic.color } : null
        }
        if (field === 'assigneeId' && optimisticAssignee !== undefined) {
          updated.assignee = optimisticAssignee || null
        }
        return updated
      }),
    }))

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      })

      if (response.ok) {
        const updatedTask = await response.json()
        // Update with actual server response
        setLocalSprint(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
        }))
        onTaskUpdate?.(updatedTask)
      } else {
        // Revert on error
        setLocalSprint(prev => ({
          ...prev,
          tasks: prev.tasks.map(t => t.id === taskId ? originalTask : t),
        }))
        console.error('Failed to update task')
      }
    } catch (error) {
      // Revert on error
      setLocalSprint(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === taskId ? originalTask : t),
      }))
      console.error('Error updating task:', error)
    }
  }, [localSprint.tasks, epics, users, onTaskUpdate])

  const handleDragStart = useCallback((event: any) => {
    const task = localSprint.tasks.find(t => t.id === event.active.id)
    setActiveTask(task || null)
  }, [localSprint.tasks])

  const handleTaskSelect = useCallback((e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedIndex !== null) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const newSelection = new Set(selectedTaskIds)
      for (let i = start; i <= end; i++) {
        newSelection.add(filteredTasks[i].id)
      }
      setSelectedTaskIds(newSelection)
    } else {
      // Single selection
      const taskId = filteredTasks[index].id
      const newSelection = new Set(selectedTaskIds)
      if (newSelection.has(taskId)) {
        newSelection.delete(taskId)
      } else {
        newSelection.add(taskId)
      }
      setSelectedTaskIds(newSelection)
      setLastSelectedIndex(index)
    }
  }, [filteredTasks, lastSelectedIndex, selectedTaskIds])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over || active.id === over.id) {
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Check if we're moving multiple selected tasks
    const tasksToMove = selectedTaskIds.size > 0 && selectedTaskIds.has(activeId)
      ? filteredTasks.filter(t => selectedTaskIds.has(t.id))
      : [filteredTasks.find(t => t.id === activeId)].filter(Boolean) as Task[]

    if (tasksToMove.length === 0) return

    const targetIndex = filteredTasks.findIndex(t => t.id === overId)
    if (targetIndex === -1) return

    // Save original order for potential revert
    const originalTasks = [...localSprint.tasks]
    
    // Calculate new positions for all tasks being moved
    const tasksToMoveIds = new Set(tasksToMove.map(t => t.id))
    const remainingTasks = filteredTasks.filter(t => !tasksToMoveIds.has(t.id))
    const newTasks = [
      ...remainingTasks.slice(0, targetIndex),
      ...tasksToMove,
      ...remainingTasks.slice(targetIndex)
    ]
    
    // Update local state immediately (optimistic update)
    setLocalSprint(prev => ({
      ...prev,
      tasks: newTasks,
    }))

    // Persist the new order automatically
    try {
      // Move all selected tasks sequentially to avoid race conditions
      for (let idx = 0; idx < tasksToMove.length; idx++) {
        const task = tasksToMove[idx]
        const newOrder = targetIndex + idx
        const response = await fetch('/api/tasks/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId: task.id,
            targetSprintId: localSprint.id,
            newOrder: newOrder,
          }),
        })
        
        if (!response.ok) {
          throw new Error(`Failed to move task ${task.id}`)
        }
      }
      
      // Clear selection after successful move
      setSelectedTaskIds(new Set())
      setLastSelectedIndex(null)
    } catch (error) {
      console.error('Failed to reorder tasks:', error)
      // Revert on error
      setLocalSprint(prev => ({
        ...prev,
        tasks: originalTasks,
      }))
    }
  }, [localSprint, filteredTasks, selectedTaskIds])

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
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 md:gap-3 mb-8">
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

          {/* View Selector */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">View:</span>
              <Button
                variant={viewMode === 'table' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('table')}
                className="h-8 text-xs"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Table
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="h-8 text-xs"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Kanban
              </Button>
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

          {/* Filter Tabs (only show in table view) */}
          {viewMode === 'table' && (
            <div className="flex items-center gap-1 flex-wrap mb-4 border-b pb-3">
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
          )}

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

          {/* Task View */}
          {viewMode === 'table' ? (
            /* Table View with Drag & Drop */
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
                    {filteredTasks.map((task, index) => (
                      <SortableTaskRow
                        key={task.id}
                        task={task}
                        onClick={() => {
                          if (!selectedTaskIds.has(task.id)) {
                            handleTaskClick(task)
                          }
                        }}
                        canEdit={canEdit}
                        isSelected={selectedTaskIds.has(task.id)}
                        isActive={selectedTask?.id === task.id}
                        onSelect={handleTaskSelect}
                        index={index}
                        users={users}
                        epics={epics}
                        onInlineUpdate={handleInlineUpdate}
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
          ) : (
            /* Kanban View */
            <div className="h-[calc(100vh-550px)] min-h-[600px]">
              <KanbanView
                tasks={localSprint.tasks}
                users={users}
                onTaskClick={(task) => {
                  if (!selectedTaskIds.has(task.id)) {
                    handleTaskClick(task)
                  }
                }}
                onTaskStatusChange={async (taskId, newStatus) => {
                  try {
                    const response = await fetch(`/api/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: newStatus }),
                    })
                    
                    if (response.ok) {
                      const updatedTask = await response.json()
                      // Update task without opening detail panel
                      setLocalSprint(prev => ({
                        ...prev,
                        tasks: prev.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
                      }))
                      onTaskUpdate?.(updatedTask)
                    } else {
                      console.error('Failed to update task status')
                    }
                  } catch (error) {
                    console.error('Error updating task status:', error)
                  }
                }}
                canEdit={canEdit}
                selectedTaskId={selectedTask?.id}
              />
            </div>
          )}
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
          onClose={handleTaskClose}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          onSplit={handleTaskSplit}
          onTaskSelect={async (taskId) => {
            try {
              const res = await fetch(`/api/tasks/${taskId}`)
              if (res.ok) {
                const task = await res.json()
                setSelectedTask(task)
                // Update URL to show task parameter
                const url = new URL(window.location.href)
                url.searchParams.set('task', taskId)
                window.history.pushState({}, '', url.toString())
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
