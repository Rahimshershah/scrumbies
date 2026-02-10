'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Attachment {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
  uploadedBy: {
    id: string
    name: string
  }
}

interface DocumentAttachmentsProps {
  documentId: string
  canEdit: boolean
}

export function DocumentAttachments({ documentId, canEdit }: DocumentAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch attachments
  useEffect(() => {
    async function fetchAttachments() {
      try {
        const res = await fetch(`/api/documents/${documentId}/attachments`)
        if (res.ok) {
          const data = await res.json()
          setAttachments(data)
        }
      } catch (error) {
        console.error('Failed to fetch attachments:', error)
      }
    }
    fetchAttachments()
  }, [documentId])

  // Upload handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`/api/documents/${documentId}/attachments`, {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const attachment = await res.json()
          setAttachments(prev => [attachment, ...prev])
        } else {
          const error = await res.json()
          alert(error.error || 'Failed to upload file')
        }
      }
    } catch (error) {
      console.error('Failed to upload:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Delete handler
  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Are you sure you want to delete this attachment?')) return

    try {
      const res = await fetch(`/api/documents/attachments/${attachmentId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId))
      }
    } catch (error) {
      console.error('Failed to delete attachment:', error)
    }
  }

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get file icon based on type
  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/')) {
      return (
        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    }
    if (mimeType === 'application/pdf') {
      return (
        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
      return (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
    if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    }
    return (
      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  }

  // Check if file is previewable image
  const isImage = (mimeType: string) => mimeType.startsWith('image/')
  const isPDF = (mimeType: string) => mimeType === 'application/pdf'

  if (attachments.length === 0 && !canEdit) {
    return null
  }

  return (
    <div className="border-b bg-muted/30">
      <div className="px-6 py-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <svg
              className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Attachments ({attachments.length})
          </button>
          {canEdit && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-1.5"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add File
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        {expanded && attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-3">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative bg-background rounded-lg border overflow-hidden hover:border-primary/50 transition-colors"
              >
                {/* Thumbnail or Icon */}
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {isImage(attachment.mimeType) ? (
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={attachment.url}
                        alt={attachment.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : isPDF(attachment.mimeType) ? (
                    <div className="aspect-square bg-red-50 dark:bg-red-950/20 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-10 h-10 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-medium text-red-600 dark:text-red-400 mt-1">PDF</span>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-square bg-muted flex items-center justify-center">
                      <div className="text-center">
                        {getFileIcon(attachment.mimeType, attachment.filename)}
                        <span className="text-xs text-muted-foreground mt-1 block">
                          {attachment.filename.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                </a>

                {/* Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate" title={attachment.filename}>
                    {attachment.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(attachment.size)}
                  </p>
                </div>

                {/* Delete button */}
                {canEdit && (
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="absolute top-1 right-1 p-1 rounded bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {expanded && attachments.length === 0 && canEdit && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">No attachments yet</p>
            <p className="text-xs mt-1">Click "Add File" to upload documents, images, or PDFs</p>
          </div>
        )}
      </div>
    </div>
  )
}
