'use client'

import { useState, useEffect } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Version {
  id: string
  title: string
  content: any
  versionNumber: number
  createdAt: string
  createdBy: {
    id: string
    name: string
    avatarUrl?: string | null
  }
}

interface VersionHistoryProps {
  documentId: string
  onRestore: (versionId: string) => void
  onClose: () => void
}

export function VersionHistory({ documentId, onRestore, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchVersions() {
      try {
        const res = await fetch(`/api/documents/${documentId}/versions`)
        if (res.ok) {
          const data = await res.json()
          setVersions(data)
        }
      } catch (error) {
        console.error('Failed to fetch versions:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchVersions()
  }, [documentId])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Version History</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <svg className="w-5 h-5 animate-spin mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">No versions yet</p>
              <p className="text-xs mt-1">Click &quot;Save Version&quot; to create a snapshot</p>
            </div>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                        v{version.versionNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(version.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium mt-1 truncate">{version.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Avatar className="w-5 h-5">
                        {version.createdBy.avatarUrl && (
                          <AvatarImage src={version.createdBy.avatarUrl} />
                        )}
                        <AvatarFallback className="text-[8px]">
                          {version.createdBy.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {version.createdBy.name}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => onRestore(version.id)}
                  >
                    Restore
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
