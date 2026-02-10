'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FileViewerPopupProps {
  open: boolean
  onClose: () => void
  fileUrl: string
  filename: string
  mimeType: string
}

export function FileViewerPopup({
  open,
  onClose,
  fileUrl,
  filename,
  mimeType,
}: FileViewerPopupProps) {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open) {
      setLoading(true)
    }
  }, [open, fileUrl])

  const isPDF = mimeType === 'application/pdf'
  const isImage = mimeType.startsWith('image/')
  const isVideo = mimeType.startsWith('video/')
  const isAudio = mimeType.startsWith('audio/')
  const isText = mimeType.startsWith('text/') || mimeType === 'application/json'

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const renderContent = () => {
    if (isPDF) {
      return (
        <div className="relative w-full h-full min-h-[70vh]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Loading PDF...
              </div>
            </div>
          )}
          <object
            data={fileUrl}
            type="application/pdf"
            className="w-full h-full min-h-[70vh]"
            onLoad={() => setLoading(false)}
          >
            {/* Fallback if object tag fails */}
            <embed
              src={fileUrl}
              type="application/pdf"
              className="w-full h-full min-h-[70vh]"
            />
          </object>
        </div>
      )
    }

    if (isImage) {
      return (
        <div className="relative flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-5 h-5 animate-spin text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
          )}
          <img
            src={fileUrl}
            alt={filename}
            className="max-w-full max-h-[70vh] object-contain"
            onLoad={() => setLoading(false)}
          />
        </div>
      )
    }

    if (isVideo) {
      return (
        <div className="relative">
          <video
            src={fileUrl}
            controls
            className="w-full max-h-[70vh]"
            onLoadedData={() => setLoading(false)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="p-8 flex flex-col items-center justify-center gap-4">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="w-12 h-12 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <audio
            src={fileUrl}
            controls
            className="w-full max-w-md"
            onLoadedData={() => setLoading(false)}
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      )
    }

    if (isText) {
      return (
        <TextFileViewer fileUrl={fileUrl} onLoaded={() => setLoading(false)} />
      )
    }

    // Fallback for unsupported file types
    return (
      <div className="p-8 text-center">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-muted-foreground mb-4">
          This file type cannot be previewed in the browser.
        </p>
        <Button onClick={handleDownload}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download File
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className={cn(
        "max-w-5xl w-[95vw] max-h-[95vh] p-0 gap-0 overflow-hidden",
        isPDF && "h-[90vh]"
      )}>
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-base font-medium truncate pr-4">
            {filename}
          </DialogTitle>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(fileUrl, '_blank')}
              className="gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in Tab
            </Button>
          </div>
        </DialogHeader>
        <div className={cn(
          "flex-1 overflow-auto bg-muted/20",
          isPDF && "h-full"
        )}>
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Helper component for text files
function TextFileViewer({ fileUrl, onLoaded }: { fileUrl: string, onLoaded: () => void }) {
  const [content, setContent] = useState<string>('')
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(fileUrl)
      .then(res => res.text())
      .then(text => {
        setContent(text)
        onLoaded()
      })
      .catch(() => {
        setError(true)
        onLoaded()
      })
  }, [fileUrl, onLoaded])

  if (error) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Failed to load text content
      </div>
    )
  }

  return (
    <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words overflow-auto max-h-[70vh]">
      {content}
    </pre>
  )
}
