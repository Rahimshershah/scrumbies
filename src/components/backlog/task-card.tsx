'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task, TaskStatus, Priority } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'
import { useRowHeight } from '@/contexts/row-height-context'

const priorityConfig: Record<Priority, { label: string; icon: string; color: string; bgColor: string }> = {
  LOW: { label: 'Low', icon: '↓', color: 'text-slate-600 dark:text-slate-300', bgColor: 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600' },
  MEDIUM: { label: 'Medium', icon: '–', color: 'text-blue-600 dark:text-blue-300', bgColor: 'bg-blue-200 hover:bg-blue-300 dark:bg-blue-800 dark:hover:bg-blue-700' },
  HIGH: { label: 'High', icon: '↑', color: 'text-orange-600 dark:text-orange-300', bgColor: 'bg-orange-200 hover:bg-orange-300 dark:bg-orange-800 dark:hover:bg-orange-700' },
  URGENT: { label: 'Urgent', icon: '!!', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-300 hover:bg-red-400 dark:bg-red-700 dark:hover:bg-red-600' },
}

interface TaskCardProps {
  task: Task
  users?: { id: string; name: string; avatarUrl?: string | null }[]
  onClick: () => void
  onUpdate?: (task: Task) => void
}

export function TaskCard({ task, users = [], onClick, onUpdate }: TaskCardProps) {
  const { statuses, getStatusConfig, getTeamConfig } = useProjectSettings()
  const { getRowHeightClass } = useRowHeight()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const status = getStatusConfig(task.status)
  const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM
  const teamConfig = task.team ? getTeamConfig(task.team) : null

  // Extract tags from title
  const tagRegex = /\[([^\]]+)\]/g
  const tags: string[] = []
  const title = task.title || ''
  let displayTitle = title
  let match
  while ((match = tagRegex.exec(title)) !== null) {
    tags.push(match[1])
  }
  displayTitle = title.replace(tagRegex, '').trim()

  async function handleStatusChange(newStatus: TaskStatus) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  async function handlePriorityChange(newPriority: Priority) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to update priority:', error)
    }
  }

  async function handleAssigneeChange(userId: string | null) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: userId }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to update assignee:', error)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 px-3 bg-card border-b last:border-b-0 hover:bg-accent/50 transition-colors",
        getRowHeightClass(),
        isDragging && "opacity-50 shadow-lg bg-background"
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

      {/* Type/Team badge - fixed width for alignment */}
      <div className="w-20 flex-shrink-0">
        {teamConfig ? (
          <Badge 
            variant="outline" 
            className="text-xs font-semibold px-2 py-0.5 h-6 border-0"
            style={{ backgroundColor: teamConfig.bgColor, color: teamConfig.color }}
          >
            {teamConfig.shortLabel}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Title with tags - clickable area */}
      <div 
        className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer hover:text-primary transition-colors"
        onClick={onClick}
      >
        {/* Task Key */}
        {task.taskKey && (
          <span className="text-xs font-mono text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded flex-shrink-0">
            {task.taskKey}
          </span>
        )}
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs font-normal px-1.5 py-0 h-5 flex-shrink-0">
            {tag}
          </Badge>
        ))}
        <span className={cn(
          "text-base truncate",
          (task.status === 'DONE' || task.status === 'LIVE') && "line-through text-muted-foreground"
        )}>{displayTitle}</span>
        
        {/* Split indicators */}
        {task.splitFrom && (
          <span 
            className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-0.5 flex-shrink-0 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded"
            title={`Continuation of: ${task.splitFrom.title}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            cont.
          </span>
        )}
        {task.splitTasks && task.splitTasks.length > 0 && (
          <span 
            className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-0.5 flex-shrink-0 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded"
            title={`Split into ${task.splitTasks.length} task(s)`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {task.splitTasks.length}
          </span>
        )}

        {/* Comment count */}
        {task._count && task._count.comments > 0 && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {task._count.comments}
          </span>
        )}
      </div>

      {/* Status dropdown - fixed width for alignment */}
      <div className="w-32 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              className="w-full px-2 py-1 rounded text-xs font-semibold uppercase tracking-wide transition-colors text-center"
              style={{ backgroundColor: status.bgColor, color: status.color }}
            >
              {status.label}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">Set Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statuses.map((s) => (
              <DropdownMenuItem
                key={s.key}
                onClick={(e) => {
                  e.stopPropagation()
                  handleStatusChange(s.key as TaskStatus)
                }}
                className={cn(
                  "flex items-center gap-2",
                  task.status === s.key && "bg-accent"
                )}
              >
                <span 
                  className="w-2.5 h-2.5 rounded-full" 
                  style={{ backgroundColor: s.color }}
                />
                <span>{s.name}</span>
                {task.status === s.key && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Priority dropdown */}
      <div className="w-10 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              className={cn(
                "w-full flex items-center justify-center h-7 rounded text-base font-bold transition-colors",
                priority.bgColor,
                priority.color
              )}
              title={`Priority: ${priority.label}`}
            >
              {priority.icon}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">Set Priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(priorityConfig) as Priority[]).map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePriorityChange(p)
                }}
                className={cn(
                  "flex items-center gap-2",
                  task.priority === p && "bg-accent"
                )}
              >
                <span className={cn("font-bold text-lg", priorityConfig[p].color)}>
                  {priorityConfig[p].icon}
                </span>
                <span>{priorityConfig[p].label}</span>
                {task.priority === p && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Assignee dropdown */}
      <div className="w-9 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            {task.assignee ? (
              <Avatar className="w-9 h-9 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                {task.assignee.avatarUrl ? (
                  <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                ) : null}
                <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <button className="w-9 h-9 rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">Assign to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleAssigneeChange(null)
              }}
              className={cn(!task.assigneeId && "bg-accent")}
            >
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center mr-2">
                <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span>Unassigned</span>
              {!task.assigneeId && (
                <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {users.map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAssigneeChange(user.id)
                }}
                className={cn(
                  "flex items-center gap-2",
                  task.assigneeId === user.id && "bg-accent"
                )}
              >
                <Avatar className="w-5 h-5">
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  ) : null}
                  <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span>{user.name}</span>
                {task.assigneeId === user.id && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
