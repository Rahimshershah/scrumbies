'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name: string
  key: string
  logoUrl: string | null
}

interface StatusSetting {
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

interface TeamSetting {
  id: string
  name: string
  key: string
  color: string
  bgColor: string
  icon?: string | null
  order: number
  isDefault: boolean
}

const COLOR_PRESETS = [
  { color: '#475569', bg: '#f1f5f9', label: 'Gray' },
  { color: '#1d4ed8', bg: '#dbeafe', label: 'Blue' },
  { color: '#7c3aed', bg: '#ede9fe', label: 'Purple' },
  { color: '#059669', bg: '#d1fae5', label: 'Green' },
  { color: '#d97706', bg: '#fef3c7', label: 'Amber' },
  { color: '#dc2626', bg: '#fee2e2', label: 'Red' },
  { color: '#0891b2', bg: '#cffafe', label: 'Cyan' },
  { color: '#be185d', bg: '#fce7f3', label: 'Pink' },
]

export default function AdminSettingsPage() {
  const [projectId, setProjectId] = useState<string>('')
  const [statuses, setStatuses] = useState<StatusSetting[]>([])
  const [teams, setTeams] = useState<TeamSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Project editing state
  const [projects, setProjects] = useState<Project[]>([])
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editProjectName, setEditProjectName] = useState('')
  const [editProjectLogo, setEditProjectLogo] = useState<string | null>(null)
  const [savingProject, setSavingProject] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // New status form
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusKey, setNewStatusKey] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#475569')
  const [newStatusBgColor, setNewStatusBgColor] = useState('#f1f5f9')
  const [newStatusIsFinal, setNewStatusIsFinal] = useState(false)

  // New team form
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamKey, setNewTeamKey] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#475569')
  const [newTeamBgColor, setNewTeamBgColor] = useState('#f1f5f9')

  useEffect(() => {
    const stored = localStorage.getItem('currentProjectId')
    if (stored) {
      setProjectId(stored)
    }
  }, [])

  useEffect(() => {
    if (projectId) {
      fetchSettings()
    }
    fetchProjects()
  }, [projectId])

  async function fetchProjects() {
    try {
      const res = await fetch('/api/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  function handleEditProject(project: Project) {
    setEditingProject(project)
    setEditProjectName(project.name)
    setEditProjectLogo(project.logoUrl)
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 2MB for base64)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image too large. Please select an image under 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setEditProjectLogo(reader.result as string)
    }
    reader.readAsDataURL(file)

    // Clear input so same file can be selected again
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  async function handleSaveProject() {
    if (!editingProject || !editProjectName.trim()) return

    setSavingProject(true)
    setError(null)

    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectName.trim(),
          logoUrl: editProjectLogo,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, name: updated.name, logoUrl: updated.logoUrl } : p))
        setEditingProject(null)
        setSuccess('Project updated successfully')
        setTimeout(() => setSuccess(null), 3000)
        // Refresh the page to update header
        window.location.reload()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update project')
      }
    } catch (err) {
      setError('Failed to update project')
      console.error(err)
    } finally {
      setSavingProject(false)
    }
  }

  function handleCancelEdit() {
    setEditingProject(null)
    setEditProjectName('')
    setEditProjectLogo(null)
  }

  // Listen for project changes
  useEffect(() => {
    const handleStorage = () => {
      const stored = localStorage.getItem('currentProjectId')
      if (stored && stored !== projectId) {
        setProjectId(stored)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [projectId])

  async function fetchSettings() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch settings')
      }
      const data = await res.json()
      setStatuses(data.statuses || [])
      setTeams(data.teams || [])
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveStatuses() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/statuses`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses }),
      })
      if (!res.ok) throw new Error('Failed to save statuses')
      const updated = await res.json()
      setStatuses(updated)
      setSuccess('Statuses saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save statuses')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStatus() {
    if (!newStatusName || !newStatusKey) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/statuses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStatusName,
          key: newStatusKey,
          color: newStatusColor,
          bgColor: newStatusBgColor,
          isFinal: newStatusIsFinal,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add status')
      }
      const newStatus = await res.json()
      setStatuses([...statuses, newStatus])
      setNewStatusName('')
      setNewStatusKey('')
      setNewStatusColor('#475569')
      setNewStatusBgColor('#f1f5f9')
      setNewStatusIsFinal(false)
      setSuccess('Status added successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteStatus(statusId: string) {
    if (!confirm('Delete this status?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/statuses?statusId=${statusId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete status')
      }
      setStatuses(statuses.filter(s => s.id !== statusId))
      setSuccess('Status deleted')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTeams() {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      })
      if (!res.ok) throw new Error('Failed to save teams')
      const updated = await res.json()
      setTeams(updated)
      setSuccess('Teams saved successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError('Failed to save teams')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddTeam() {
    if (!newTeamName || !newTeamKey) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          key: newTeamKey,
          color: newTeamColor,
          bgColor: newTeamBgColor,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add team')
      }
      const newTeam = await res.json()
      setTeams([...teams, newTeam])
      setNewTeamName('')
      setNewTeamKey('')
      setNewTeamColor('#475569')
      setNewTeamBgColor('#f1f5f9')
      setSuccess('Team added successfully')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Delete this team?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/teams?teamId=${teamId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete team')
      }
      setTeams(teams.filter(t => t.id !== teamId))
      setSuccess('Team deleted')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function updateStatus(id: string, field: keyof StatusSetting, value: any) {
    setStatuses(statuses.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function updateTeam(id: string, field: keyof TeamSetting, value: any) {
    setTeams(teams.map(t => t.id === id ? { ...t, [field]: value } : t))
  }

  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a project from the header</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground">Manage task statuses, teams, and other project configurations</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-4 rounded-lg mb-6">
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <Tabs defaultValue="project" className="space-y-6">
          <TabsList>
            <TabsTrigger value="project">Project</TabsTrigger>
            <TabsTrigger value="statuses">Task Statuses</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
          </TabsList>

          {/* Project Tab */}
          <TabsContent value="project" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Projects</CardTitle>
                <CardDescription>
                  Manage your projects - rename them or update their logos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {projects.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No projects found.</p>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className={cn(
                          "flex items-center gap-4 p-4 border rounded-lg",
                          editingProject?.id === project.id ? "bg-accent" : "bg-card"
                        )}
                      >
                        {editingProject?.id === project.id ? (
                          // Editing mode
                          <>
                            <div
                              className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden shrink-0"
                              onClick={() => logoInputRef.current?.click()}
                            >
                              {editProjectLogo ? (
                                <img src={editProjectLogo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                                  {project.key.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoSelect}
                            />
                            <div className="flex-1 space-y-2">
                              <Input
                                value={editProjectName}
                                onChange={(e) => setEditProjectName(e.target.value)}
                                placeholder="Project name"
                                className="max-w-xs"
                              />
                              <p className="text-xs text-muted-foreground">
                                Click the logo to change it. Key: <code className="bg-muted px-1 rounded">{project.key}</code>
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveProject}
                                disabled={savingProject || !editProjectName.trim()}
                              >
                                {savingProject ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </>
                        ) : (
                          // View mode
                          <>
                            <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                              {project.logoUrl ? (
                                <img src={project.logoUrl} alt={project.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                                  {project.key.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{project.name}</h3>
                              <p className="text-xs text-muted-foreground">
                                Key: <code className="bg-muted px-1 rounded">{project.key}</code>
                                {!project.logoUrl && (
                                  <span className="ml-2 text-amber-600">(No logo set)</span>
                                )}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditProject(project)}
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Statuses Tab */}
          <TabsContent value="statuses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Statuses</CardTitle>
                <CardDescription>
                  Configure the workflow statuses for tasks in this project. Mark statuses as "Final" if they represent completed work.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing Statuses */}
                <div className="space-y-3">
                  {statuses.map((status) => (
                    <div
                      key={status.id}
                      className="flex items-center gap-4 p-4 border rounded-lg bg-card"
                    >
                      {/* Color picker */}
                      <div className="flex gap-1">
                        {COLOR_PRESETS.map((preset, i) => (
                          <button
                            key={i}
                            type="button"
                            title={preset.label}
                            className={cn(
                              "w-6 h-6 rounded border-2 transition-all",
                              status.color === preset.color ? "border-primary scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: preset.color }}
                            onClick={() => {
                              updateStatus(status.id, 'color', preset.color)
                              updateStatus(status.id, 'bgColor', preset.bg)
                            }}
                          />
                        ))}
                      </div>

                      {/* Preview badge */}
                      <Badge
                        style={{
                          backgroundColor: status.bgColor,
                          color: status.color,
                          borderColor: 'transparent',
                        }}
                        className="min-w-[100px] justify-center text-sm"
                      >
                        {status.name}
                      </Badge>

                      {/* Name input */}
                      <Input
                        value={status.name}
                        onChange={(e) => updateStatus(status.id, 'name', e.target.value)}
                        className="w-40"
                        placeholder="Display name"
                      />

                      {/* Key (readonly) */}
                      <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono">
                        {status.key}
                      </code>

                      {/* Is Final checkbox */}
                      <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                        <Checkbox
                          checked={status.isFinal}
                          onCheckedChange={(checked) => updateStatus(status.id, 'isFinal', checked)}
                        />
                        Final status
                      </label>

                      {/* Delete button */}
                      <div className="ml-auto">
                        {!status.isDefault ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteStatus(status.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">Default</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveStatuses} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Add New Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add New Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        title={preset.label}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all",
                          newStatusColor === preset.color ? "border-primary scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => {
                          setNewStatusColor(preset.color)
                          setNewStatusBgColor(preset.bg)
                        }}
                      />
                    ))}
                  </div>

                  <Badge
                    style={{
                      backgroundColor: newStatusBgColor,
                      color: newStatusColor,
                      borderColor: 'transparent',
                    }}
                    className="min-w-[100px] justify-center"
                  >
                    {newStatusName || 'Preview'}
                  </Badge>

                  <Input
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    className="w-40"
                    placeholder="Display name"
                  />

                  <Input
                    value={newStatusKey}
                    onChange={(e) => setNewStatusKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-32 font-mono text-sm"
                    placeholder="KEY"
                  />

                  <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                    <Checkbox
                      checked={newStatusIsFinal}
                      onCheckedChange={(checked) => setNewStatusIsFinal(checked as boolean)}
                    />
                    Final status
                  </label>

                  <Button onClick={handleAddStatus} disabled={!newStatusName || !newStatusKey || saving}>
                    Add Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Teams</CardTitle>
                <CardDescription>
                  Define teams that can be assigned to tasks for better organization and filtering.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing Teams */}
                <div className="space-y-3">
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-4 p-4 border rounded-lg bg-card"
                    >
                      {/* Color picker */}
                      <div className="flex gap-1">
                        {COLOR_PRESETS.map((preset, i) => (
                          <button
                            key={i}
                            type="button"
                            title={preset.label}
                            className={cn(
                              "w-6 h-6 rounded border-2 transition-all",
                              team.color === preset.color ? "border-primary scale-110" : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: preset.color }}
                            onClick={() => {
                              updateTeam(team.id, 'color', preset.color)
                              updateTeam(team.id, 'bgColor', preset.bg)
                            }}
                          />
                        ))}
                      </div>

                      {/* Preview badge */}
                      <Badge
                        style={{
                          backgroundColor: team.bgColor,
                          color: team.color,
                          borderColor: 'transparent',
                        }}
                        className="min-w-[60px] justify-center"
                      >
                        {team.key}
                      </Badge>

                      {/* Name input */}
                      <Input
                        value={team.name}
                        onChange={(e) => updateTeam(team.id, 'name', e.target.value)}
                        className="w-40"
                        placeholder="Full name"
                      />

                      {/* Key (readonly) */}
                      <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono">
                        {team.key}
                      </code>

                      {/* Delete button */}
                      <div className="ml-auto">
                        {!team.isDefault ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteTeam(team.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground px-2">Default</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveTeams} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Add New Team */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add New Team</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        title={preset.label}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all",
                          newTeamColor === preset.color ? "border-primary scale-110" : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: preset.color }}
                        onClick={() => {
                          setNewTeamColor(preset.color)
                          setNewTeamBgColor(preset.bg)
                        }}
                      />
                    ))}
                  </div>

                  <Badge
                    style={{
                      backgroundColor: newTeamBgColor,
                      color: newTeamColor,
                      borderColor: 'transparent',
                    }}
                    className="min-w-[60px] justify-center"
                  >
                    {newTeamKey || 'KEY'}
                  </Badge>

                  <Input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-40"
                    placeholder="Full name"
                  />

                  <Input
                    value={newTeamKey}
                    onChange={(e) => setNewTeamKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-24 font-mono text-sm"
                    placeholder="KEY"
                  />

                  <Button onClick={handleAddTeam} disabled={!newTeamName || !newTeamKey || saving}>
                    Add Team
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
















