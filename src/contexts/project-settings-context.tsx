'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'

export interface ProjectStatus {
  id: string
  name: string
  key: string
  color: string
  bgColor: string
  icon?: string | null
  order: number
  isDefault: boolean
  isFinal: boolean
}

export interface ProjectTeam {
  id: string
  name: string
  key: string
  color: string
  bgColor: string
  icon?: string | null
  order: number
  isDefault: boolean
}

interface ProjectSettingsContextType {
  statuses: ProjectStatus[]
  teams: ProjectTeam[]
  loading: boolean
  error: string | null
  refreshSettings: () => Promise<void>
  getStatusConfig: (key: string) => { label: string; color: string; bgColor: string }
  getTeamConfig: (key: string) => { label: string; shortLabel: string; color: string; bgColor: string }
}

const ProjectSettingsContext = createContext<ProjectSettingsContextType | null>(null)

// Default fallbacks if settings can't be loaded
const DEFAULT_STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  'TODO': { label: 'To Do', color: '#475569', bgColor: '#f1f5f9' },
  'IN_PROGRESS': { label: 'In Progress', color: '#1d4ed8', bgColor: '#dbeafe' },
  'READY_TO_TEST': { label: 'Ready to Test', color: '#d97706', bgColor: '#fef3c7' },
  'BLOCKED': { label: 'Blocked', color: '#dc2626', bgColor: '#fee2e2' },
  'DONE': { label: 'Done', color: '#16a34a', bgColor: '#dcfce7' },
  'LIVE': { label: 'Live', color: '#9333ea', bgColor: '#f3e8ff' },
}

const DEFAULT_TEAM_CONFIG: Record<string, { label: string; shortLabel: string; color: string; bgColor: string }> = {
  'WEB': { label: 'Web', shortLabel: 'WEB', color: '#2563eb', bgColor: '#dbeafe' },
  'MOBILE': { label: 'Mobile', shortLabel: 'MOBILE', color: '#7c3aed', bgColor: '#ede9fe' },
  'OPS': { label: 'Operations', shortLabel: 'OPS', color: '#059669', bgColor: '#d1fae5' },
  'OPERATIONS': { label: 'Operations', shortLabel: 'OPS', color: '#059669', bgColor: '#d1fae5' },
}

export function ProjectSettingsProvider({ 
  children, 
  projectId 
}: { 
  children: ReactNode
  projectId: string | null
}) {
  const [statuses, setStatuses] = useState<ProjectStatus[]>([])
  const [teams, setTeams] = useState<ProjectTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${projectId}/settings`)
      if (res.ok) {
        const data = await res.json()
        setStatuses(data.statuses || [])
        setTeams(data.teams || [])
      } else {
        setError('Failed to load settings')
      }
    } catch (err) {
      console.error('Failed to fetch project settings:', err)
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const getStatusConfig = useCallback((key: string) => {
    const status = statuses.find(s => s.key === key)
    if (status) {
      return {
        label: status.name,
        color: status.color,
        bgColor: status.bgColor,
      }
    }
    return DEFAULT_STATUS_CONFIG[key] || { label: key.replace(/_/g, ' '), color: '#475569', bgColor: '#f1f5f9' }
  }, [statuses])

  const getTeamConfig = useCallback((key: string) => {
    const team = teams.find(t => t.key === key)
    if (team) {
      return {
        label: team.name,
        shortLabel: team.key,
        color: team.color,
        bgColor: team.bgColor,
      }
    }
    return DEFAULT_TEAM_CONFIG[key] || { label: key, shortLabel: key, color: '#475569', bgColor: '#f1f5f9' }
  }, [teams])

  return (
    <ProjectSettingsContext.Provider value={{
      statuses,
      teams,
      loading,
      error,
      refreshSettings: fetchSettings,
      getStatusConfig,
      getTeamConfig,
    }}>
      {children}
    </ProjectSettingsContext.Provider>
  )
}

export function useProjectSettings() {
  const context = useContext(ProjectSettingsContext)
  if (!context) {
    throw new Error('useProjectSettings must be used within a ProjectSettingsProvider')
  }
  return context
}






