'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface Project {
  id: string
  name: string
  key: string
  logoUrl?: string | null
}

interface User {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'MEMBER'
  avatarUrl?: string | null
  createdAt: string
  projects?: Project[]
}

interface Invite {
  id: string
  email: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedBy: { name: string }
  projects: Project[]
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Invite form
  const [emailsInput, setEmailsInput] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, invitesRes, projectsRes] = await Promise.all([
        fetch('/api/users/all'),
        fetch('/api/invites'),
        fetch('/api/projects'),
      ])

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData || [])
      } else {
        console.error('Failed to fetch users:', usersRes.status)
      }

      if (invitesRes.ok) {
        const invitesData = await invitesRes.json()
        setInvites(invitesData || [])
      } else {
        console.error('Failed to fetch invites:', invitesRes.status)
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        setProjects(projectsData || [])
      } else {
        console.error('Failed to fetch projects:', projectsRes.status)
      }
    } catch (err) {
      setError('Failed to load data')
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Parse emails from input
  function parseEmails(input: string): string[] {
    return input
      .split(/[,;\n]+/)
      .map(email => email.trim().toLowerCase())
      .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  }

  const parsedEmails = parseEmails(emailsInput)
  const uniqueEmails = [...new Set(parsedEmails)]

  async function handleSendInvites() {
    if (uniqueEmails.length === 0 || selectedProjects.size === 0) return

    setSending(true)
    setError(null)
    setSuccess(null)

    let successCount = 0
    let failCount = 0

    for (const email of uniqueEmails) {
      try {
        const res = await fetch('/api/invites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            projectIds: Array.from(selectedProjects),
          }),
        })

        if (res.ok) {
          successCount++
        } else {
          failCount++
        }
      } catch {
        failCount++
      }
    }

    if (successCount > 0) {
      setSuccess(`${successCount} invitation${successCount > 1 ? 's' : ''} sent successfully`)
      setEmailsInput('')
      setSelectedProjects(new Set())
      setShowInviteForm(false)
      fetchData()
    }
    if (failCount > 0) {
      setError(`${failCount} invitation${failCount > 1 ? 's' : ''} failed to send`)
    }

    setSending(false)
    setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 5000)
  }

  async function handleCancelInvite(inviteId: string) {
    if (!confirm('Cancel this invitation?')) return

    try {
      const res = await fetch(`/api/invites?id=${inviteId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setInvites(invites.filter(i => i.id !== inviteId))
        setSuccess('Invitation cancelled')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to cancel invitation')
      }
    } catch (err) {
      setError('Failed to cancel invitation')
      console.error(err)
    }
  }

  async function handleResendInvite(inviteId: string) {
    try {
      const res = await fetch('/api/invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      })

      if (res.ok) {
        const updatedInvite = await res.json()
        setInvites(invites.map(i => i.id === inviteId ? { ...i, ...updatedInvite } : i))
        setSuccess('Invitation resent successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to resend invitation')
      }
    } catch (err) {
      setError('Failed to resend invitation')
      console.error(err)
    }
  }

  async function handleRoleChange(userId: string, newRole: 'ADMIN' | 'MEMBER') {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (res.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
        setSuccess('Role updated')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setError('Failed to update role')
      console.error(err)
    }
  }

  async function handleDeleteUser(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to delete "${userName}"? This action cannot be undone.`)) return

    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setUsers(users.filter(u => u.id !== userId))
        setSuccess('User deleted successfully')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete user')
      }
    } catch (err) {
      setError('Failed to delete user')
      console.error(err)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const pendingInvites = invites.filter(i => i.status === 'PENDING')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Users & Invitations</h1>
            <p className="text-muted-foreground">Manage team members and send invitations</p>
          </div>
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            {showInviteForm ? (
              'Cancel'
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite Users
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-4 rounded-lg">
            {success}
          </div>
        )}

        {/* Compact Invite Form */}
        {showInviteForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Send Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Email Input */}
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Email Addresses</label>
                  <Textarea
                    value={emailsInput}
                    onChange={(e) => setEmailsInput(e.target.value)}
                    placeholder="user1@example.com, user2@example.com"
                    rows={3}
                    className="resize-none font-mono text-sm"
                  />
                  {uniqueEmails.length > 0 && (
                    <p className="text-xs text-primary mt-1">
                      {uniqueEmails.length} valid email{uniqueEmails.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>

                {/* Project Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium">Projects</label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSelectedProjects(new Set(projects.map(p => p.id)))}
                        className="text-primary hover:underline"
                      >
                        All
                      </button>
                      <span className="text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProjects(new Set())}
                        className="text-primary hover:underline"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="border rounded-lg p-2 max-h-[100px] overflow-auto space-y-1">
                    {projects.map((project) => (
                      <label
                        key={project.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedProjects.has(project.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(selectedProjects)
                            if (checked) next.add(project.id)
                            else next.delete(project.id)
                            setSelectedProjects(next)
                          }}
                        />
                        <div className="flex items-center gap-1.5">
                          {project.logoUrl ? (
                            <img src={project.logoUrl} alt="" className="w-4 h-4 rounded" />
                          ) : (
                            <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                              {project.key.slice(0, 2)}
                            </div>
                          )}
                          <span className="text-sm">{project.name}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSendInvites}
                  disabled={sending || uniqueEmails.length === 0 || selectedProjects.size === 0}
                >
                  {sending ? 'Sending...' : `Send ${uniqueEmails.length > 1 ? `${uniqueEmails.length} Invites` : 'Invite'}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending Invites */}
        {pendingInvites.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                Pending Invitations
                <Badge variant="secondary" className="text-xs">{pendingInvites.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-amber-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-sm">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires {formatDate(invite.expiresAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Project avatars */}
                      <div className="flex -space-x-1">
                        {invite.projects.slice(0, 4).map((project) => (
                          <Tooltip key={project.id}>
                            <TooltipTrigger>
                              {project.logoUrl ? (
                                <img
                                  src={project.logoUrl}
                                  alt={project.name}
                                  className="w-6 h-6 rounded border-2 border-white"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded border-2 border-white bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                  {project.key.slice(0, 2)}
                                </div>
                              )}
                            </TooltipTrigger>
                            <TooltipContent>{project.name}</TooltipContent>
                          </Tooltip>
                        ))}
                        {invite.projects.length > 4 && (
                          <div className="w-6 h-6 rounded border-2 border-white bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                            +{invite.projects.length - 4}
                          </div>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-primary"
                            onClick={() => handleResendInvite(invite.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resend invitation</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleCancelInvite(invite.id)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel invitation</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Users */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Team Members
              <Badge variant="secondary" className="text-xs">{users.length}</Badge>
            </CardTitle>
            <CardDescription>
              Manage team members and their access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {user.avatarUrl && <AvatarImage src={user.avatarUrl} />}
                          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {user.projects && user.projects.length > 0 ? (
                        <div className="flex -space-x-1">
                          {user.projects.slice(0, 4).map((project) => (
                            <Tooltip key={project.id}>
                              <TooltipTrigger>
                                {project.logoUrl ? (
                                  <img
                                    src={project.logoUrl}
                                    alt={project.name}
                                    className="w-6 h-6 rounded border-2 border-white"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded border-2 border-white bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                                    {project.key.slice(0, 2)}
                                  </div>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>{project.name}</TooltipContent>
                            </Tooltip>
                          ))}
                          {user.projects.length > 4 && (
                            <Tooltip>
                              <TooltipTrigger>
                                <div className="w-6 h-6 rounded border-2 border-white bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                                  +{user.projects.length - 4}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {user.projects.slice(4).map(p => p.name).join(', ')}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value as 'ADMIN' | 'MEMBER')}
                      >
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="MEMBER">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteUser(user.id, user.name)}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete user</TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
