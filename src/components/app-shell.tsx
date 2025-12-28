'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Header } from '@/components/header'
import { BacklogView } from '@/components/backlog/backlog-view'
import { SpacesView } from '@/components/spaces'
import { ReportsView } from '@/components/reports/reports-view'
import { AppLayout } from '@/components/layout/app-layout'
import { ProjectRequired } from '@/components/project-required'
import { ProjectSettingsProvider } from '@/contexts/project-settings-context'
import { RowHeightProvider } from '@/contexts/row-height-context'
import { Project, Sprint, Task, Epic } from '@/types'

export type AppView = 'backlog' | 'epics' | 'reports' | 'spaces'

interface AppShellProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    avatarUrl?: string | null
  }
  initialProjects: Project[]
  initialProjectId: string | null
  initialSprints: Sprint[]
  initialBacklog: Task[]
  initialEpics?: Epic[]
  users: { id: string; name: string; avatarUrl?: string | null }[]
  unreadCount: number
}

export function AppShell({
  user: initialUser,
  initialProjects,
  initialProjectId,
  initialSprints,
  initialBacklog,
  initialEpics = [],
  users: initialUsers,
  unreadCount: initialUnreadCount,
}: AppShellProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [user, setUser] = useState(initialUser)
  const [users, setUsers] = useState(initialUsers)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId)
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints)
  const [backlogTasks, setBacklogTasks] = useState<Task[]>(initialBacklog)
  const [epics, setEpics] = useState<Epic[]>(initialEpics)
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [currentView, setCurrentView] = useState<AppView>('backlog')
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)
  const [taskToOpen, setTaskToOpen] = useState<string | null>(null)

  // Restore view from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem('scrumbies_current_view') as AppView | null
    if (savedView && (savedView === 'backlog' || savedView === 'epics' || savedView === 'reports' || savedView === 'spaces')) {
      setCurrentView(savedView)
    }
  }, [])

  // Persist view changes to localStorage
  const handleViewChange = useCallback((view: AppView) => {
    setCurrentView(view)
    localStorage.setItem('scrumbies_current_view', view)
  }, [])

  // Check for task query parameter on mount
  useEffect(() => {
    const taskParam = searchParams?.get('task')
    if (taskParam) {
      setTaskToOpen(taskParam)
      handleViewChange('backlog')
      // Don't clear the URL - keep the task parameter so users can see which task they're viewing
      // BacklogView uses lastOpenedTaskId to prevent duplicate processing, so no need to clear taskToOpen
    }
  }, [searchParams, handleViewChange])

  // Handle opening a document from task sidebar
  const handleOpenDocument = useCallback((documentId: string) => {
    setPendingDocumentId(documentId)
    handleViewChange('spaces')
  }, [handleViewChange])

  // Clear pending document after SpacesView handles it
  const handleDocumentOpened = useCallback(() => {
    setPendingDocumentId(null)
  }, [])

  // Handle user profile update
  const handleUserUpdate = useCallback((updatedUser: { name: string; email: string; avatarUrl?: string | null }) => {
    setUser(prev => ({ ...prev, ...updatedUser }))
    // Also update the users list
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, name: updatedUser.name, avatarUrl: updatedUser.avatarUrl } : u))
  }, [user.id])

  // Fetch data when project changes
  const fetchProjectData = useCallback(async (projectId: string) => {
    setLoading(true)
    try {
      const [sprintsRes, backlogRes, epicsRes] = await Promise.all([
        fetch(`/api/sprints?projectId=${projectId}`),
        fetch(`/api/tasks?projectId=${projectId}&backlog=true`),
        fetch(`/api/epics?projectId=${projectId}`),
      ])

      if (sprintsRes.ok && backlogRes.ok) {
        const sprintsData = await sprintsRes.json()
        const backlogData = await backlogRes.json()
        setSprints(sprintsData)
        setBacklogTasks(backlogData)
      }
      
      if (epicsRes.ok) {
        const epicsData = await epicsRes.json()
        setEpics(epicsData)
      }
    } catch (error) {
      console.error('Failed to fetch project data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Handle project change
  const handleProjectChange = useCallback(async (projectId: string) => {
    if (projectId === currentProjectId) return
    
    setCurrentProjectId(projectId)
    
    // Store in localStorage for persistence
    localStorage.setItem('scrumbies_current_project', projectId)
    
    // Fetch new project data
    await fetchProjectData(projectId)
  }, [currentProjectId, fetchProjectData])

  // Restore project from localStorage on mount
  useEffect(() => {
    const savedProjectId = localStorage.getItem('scrumbies_current_project')
    if (savedProjectId && projects.some(p => p.id === savedProjectId) && savedProjectId !== currentProjectId) {
      handleProjectChange(savedProjectId)
    }
  }, []) // Only run on mount

  // Fetch epics on initial load for current project
  useEffect(() => {
    async function fetchEpics() {
      if (!currentProjectId) return
      try {
        const res = await fetch(`/api/epics?projectId=${currentProjectId}`)
        if (res.ok) {
          const data = await res.json()
          setEpics(data)
        }
      } catch (error) {
        console.error('Failed to fetch epics:', error)
      }
    }
    fetchEpics()
  }, [currentProjectId])

  // Handle new project creation from header
  const handleProjectCreated = useCallback((newProject: Project) => {
    setProjects(prev => [...prev, newProject])
    handleProjectChange(newProject.id)
  }, [handleProjectChange])

  // Handle task selection from notifications
  const handleTaskSelect = useCallback((taskId: string) => {
    setTaskToOpen(taskId)
    handleViewChange('backlog')
    // Clear after a short delay to allow BacklogView to process it
    setTimeout(() => setTaskToOpen(null), 100)
  }, [handleViewChange])

  // Refresh unread count
  const handleUnreadCountChange = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const notifications = await res.json()
        const unread = notifications.filter((n: { read: boolean }) => !n.read).length
        setUnreadCount(unread)
      }
    } catch (error) {
      console.error('Failed to refresh unread count:', error)
    }
  }, [])

  // Refresh unread count on mount and periodically
  useEffect(() => {
    handleUnreadCountChange()
    const interval = setInterval(handleUnreadCountChange, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [handleUnreadCountChange])

  // If no projects, show create project screen
  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header
          user={user}
          unreadCount={unreadCount}
          projects={projects}
          currentProjectId={currentProjectId || undefined}
          onProjectChange={handleProjectChange}
          onUserUpdate={handleUserUpdate}
          currentView={currentView}
          onViewChange={handleViewChange}
          onTaskSelect={handleTaskSelect}
          onUnreadCountChange={handleUnreadCountChange}
        />
        <div className="flex-1">
          <ProjectRequired user={user} />
        </div>
      </div>
    )
  }

  const effectiveProjectId = currentProjectId || projects[0]?.id

  return (
    <ProjectSettingsProvider projectId={effectiveProjectId}>
      <RowHeightProvider>
        <div className="min-h-screen bg-background flex flex-col">
        <Header
          user={user}
          unreadCount={unreadCount}
          projects={projects}
          currentProjectId={effectiveProjectId}
          onProjectChange={handleProjectChange}
          onUserUpdate={handleUserUpdate}
          currentView={currentView}
          onViewChange={handleViewChange}
          onTaskSelect={handleTaskSelect}
          onUnreadCountChange={handleUnreadCountChange}
        />
        <div className="flex-1 relative overflow-hidden">
          {loading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm text-muted-foreground">Loading project...</span>
            </div>
          </div>
        )}
        {currentView === 'backlog' || currentView === 'epics' ? (
          <BacklogView
            initialSprints={sprints}
            initialBacklog={backlogTasks}
            initialEpics={epics}
            users={users}
            currentUser={user}
            projectId={effectiveProjectId}
            onOpenDocument={handleOpenDocument}
            taskToOpen={taskToOpen}
            onNavigateToReports={() => handleViewChange('reports')}
          />
        ) : currentView === 'reports' ? (
          <AppLayout
            currentView="reports"
            onViewChange={handleViewChange}
            completedSprints={sprints.filter(s => s.status === 'COMPLETED')}
            onSprintSelect={() => {}}
          >
            <ReportsView
              projectId={effectiveProjectId}
              sprints={sprints}
              epics={epics}
            />
          </AppLayout>
        ) : (
          <SpacesView
            projectId={effectiveProjectId}
            currentUser={user}
            initialDocumentId={pendingDocumentId}
            onDocumentOpened={handleDocumentOpened}
          />
          )}
        </div>
      </div>
      </RowHeightProvider>
    </ProjectSettingsProvider>
  )
}

