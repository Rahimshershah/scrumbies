'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Epic } from '@/types'

interface EpicModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (epic: Epic) => void
  epic?: Epic | null
  projectId: string
}

const EPIC_COLORS = [
  // Blues
  '#3b82f6', // Blue
  '#0ea5e9', // Sky
  '#06b6d4', // Cyan
  '#2563eb', // Blue 600
  '#1d4ed8', // Blue 700
  // Purples
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#c026d3', // Fuchsia
  '#7c3aed', // Violet 600
  // Pinks & Reds
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#dc2626', // Red 600
  '#be123c', // Rose 700
  // Oranges & Yellows
  '#f97316', // Orange
  '#ea580c', // Orange 600
  '#eab308', // Yellow
  '#f59e0b', // Amber
  '#ca8a04', // Yellow 600
  // Greens & Teals
  '#22c55e', // Green
  '#16a34a', // Green 600
  '#14b8a6', // Teal
  '#0d9488', // Teal 600
  '#10b981', // Emerald
  // Neutrals & Others
  '#64748b', // Slate
  '#71717a', // Zinc
  '#78716c', // Stone
  '#0f172a', // Slate 900
  '#374151', // Gray 700
]

export function EpicModal({ isOpen, onClose, onSave, epic, projectId }: EpicModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState(EPIC_COLORS[0])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (epic) {
      setName(epic.name)
      setDescription(epic.description || '')
      setColor(epic.color)
      setStartDate(epic.startDate ? new Date(epic.startDate).toISOString().split('T')[0] : '')
      setEndDate(epic.endDate ? new Date(epic.endDate).toISOString().split('T')[0] : '')
    } else {
      setName('')
      setDescription('')
      setColor(EPIC_COLORS[Math.floor(Math.random() * EPIC_COLORS.length)])
      setStartDate('')
      setEndDate('')
    }
  }, [epic, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const url = epic ? `/api/epics/${epic.id}` : '/api/epics'
      const method = epic ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          color,
          startDate: startDate || null,
          endDate: endDate || null,
          projectId,
        }),
      })

      if (res.ok) {
        const savedEpic = await res.json()
        onSave(savedEpic)
        onClose()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to save epic')
      }
    } catch (error) {
      console.error('Failed to save epic:', error)
      alert('Failed to save epic')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{epic ? 'Edit Epic' : 'Create New Epic'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                placeholder="Epic name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Describe the epic..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 flex-wrap">
                {EPIC_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : epic ? 'Update Epic' : 'Create Epic'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

