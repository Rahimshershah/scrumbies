'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Task, TaskStatus, Priority, Epic } from '@/types'
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
  epics?: Epic[]
  onClick: () => void
  onUpdate?: (task: Task) => void
  isActive?: boolean
}

export function TaskCard({ task, users = [], epics = [], onClick, onUpdate, isActive = false }: TaskCardProps) {
  const { statuses, teams, getStatusConfig, getTeamConfig } = useProjectSettings()
  const { getRowHeightClass, getTextSize, getAvatarSize, getScale, getIconSize } = useRowHeight()
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

  async function handleEpicChange(epicId: string | null) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to update epic:', error)
    }
  }

  async function handleTeamChange(team: string | null) {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team }),
      })
      if (res.ok) {
        const updated = await res.json()
        onUpdate?.(updated)
      }
    } catch (error) {
      console.error('Failed to update team:', error)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "relative flex items-center gap-2 sm:gap-3 px-3 bg-card border-b last:border-b-0 hover:bg-accent/50 transition-colors active:cursor-grabbing",
        getRowHeightClass(),
        isDragging && "opacity-50 shadow-lg bg-background cursor-grabbing",
        isActive && "bg-blue-50 dark:bg-blue-950/20"
      )}
    >
      {/* Drag handle indicator */}
      <div
        className="text-muted-foreground/50 hover:text-muted-foreground flex-shrink-0 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      </div>

      {/* Team dropdown - hidden on small screens */}
      <div className="hidden md:block w-20 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left hover:opacity-80 transition-opacity">
              {teamConfig ? (
                <Badge 
                  variant="outline" 
                  className={cn(getTextSize('xs'), "font-semibold px-2 py-0.5 border-0 cursor-pointer")}
                  style={{ backgroundColor: teamConfig.bgColor, color: teamConfig.color, height: `${6 * getScale() * 0.25}rem` }}
                >
                  {teamConfig.shortLabel}
                </Badge>
              ) : (
                <span className={cn(getTextSize('xs'), "text-muted-foreground hover:text-foreground cursor-pointer")}>—</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className={getTextSize('xs')}>Set Team</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleTeamChange(null)
              }}
              className={cn(!task.team && "bg-accent")}
            >
              <span className="text-muted-foreground">No Team</span>
            </DropdownMenuItem>
            {teams.map((team) => (
              <DropdownMenuItem 
                key={team.key} 
                onClick={(e) => {
                  e.stopPropagation()
                  handleTeamChange(team.key)
                }}
                className={cn(task.team === team.key && "bg-accent")}
              >
                <span 
                  className="w-2 h-2 rounded-full mr-2" 
                  style={{ backgroundColor: team.color }}
                />
                {team.name}
                {task.team === team.key && (
                  <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title with tags - shrinks aggressively to make room for right columns */}
      <div
        className="flex-shrink min-w-0 flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer overflow-hidden"
        style={{ flex: '1 1 0%' }}
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
          <Badge key={tag} variant="outline" className={cn(getTextSize('xs'), "font-normal px-1.5 py-0 flex-shrink-0 hidden sm:inline-flex")} style={{ height: `${5 * getScale() * 0.25}rem` }}>
            {tag}
          </Badge>
        ))}
        <span className={cn(
          getTextSize('base'), "truncate",
          (task.status === 'DONE' || task.status === 'LIVE') && "line-through text-muted-foreground"
        )}>{displayTitle}</span>

        {/* Split indicators - hidden on very small screens */}
        {task.splitFrom && (
          <span
            className={cn(getTextSize('xs'), "text-amber-700 dark:text-amber-300 hidden sm:flex items-center gap-0.5 flex-shrink-0 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded")}
            title={`Continuation of: ${task.splitFrom.title}`}
          >
            <svg className={getIconSize(3.5)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            cont.
          </span>
        )}
        {task.splitTasks && task.splitTasks.length > 0 && (
          <span
            className={cn(getTextSize('xs'), "text-purple-700 dark:text-purple-300 hidden sm:flex items-center gap-0.5 flex-shrink-0 bg-purple-100 dark:bg-purple-900/50 px-1.5 py-0.5 rounded")}
            title={`Split into ${task.splitTasks.length} task(s)`}
          >
            <svg className={getIconSize(3.5)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {task.splitTasks.length}
          </span>
        )}

        {/* Comment count - hidden on small screens */}
        {task._count && task._count.comments > 0 && (
          <span className={cn(getTextSize('xs'), "text-muted-foreground hidden md:flex items-center gap-1 flex-shrink-0")}>
            <svg className={getIconSize(3.5)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {task._count.comments}
          </span>
        )}
      </div>

      {/* Right columns container - ABSOLUTE: always visible, pins to right edge, overlays title */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 flex items-center gap-2 z-10 pl-8 pr-3",
        // Match row background states
        "bg-card",
        isActive && "!bg-blue-50 dark:!bg-blue-950/20",
        // Left fade gradient to show content underneath
        "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-8 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:to-card",
        isActive && "before:!bg-gradient-to-r before:!from-transparent before:!to-blue-50 dark:before:!to-blue-950/20"
      )}>

      {/* Epic dropdown - responsive width, full text on large screens */}
      <div className="w-[80px] sm:w-[100px] md:w-[120px] lg:w-auto lg:min-w-[120px] lg:max-w-[200px] xl:max-w-[280px]" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full text-left hover:opacity-80 transition-opacity">
              {task.epic ? (
                <Badge
                  className={cn(getTextSize('xs'), "font-medium px-2 py-0.5 cursor-pointer max-w-full block truncate lg:overflow-visible lg:text-clip lg:whitespace-nowrap")}
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
                <Badge variant="outline" className={cn(getTextSize('xs'), "text-muted-foreground hover:text-foreground cursor-pointer px-2 py-0.5 border-dashed")}>
                  No Epic
                </Badge>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className={getTextSize('xs')}>Set Epic</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleEpicChange(null)
              }}
              className={cn(!task.epicId && "bg-accent")}
            >
              <span className="text-muted-foreground">No Epic</span>
            </DropdownMenuItem>
            {epics.map((epic) => (
              <DropdownMenuItem
                key={epic.id}
                onClick={(e) => {
                  e.stopPropagation()
                  handleEpicChange(epic.id)
                }}
                className={cn(task.epicId === epic.id && "bg-accent")}
              >
                <span
                  className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
                  style={{ backgroundColor: epic.color }}
                />
                <span className="truncate">{epic.name}</span>
                {task.epicId === epic.id && (
                  <svg className="w-4 h-4 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Status dropdown - always visible, fixed width */}
      <div className="w-20 sm:w-24 md:w-28">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              className={cn("w-full px-2 py-1 rounded", getTextSize('xs'), "font-semibold uppercase tracking-wide transition-colors text-center")}
              style={{ backgroundColor: status.bgColor, color: status.color }}
            >
              {status.label}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className={getTextSize('xs')}>Set Status</DropdownMenuLabel>
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
                  <svg className={cn(getIconSize(4), "ml-auto")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Priority dropdown */}
      <div className="w-8 sm:w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button
              className={cn(
                "w-full flex items-center justify-center rounded font-bold transition-colors",
                getTextSize('base'),
                priority.bgColor,
                priority.color
              )}
              style={{ height: `${7 * getScale() * 0.25}rem` }}
              title={`Priority: ${priority.label}`}
            >
              {priority.icon}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className={getTextSize('xs')}>Set Priority</DropdownMenuLabel>
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
      <div style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            {task.assignee ? (
              <Avatar className={cn("cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all")} style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }}>
                {task.assignee.avatarUrl ? (
                  <AvatarImage src={task.assignee.avatarUrl} alt={task.assignee.name} />
                ) : null}
                <AvatarFallback className={cn(getTextSize('sm'), "bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold")}>
                  {task.assignee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <button className="rounded-full border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 flex items-center justify-center transition-colors" style={{ width: `${7 * getScale() * 0.25}rem`, height: `${7 * getScale() * 0.25}rem` }}>
                <svg className={cn(getIconSize(4), "text-muted-foreground/50")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className={getTextSize('xs')}>Assign to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleAssigneeChange(null)
              }}
              className={cn(!task.assigneeId && "bg-accent")}
            >
              <div className="rounded-full bg-muted flex items-center justify-center mr-2" style={{ width: `${5 * getScale() * 0.25}rem`, height: `${5 * getScale() * 0.25}rem` }}>
                <svg className={getIconSize(3)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span>Unassigned</span>
              {!task.assigneeId && (
                <svg className={cn(getIconSize(4), "ml-auto")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <Avatar style={{ width: `${5 * getScale() * 0.25}rem`, height: `${5 * getScale() * 0.25}rem` }}>
                  {user.avatarUrl ? (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  ) : null}
                  <AvatarFallback className={cn(getTextSize('xs'), "bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold")}>
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

      </div>{/* End right columns container */}
    </div>
  )
}
