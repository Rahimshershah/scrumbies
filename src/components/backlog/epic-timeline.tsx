'use client'

import { useState, useEffect, useMemo } from 'react'
import { Epic, Task, Sprint } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EpicTimelineProps {
  epics: Epic[]
  sprints: Sprint[]
  onBack: () => void
  onTaskClick: (task: Task) => void
  onEpicClick: (epicId: string) => void
}

interface EpicWithTasks extends Epic {
  tasks: Task[]
}

export function EpicTimeline({ epics, sprints, onBack, onTaskClick, onEpicClick }: EpicTimelineProps) {
  const [loading, setLoading] = useState(true)
  const [epicsWithTasks, setEpicsWithTasks] = useState<EpicWithTasks[]>([])
  const [view, setView] = useState<'timeline' | 'list'>('timeline')

  // Fetch epic details with tasks
  useEffect(() => {
    async function fetchEpicDetails() {
      setLoading(true)
      try {
        const detailedEpics = await Promise.all(
          epics.map(async (epic) => {
            const res = await fetch(`/api/epics/${epic.id}`)
            if (res.ok) {
              return await res.json()
            }
            return { ...epic, tasks: [] }
          })
        )
        setEpicsWithTasks(detailedEpics)
      } catch (error) {
        console.error('Failed to fetch epic details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (epics.length > 0) {
      fetchEpicDetails()
    } else {
      setLoading(false)
      setEpicsWithTasks([])
    }
  }, [epics])

  // Calculate timeline range
  const { startDate, endDate, weeks } = useMemo(() => {
    const now = new Date()
    let minDate = now
    let maxDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days from now

    // Consider epic dates
    epicsWithTasks.forEach((epic) => {
      if (epic.startDate) {
        const start = new Date(epic.startDate)
        if (start < minDate) minDate = start
      }
      if (epic.endDate) {
        const end = new Date(epic.endDate)
        if (end > maxDate) maxDate = end
      }
    })

    // Consider sprint dates
    sprints.forEach((sprint) => {
      if (sprint.startDate) {
        const start = new Date(sprint.startDate)
        if (start < minDate) minDate = start
      }
      if (sprint.endDate) {
        const end = new Date(sprint.endDate)
        if (end > maxDate) maxDate = end
      }
    })

    // Align to week boundaries
    const startOfWeek = new Date(minDate)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(maxDate)
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()))
    endOfWeek.setHours(23, 59, 59, 999)

    // Generate weeks
    const weeks: Date[] = []
    const current = new Date(startOfWeek)
    while (current <= endOfWeek) {
      weeks.push(new Date(current))
      current.setDate(current.getDate() + 7)
    }

    return { startDate: startOfWeek, endDate: endOfWeek, weeks }
  }, [epicsWithTasks, sprints])

  // Calculate epic date range from its tasks' sprint dates if epic dates not set
  const getEpicDateRange = (epic: EpicWithTasks): { start: string | null, end: string | null } => {
    // If epic has explicit dates, use them
    if (epic.startDate && epic.endDate) {
      return { start: epic.startDate, end: epic.endDate }
    }

    // Otherwise, calculate from tasks' sprint dates
    const sprintDates: { start: Date, end: Date }[] = []

    ;(epic.tasks || []).forEach((task: any) => {
      if (task.sprint?.startDate && task.sprint?.endDate) {
        sprintDates.push({
          start: new Date(task.sprint.startDate),
          end: new Date(task.sprint.endDate)
        })
      }
    })

    if (sprintDates.length === 0) {
      return {
        start: epic.startDate || null,
        end: epic.endDate || null
      }
    }

    const minDate = sprintDates.reduce((min, d) => d.start < min ? d.start : min, sprintDates[0].start)
    const maxDate = sprintDates.reduce((max, d) => d.end > max ? d.end : max, sprintDates[0].end)

    // If epic has start date but not end, use calculated end
    if (epic.startDate && !epic.endDate) {
      return { start: epic.startDate, end: maxDate.toISOString() }
    }

    // If epic has end date but not start, use calculated start
    if (!epic.startDate && epic.endDate) {
      return { start: minDate.toISOString(), end: epic.endDate }
    }

    // Use fully calculated dates
    return {
      start: minDate.toISOString(),
      end: maxDate.toISOString()
    }
  }

  // Calculate position and width for a date range
  const getBarStyle = (start: string | null | undefined, end: string | null | undefined, minWidthPercent = 2) => {
    if (!start) return null

    const totalMs = endDate.getTime() - startDate.getTime()
    if (totalMs === 0) return null
    
    const startMs = new Date(start).getTime() - startDate.getTime()
    const endMs = end ? new Date(end).getTime() - startDate.getTime() : startMs + 14 * 24 * 60 * 60 * 1000 // Default 2 weeks

    const left = Math.max(0, (startMs / totalMs) * 100)
    const width = Math.min(100 - left, ((endMs - startMs) / totalMs) * 100)

    return { left: `${left}%`, width: `${Math.max(minWidthPercent, width)}%` }
  }

  // Get task bar style based on its sprint dates
  const getTaskBarStyle = (task: any) => {
    if (!task.sprint?.startDate || !task.sprint?.endDate) return null
    return getBarStyle(task.sprint.startDate, task.sprint.endDate, 5)
  }

  // Group tasks by status
  const getTaskStats = (tasks: Task[]) => {
    const done = tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length
    const total = tasks.length
    const progress = total > 0 ? Math.round((done / total) * 100) : 0

    return { done, inProgress, total, progress }
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const isCurrentWeek = (weekStart: Date) => {
    const now = new Date()
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return now >= weekStart && now <= weekEnd
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onBack}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <div>
            <h1 className="text-base font-semibold">Epic Timeline</h1>
            <p className="text-xs text-muted-foreground">
              {epicsWithTasks.length} epic{epicsWithTasks.length !== 1 ? 's' : ''} • 
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center border rounded p-0.5 bg-muted/30">
          <Button
            variant={view === 'timeline' ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setView('timeline')}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Timeline
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setView('list')}
          >
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            List
          </Button>
        </div>
      </div>

      {view === 'timeline' ? (
        <ScrollArea className="flex-1">
          <div className="min-w-[900px]">
            {/* Week headers */}
            <div className="sticky top-0 bg-background z-10 border-b">
              <div className="flex">
                <div className="w-52 flex-shrink-0 px-2 py-1.5 border-r font-medium text-xs text-muted-foreground">
                  Epic
                </div>
                <div className="flex-1 flex">
                  {weeks.map((week, i) => (
                    <div
                      key={i}
                      className={`flex-1 min-w-[80px] px-1 py-1.5 text-center text-[10px] border-r ${
                        isCurrentWeek(week) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="font-medium">{formatDate(week)}</div>
                      {isCurrentWeek(week) && (
                        <div className="text-primary text-[9px] font-semibold">Now</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Epics */}
            {epicsWithTasks.map((epic) => {
              const stats = getTaskStats(epic.tasks || [])
              const epicDates = getEpicDateRange(epic)
              const barStyle = getBarStyle(epicDates.start, epicDates.end)

              return (
                <div key={epic.id} className="border-b">
                  {/* Epic Row */}
                  <div className="flex bg-muted/20">
                    {/* Epic info */}
                    <div className="w-52 flex-shrink-0 px-2 py-1.5 border-r bg-muted/30">
                      <button
                        onClick={() => onEpicClick(epic.id)}
                        className="text-left w-full"
                      >
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: epic.color }}
                          />
                          <span className="font-medium text-sm truncate">{epic.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 ml-4">
                          <span>{stats.total} tasks</span>
                          <span>•</span>
                          <span>{stats.progress}%</span>
                          {/* Inline progress bar */}
                          <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${stats.progress}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Epic Timeline bar */}
                    <div className="flex-1 relative h-10">
                      {/* Week grid lines */}
                      <div className="absolute inset-0 flex">
                        {weeks.map((week, i) => (
                          <div
                            key={i}
                            className={`flex-1 min-w-[80px] border-r ${
                              isCurrentWeek(week) ? 'bg-primary/5' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {/* Epic bar - main bar showing the epic's date range */}
                      {barStyle && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="absolute top-1.5 h-7 rounded cursor-pointer hover:opacity-90 transition-opacity flex items-center px-2 text-white text-xs font-medium shadow-sm"
                                style={{
                                  ...barStyle,
                                  backgroundColor: epic.color,
                                  minWidth: '80px',
                                }}
                                onClick={() => onEpicClick(epic.id)}
                              >
                                <span className="truncate">{epic.name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <div className="font-medium">{epic.name}</div>
                                <div className="text-muted-foreground">
                                  {epicDates.start && formatDate(new Date(epicDates.start))}
                                  {epicDates.start && epicDates.end && ' - '}
                                  {epicDates.end && formatDate(new Date(epicDates.end))}
                                </div>
                                <div className="mt-1">
                                  {stats.done}/{stats.total} tasks done
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>

                  {/* Tasks in Epic - each task positioned based on its sprint dates */}
                  {(epic.tasks || []).length > 0 && (
                    <div className="flex">
                      {/* Task list sidebar */}
                      <div className="w-52 flex-shrink-0 border-r bg-background">
                        {(epic.tasks || []).map((task: any) => (
                          <button
                            key={task.id}
                            onClick={() => onTaskClick(task)}
                            className="w-full text-left px-2 py-1 border-b hover:bg-muted/50 flex items-center gap-1.5"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              task.status === 'DONE' || task.status === 'LIVE'
                                ? 'bg-green-500'
                                : task.status === 'IN_PROGRESS'
                                ? 'bg-blue-500'
                                : task.status === 'BLOCKED'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                            }`} />
                            <span className="text-[10px] font-mono text-primary/70 flex-shrink-0">{task.taskKey}</span>
                            <span className="text-xs truncate flex-1">{task.title}</span>
                          </button>
                        ))}
                      </div>

                      {/* Task timeline bars */}
                      <div className="flex-1">
                        {(epic.tasks || []).map((task: any) => {
                          const taskBarStyle = getTaskBarStyle(task)
                          
                          return (
                            <div key={task.id} className="relative h-7 border-b">
                              {/* Week grid lines */}
                              <div className="absolute inset-0 flex">
                                {weeks.map((week, i) => (
                                  <div
                                    key={i}
                                    className={`flex-1 min-w-[80px] border-r ${
                                      isCurrentWeek(week) ? 'bg-primary/5' : ''
                                    }`}
                                  />
                                ))}
                              </div>

                              {/* Task bar */}
                              {taskBarStyle ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`absolute top-1 h-5 rounded cursor-pointer hover:opacity-90 transition-opacity flex items-center px-1.5 text-white text-[10px] font-medium shadow-sm ${
                                          task.status === 'DONE' || task.status === 'LIVE'
                                            ? 'bg-green-500'
                                            : task.status === 'IN_PROGRESS'
                                            ? 'bg-blue-500'
                                            : task.status === 'BLOCKED'
                                            ? 'bg-red-500'
                                            : 'bg-gray-500'
                                        }`}
                                        style={{
                                          ...taskBarStyle,
                                          minWidth: '60px',
                                        }}
                                        onClick={() => onTaskClick(task)}
                                      >
                                        <span className="truncate">{task.taskKey}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-sm max-w-xs">
                                        <div className="font-medium">{task.taskKey}</div>
                                        <div>{task.title}</div>
                                        <div className="text-muted-foreground mt-1">
                                          Status: {task.status.replace('_', ' ')}
                                        </div>
                                        {task.sprint && (
                                          <div className="text-muted-foreground">
                                            Sprint: {task.sprint.name}
                                          </div>
                                        )}
                                        {task.sprint?.startDate && task.sprint?.endDate && (
                                          <div className="text-muted-foreground">
                                            {formatDate(new Date(task.sprint.startDate))} - {formatDate(new Date(task.sprint.endDate))}
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`absolute left-1 top-1 h-5 px-1.5 rounded cursor-pointer hover:opacity-90 transition-opacity flex items-center text-white text-[10px] font-medium shadow-sm ${
                                          task.status === 'DONE' || task.status === 'LIVE'
                                            ? 'bg-green-500'
                                            : task.status === 'IN_PROGRESS'
                                            ? 'bg-blue-500'
                                            : task.status === 'BLOCKED'
                                            ? 'bg-red-500'
                                            : 'bg-gray-500'
                                        }`}
                                        onClick={() => onTaskClick(task)}
                                      >
                                        <span className="truncate">{task.taskKey}</span>
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-sm max-w-xs">
                                        <div className="font-medium">{task.taskKey}</div>
                                        <div>{task.title}</div>
                                        <div className="text-muted-foreground mt-1">
                                          Status: {task.status.replace('_', ' ')}
                                        </div>
                                        <div className="text-amber-600 mt-1">
                                          No sprint dates set
                                        </div>
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {epicsWithTasks.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-lg font-medium">No epics yet</p>
                <p className="text-sm mt-1">Create epics to organize your work on a timeline</p>
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        /* List view */
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {epicsWithTasks.map((epic) => {
              const stats = getTaskStats(epic.tasks || [])

              return (
                <div key={epic.id} className="border rounded-lg overflow-hidden">
                  {/* Epic header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30"
                    onClick={() => onEpicClick(epic.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: epic.color }}
                        />
                        <div>
                          <h3 className="font-semibold">{epic.name}</h3>
                          {epic.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {epic.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-medium">{stats.progress}%</div>
                        <div className="text-muted-foreground">
                          {stats.done}/{stats.total} done
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all"
                        style={{ width: `${stats.progress}%` }}
                      />
                    </div>

                    {/* Dates */}
                    {(epic.startDate || epic.endDate) && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        {epic.startDate && formatDate(new Date(epic.startDate))}
                        {epic.startDate && epic.endDate && ' - '}
                        {epic.endDate && formatDate(new Date(epic.endDate))}
                      </div>
                    )}
                  </div>

                  {/* Tasks */}
                  {(epic.tasks || []).length > 0 && (
                    <div className="border-t bg-muted/20">
                      <div className="p-3">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Tasks ({epic.tasks?.length})
                        </div>
                        <div className="space-y-1">
                          {(epic.tasks || []).slice(0, 5).map((task) => (
                            <button
                              key={task.id}
                              onClick={() => onTaskClick(task)}
                              className="w-full text-left p-2 rounded hover:bg-background flex items-center gap-3"
                            >
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  task.status === 'DONE' || task.status === 'LIVE'
                                    ? 'bg-green-500/10 text-green-600 border-green-200'
                                    : task.status === 'IN_PROGRESS'
                                    ? 'bg-blue-500/10 text-blue-600 border-blue-200'
                                    : task.status === 'BLOCKED'
                                    ? 'bg-red-500/10 text-red-600 border-red-200'
                                    : ''
                                }`}
                              >
                                {task.taskKey}
                              </Badge>
                              <span className="flex-1 truncate text-sm">{task.title}</span>
                              {task.assignee && (
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={task.assignee.avatarUrl || undefined} />
                                  <AvatarFallback className="text-[10px]">
                                    {task.assignee.name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                            </button>
                          ))}
                          {(epic.tasks || []).length > 5 && (
                            <button
                              onClick={() => onEpicClick(epic.id)}
                              className="w-full text-center text-sm text-primary hover:underline py-1"
                            >
                              View all {epic.tasks?.length} tasks
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {epicsWithTasks.length === 0 && (
              <div className="text-center py-20 text-muted-foreground">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <p className="text-lg font-medium">No epics yet</p>
                <p className="text-sm mt-1">Create epics to organize your work</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

