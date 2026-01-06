'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Sprint, Task, Epic } from '@/types'
import { SprintSection } from './sprint-section'
import { UATSprintSection } from './uat-sprint-section'
import { BacklogSection } from './backlog-section'
import { TaskDetailSidebar } from './task-detail-sidebar'
import { CreateSprintModal } from './create-sprint-modal'
import { AppLayout } from '@/components/layout/app-layout'
import { SprintView } from './sprint-view'
import { EpicPanel } from './epic-panel'
import { EpicTimeline } from './epic-timeline'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRowHeight } from '@/contexts/row-height-context'
import { TaskStatus, Priority } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface BacklogViewProps {
  initialSprints: Sprint[]
  initialBacklog: Task[]
  initialEpics?: Epic[]
  users: { id: string; name: string; avatarUrl?: string | null }[]
  currentUser?: { id: string; name: string; role: string }
  projectId: string
  onOpenDocument?: (documentId: string) => void
  taskToOpen?: string | null
  onNavigateToReports?: () => void
}

interface PendingMove {
  task: Task
  sourceSprintId: string | null
  sourceSprintName: string
  sourceSprintStatus: string
  destSprintId: string | null
  destSprintName: string
  newOrder: number
}

export function BacklogView({ initialSprints, initialBacklog, initialEpics = [], users, currentUser, projectId, onOpenDocument, taskToOpen, onNavigateToReports }: BacklogViewProps) {
  const { rowHeight, setRowHeight } = useRowHeight()
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints)
  const [backlogTasks, setBacklogTasks] = useState<Task[]>(initialBacklog)
  const [epics, setEpics] = useState<Epic[]>(initialEpics)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [viewingSprint, setViewingSprint] = useState<Sprint | null>(null)
  const [viewingTimeline, setViewingTimeline] = useState(false)
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null)
  const [lastOpenedTaskId, setLastOpenedTaskId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPriority, setFilterPriority] = useState<Priority | 'ALL'>('ALL')
  const [filterAssignee, setFilterAssignee] = useState<string | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'ALL'>('ALL')
  const [filterEpic, setFilterEpic] = useState<string | null>(null) // null = all, 'none' = no epic, epicId = specific epic
  const [showEpicPanel, setShowEpicPanel] = useState(true) // Always show epic panel
  
  // Track the original state before drag for reverting
  const originalStateRef = useRef<{ sprints: Sprint[]; backlog: Task[] } | null>(null)

  // Handle external task selection request (e.g., from email link with ?task=)
  useEffect(() => {
    if (taskToOpen && taskToOpen !== lastOpenedTaskId) {
      setLastOpenedTaskId(taskToOpen)
      // Close sprint view if open, so the sidebar can show in the backlog
      setViewingSprint(null)
      async function openTask() {
        try {
          const res = await fetch(`/api/tasks/${taskToOpen}`)
          if (res.ok) {
            const task = await res.json()
            setSelectedTask(task)
            // Update URL to show task parameter (in case it's not already set)
            const url = new URL(window.location.href)
            url.searchParams.set('task', task.id)
            window.history.replaceState({}, '', url.toString())
            // Stay in backlog view - just show the details panel, don't redirect to sprint view
          }
        } catch (error) {
          console.error('Failed to fetch task:', error)
        }
      }
      openTask()
    }
  }, [taskToOpen, lastOpenedTaskId])

  // Sync state when project changes (props update)
  useEffect(() => {
    setSprints(initialSprints)
    setBacklogTasks(initialBacklog)
    setEpics(initialEpics)
    setSelectedTask(null)
    setViewingSprint(null)
    setLastOpenedTaskId(null)
    setFilterEpic(null) // Reset epic filter when switching projects
  }, [projectId, initialSprints, initialBacklog, initialEpics])

  // Search filter function
  const matchesSearch = useCallback((task: Task, query: string): boolean => {
    if (!query.trim()) return true
    
    const searchLower = query.toLowerCase().trim()
    const title = task.title?.toLowerCase() || ''
    const taskKey = task.taskKey?.toLowerCase() || ''
    
    // Extract tags from title
    const tagRegex = /\[([^\]]+)\]/g
    const tags: string[] = []
    let match
    while ((match = tagRegex.exec(task.title || '')) !== null) {
      tags.push(match[1].toLowerCase())
    }
    
    // Search in title, taskKey, and tags
    return title.includes(searchLower) || 
           taskKey.includes(searchLower) || 
           tags.some(tag => tag.includes(searchLower))
  }, [])

  // Combined filter function
  const matchesFilters = useCallback((task: Task): boolean => {
    // Search filter
    if (!matchesSearch(task, searchQuery)) return false
    
    // Priority filter
    if (filterPriority !== 'ALL' && task.priority !== filterPriority) return false
    
    // Assignee filter
    if (filterAssignee !== 'ALL') {
      if (filterAssignee === 'UNASSIGNED') {
        if (task.assigneeId !== null) return false
      } else {
        if (task.assigneeId !== filterAssignee) return false
      }
    }
    
    // Status filter
    if (filterStatus !== 'ALL' && task.status !== filterStatus) return false
    
    // Epic filter
    if (filterEpic !== null) {
      if (filterEpic === 'none') {
        if (task.epicId !== null && task.epicId !== undefined) return false
      } else {
        if (task.epicId !== filterEpic) return false
      }
    }
    
    return true
  }, [searchQuery, filterPriority, filterAssignee, filterStatus, filterEpic, matchesSearch])

  // Categorize sprints
  const uatSprints = sprints.filter(s => s.status === 'UAT')
  const activeSprints = sprints.filter(s => s.status === 'ACTIVE')
  const plannedSprints = sprints.filter(s => s.status === 'PLANNED')
  const closedSprints = sprints.filter(s => s.status === 'COMPLETED')

  // Non-closed sprints for drag-drop (UAT sprints are also visible)
  const visibleSprints = [...uatSprints, ...activeSprints, ...plannedSprints]
  
  // Filter and sort tasks based on search query and filters
  // Sort by order field to ensure correct drag-drop calculations
  const filteredUATSprints = uatSprints.map(sprint => ({
    ...sprint,
    tasks: [...sprint.tasks].sort((a, b) => a.order - b.order).filter(task => matchesFilters(task))
  })).filter(sprint => sprint.tasks.length > 0 || (!searchQuery.trim() && filterPriority === 'ALL' && filterAssignee === 'ALL' && filterStatus === 'ALL'))

  const filteredActiveSprints = activeSprints.map(sprint => ({
    ...sprint,
    tasks: [...sprint.tasks].sort((a, b) => a.order - b.order).filter(task => matchesFilters(task))
  })).filter(sprint => sprint.tasks.length > 0 || (!searchQuery.trim() && filterPriority === 'ALL' && filterAssignee === 'ALL' && filterStatus === 'ALL'))

  const filteredPlannedSprints = plannedSprints.map(sprint => ({
    ...sprint,
    tasks: [...sprint.tasks].sort((a, b) => a.order - b.order).filter(task => matchesFilters(task))
  })).filter(sprint => sprint.tasks.length > 0 || (!searchQuery.trim() && filterPriority === 'ALL' && filterAssignee === 'ALL' && filterStatus === 'ALL'))

  const filteredBacklogTasks = [...backlogTasks].sort((a, b) => a.order - b.order).filter(task => matchesFilters(task))

  // Calculate total tasks (for display)
  const totalTasks = visibleSprints.reduce((sum, s) => sum + s.tasks.length, 0) + backlogTasks.length
  const filteredTotalTasks = filteredUATSprints.reduce((sum, s) => sum + s.tasks.length, 0) +
                             filteredActiveSprints.reduce((sum, s) => sum + s.tasks.length, 0) +
                             filteredPlannedSprints.reduce((sum, s) => sum + s.tasks.length, 0) +
                             filteredBacklogTasks.length

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    const taskId = active.id as string

    // Save original state for potential revert
    originalStateRef.current = {
      sprints: JSON.parse(JSON.stringify(sprints)),
      backlog: JSON.parse(JSON.stringify(backlogTasks)),
    }

    // Search in sprints first
    let task = sprints.flatMap((s) => s.tasks).find((t) => t.id === taskId)

    // If not found, search in backlog
    if (!task) {
      task = backlogTasks.find((t) => t.id === taskId)
    }

    setActiveTask(task || null)
  }, [sprints, backlogTasks])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find source container (sprint or backlog)
    let sourceSprintId: string | null = null
    const sourceSprintIndex = sprints.findIndex((s) => s.tasks.some((t) => t.id === activeId))
    if (sourceSprintIndex !== -1) {
      sourceSprintId = sprints[sourceSprintIndex].id
    }
    const isFromBacklog = backlogTasks.some((t) => t.id === activeId)

    // Find destination container
    let destSprintId: string | null = null
    if (overId === 'backlog-drop-zone') {
      destSprintId = null // Backlog
    } else {
      const destSprint = sprints.find((s) => s.id === overId)
      if (destSprint) {
        destSprintId = destSprint.id
      } else {
        const destSprintByTask = sprints.find((s) => s.tasks.some((t) => t.id === overId))
        if (destSprintByTask) {
          destSprintId = destSprintByTask.id
        } else if (backlogTasks.some((t) => t.id === overId)) {
          destSprintId = null // Moving to backlog
        }
      }
    }

    // Same container, no cross-container move needed
    if ((sourceSprintId === destSprintId) || (isFromBacklog && destSprintId === null)) {
      return
    }

    // Cross-container move (visual only, confirmation comes later)
    if (isFromBacklog && destSprintId) {
      // Moving from backlog to sprint
      const task = backlogTasks.find((t) => t.id === activeId)!
      setBacklogTasks((prev) => prev.filter((t) => t.id !== activeId))
      setSprints((prev) => prev.map((sprint) =>
        sprint.id === destSprintId
          ? { ...sprint, tasks: [...sprint.tasks, { ...task, sprintId: destSprintId }] }
          : sprint
      ))
    } else if (sourceSprintId && destSprintId === null) {
      // Moving from sprint to backlog
      const task = sprints[sourceSprintIndex].tasks.find((t) => t.id === activeId)!
      setSprints((prev) => prev.map((sprint) =>
        sprint.id === sourceSprintId
          ? { ...sprint, tasks: sprint.tasks.filter((t) => t.id !== activeId) }
          : sprint
      ))
      setBacklogTasks((prev) => [...prev, { ...task, sprintId: null }])
    } else if (sourceSprintId && destSprintId && sourceSprintId !== destSprintId) {
      // Moving between sprints
      const task = sprints[sourceSprintIndex].tasks.find((t) => t.id === activeId)!
      setSprints((prev) => prev.map((sprint) => {
        if (sprint.id === sourceSprintId) {
          return { ...sprint, tasks: sprint.tasks.filter((t) => t.id !== activeId) }
        }
        if (sprint.id === destSprintId) {
          return { ...sprint, tasks: [...sprint.tasks, { ...task, sprintId: destSprintId }] }
        }
        return sprint
      }))
    }
  }, [sprints, backlogTasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)

    if (!over) {
      // Revert if dropped outside
      if (originalStateRef.current) {
        setSprints(originalStateRef.current.sprints)
        setBacklogTasks(originalStateRef.current.backlog)
        originalStateRef.current = null
      }
      return
    }

    const activeId = active.id as string
    const overId = over.id as string

    // Find which container the task is in now
    const sprint = sprints.find((s) => s.tasks.some((t) => t.id === activeId))
    const isInBacklog = backlogTasks.some((t) => t.id === activeId)

    // Check if this was a cross-container move
    const original = originalStateRef.current
    if (original) {
      const wasInSprint = original.sprints.some(s => s.tasks.some(t => t.id === activeId))
      const wasInBacklog = original.backlog.some(t => t.id === activeId)
      
      const originalSprint = wasInSprint 
        ? original.sprints.find(s => s.tasks.some(t => t.id === activeId))
        : null
      const originalSprintId = originalSprint?.id || null
      const currentSprintId = sprint?.id || null

      // Cross-container move detected - show confirmation
      if (originalSprintId !== currentSprintId || (wasInBacklog && sprint) || (wasInSprint && isInBacklog)) {
        const task = sprint?.tasks.find(t => t.id === activeId) || backlogTasks.find(t => t.id === activeId)
        if (task) {
          const sourceSprintName = wasInBacklog ? 'Backlog' : originalSprint?.name || 'Unknown'
          const sourceSprintStatus = originalSprint?.status || 'PLANNED'
          const destSprintName = isInBacklog ? 'Backlog' : sprint?.name || 'Unknown'
          
          let newOrder = 0
          if (sprint) {
            newOrder = sprint.tasks.findIndex(t => t.id === overId)
            if (newOrder === -1) newOrder = sprint.tasks.length - 1
          } else if (isInBacklog) {
            newOrder = backlogTasks.findIndex(t => t.id === overId)
            if (newOrder === -1) newOrder = backlogTasks.length - 1
          }

          setPendingMove({
            task,
            sourceSprintId: originalSprintId,
            sourceSprintName,
            sourceSprintStatus,
            destSprintId: currentSprintId,
            destSprintName,
            newOrder,
          })
          return // Wait for confirmation
        }
      }
    }

    // Same container reordering - no confirmation needed
    if (sprint) {
      // Sort tasks by order for accurate position calculations
      const sortedTasks = [...sprint.tasks].sort((a, b) => a.order - b.order)
      const oldIndex = sortedTasks.findIndex((t) => t.id === activeId)
      let newIndex = sortedTasks.findIndex((t) => t.id === overId)

      if (newIndex === -1) {
        newIndex = sortedTasks.length - 1
      }

      if (oldIndex !== newIndex) {
        // Get the actual order value from the target position
        const targetOrder = sortedTasks[newIndex]?.order ?? newIndex

        // Optimistic update for immediate visual feedback
        setSprints((prev) => {
          const sprintIdx = prev.findIndex((s) => s.id === sprint.id)
          const sprintSortedTasks = [...prev[sprintIdx].tasks].sort((a, b) => a.order - b.order)
          const movedTasks = arrayMove(sprintSortedTasks, oldIndex, newIndex)
          const newTasks = movedTasks.map((task, idx) => ({ ...task, order: idx }))
          const newSprints = [...prev]
          newSprints[sprintIdx] = { ...newSprints[sprintIdx], tasks: newTasks }
          return newSprints
        })

        // Persist to server and sync with actual DB values
        try {
          const response = await fetch('/api/tasks/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: activeId,
              targetSprintId: sprint.id,
              newOrder: targetOrder,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            // Update with actual tasks from database to keep order values in sync
            if (result.targetTasks) {
              setSprints((prev) => prev.map((s) =>
                s.id === result.targetSprintId
                  ? { ...s, tasks: result.targetTasks }
                  : s
              ))
            }
          }
        } catch (error) {
          console.error('Failed to reorder task:', error)
        }
      }
    } else if (isInBacklog) {
      // Sort backlog tasks by order for accurate position calculations
      const sortedBacklog = [...backlogTasks].sort((a, b) => a.order - b.order)
      const oldIndex = sortedBacklog.findIndex((t) => t.id === activeId)
      let newIndex = sortedBacklog.findIndex((t) => t.id === overId)

      if (newIndex === -1) {
        newIndex = sortedBacklog.length - 1
      }

      if (oldIndex !== newIndex) {
        // Get the actual order value from the target position
        const targetOrder = sortedBacklog[newIndex]?.order ?? newIndex

        // Optimistic update for immediate visual feedback
        setBacklogTasks((prev) => {
          const sortedPrev = [...prev].sort((a, b) => a.order - b.order)
          const movedTasks = arrayMove(sortedPrev, oldIndex, newIndex)
          return movedTasks.map((task, idx) => ({ ...task, order: idx }))
        })

        // Persist to server and sync with actual DB values
        try {
          const response = await fetch('/api/tasks/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: activeId,
              targetSprintId: null,
              newOrder: targetOrder,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            // Update with actual tasks from database to keep order values in sync
            if (result.targetTasks) {
              setBacklogTasks(result.targetTasks)
            }
          }
        } catch (error) {
          console.error('Failed to reorder task:', error)
        }
      }
    }

    originalStateRef.current = null
  }, [sprints, backlogTasks])

  const confirmMove = useCallback(async () => {
    if (!pendingMove) return

    // Persist to server
    try {
      await fetch('/api/tasks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: pendingMove.task.id,
          targetSprintId: pendingMove.destSprintId,
          newOrder: pendingMove.newOrder,
        }),
      })
    } catch (error) {
      console.error('Failed to move task:', error)
      // Revert on error
      if (originalStateRef.current) {
        setSprints(originalStateRef.current.sprints)
        setBacklogTasks(originalStateRef.current.backlog)
      }
    }

    originalStateRef.current = null
    setPendingMove(null)
  }, [pendingMove])

  const confirmSplit = useCallback(async () => {
    if (!pendingMove) return

    try {
      // Split the task - creates a new task in the destination, keeps original in source
      const res = await fetch(`/api/tasks/${pendingMove.task.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSprintId: pendingMove.destSprintId,
        }),
      })
      
      if (res.ok) {
        const newTask = await res.json()
        
        // Revert the visual move (task stays in original sprint)
        if (originalStateRef.current) {
          setSprints(originalStateRef.current.sprints)
          setBacklogTasks(originalStateRef.current.backlog)
        }
        
        // Add the new split task to the destination
        if (newTask.sprintId) {
          setSprints(prev => prev.map(sprint => {
            // Update the original task to show it has split tasks
            if (sprint.id === pendingMove.sourceSprintId) {
              return {
                ...sprint,
                tasks: sprint.tasks.map(t => 
                  t.id === pendingMove.task.id 
                    ? { ...t, splitTasks: [...(t.splitTasks || []), { id: newTask.id, title: newTask.title, status: newTask.status, createdAt: newTask.createdAt }] }
                    : t
                )
              }
            }
            // Add the new task to destination sprint
            if (sprint.id === newTask.sprintId) {
              return { ...sprint, tasks: [...sprint.tasks, newTask] }
            }
            return sprint
          }))
        } else {
          // Update original task
          setSprints(prev => prev.map(sprint => {
            if (sprint.id === pendingMove.sourceSprintId) {
              return {
                ...sprint,
                tasks: sprint.tasks.map(t => 
                  t.id === pendingMove.task.id 
                    ? { ...t, splitTasks: [...(t.splitTasks || []), { id: newTask.id, title: newTask.title, status: newTask.status, createdAt: newTask.createdAt }] }
                    : t
                )
              }
            }
            return sprint
          }))
          setBacklogTasks(prev => [...prev, newTask])
        }
      }
    } catch (error) {
      console.error('Failed to split task:', error)
      // Revert on error
      if (originalStateRef.current) {
        setSprints(originalStateRef.current.sprints)
        setBacklogTasks(originalStateRef.current.backlog)
      }
    }

    originalStateRef.current = null
    setPendingMove(null)
  }, [pendingMove])

  const cancelMove = useCallback(() => {
    // Revert to original state
    if (originalStateRef.current) {
      setSprints(originalStateRef.current.sprints)
      setBacklogTasks(originalStateRef.current.backlog)
      originalStateRef.current = null
    }
    setPendingMove(null)
  }, [])

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

  const handleTaskUpdate = useCallback((updatedTask: Task) => {
    // Check if sprint changed
    const wasInSprint = sprints.some(s => s.tasks.some(t => t.id === updatedTask.id))
    const wasInBacklog = backlogTasks.some(t => t.id === updatedTask.id)

    if (updatedTask.sprintId) {
      // Task should be in a sprint
      if (wasInBacklog) {
        // Move from backlog to sprint
        setBacklogTasks(prev => prev.filter(t => t.id !== updatedTask.id))
        setSprints(prev => prev.map(sprint =>
          sprint.id === updatedTask.sprintId
            ? { ...sprint, tasks: [...sprint.tasks, updatedTask] }
            : sprint
        ))
      } else {
        // Update in sprints (possibly move between sprints)
        setSprints(prev => {
          const oldSprint = prev.find(s => s.tasks.some(t => t.id === updatedTask.id))
          if (oldSprint && oldSprint.id !== updatedTask.sprintId) {
            // Move between sprints
            return prev.map(sprint => {
              if (sprint.id === oldSprint.id) {
                return { ...sprint, tasks: sprint.tasks.filter(t => t.id !== updatedTask.id) }
              }
              if (sprint.id === updatedTask.sprintId) {
                return { ...sprint, tasks: [...sprint.tasks, updatedTask] }
              }
              return sprint
            })
          }
          // Update in place
          return prev.map(sprint => ({
            ...sprint,
            tasks: sprint.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
          }))
        })
      }
    } else {
      // Task should be in backlog
      if (wasInSprint) {
        // Move from sprint to backlog
        setSprints(prev => prev.map(sprint => ({
          ...sprint,
          tasks: sprint.tasks.filter(t => t.id !== updatedTask.id),
        })))
        setBacklogTasks(prev => [...prev, updatedTask])
      } else {
        // Update in backlog
        setBacklogTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t))
      }
    }
    setSelectedTask(updatedTask)
  }, [sprints, backlogTasks])

  const handleTaskDelete = useCallback((taskId: string) => {
    setSprints(prev => prev.map(sprint => ({
      ...sprint,
      tasks: sprint.tasks.filter(t => t.id !== taskId),
    })))
    setBacklogTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(null)
    // Clear task parameter from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('task')
    window.history.pushState({}, '', url.toString())
  }, [])

  const handleTaskSplit = useCallback((newTask: Task) => {
    if (newTask.sprintId) {
      setSprints(prev => prev.map(sprint =>
        sprint.id === newTask.sprintId
          ? { ...sprint, tasks: [...sprint.tasks, newTask].sort((a, b) => a.order - b.order) }
          : sprint
      ))
    } else {
      setBacklogTasks(prev => [...prev, newTask])
    }
  }, [])

  const handleCreateTask = useCallback((newTask: Task) => {
    if (newTask.sprintId) {
      setSprints(prev => prev.map(sprint =>
        sprint.id === newTask.sprintId
          ? { ...sprint, tasks: [...sprint.tasks, newTask] }
          : sprint
      ))
    } else {
      setBacklogTasks(prev => [...prev, newTask])
    }
  }, [])

  const handleCreateSprint = useCallback((newSprint: Sprint) => {
    setSprints(prev => [...prev, newSprint])
    setShowCreateSprint(false)
  }, [])

  const handleSprintStatusChange = useCallback((sprintId: string, newStatus: string) => {
    setSprints(prev => prev.map(sprint =>
      sprint.id === sprintId ? { ...sprint, status: newStatus as any } : sprint
    ))
  }, [])

  const handleSprintUpdate = useCallback((updatedSprint: Sprint) => {
    setSprints(prev => prev.map(sprint =>
      sprint.id === updatedSprint.id ? { ...sprint, ...updatedSprint } : sprint
    ))
  }, [])

  // Check if dragging from active sprint
  const isFromActiveSprint = pendingMove?.sourceSprintStatus === 'ACTIVE'

  // Keep viewingSprint in sync with sprints state
  const currentViewingSprint = viewingSprint 
    ? sprints.find(s => s.id === viewingSprint.id) || viewingSprint 
    : null

  // Handle sprint reactivation (admin only)
  const handleSprintReactivate = async (sprintId: string) => {
    try {
      const res = await fetch(`/api/sprints/${sprintId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })
      if (res.ok) {
        const updatedSprint = await res.json()
        setSprints(prev => prev.map(s => s.id === sprintId ? updatedSprint : s))
        // If currently viewing this sprint, update the view
        if (viewingSprint?.id === sprintId) {
          setViewingSprint(updatedSprint)
        }
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to reactivate sprint')
      }
    } catch (error) {
      console.error('Failed to reactivate sprint:', error)
    }
  }

  return (
    <AppLayout
      activeSprint={activeSprints[0] || null}
      completedSprints={closedSprints}
      selectedSprint={viewingSprint}
      onSprintSelect={setViewingSprint}
      currentUser={currentUser}
      onSprintReactivate={handleSprintReactivate}
      currentView={viewingTimeline ? 'epics' : 'backlog'}
      onViewChange={(view) => {
        if (view === 'reports') {
          onNavigateToReports?.()
        } else if (view === 'epics') {
          setViewingTimeline(true)
        } else {
          setViewingTimeline(false)
        }
      }}
    >
      <div className="flex h-full">
        {/* Epic Panel - Timeline view */}
        {viewingTimeline && (
          <div className="flex-1">
            <EpicTimeline
              epics={epics}
              sprints={sprints}
              onBack={() => setViewingTimeline(false)}
              onTaskClick={(task) => {
                // Stay in timeline, just open the detail sidebar
                setSelectedTask(task)
              }}
              onEpicClick={(epicId) => {
                setViewingTimeline(false)
                setFilterEpic(epicId)
              }}
            />
          </div>
        )}

        {/* Epic Panel - Sidebar (always visible) */}
        {!viewingTimeline && !currentViewingSprint && (
          <EpicPanel
            epics={epics}
            selectedEpicId={filterEpic}
            onSelectEpic={setFilterEpic}
            onEpicCreated={(epic) => setEpics(prev => [...prev, epic])}
            onEpicUpdated={(epic) => setEpics(prev => prev.map(e => e.id === epic.id ? epic : e))}
            onEpicDeleted={(epicId) => setEpics(prev => prev.filter(e => e.id !== epicId))}
            onViewTimeline={() => setViewingTimeline(true)}
            projectId={projectId}
          />
        )}

        {/* Main content area */}
        {!viewingTimeline && (
        <div className="flex-1 min-w-0 h-full">
          {/* Show sprint view or main backlog */}
          {currentViewingSprint ? (
            <SprintView
              sprint={currentViewingSprint}
              users={users}
              allSprints={sprints}
              epics={epics}
              currentUser={currentUser}
              projectId={projectId}
              onBack={() => setViewingSprint(null)}
              onTaskUpdate={handleTaskUpdate}
              onTaskCreate={handleCreateTask}
              onTaskDelete={handleTaskDelete}
              onOpenDocument={onOpenDocument}
            />
          ) : (
          <ScrollArea className="h-full">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold">Backlog</h1>
                <p className="text-sm text-muted-foreground">
                  {(searchQuery.trim() || filterPriority !== 'ALL' || filterAssignee !== 'ALL' || filterStatus !== 'ALL') ? (
                    <>
                      {filteredTotalTasks} of {totalTasks} tasks
                      {filteredTotalTasks !== totalTasks && ' matching filters'}
                    </>
                  ) : (
                    <>
                      {totalTasks} tasks across {visibleSprints.length} sprints + backlog
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Row Height Selector */}
                <div className="flex items-center gap-1 border rounded-md p-0.5 bg-muted/30">
                  <Button
                    type="button"
                    variant={rowHeight === 'compact' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRowHeight('compact')
                    }}
                    title="Compact"
                  >
                    Compact
                  </Button>
                  <Button
                    type="button"
                    variant={rowHeight === 'normal' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRowHeight('normal')
                    }}
                    title="Normal"
                  >
                    Normal
                  </Button>
                  <Button
                    type="button"
                    variant={rowHeight === 'comfortable' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      setRowHeight('comfortable')
                    }}
                    title="Comfortable"
                  >
                    Comfortable
                  </Button>
                </div>
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCreateSprint(true)
                  }}
                >
                  + New Sprint
                </Button>
              </div>
            </div>
            
            {/* Search Bar and Filters */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Input
                    type="text"
                    placeholder="Search tasks by title, key, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4"
                  />
                  <svg 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      type="button"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                
                {/* Filters */}
                <Select value={filterPriority} onValueChange={(value) => setFilterPriority(value as Priority | 'ALL')}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Priorities</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LOW">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterAssignee} onValueChange={(value) => setFilterAssignee(value)}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Assignees</SelectItem>
                    <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as TaskStatus | 'ALL')}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="TODO">Todo</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="READY_TO_TEST">Ready to Test</SelectItem>
                    <SelectItem value="BLOCKED">Blocked</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                    <SelectItem value="LIVE">Live</SelectItem>
                  </SelectContent>
                </Select>

                {(filterPriority !== 'ALL' || filterAssignee !== 'ALL' || filterStatus !== 'ALL' || filterEpic !== null || searchQuery.trim()) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('')
                      setFilterPriority('ALL')
                      setFilterAssignee('ALL')
                      setFilterStatus('ALL')
                      setFilterEpic(null)
                    }}
                    className="h-9 text-xs"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {/* UAT Sprints - at the top, collapsed by default */}
            {filteredUATSprints.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    UAT Sprints
                  </h2>
                  <Badge variant="default" className="bg-blue-500">
                    {filteredUATSprints.length}
                  </Badge>
                </div>
                {filteredUATSprints.map((sprint) => (
                  <UATSprintSection
                    key={sprint.id}
                    sprint={sprint}
                    users={users}
                    epics={epics}
                    allSprints={sprints}
                    availableSprints={filteredPlannedSprints}
                    projectId={projectId}
                    onTaskClick={handleTaskClick}
                    onCreateTask={handleCreateTask}
                    onTaskUpdate={handleTaskUpdate}
                    selectedTaskId={selectedTask?.id}
                    onStatusChange={handleSprintStatusChange}
                    onSprintUpdate={handleSprintUpdate}
                    onSprintComplete={(completedSprint) => {
                      setSprints(prev => prev.map(s =>
                        s.id === completedSprint.id ? completedSprint : s
                      ))
                    }}
                    onOpenInDedicatedView={setViewingSprint}
                  />
                ))}
              </div>
            )}

            {/* Active Sprints */}
            {filteredActiveSprints.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Active Sprint
                  </h2>
                  <Badge variant="default" className="bg-green-500">
                    {filteredActiveSprints.length}
                  </Badge>
                </div>
                {filteredActiveSprints.map((sprint) => (
                  <SprintSection
                    key={sprint.id}
                    sprint={sprint}
                    users={users}
                    epics={epics}
                    allSprints={sprints}
                    availableSprints={filteredPlannedSprints}
                    projectId={projectId}
                    onTaskClick={handleTaskClick}
                    onCreateTask={handleCreateTask}
                    onTaskUpdate={handleTaskUpdate}
                    selectedTaskId={selectedTask?.id}
                    onStatusChange={handleSprintStatusChange}
                    onSprintUpdate={handleSprintUpdate}
                    onSprintComplete={(completedSprint) => {
                      setSprints(prev => prev.map(s =>
                        s.id === completedSprint.id ? completedSprint : s
                      ))
                    }}
                    onSprintUAT={(uatSprint) => {
                      setSprints(prev => prev.map(s =>
                        s.id === uatSprint.id ? uatSprint : s
                      ))
                    }}
                    onOpenInDedicatedView={setViewingSprint}
                    variant="active"
                  />
                ))}
              </div>
            )}

            {/* Planned/Future Sprints */}
            {filteredPlannedSprints.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Upcoming Sprints
                  </h2>
                  <Badge variant="secondary">
                    {filteredPlannedSprints.length}
                  </Badge>
                </div>
                {filteredPlannedSprints.map((sprint) => (
                  <SprintSection
                    key={sprint.id}
                    sprint={sprint}
                    users={users}
                    epics={epics}
                    allSprints={sprints}
                    availableSprints={filteredPlannedSprints.filter(s => s.id !== sprint.id)}
                    projectId={projectId}
                    onTaskClick={handleTaskClick}
                    onCreateTask={handleCreateTask}
                    onTaskUpdate={handleTaskUpdate}
                    selectedTaskId={selectedTask?.id}
                    onStatusChange={handleSprintStatusChange}
                    onSprintUpdate={handleSprintUpdate}
                    onOpenInDedicatedView={setViewingSprint}
                    variant="planned"
                  />
                ))}
              </div>
            )}

            {/* Backlog Section */}
            {(filteredBacklogTasks.length > 0 || !searchQuery.trim()) && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Backlog
                  </h2>
                  <Badge variant="outline">
                    {searchQuery.trim() ? filteredBacklogTasks.length : backlogTasks.length}
                  </Badge>
                </div>
                <BacklogSection
                  tasks={filteredBacklogTasks}
                  users={users}
                  epics={epics}
                  sprints={sprints}
                  projectId={projectId}
                  onTaskClick={handleTaskClick}
                  onCreateTask={handleCreateTask}
                  onTaskUpdate={handleTaskUpdate}
                  selectedTaskId={selectedTask?.id}
                />
              </div>
            )}
            
            {/* No Search Results */}
            {(searchQuery.trim() || filterPriority !== 'ALL' || filterAssignee !== 'ALL' || filterStatus !== 'ALL') &&
             filteredUATSprints.length === 0 && filteredActiveSprints.length === 0 && filteredPlannedSprints.length === 0 && filteredBacklogTasks.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-2">
                  No tasks found matching your filters
                </p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filter criteria
                </p>
              </div>
            )}

            {/* Empty State */}
            {visibleSprints.length === 0 && backlogTasks.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-4">
                  No sprints or tasks yet. Create your first sprint or add tasks to the backlog.
                </p>
                <Button onClick={() => setShowCreateSprint(true)}>
                  Create Sprint
                </Button>
              </div>
            )}

            <DragOverlay>
              {activeTask && (
                <div className="bg-background shadow-lg rounded-md border px-3 py-1.5 text-sm">
                  {activeTask.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </ScrollArea>
          )}
        </div>
        )}

        {/* Task detail sidebar - inline next to content */}
        {/* Only show BacklogView's sidebar when NOT viewing a sprint (SprintView has its own) */}
        {selectedTask && !currentViewingSprint && (
          <TaskDetailSidebar
            task={selectedTask}
            users={users}
            sprints={sprints}
            epics={epics}
            currentUserId={currentUser?.id}
            currentUserRole={currentUser?.role}
            projectId={projectId}
            onClose={handleTaskClose}
            onUpdate={handleTaskUpdate}
            onDelete={handleTaskDelete}
            onSplit={handleTaskSplit}
            onTaskSelect={async (taskId) => {
              // Fetch the task and select it
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
          />
        )}
      </div>

      {/* Move/Split confirmation dialog */}
      <Dialog open={!!pendingMove} onOpenChange={() => cancelMove()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isFromActiveSprint ? 'Move or Split Task?' : 'Move Task'}
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              {isFromActiveSprint ? (
                <p>This task is from an <strong>active sprint</strong>. Would you like to move it completely or split it to continue in the next sprint?</p>
              ) : (
                <p>Are you sure you want to move this task?</p>
              )}
              <div className="bg-muted p-3 rounded-md mt-2">
                <p className="font-medium text-foreground">{pendingMove?.task.title}</p>
              </div>
              <div className="flex items-center gap-2 text-sm mt-3">
                <span className="text-muted-foreground">From:</span>
                <Badge variant={isFromActiveSprint ? "default" : "outline"} className={isFromActiveSprint ? "bg-green-500" : ""}>
                  {pendingMove?.sourceSprintName}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">To:</span>
                <Badge variant="secondary">{pendingMove?.destSprintName}</Badge>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={cancelMove}>
              Cancel
            </Button>
            {isFromActiveSprint && (
              <Button variant="secondary" onClick={confirmSplit}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Split Task
              </Button>
            )}
            <Button onClick={confirmMove}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Move Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create sprint modal */}
      {showCreateSprint && (
        <CreateSprintModal
          projectId={projectId}
          existingSprintsCount={sprints.length}
          onClose={() => setShowCreateSprint(false)}
          onCreate={handleCreateSprint}
        />
      )}
    </AppLayout>
  )
}
