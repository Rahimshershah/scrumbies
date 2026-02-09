'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BulkActionsToolbarProps {
  selectedCount: number
  lastSelectedElement: HTMLElement | null
  onMove: () => void
  onDelete: () => void
  onClearSelection: () => void
}

export function BulkActionsToolbar({
  selectedCount,
  lastSelectedElement,
  onMove,
  onDelete,
  onClearSelection,
}: BulkActionsToolbarProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!lastSelectedElement || selectedCount === 0) return

    const updatePosition = () => {
      const rect = lastSelectedElement.getBoundingClientRect()
      const toolbarWidth = toolbarRef.current?.offsetWidth || 200

      // Position below and slightly to the right of the selected task
      let top = rect.bottom + 8
      let left = rect.left + 40

      // Keep within viewport bounds
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Adjust if going off right edge
      if (left + toolbarWidth > viewportWidth - 16) {
        left = viewportWidth - toolbarWidth - 16
      }

      // Adjust if going off bottom edge - show above instead
      if (top + 50 > viewportHeight) {
        top = rect.top - 50
      }

      // Minimum bounds
      left = Math.max(16, left)
      top = Math.max(16, top)

      setPosition({ top, left })
    }

    updatePosition()

    // Update on scroll and resize
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [lastSelectedElement, selectedCount])

  if (selectedCount === 0) return null

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-50 flex items-center gap-2 px-3 py-2 rounded-lg",
        "bg-popover border shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150"
      )}
      style={{ top: position.top, left: position.left }}
    >
      <span className="text-sm font-medium text-muted-foreground mr-1">
        {selectedCount} selected
      </span>

      <Button
        size="sm"
        variant="outline"
        onClick={onMove}
        className="h-8"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        Move
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={onDelete}
        className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </Button>

      <button
        onClick={onClearSelection}
        className="ml-1 p-1 rounded hover:bg-muted transition-colors"
        title="Clear selection"
      >
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
