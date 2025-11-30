'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

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

interface AdminSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSettingsChange?: () => void
}

const COLOR_PRESETS = [
  { color: '#475569', bg: '#f1f5f9' }, // Gray
  { color: '#1d4ed8', bg: '#dbeafe' }, // Blue
  { color: '#7c3aed', bg: '#ede9fe' }, // Purple
  { color: '#059669', bg: '#d1fae5' }, // Green
  { color: '#d97706', bg: '#fef3c7' }, // Amber
  { color: '#dc2626', bg: '#fee2e2' }, // Red
  { color: '#0891b2', bg: '#cffafe' }, // Cyan
  { color: '#be185d', bg: '#fce7f3' }, // Pink
]

export function AdminSettingsModal({ open, onOpenChange, projectId, onSettingsChange }: AdminSettingsModalProps) {
  const [statuses, setStatuses] = useState<StatusSetting[]>([])
  const [teams, setTeams] = useState<TeamSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New status/team form
  const [newStatusName, setNewStatusName] = useState('')
  const [newStatusKey, setNewStatusKey] = useState('')
  const [newStatusColor, setNewStatusColor] = useState('#475569')
  const [newStatusBgColor, setNewStatusBgColor] = useState('#f1f5f9')
  const [newStatusIsFinal, setNewStatusIsFinal] = useState(false)

  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamKey, setNewTeamKey] = useState('')
  const [newTeamColor, setNewTeamColor] = useState('#475569')
  const [newTeamBgColor, setNewTeamBgColor] = useState('#f1f5f9')

  useEffect(() => {
    if (open && projectId) {
      fetchSettings()
    }
  }, [open, projectId])

  async function fetchSettings() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings`)
      if (!res.ok) throw new Error('Failed to fetch settings')
      const data = await res.json()
      setStatuses(data.statuses || [])
      setTeams(data.teams || [])
    } catch (err) {
      setError('Failed to load settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveStatuses() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/statuses`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses }),
      })
      if (!res.ok) throw new Error('Failed to save statuses')
      const updated = await res.json()
      setStatuses(updated)
      onSettingsChange?.()
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
      if (!res.ok) throw new Error('Failed to add status')
      const newStatus = await res.json()
      setStatuses([...statuses, newStatus])
      setNewStatusName('')
      setNewStatusKey('')
      setNewStatusColor('#475569')
      setNewStatusBgColor('#f1f5f9')
      setNewStatusIsFinal(false)
      onSettingsChange?.()
    } catch (err) {
      setError('Failed to add status')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteStatus(statusId: string) {
    if (!confirm('Delete this status?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/statuses?statusId=${statusId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete status')
        return
      }
      setStatuses(statuses.filter(s => s.id !== statusId))
      onSettingsChange?.()
    } catch (err) {
      setError('Failed to delete status')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveTeams() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/teams`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teams }),
      })
      if (!res.ok) throw new Error('Failed to save teams')
      const updated = await res.json()
      setTeams(updated)
      onSettingsChange?.()
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
      if (!res.ok) throw new Error('Failed to add team')
      const newTeam = await res.json()
      setTeams([...teams, newTeam])
      setNewTeamName('')
      setNewTeamKey('')
      setNewTeamColor('#475569')
      setNewTeamBgColor('#f1f5f9')
      onSettingsChange?.()
    } catch (err) {
      setError('Failed to add team')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Delete this team?')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/settings/teams?teamId=${teamId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete team')
        return
      }
      setTeams(teams.filter(t => t.id !== teamId))
      onSettingsChange?.()
    } catch (err) {
      setError('Failed to delete team')
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Manage task statuses, teams, and other project settings
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <Tabs defaultValue="statuses" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="statuses">Task Statuses</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
            </TabsList>

            {/* Statuses Tab */}
            <TabsContent value="statuses" className="flex-1 overflow-auto mt-4 space-y-4">
              {/* Existing Statuses */}
              <div className="space-y-2">
                {statuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    {/* Color picker */}
                    <div className="flex gap-1">
                      {COLOR_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          className={cn(
                            "w-5 h-5 rounded border-2",
                            status.color === preset.color ? "border-primary" : "border-transparent"
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
                      className="min-w-[80px] justify-center"
                    >
                      {status.name}
                    </Badge>

                    {/* Name input */}
                    <Input
                      value={status.name}
                      onChange={(e) => updateStatus(status.id, 'name', e.target.value)}
                      className="h-8 w-32"
                      placeholder="Name"
                    />

                    {/* Key (readonly for defaults) */}
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {status.key}
                    </code>

                    {/* Is Final checkbox */}
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={status.isFinal}
                        onCheckedChange={(checked) => updateStatus(status.id, 'isFinal', checked)}
                      />
                      Final
                    </label>

                    {/* Delete button */}
                    {!status.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteStatus(status.id)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    )}
                    {status.isDefault && (
                      <span className="text-xs text-muted-foreground">Default</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Status */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Add New Status</p>
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        className={cn(
                          "w-5 h-5 rounded border-2",
                          newStatusColor === preset.color ? "border-primary" : "border-transparent"
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
                    className="min-w-[80px] justify-center"
                  >
                    {newStatusName || 'Preview'}
                  </Badge>

                  <Input
                    value={newStatusName}
                    onChange={(e) => setNewStatusName(e.target.value)}
                    className="h-8 w-28"
                    placeholder="Name"
                  />

                  <Input
                    value={newStatusKey}
                    onChange={(e) => setNewStatusKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="h-8 w-28 font-mono text-xs"
                    placeholder="KEY"
                  />

                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox
                      checked={newStatusIsFinal}
                      onCheckedChange={(checked) => setNewStatusIsFinal(checked as boolean)}
                    />
                    Final
                  </label>

                  <Button size="sm" onClick={handleAddStatus} disabled={!newStatusName || !newStatusKey || saving}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveStatuses} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </TabsContent>

            {/* Teams Tab */}
            <TabsContent value="teams" className="flex-1 overflow-auto mt-4 space-y-4">
              {/* Existing Teams */}
              <div className="space-y-2">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    {/* Color picker */}
                    <div className="flex gap-1">
                      {COLOR_PRESETS.map((preset, i) => (
                        <button
                          key={i}
                          type="button"
                          className={cn(
                            "w-5 h-5 rounded border-2",
                            team.color === preset.color ? "border-primary" : "border-transparent"
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
                      className="h-8 w-32"
                      placeholder="Full name"
                    />

                    {/* Key (readonly for defaults) */}
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {team.key}
                    </code>

                    {/* Delete button */}
                    {!team.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteTeam(team.id)}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    )}
                    {team.isDefault && (
                      <span className="text-xs text-muted-foreground">Default</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Add New Team */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Add New Team</p>
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <div className="flex gap-1">
                    {COLOR_PRESETS.map((preset, i) => (
                      <button
                        key={i}
                        type="button"
                        className={cn(
                          "w-5 h-5 rounded border-2",
                          newTeamColor === preset.color ? "border-primary" : "border-transparent"
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
                    className="h-8 w-32"
                    placeholder="Full name"
                  />

                  <Input
                    value={newTeamKey}
                    onChange={(e) => setNewTeamKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="h-8 w-20 font-mono text-xs"
                    placeholder="KEY"
                  />

                  <Button size="sm" onClick={handleAddTeam} disabled={!newTeamName || !newTeamKey || saving}>
                    Add
                  </Button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveTeams} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

