'use client'

import { useState, useRef, useEffect } from 'react'
import { Task, TaskStatus } from '@/types'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'

interface InlineTaskInputProps {
  sprintId: string | null
  projectId?: string
  users: { id: string; name: string; avatarUrl?: string | null }[]
  onSave: (task: Task) => void
  onCancel: () => void
}

export function InlineTaskInput({ sprintId, projectId, users, onSave, onCancel }: InlineTaskInputProps) {
  const { statuses, teams, getStatusConfig, getTeamConfig } = useProjectSettings()
  const [title, setTitle] = useState('')
  const [team, setTeam] = useState<string>('none')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [assigneeId, setAssigneeId] = useState<string>('unassigned')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSave() {
    if (!title.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          sprintId: sprintId,
          projectId: projectId,
          team: team === 'none' ? null : team,
          assigneeId: assigneeId === 'unassigned' ? null : assigneeId,
          status: status,
        }),
      })
      const task = await res.json()
      onSave(task)
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      onCancel()
    }
  }

  const selectedUser = users.find(u => u.id === assigneeId)
  const statusStyle = getStatusConfig(status)
  const teamStyle = team !== 'none' ? getTeamConfig(team) : null

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 bg-accent/30 border rounded-md">
      {/* Team selector - matches task card position */}
      <div className="w-20 flex-shrink-0">
        <Select value={team} onValueChange={(v) => setTeam(v)}>
          <SelectTrigger 
            className="h-5 text-[10px] font-semibold border-0 px-1.5"
            style={teamStyle ? { backgroundColor: teamStyle.bgColor, color: teamStyle.color } : undefined}
          >
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Team</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.key} value={t.key}>{t.key}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Title input */}
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What needs to be done?"
        className="flex-1 h-6 text-sm border-0 bg-transparent focus-visible:ring-0 px-0"
        disabled={saving}
      />

      {/* Status selector - matches task card position */}
      <div className="w-28 flex-shrink-0">
        <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
          <SelectTrigger 
            className="h-5 text-[10px] font-semibold uppercase border-0 px-2"
            style={{ backgroundColor: statusStyle.bgColor, color: statusStyle.color }}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                <span className="text-xs">{s.name.toUpperCase()}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Assignee selector - matches task card position */}
      <div className="w-7 flex-shrink-0">
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden">
            {selectedUser ? (
              <Avatar className="w-6 h-6">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <svg className="w-3 h-3 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="w-4 h-4">
                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {user.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1 flex-shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={handleSave}
          disabled={saving || !title.trim()}
        >
          {saving ? '...' : 'Add'}
        </Button>
      </div>
    </div>
  )
}
