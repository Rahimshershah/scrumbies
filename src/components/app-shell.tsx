'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/header'
import { BacklogView } from '@/components/backlog/backlog-view'
import { SpacesView } from '@/components/spaces'
import { ProjectRequired } from '@/components/project-required'
import { ProjectSettingsProvider } from '@/contexts/project-settings-context'
import { Project, Sprint, Task } from '@/types'

export type AppView = 'backlog' | 'spaces'

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
  users: { id: string; name: string; avatarUrl?: string | null }[]
  unreadCount: number
}

export function AppShell({
  user: initialUser,
  initialProjects,
  initialProjectId,
  initialSprints,
  initialBacklog,
  users: initialUsers,
  unreadCount,
}: AppShellProps) {
  const [user, setUser] = useState(initialUser)
  const [users, setUsers] = useState(initialUsers)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(initialProjectId)
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints)
  const [backlogTasks, setBacklogTasks] = useState<Task[]>(initialBacklog)
  const [loading, setLoading] = useState(false)
  const [currentView, setCurrentView] = useState<AppView>('backlog')
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)

  // Restore view from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem('scrumbies_current_view') as AppView | null
    if (savedView && (savedView === 'backlog' || savedView === 'spaces')) {
      setCurrentView(savedView)
    }
  }, [])

  // Persist view changes to localStorage
  const handleViewChange = useCallback((view: AppView) => {
    setCurrentView(view)
    localStorage.setItem('scrumbies_current_view', view)
  }, [])

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
      const [sprintsRes, backlogRes] = await Promise.all([
        fetch(`/api/sprints?projectId=${projectId}`),
        fetch(`/api/tasks?projectId=${projectId}&backlog=true`),
      ])

      if (sprintsRes.ok && backlogRes.ok) {
        const sprintsData = await sprintsRes.json()
        const backlogData = await backlogRes.json()
        setSprints(sprintsData)
        setBacklogTasks(backlogData)
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

  // Handle new project creation from header
  const handleProjectCreated = useCallback((newProject: Project) => {
    setProjects(prev => [...prev, newProject])
    handleProjectChange(newProject.id)
  }, [handleProjectChange])

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
        {currentView === 'backlog' ? (
          <BacklogView
            initialSprints={sprints}
            initialBacklog={backlogTasks}
            users={users}
            currentUser={user}
            projectId={effectiveProjectId}
            onOpenDocument={handleOpenDocument}
          />
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
    </ProjectSettingsProvider>
  )
}

