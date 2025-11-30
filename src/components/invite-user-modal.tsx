'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Project {
  id: string
  name: string
  key: string
  logoUrl?: string | null
}

interface InviteResult {
  email: string
  success: boolean
  error?: string
}

interface InviteUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: Project[]
  onInviteSent?: () => void
}

export function InviteUserModal({ open, onOpenChange, projects, onInviteSent }: InviteUserModalProps) {
  const [emailsInput, setEmailsInput] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<InviteResult[] | null>(null)

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setEmailsInput('')
      setSelectedProjects(new Set())
      setError(null)
      setResults(null)
    }
  }, [open])

  // Parse emails from input (comma, semicolon, or newline separated)
  function parseEmails(input: string): string[] {
    return input
      .split(/[,;\n]+/)
      .map(email => email.trim().toLowerCase())
      .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  }

  const parsedEmails = parseEmails(emailsInput)
  const uniqueEmails = [...new Set(parsedEmails)]

  function toggleProject(projectId: string) {
    setSelectedProjects((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  function selectAll() {
    setSelectedProjects(new Set(projects.map(p => p.id)))
  }

  function deselectAll() {
    setSelectedProjects(new Set())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (uniqueEmails.length === 0) {
      setError('Please enter at least one valid email address')
      return
    }

    if (selectedProjects.size === 0) {
      setError('Please select at least one project')
      return
    }

    setSending(true)
    setError(null)

    const inviteResults: InviteResult[] = []

    // Send invites one by one to track individual results
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
          inviteResults.push({ email, success: true })
        } else {
          const data = await res.json()
          inviteResults.push({ email, success: false, error: data.error || 'Failed to send' })
        }
      } catch {
        inviteResults.push({ email, success: false, error: 'Network error' })
      }
    }

    setResults(inviteResults)
    
    const successCount = inviteResults.filter(r => r.success).length
    if (successCount > 0) {
      onInviteSent?.()
    }

    setSending(false)
  }

  const successCount = results?.filter(r => r.success).length || 0
  const failCount = results?.filter(r => !r.success).length || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Users</DialogTitle>
          <DialogDescription>
            Send invitations to join Scrumbies. Enter multiple email addresses separated by commas or new lines.
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="py-4">
            {/* Summary */}
            <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
              {successCount > 0 && (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium">{successCount} sent</span>
                </div>
              )}
              {failCount > 0 && (
                <div className="flex items-center gap-2 text-red-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm font-medium">{failCount} failed</span>
                </div>
              )}
            </div>

            {/* Results list */}
            <div className="space-y-2 max-h-64 overflow-auto">
              {results.map((result, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {result.success ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  <span className="truncate flex-1">{result.email}</span>
                  {result.error && (
                    <span className="text-xs opacity-75">{result.error}</span>
                  )}
                </div>
              ))}
            </div>

            <DialogFooter className="mt-4">
              <Button onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium">Email Addresses</label>
                  {uniqueEmails.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {uniqueEmails.length} email{uniqueEmails.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <Textarea
                  value={emailsInput}
                  onChange={(e) => setEmailsInput(e.target.value)}
                  placeholder="user1@example.com, user2@example.com&#10;user3@example.com"
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Separate multiple emails with commas, semicolons, or new lines
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Assign to Projects</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-xs text-muted-foreground">|</span>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="text-xs text-primary hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg divide-y max-h-40 overflow-auto">
                  {projects.map((project) => (
                    <label
                      key={project.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {project.logoUrl ? (
                          <img src={project.logoUrl} alt="" className="w-6 h-6 rounded" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                            {project.key.slice(0, 2)}
                          </div>
                        )}
                        <span className="text-sm font-medium truncate">{project.name}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {project.key}
                        </Badge>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedProjects.size > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedProjects.size} project{selectedProjects.size > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending || uniqueEmails.length === 0}>
                {sending ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  `Send ${uniqueEmails.length > 1 ? `${uniqueEmails.length} Invitations` : 'Invitation'}`
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
