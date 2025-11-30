'use client'

import { useState, useEffect } from 'react'
import { Task, Sprint, TaskStatus, Comment } from '@/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface TaskModalProps {
  task: Task
  users: { id: string; name: string; avatarUrl?: string | null }[]
  sprints: Sprint[]
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onSplit: (newTask: Task) => void
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'READY_TO_TEST', label: 'Ready to Test' },
  { value: 'DONE', label: 'Done' },
]

export function TaskModal({
  task,
  users,
  sprints,
  onClose,
  onUpdate,
  onDelete,
  onSplit,
}: TaskModalProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState(task.status)
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || 'unassigned')
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingComments, setLoadingComments] = useState(true)

  useEffect(() => {
    async function loadTaskDetails() {
      try {
        const res = await fetch(`/api/tasks/${task.id}`)
        const data = await res.json()
        setComments(data.comments || [])
      } catch (error) {
        console.error('Failed to load task details:', error)
      } finally {
        setLoadingComments(false)
      }
    }
    loadTaskDetails()
  }, [task.id])

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status,
          assigneeId: assigneeId === 'unassigned' ? null : assigneeId,
        }),
      })
      const updated = await res.json()
      onUpdate(updated)
      onClose()
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this task?')) return

    setLoading(true)
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      onDelete(task.id)
    } catch (error) {
      console.error('Failed to delete task:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSplit() {
    setLoading(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/split`, { method: 'POST' })
      const newTask = await res.json()
      onSplit(newTask)
    } catch (error) {
      console.error('Failed to split task:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return

    const mentionRegex = /@(\w+)/g
    const mentionNames = Array.from(newComment.matchAll(mentionRegex)).map((m) => m[1].toLowerCase())
    const mentionIds = users
      .filter((u) => mentionNames.includes(u.name.toLowerCase()))
      .map((u) => u.id)

    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          mentionIds,
        }),
      })
      const comment = await res.json()
      setComments((prev) => [...prev, comment])
      setNewComment('')
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
              <p className="text-xs text-muted-foreground">
                Use [tag] prefix for categorization, e.g., [web] Fix login bug
              </p>
            </div>

            {/* Status & Assignee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Assignee</label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Add a description..."
              />
            </div>

            {/* Split from indicator */}
            {task.splitFrom && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <span className="text-muted-foreground">Split from: </span>
                <span className="font-medium">{task.splitFrom.title}</span>
              </div>
            )}

            <Separator />

            {/* Comments */}
            <div>
              <h3 className="text-sm font-medium mb-3">Comments</h3>

              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments...</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {comment.author.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{comment.author.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-muted-foreground">No comments yet</p>
                  )}
                </div>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  placeholder="Add a comment... (use @name to mention)"
                  className="flex-1"
                />
                <Button variant="secondary" onClick={handleAddComment}>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              Delete
            </Button>
            <Button variant="outline" onClick={handleSplit} disabled={loading}>
              Split
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
