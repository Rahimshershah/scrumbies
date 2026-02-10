'use client'

import { cn } from '@/lib/utils'
import type { Folder } from './spaces-view'

interface ExplorerBreadcrumbProps {
  currentFolder: Folder | null
  onNavigateToRoot: () => void
}

export function ExplorerBreadcrumb({ currentFolder, onNavigateToRoot }: ExplorerBreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        onClick={onNavigateToRoot}
        className={cn(
          'hover:text-foreground transition-colors',
          currentFolder ? 'text-muted-foreground' : 'text-foreground font-medium'
        )}
      >
        Documents
      </button>
      {currentFolder && (
        <>
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            {currentFolder.name}
          </span>
        </>
      )}
    </div>
  )
}
