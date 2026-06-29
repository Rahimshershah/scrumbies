'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Task, Sprint, TaskStatus, Priority, Activity, Comment, TaskChain, TaskChainItem, Attachment, Epic } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { RichTextEditor, RichTextDisplay, MentionUser } from '@/components/ui/rich-text-editor'
import { cn } from '@/lib/utils'
import { useProjectSettings } from '@/contexts/project-settings-context'
import { useSocket } from '@/contexts/socket-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'

interface LinkedDocument {
  id: string
  title: string
  folder: {
    id: string
    name: string
  }
}

interface TaskDetailSidebarProps {
  task: Task
  users: { id: string; name: string; avatarUrl?: string | null }[]
  sprints: Sprint[]
  epics?: Epic[]
  currentUserId?: string
  currentUserRole?: string
  projectId?: string
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: (taskId: string) => void
  onSplit: (newTask: Task) => void
  onTaskSelect?: (taskId: string) => void
  onOpenDocument?: (documentId: string) => void
  readOnly?: boolean
}

const priorityConfig: Record<Priority, { label: string; icon: string; color: string }> = {
  LOW: { label: 'Low', icon: '↓', color: 'text-slate-500' },
  MEDIUM: { label: 'Medium', icon: '=', color: 'text-blue-500' },
  HIGH: { label: 'High', icon: '↑', color: 'text-orange-500' },
  URGENT: { label: 'Urgent', icon: '!!', color: 'text-red-600' },
}

export function TaskDetailSidebar({
  task,
  users,
  sprints,
  epics = [],
  currentUserId,
  currentUserRole,
  projectId,
  onClose,
  onUpdate,
  onDelete,
  onSplit,
  onTaskSelect,
  onOpenDocument,
  readOnly = false,
}: TaskDetailSidebarProps) {
  // Permission check: only admin or task creator can delete
  const canDelete = currentUserRole === 'ADMIN' || task.createdById === currentUserId
  const { statuses, teams, getStatusConfig, getTeamConfig } = useProjectSettings()
  const { subscribe } = useSocket()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [priority, setPriority] = useState<Priority>(task.priority || 'MEDIUM')
  const [team, setTeam] = useState<string>(task.team || 'none')
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || 'unassigned')
  const [sprintId, setSprintId] = useState(task.sprintId || 'backlog')
  const [epicId, setEpicId] = useState(task.epicId || 'none')
  const [saving, setSaving] = useState(false)
  const [splitting, setSplitting] = useState(false)
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [splitTargetSprintId, setSplitTargetSprintId] = useState<string>('')
  const [splitTransferComments, setSplitTransferComments] = useState(true)
  const [splitTransferDescription, setSplitTransferDescription] = useState(true)
  const [activities, setActivities] = useState<Activity[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [commentMentions, setCommentMentions] = useState<string[]>([])
  const [pendingCommentFiles, setPendingCommentFiles] = useState<File[]>([])
  const [submittingComment, setSubmittingComment] = useState(false)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const commentFileInputRef = useRef<HTMLInputElement>(null)
  // Layout mode for the panel: side drawer (default) or bottom sheet (~80% height)
  const [layoutMode, setLayoutMode] = useState<'side' | 'bottom'>('side')
  // Threaded replies
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replyMentions, setReplyMentions] = useState<string[]>([])
  const [submittingReply, setSubmittingReply] = useState(false)
  const [descriptionMentions, setDescriptionMentions] = useState<string[]>([])
  const [loadingActivity, setLoadingActivity] = useState(true)
  const [taskChain, setTaskChain] = useState<TaskChain | null>(null)
  const [loadingChain, setLoadingChain] = useState(true)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Linked documents
  const [linkedDocuments, setLinkedDocuments] = useState<LinkedDocument[]>([])
  const [showDocSearch, setShowDocSearch] = useState(false)
  const [docSearchQuery, setDocSearchQuery] = useState('')
  const [docSearchResults, setDocSearchResults] = useState<LinkedDocument[]>([])
  const [searchingDocs, setSearchingDocs] = useState(false)
  
  // Attachment preview with navigation
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null)

  // Get previewable attachments (images and videos)
  const previewableAttachments = attachments.filter(a =>
    a.mimeType.startsWith('image/') || a.mimeType.startsWith('video/')
  )
  const currentPreviewIndex = previewAttachment
    ? previewableAttachments.findIndex(a => a.id === previewAttachment.id)
    : -1

  const goToPreviousAttachment = useCallback(() => {
    if (currentPreviewIndex > 0) {
      setPreviewAttachment(previewableAttachments[currentPreviewIndex - 1])
    }
  }, [currentPreviewIndex, previewableAttachments])

  const goToNextAttachment = useCallback(() => {
    if (currentPreviewIndex < previewableAttachments.length - 1) {
      setPreviewAttachment(previewableAttachments[currentPreviewIndex + 1])
    }
  }, [currentPreviewIndex, previewableAttachments])

  // Keyboard navigation for attachment preview
  useEffect(() => {
    if (!previewAttachment) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goToPreviousAttachment()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goToNextAttachment()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewAttachment, goToPreviousAttachment, goToNextAttachment])

  // Collapsible sections
  const [detailsOpen, setDetailsOpen] = useState(true)
  
  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(480)
  const isResizing = useRef(false)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // Reset state when task changes
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description || '')
    setStatus(task.status)
    setPriority(task.priority || 'MEDIUM')
    setTeam(task.team || 'none')
    setAssigneeId(task.assigneeId || 'unassigned')
    setSprintId(task.sprintId || 'backlog')
    setEpicId(task.epicId || 'none')
  }, [task])

  // Load activities, comments, chain, attachments, and linked documents
  useEffect(() => {
    const abortController = new AbortController()
    const currentTaskId = task.id

    // Clear previous data immediately when task changes
    setComments([])
    setActivities([])
    setAttachments([])
    setLinkedDocuments([])
    setTaskChain(null)
    setLoadingComments(true)

    async function loadData() {
      setLoadingActivity(true)
      setLoadingChain(true)
      try {
        const [actRes, commentsRes, chainRes, attachRes, docsRes] = await Promise.all([
          fetch(`/api/tasks/${currentTaskId}/activities`, { signal: abortController.signal }),
          fetch(`/api/tasks/${currentTaskId}/comments`, { signal: abortController.signal }),
          fetch(`/api/tasks/${currentTaskId}/chain`, { signal: abortController.signal }),
          fetch(`/api/tasks/${currentTaskId}/attachments`, { signal: abortController.signal }),
          fetch(`/api/tasks/${currentTaskId}/documents`, { signal: abortController.signal }),
        ])

        // Don't update state if this request was aborted or task changed
        if (abortController.signal.aborted) return

        if (actRes.ok) setActivities(await actRes.json())
        if (commentsRes.ok) setComments(await commentsRes.json())
        if (chainRes.ok) setTaskChain(await chainRes.json())
        if (attachRes.ok) setAttachments(await attachRes.json())
        if (docsRes.ok) setLinkedDocuments(await docsRes.json())
      } catch (error) {
        // Ignore abort errors - they're expected when switching tasks quickly
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Failed to load task data:', error)
      } finally {
        if (!abortController.signal.aborted) {
          setLoadingActivity(false)
          setLoadingChain(false)
          setLoadingComments(false)
        }
      }
    }
    loadData()

    // Cleanup: abort any in-flight requests when task changes
    return () => {
      abortController.abort()
    }
  }, [task.id])

  // Restore the panel layout preference once on mount.
  useEffect(() => {
    const saved = localStorage.getItem('scrumbies_task_panel_layout')
    if (saved === 'bottom' || saved === 'side') setLayoutMode(saved)
  }, [])

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode(prev => {
      const next = prev === 'side' ? 'bottom' : 'side'
      localStorage.setItem('scrumbies_task_panel_layout', next)
      return next
    })
  }, [])

  // Real-time: live-update this task's comments when teammates add or resolve them.
  useEffect(() => {
    const unsubAdded = subscribe('comment:added', (p: any) => {
      if (p?.taskId !== task.id || !p?.comment) return
      setComments(prev => (prev.some(c => c.id === p.comment.id) ? prev : [...prev, p.comment]))
    })
    const unsubUpdated = subscribe('comment:updated', (p: any) => {
      if (p?.taskId !== task.id || !p?.comment) return
      setComments(prev => prev.map(c => (c.id === p.comment.id ? p.comment : c)))
    })
    return () => { unsubAdded(); unsubUpdated() }
  }, [subscribe, task.id])

  // Resize handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    e.preventDefault()
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX
      setSidebarWidth(Math.max(380, Math.min(800, newWidth)))
    }

    const handleMouseUp = () => {
      isResizing.current = false
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          status,
          priority,
          team: team === 'none' ? null : team,
          assigneeId: assigneeId === 'unassigned' ? null : assigneeId,
          sprintId: sprintId === 'backlog' ? null : sprintId,
          epicId: epicId === 'none' ? null : epicId,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        console.error('Failed to update task:', error)
        return
      }
      const updated = await res.json()
      onUpdate(updated)
    } catch (error) {
      console.error('Failed to update task:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this task?')) return
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      onDelete(task.id)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  function openSplitDialog() {
    // Default to the next available sprint (planned or active, excluding completed)
    const availableSprints = sprints.filter(s => s.status !== 'COMPLETED')
    const defaultSprint = availableSprints.find(s => s.status === 'PLANNED') || availableSprints[0]
    setSplitTargetSprintId(defaultSprint?.id || 'backlog')
    setSplitTransferComments(true)
    setSplitTransferDescription(true)
    setShowSplitDialog(true)
  }

  async function confirmSplit() {
    setSplitting(true)
    setShowSplitDialog(false)
    try {
      const res = await fetch(`/api/tasks/${task.id}/split`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSprintId: splitTargetSprintId === 'backlog' ? null : splitTargetSprintId,
          transferComments: splitTransferComments,
          transferDescription: splitTransferDescription,
        }),
      })
      const newTask = await res.json()
      onSplit(newTask)
      const chainRes = await fetch(`/api/tasks/${task.id}/chain`)
      if (chainRes.ok) setTaskChain(await chainRes.json())
    } catch (error) {
      console.error('Failed to split task:', error)
    } finally {
      setSplitting(false)
    }
  }

  // Upload an inline image (pasted/dropped/picked inside the comment editor) and
  // return its URL so the editor can embed <img src>. Avoids huge base64 payloads.
  const uploadInlineImage = useCallback(async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/uploads/inline-images', { method: 'POST', body: formData })
      if (!res.ok) return null
      const data = await res.json()
      return data.url || null
    } catch {
      return null
    }
  }, [])

  async function handleAddComment() {
    if (submittingComment) return
    const hasText = !!newComment.trim() && newComment !== '<p></p>'
    if (!hasText && pendingCommentFiles.length === 0) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: hasText ? newComment : '',
          mentionIds: commentMentions,
        }),
      })
      if (!res.ok) throw new Error('Failed to create comment')
      let comment = await res.json()
      // Upload any picked attachments to the freshly-created comment.
      if (pendingCommentFiles.length > 0) {
        const uploaded: Attachment[] = []
        for (const file of pendingCommentFiles) {
          const fd = new FormData()
          fd.append('file', file)
          const ar = await fetch(`/api/comments/${comment.id}/attachments`, { method: 'POST', body: fd })
          if (ar.ok) uploaded.push(await ar.json())
        }
        comment = { ...comment, attachments: [...(comment.attachments || []), ...uploaded] }
      }
      setComments(prev =>
        prev.some(c => c.id === comment.id) ? prev.map(c => (c.id === comment.id ? comment : c)) : [...prev, comment]
      )
      setNewComment('')
      setCommentMentions([])
      setPendingCommentFiles([])
    } catch (error) {
      console.error('Failed to add comment:', error)
      alert('Failed to add comment. Please try again.')
    } finally {
      setSubmittingComment(false)
    }
  }

  async function handleAddReply(parentId: string) {
    if (submittingReply) return
    const hasText = !!replyText.trim() && replyText !== '<p></p>'
    if (!hasText) return
    setSubmittingReply(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText, mentionIds: replyMentions, parentId }),
      })
      if (!res.ok) throw new Error('Failed to reply')
      const reply = await res.json()
      setComments(prev => (prev.some(c => c.id === reply.id) ? prev : [...prev, reply]))
      setReplyingTo(null)
      setReplyText('')
      setReplyMentions([])
    } catch (error) {
      console.error('Failed to add reply:', error)
      alert('Failed to add reply. Please try again.')
    } finally {
      setSubmittingReply(false)
    }
  }

  async function handleToggleResolve(comment: Comment) {
    setResolvingId(comment.id)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: !comment.resolved }),
      })
      if (res.ok) {
        const updated = await res.json()
        setComments(prev => prev.map(c => (c.id === comment.id ? updated : c)))
      }
    } catch (error) {
      console.error('Failed to toggle resolve:', error)
    } finally {
      setResolvingId(null)
    }
  }

  function handleCommentFilesPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    const tooBig = files.find(f => f.size > 25 * 1024 * 1024)
    if (tooBig) {
      alert('Each file must be 25MB or smaller.')
      e.target.value = ''
      return
    }
    setPendingCommentFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm('Delete this comment?')) return
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file size (25MB for all files)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      alert(`File too large. Maximum size is 25MB.`)
      e.target.value = '' // Reset input
      return
    }
    
    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/tasks/${task.id}/attachments`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        const attachment = await res.json()
        setAttachments((prev) => [attachment, ...prev])
      } else {
        const error = await res.json().catch(() => ({ error: 'Failed to upload file' }))
        alert(error.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
      alert('Failed to upload file. Please try again.')
    } finally {
      // Reset input so same file can be uploaded again
      e.target.value = ''
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    if (!confirm('Delete this attachment?')) return
    try {
      const res = await fetch(`/api/attachments/${attachmentId}`, { method: 'DELETE' })
      if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
    } catch (error) {
      console.error('Failed to delete attachment:', error)
    }
  }

  // Document linking functions
  async function searchDocuments(query: string) {
    if (!projectId) return
    setSearchingDocs(true)
    try {
      const res = await fetch(`/api/documents/search?projectId=${projectId}&q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const results = await res.json()
        // Filter out already linked documents
        const linkedIds = new Set(linkedDocuments.map(d => d.id))
        setDocSearchResults(results.filter((d: LinkedDocument) => !linkedIds.has(d.id)))
      }
    } catch (error) {
      console.error('Failed to search documents:', error)
    } finally {
      setSearchingDocs(false)
    }
  }

  async function handleLinkDocument(documentId: string) {
    try {
      const res = await fetch(`/api/tasks/${task.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (res.ok) {
        const doc = await res.json()
        setLinkedDocuments((prev) => [...prev, doc])
        setDocSearchResults((prev) => prev.filter((d) => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to link document:', error)
    }
  }

  async function handleUnlinkDocument(documentId: string) {
    try {
      const res = await fetch(`/api/tasks/${task.id}/documents?documentId=${documentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setLinkedDocuments((prev) => prev.filter((d) => d.id !== documentId))
      }
    } catch (error) {
      console.error('Failed to unlink document:', error)
    }
  }

  // Effect to search docs when query changes or dialog opens
  useEffect(() => {
    if (!showDocSearch || !projectId) return
    // Load documents immediately when dialog opens, then debounce subsequent searches
    const timer = setTimeout(() => {
      searchDocuments(docSearchQuery)
    }, docSearchQuery ? 300 : 0) // No delay for initial load
    return () => clearTimeout(timer)
  }, [docSearchQuery, showDocSearch, projectId])

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function canPreview(mimeType: string): boolean {
    // PDFs open in new tab, images and videos preview in modal
    return (
      mimeType.startsWith('image/') ||
      mimeType.startsWith('video/')
    )
  }

  function handleAttachmentClick(attachment: Attachment) {
    if (attachment.mimeType === 'application/pdf') {
      // Open PDFs in new browser tab for best viewing experience
      window.open(attachment.url, '_blank')
    } else if (canPreview(attachment.mimeType)) {
      setPreviewAttachment(attachment)
    } else {
      window.open(attachment.url, '_blank')
    }
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) return '🖼️'
    if (mimeType.startsWith('video/')) return '🎬'
    if (mimeType.includes('pdf')) return '📄'
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝'
    return '📎'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days} days ago`
    return formatDate(dateStr)
  }

  const getActivityText = (activity: Activity) => {
    const meta = activity.metadata || {}
    switch (activity.type) {
      case 'CREATED':
        if (meta.splitFrom) return `split #${meta.splitNumber || '?'} from "${meta.splitFrom}"`
        return 'created task'
      case 'STATUS_CHANGED':
        return `${meta.from?.replace(/_/g, ' ')} → ${meta.to?.replace(/_/g, ' ')}`
      case 'PRIORITY_CHANGED':
        return `priority ${meta.from} → ${meta.to}`
      case 'ASSIGNED':
        return meta.to ? `assigned to ${meta.to}` : 'unassigned'
      case 'MOVED_TO_SPRINT':
        return meta.to ? `→ ${meta.to}` : '→ Backlog'
      case 'SPLIT':
        return `split #${meta.splitNumber || '?'} → ${meta.targetSprint}`
      default:
        return activity.type.toLowerCase().replace(/_/g, ' ')
    }
  }

  // Threading: top-level comments (newest first) and their replies grouped by parent.
  const topLevelComments = [...comments]
    .filter(c => !c.parentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const repliesByParent = comments.reduce((acc, c) => {
    if (c.parentId) {
      ;(acc[c.parentId] = acc[c.parentId] || []).push(c)
    }
    return acc
  }, {} as Record<string, Comment[]>)

  const hasChanges =
    title !== task.title ||
    description !== (task.description || '') ||
    status !== task.status ||
    priority !== (task.priority || 'MEDIUM') ||
    team !== (task.team || 'none') ||
    assigneeId !== (task.assigneeId || 'unassigned') ||
    sprintId !== (task.sprintId || 'backlog') ||
    epicId !== (task.epicId || 'none')

  const hasChain = taskChain && taskChain.totalTasks > 1
  const assignee = users.find(u => u.id === assigneeId)
  const reporter = task.createdBy || (task.createdById ? users.find(u => u.id === task.createdById) : null) || { name: 'Unknown', avatarUrl: null }

  // Description content — rendered in the details column in side mode, or moved into
  // the wide comments (70%) column in the bottom full view.
  const descriptionBlock = (
    <>
      <label className="text-sm font-semibold mb-2 block">Description</label>
      <div className="overflow-x-auto max-w-full min-w-0 [&_table]:max-w-[calc(100%-1rem)] [&_.ProseMirror]:max-w-full">
        {readOnly ? (
          description ? (
            <div className="max-w-full overflow-hidden">
              <RichTextDisplay content={description} className="text-sm [&_.ProseMirror]:max-w-full" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description</p>
          )
        ) : (
          <RichTextEditor
            content={description}
            onChange={setDescription}
            onMentionsChange={setDescriptionMentions}
            placeholder="Add a description... (type @ to mention someone)"
            minHeight="80px"
            minimal
            users={users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
          />
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Blurred backdrop behind the bottom sheet (full view only). Click to close. */}
      {layoutMode === 'bottom' && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        ref={sidebarRef}
        className={cn(
          "bg-background flex flex-shrink-0 relative z-50",
          layoutMode === 'bottom'
            ? "fixed inset-x-0 bottom-0 h-[80vh] w-full border-t shadow-2xl"
            : "h-full border-l fixed md:relative inset-0 md:inset-auto md:z-auto"
        )}
        style={layoutMode === 'bottom' ? { maxWidth: '100vw' } : { width: sidebarWidth, maxWidth: '100vw' }}
      >
        {/* Resize handle - side mode only, hidden on mobile */}
        {layoutMode === 'side' && (
          <div
            className="hidden md:block absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary transition-colors z-10 -ml-0.5"
            onMouseDown={startResizing}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {task.taskKey && (
                <span className="text-sm font-mono font-medium text-muted-foreground">
                  {task.taskKey}
                </span>
              )}
              <span className="text-sm text-muted-foreground">
                {task.team || 'No team'} work item
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!readOnly && hasChanges && (
                <Button size="sm" variant="default" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
              {/* Layout toggle: right drawer ⟷ bottom sheet (desktop only) */}
              <Button
                size="sm"
                variant="outline"
                className="h-8 hidden md:inline-flex items-center gap-1.5 text-xs"
                onClick={toggleLayoutMode}
                title={layoutMode === 'side' ? 'Expand to a bottom panel (80% height)' : 'Dock to the right side'}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {layoutMode === 'side' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  )}
                </svg>
                {layoutMode === 'side' ? 'Switch to Bottom' : 'Switch to Side'}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="flex-1 w-full overflow-y-auto overflow-x-hidden">
            <div className={cn("p-4 max-w-full", layoutMode === 'bottom' ? "lg:flex lg:gap-0 lg:p-0 lg:items-start" : "space-y-4 overflow-x-hidden")}>
              {/* DETAILS COLUMN — ~30% width in the bottom (full) view; sticks while the
                  right (comments) column scrolls. */}
              <div className={cn("space-y-4 min-w-0", layoutMode === 'bottom' && "lg:w-[30%] lg:min-w-[300px] lg:max-w-[460px] lg:shrink-0 lg:p-4 lg:border-r lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(80vh-3.25rem)] lg:overflow-y-auto")}>
              {/* Title */}
              <div>
                {readOnly ? (
                  <h2 className="text-lg font-semibold">{title}</h2>
                ) : (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg font-semibold border-0 px-0 h-auto focus-visible:ring-0 bg-transparent"
                    placeholder="Task title"
                  />
                )}
              </div>

              {/* Status Badge + Actions Row */}
              <div className="flex items-center justify-between">
                <div>
                  {readOnly ? (
                    <Badge 
                      className="font-semibold"
                      style={{ backgroundColor: getStatusConfig(status).bgColor, color: getStatusConfig(status).color }}
                    >
                      {getStatusConfig(status).label}
                    </Badge>
                  ) : (
                    <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                      <SelectTrigger className="w-auto h-7 border-0 bg-transparent p-0">
                        <Badge 
                          className="font-semibold cursor-pointer"
                          style={{ backgroundColor: getStatusConfig(status).bgColor, color: getStatusConfig(status).color }}
                        >
                          {getStatusConfig(status).label} ▾
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            <span style={{ color: s.color }}>{s.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openSplitDialog} disabled={splitting}>
                      {splitting ? 'Splitting...' : 'Split'}
                    </Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                        Delete
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Details Section - Collapsible */}
              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 hover:bg-muted/50 rounded -mx-2 px-2">
                  <svg className={cn("w-4 h-4 transition-transform", detailsOpen && "rotate-90")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold">Details</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-2">
                  {/* Priority */}
                  <div className="flex items-center py-1">
                    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Priority</span>
                    {readOnly ? (
                      <span className={cn("text-sm font-medium", priorityConfig[priority].color)}>
                        {priorityConfig[priority].icon} {priorityConfig[priority].label}
                      </span>
                    ) : (
                      <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                        <SelectTrigger className="w-32 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(priorityConfig).map(([key, config]) => (
                            <SelectItem key={key} value={key}>
                              <span className={cn("flex items-center gap-2", config.color)}>
                                <span>{config.icon}</span> {config.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center py-1">
                    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Assignee</span>
                    {readOnly ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          {assignee?.avatarUrl ? <AvatarImage src={assignee.avatarUrl} /> : null}
                          <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {assignee?.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{assignee?.name || 'Unassigned'}</span>
                      </div>
                    ) : (
                      <Select value={assigneeId} onValueChange={setAssigneeId}>
                        <SelectTrigger className="w-40 h-8 text-sm">
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="w-5 h-5">
                                  {user.avatarUrl ? <AvatarImage src={user.avatarUrl} /> : null}
                                  <AvatarFallback className="text-[9px]">
                                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                {user.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Team */}
                  <div className="flex items-center py-1">
                    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Team</span>
                    {readOnly ? (
                      <span className="text-sm">{team === 'none' ? 'No team' : team}</span>
                    ) : (
                      <Select value={team} onValueChange={(v) => setTeam(v)}>
                        <SelectTrigger className="w-32 h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No team</SelectItem>
                          {teams.map((t) => (
                            <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Sprint */}
                  <div className="flex items-center py-1">
                    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Sprint</span>
                    {readOnly ? (
                      <span className="text-sm">{sprints.find(s => s.id === sprintId)?.name || 'Backlog'}</span>
                    ) : (
                      <Select value={sprintId} onValueChange={setSprintId}>
                        <SelectTrigger className="w-40 h-8 text-sm">
                          <SelectValue placeholder={sprints.find(s => s.id === sprintId)?.name || 'Backlog'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          {sprints.filter(s => s.status !== 'COMPLETED').map((sprint) => (
                            <SelectItem key={sprint.id} value={sprint.id}>{sprint.name}</SelectItem>
                          ))}
                          {sprintId !== 'backlog' && sprints.find(s => s.id === sprintId && s.status === 'COMPLETED') && (
                            <SelectItem value={sprintId} disabled>
                              {sprints.find(s => s.id === sprintId)?.name} (Completed)
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Epic */}
                  {epics.length > 0 && (
                    <div className="flex items-center py-1">
                      <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Epic</span>
                      {readOnly ? (
                        <div className="flex items-center gap-2">
                          {task.epic ? (
                            <>
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: task.epic.color }}
                              />
                              <span className="text-sm">{task.epic.name}</span>
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">No epic</span>
                          )}
                        </div>
                      ) : (
                        <Select value={epicId} onValueChange={setEpicId}>
                          <SelectTrigger className="w-40 h-8 text-sm">
                            <SelectValue placeholder="No epic" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No epic</SelectItem>
                            {epics.map((epic) => (
                              <SelectItem key={epic.id} value={epic.id}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: epic.color }}
                                  />
                                  {epic.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}

                  {/* Reporter */}
                  <div className="flex items-center py-1">
                    <span className="text-sm text-muted-foreground w-28 flex-shrink-0">Reporter</span>
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        {reporter.avatarUrl ? <AvatarImage src={reporter.avatarUrl} /> : null}
                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                          {reporter.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{reporter.name}</span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Linked Documents */}
              {projectId && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Linked Documents {linkedDocuments.length > 0 && `(${linkedDocuments.length})`}</span>
                    {!readOnly && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDocSearch(true)}>
                        + Link
                      </Button>
                    )}
                  </div>
                  {linkedDocuments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No linked documents</p>
                  ) : (
                    <div className="space-y-1">
                      {linkedDocuments.map((doc) => (
                        <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded group">
                          <button
                            onClick={() => onOpenDocument?.(doc.id)}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-primary transition-colors"
                          >
                            <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium truncate block hover:underline">{doc.title}</span>
                              <span className="text-[10px] text-muted-foreground">{doc.folder.name}</span>
                            </div>
                          </button>
                          {!readOnly && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" onClick={() => handleUnlinkDocument(doc.id)}>
                              <svg className="w-3 h-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Description — shown in the details column only in side mode; in the
                  bottom full view it moves to the 70% comments column. */}
              {layoutMode === 'side' && (
                <div className="border-t pt-4 min-w-0">
                  {descriptionBlock}
                </div>
              )}

              {/* Attachments */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-semibold truncate">Attachments {attachments.length > 0 && `(${attachments.length})`}</span>
                  {!readOnly && (
                    <>
                      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar" />
                      <Button variant="ghost" size="sm" className="h-7 text-xs flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}>
                        {uploadingFile ? 'Uploading...' : '+ Attach'}
                      </Button>
                    </>
                  )}
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No attachments</p>
                ) : (
                  <div className="space-y-1">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded group">
                        {/* Thumbnail - same size for all */}
                        <button
                          onClick={() => handleAttachmentClick(attachment)}
                          className="w-10 h-10 rounded overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity bg-muted flex items-center justify-center"
                        >
                          {attachment.mimeType.startsWith('image/') ? (
                            <img src={attachment.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">{getFileIcon(attachment.mimeType)}</span>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => handleAttachmentClick(attachment)}
                            className="text-xs font-medium hover:underline truncate block text-left w-full"
                          >
                            {attachment.filename}
                          </button>
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(attachment.size)}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Preview/Open button */}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleAttachmentClick(attachment)} title={canPreview(attachment.mimeType) ? "Preview" : "Open"}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {attachment.mimeType === 'application/pdf' ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              ) : (
                                <>
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </>
                              )}
                            </svg>
                          </Button>
                          {/* Download button */}
                          <a href={attachment.url} download={attachment.filename} className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent" title="Download">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                          {/* Delete button */}
                          {!readOnly && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteAttachment(attachment.id)} title="Delete">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Task Chain */}
              {hasChain && (
                <div className="border-t pt-4">
                  <span className="text-sm font-semibold mb-2 block">
                    Task Chain ({taskChain.totalTasks} tasks • {taskChain.sprintCount} sprint{taskChain.sprintCount > 1 ? 's' : ''})
                  </span>
                  <div className="space-y-1 bg-muted/30 rounded-lg p-2">
                    {taskChain.chain.map((chainTask, index) => (
                      <button
                        key={chainTask.id}
                        onClick={() => chainTask.id !== task.id && onTaskSelect?.(chainTask.id)}
                        disabled={chainTask.id === task.id}
                        className={cn(
                          "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2",
                          chainTask.id === task.id ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <Badge variant="outline" className="text-[9px] px-1 h-4">#{index + 1}</Badge>
                        <span className="truncate flex-1">{chainTask.title}</span>
                        <Badge 
                          className="text-[9px]"
                          style={{ backgroundColor: getStatusConfig(chainTask.status).bgColor, color: getStatusConfig(chainTask.status).color }}
                        >
                          {getStatusConfig(chainTask.status).label}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              </div>
              {/* end DETAILS COLUMN */}

              {/* COMMENTS COLUMN — ~70% width in the bottom (full) view */}
              <div className={cn("min-w-0", layoutMode === 'bottom' && "lg:flex-1 lg:p-4")}>
              {/* Description moves here in the bottom full view (top of the 70% column) */}
              {layoutMode === 'bottom' && (
                <div className="pb-4 mb-4 border-b min-w-0">
                  {descriptionBlock}
                </div>
              )}
              {/* Comments & Activity Tabs */}
              <div className={cn(layoutMode === 'bottom' ? "lg:pt-0" : "border-t pt-4")}>
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 h-9">
                    <TabsTrigger value="comments" className="text-sm">
                      Comments {comments.length > 0 && `(${comments.length})`}
                    </TabsTrigger>
                    <TabsTrigger value="activity" className="text-sm">
                      Activity {activities.length > 0 && `(${activities.length})`}
                    </TabsTrigger>
                  </TabsList>

                  {/* Comments Tab */}
                  <TabsContent value="comments" className="mt-4 space-y-4 pb-4">
                    {/* Add Comment */}
                    {!readOnly && (
                      <div className="space-y-2">
                        <RichTextEditor
                          content={newComment}
                          onChange={setNewComment}
                          onMentionsChange={setCommentMentions}
                          placeholder="Add a comment... (@ to mention, paste or drop an image)"
                          minHeight="60px"
                          minimal
                          users={users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
                          enableImages
                          onImageUpload={uploadInlineImage}
                        />
                        {/* Pending attachment chips */}
                        {pendingCommentFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {pendingCommentFiles.map((file, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs max-w-[220px]">
                                <span className="truncate">{file.name}</span>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-destructive leading-none"
                                  onClick={() => setPendingCommentFiles(prev => prev.filter((_, i) => i !== idx))}
                                  title="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2 pr-1">
                          <input
                            type="file"
                            multiple
                            ref={commentFileInputRef}
                            onChange={handleCommentFilesPicked}
                            className="hidden"
                            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                          />
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => commentFileInputRef.current?.click()} disabled={submittingComment}>
                            📎 Attach
                          </Button>
                          <Button
                            size="sm"
                            className="flex-shrink-0"
                            onClick={handleAddComment}
                            disabled={submittingComment || (!(newComment.trim() && newComment !== '<p></p>') && pendingCommentFiles.length === 0)}
                          >
                            {submittingComment ? 'Posting...' : 'Comment'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Comments list - newest first */}
                    <div className="space-y-4">
                      {loadingComments ? (
                        <div className="flex items-center justify-center py-4">
                          <svg className="w-5 h-5 animate-spin text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span className="ml-2 text-sm text-muted-foreground">Loading comments...</span>
                        </div>
                      ) : comments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                      ) : (
                        topLevelComments.map((comment) => {
                          const isTestingComment = comment.taskStatusAtCreation === 'READY_TO_TEST'
                          const isBlockedComment = comment.taskStatusAtCreation === 'BLOCKED'
                          const isResolved = !!comment.resolved
                          const replies = (repliesByParent[comment.id] || []).slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                          return (
                            <div key={comment.id} className="space-y-2">
                            <div className={cn("flex gap-3 group", isResolved && "opacity-60")}>
                              <Avatar className="w-7 h-7 flex-shrink-0">
                                {comment.author.avatarUrl ? (
                                  <AvatarImage src={comment.author.avatarUrl} />
                                ) : null}
                                <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                  {comment.author.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="text-sm font-semibold">{comment.author.name}</span>
                                  {isTestingComment && (
                                    <Badge variant="outline" className="h-4 text-[9px] px-1.5 bg-yellow-100 text-yellow-700 border-yellow-300">
                                      🧪 Testing
                                    </Badge>
                                  )}
                                  {isBlockedComment && (
                                    <Badge variant="outline" className="h-4 text-[9px] px-1.5 bg-red-100 text-red-700 border-red-300">
                                      🚫 Blocked
                                    </Badge>
                                  )}
                                  {isResolved && (
                                    <Badge variant="outline" className="h-4 text-[9px] px-1.5 bg-green-100 text-green-700 border-green-300">
                                      ✓ Resolved{comment.resolvedBy?.name ? ` · ${comment.resolvedBy.name}` : ''}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
                                  <div className="ml-auto flex items-center gap-0.5">
                                    {!readOnly && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                          "h-5 px-1.5 transition-opacity",
                                          isResolved ? "text-green-600 opacity-100" : "text-muted-foreground hover:text-green-600 opacity-0 group-hover:opacity-100"
                                        )}
                                        onClick={() => handleToggleResolve(comment)}
                                        disabled={resolvingId === comment.id}
                                        title={isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </Button>
                                    )}
                                    {currentUserId === comment.author.id && !readOnly && (
                                      <Button variant="ghost" size="sm" className="h-5 px-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(comment.id)}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <div className={cn("text-sm overflow-hidden break-words", isResolved && "line-through decoration-1")}>
                                  <RichTextDisplay content={comment.content} />
                                </div>
                                {/* Comment attachments */}
                                {comment.attachments && comment.attachments.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {comment.attachments.map((att) => (
                                      att.mimeType.startsWith('image/') ? (
                                        <button key={att.id} onClick={() => handleAttachmentClick(att)} className="block" title={att.filename}>
                                          <img src={att.url} alt={att.filename} className="h-20 w-20 object-cover rounded border hover:opacity-80 transition-opacity" />
                                        </button>
                                      ) : (
                                        <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 text-xs hover:bg-muted max-w-[220px]">
                                          <span>{getFileIcon(att.mimeType)}</span>
                                          <span className="truncate">{att.filename}</span>
                                        </a>
                                      )
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Replies (one level deep) */}
                            {replies.map((reply) => (
                              <div key={reply.id} className={cn("flex gap-2 group ml-10 pl-3 border-l-2 border-muted", reply.resolved && "opacity-60")}>
                                <Avatar className="w-6 h-6 flex-shrink-0">
                                  {reply.author.avatarUrl ? <AvatarImage src={reply.author.avatarUrl} /> : null}
                                  <AvatarFallback className="text-[9px] bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {reply.author.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <span className="text-xs font-semibold">{reply.author.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{formatRelativeTime(reply.createdAt)}</span>
                                    {currentUserId === reply.author.id && !readOnly && (
                                      <Button variant="ghost" size="sm" className="h-4 px-1 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteComment(reply.id)}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </Button>
                                    )}
                                  </div>
                                  <div className="text-sm overflow-hidden break-words"><RichTextDisplay content={reply.content} /></div>
                                  {reply.attachments && reply.attachments.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-2">
                                      {reply.attachments.map((att) => (
                                        att.mimeType.startsWith('image/') ? (
                                          <button key={att.id} onClick={() => handleAttachmentClick(att)} className="block" title={att.filename}>
                                            <img src={att.url} alt={att.filename} className="h-16 w-16 object-cover rounded border hover:opacity-80" />
                                          </button>
                                        ) : (
                                          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-muted/50 rounded px-2 py-1 text-xs hover:bg-muted max-w-[200px]">
                                            <span>{getFileIcon(att.mimeType)}</span>
                                            <span className="truncate">{att.filename}</span>
                                          </a>
                                        )
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {/* Reply affordance */}
                            {!readOnly && (
                              <div className="ml-10">
                                {replyingTo === comment.id ? (
                                  <div className="space-y-2">
                                    <RichTextEditor
                                      content={replyText}
                                      onChange={setReplyText}
                                      onMentionsChange={setReplyMentions}
                                      placeholder="Write a reply... (@ to mention, paste an image)"
                                      minHeight="48px"
                                      minimal
                                      users={users.map(u => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))}
                                      enableImages
                                      onImageUpload={uploadInlineImage}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyText(''); setReplyMentions([]) }}>Cancel</Button>
                                      <Button size="sm" onClick={() => handleAddReply(comment.id)} disabled={submittingReply || !(replyText.trim() && replyText !== '<p></p>')}>
                                        {submittingReply ? 'Replying...' : 'Reply'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="text-xs text-muted-foreground hover:text-primary font-medium"
                                    onClick={() => { setReplyingTo(comment.id); setReplyText(''); setReplyMentions([]) }}
                                  >
                                    Reply{replies.length > 0 ? ` (${replies.length})` : ''}
                                  </button>
                                )}
                              </div>
                            )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="mt-4 pb-4">
                    <div className="space-y-1">
                      {activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
                      ) : (
                        [...activities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((activity) => (
                          <div key={activity.id} className="flex items-start gap-2 text-xs py-2 border-b last:border-b-0">
                            <Avatar className="w-5 h-5 flex-shrink-0 mt-0.5">
                              {activity.user.avatarUrl ? (
                                <AvatarImage src={activity.user.avatarUrl} />
                              ) : null}
                              <AvatarFallback className="text-[8px] bg-muted">
                                {activity.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{activity.user.name}</span>
                              <span className="text-muted-foreground"> {getActivityText(activity)}</span>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelativeTime(activity.createdAt)}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
              </div>
              {/* end COMMENTS COLUMN */}
            </div>
          </div>
        </div>
      </div>

      {/* Split Task Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Split Task</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>This will mark the current task as done and create a continuation in the selected sprint.</p>
              <div className="bg-muted p-3 rounded-md">
                <p className="font-medium text-foreground">{task.title}</p>
                {task.taskKey && (
                  <p className="text-xs text-muted-foreground mt-1">{task.taskKey}</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Split to:</label>
              <Select value={splitTargetSprintId} onValueChange={setSplitTargetSprintId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  {sprints
                    .filter(s => s.status !== 'COMPLETED')
                    .map((sprint) => (
                      <SelectItem key={sprint.id} value={sprint.id}>
                        <div className="flex items-center gap-2">
                          {sprint.name}
                          {sprint.status === 'ACTIVE' && (
                            <Badge variant="default" className="bg-green-500 text-[10px] h-4">Active</Badge>
                          )}
                          {sprint.status === 'PLANNED' && (
                            <Badge variant="secondary" className="text-[10px] h-4">Planned</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium block">Transfer to new task:</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitTransferDescription}
                    onChange={(e) => setSplitTransferDescription(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Description</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={splitTransferComments}
                    onChange={(e) => setSplitTransferComments(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm">Comments ({comments.length})</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSplit} disabled={splitting}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              {splitting ? 'Splitting...' : 'Split Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Document Dialog */}
      <Dialog open={showDocSearch} onOpenChange={(open) => {
        setShowDocSearch(open)
        if (!open) {
          setDocSearchQuery('')
          setDocSearchResults([])
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Document</DialogTitle>
            <DialogDescription>
              Search for documents in this project to link to this task.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="relative">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input
                placeholder="Search documents by title..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            <div className="min-h-[200px] max-h-[300px] overflow-auto">
              {searchingDocs ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <svg className="w-5 h-5 animate-spin mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Searching...
                </div>
              ) : docSearchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  {docSearchQuery ? 'No documents found' : 'No documents in this project yet'}
                </div>
              ) : (
                <div className="space-y-1">
                  {docSearchResults.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => handleLinkDocument(doc.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted text-left transition-colors"
                    >
                      <svg className="w-5 h-5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{doc.title}</span>
                        <span className="text-xs text-muted-foreground">{doc.folder.name}</span>
                      </div>
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDocSearch(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attachment Preview Modal - Full screen for better visibility */}
      <Dialog open={!!previewAttachment} onOpenChange={(open) => !open && setPreviewAttachment(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden">
          {previewAttachment && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg">{getFileIcon(previewAttachment.mimeType)}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate">{previewAttachment.filename}</h3>
                    <p className="text-xs text-muted-foreground">{formatFileSize(previewAttachment.size)}</p>
                  </div>
                </div>
                <a
                  href={previewAttachment.url}
                  download={previewAttachment.filename}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto bg-black/5 dark:bg-white/5 relative">
                {/* Navigation buttons */}
                {previewableAttachments.length > 1 && (
                  <>
                    {/* Previous button */}
                    <button
                      onClick={goToPreviousAttachment}
                      disabled={currentPreviewIndex <= 0}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Previous (Left Arrow)"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    {/* Next button */}
                    <button
                      onClick={goToNextAttachment}
                      disabled={currentPreviewIndex >= previewableAttachments.length - 1}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Next (Right Arrow)"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    {/* Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
                      {currentPreviewIndex + 1} / {previewableAttachments.length}
                    </div>
                  </>
                )}

                {previewAttachment.mimeType.startsWith('image/') && (
                  <div className="flex items-center justify-center p-4 h-full">
                    <img
                      src={previewAttachment.url}
                      alt={previewAttachment.filename}
                      className="max-w-full max-h-[calc(95vh-80px)] object-contain rounded shadow-lg"
                    />
                  </div>
                )}

                {previewAttachment.mimeType.startsWith('video/') && (
                  <div className="flex items-center justify-center p-4 h-full">
                    <video
                      src={previewAttachment.url}
                      controls
                      autoPlay
                      className="max-w-full max-h-[calc(95vh-80px)] rounded shadow-lg"
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                )}

                {/* Fallback for unsupported types */}
                {!previewAttachment.mimeType.startsWith('image/') &&
                 !previewAttachment.mimeType.startsWith('video/') && (
                  <div className="flex flex-col items-center justify-center p-8 min-h-[300px] text-center">
                    <span className="text-6xl mb-4">{getFileIcon(previewAttachment.mimeType)}</span>
                    <p className="text-lg font-medium mb-2">{previewAttachment.filename}</p>
                    <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type</p>
                    <a
                      href={previewAttachment.url}
                      download={previewAttachment.filename}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download File
                    </a>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
