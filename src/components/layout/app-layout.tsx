'use client'

import { useState } from 'react'
import { Sprint } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  activeSprint?: Sprint | null
  completedSprints: Sprint[]
  selectedSprint?: Sprint | null
  onSprintSelect: (sprint: Sprint | null) => void
  currentUser?: { id: string; role: string }
  onSprintReactivate?: (sprintId: string) => void
  currentView?: 'backlog' | 'epics' | 'spaces'
  onViewChange?: (view: 'backlog' | 'epics' | 'spaces') => void
}

function formatDate(dateString: string | null | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function formatRelativeDate(dateString: string | null | undefined) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return formatDate(dateString)
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        active 
          ? "bg-primary text-primary-foreground" 
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function Sidebar({ 
  activeSprint,
  completedSprints,
  selectedSprint,
  onSprintSelect,
  currentUser,
  onSprintReactivate,
  currentView,
  onViewChange,
  className 
}: {
  activeSprint?: Sprint | null
  completedSprints: Sprint[]
  selectedSprint?: Sprint | null
  onSprintSelect: (sprint: Sprint | null) => void
  currentUser?: { id: string; role: string }
  onSprintReactivate?: (sprintId: string) => void
  currentView?: 'backlog' | 'epics' | 'spaces'
  onViewChange?: (view: 'backlog' | 'epics' | 'spaces') => void
  className?: string
}) {
  const isAdmin = currentUser?.role === 'ADMIN'
  return (
    <div className={cn("flex flex-col h-full bg-background border-r", className)}>
      {/* Navigation Menu */}
      <div className="p-3 space-y-1 border-b">
        <NavItem
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          }
          label="Backlog"
          active={!selectedSprint && currentView === 'backlog'}
          onClick={() => {
            onSprintSelect(null)
            onViewChange?.('backlog')
          }}
        />
        <NavItem
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
          label="Epics"
          active={currentView === 'epics'}
          onClick={() => onViewChange?.('epics')}
        />
      </div>

      {/* Active Sprint Shortcut */}
      {activeSprint && (
        <div className="px-3 pb-1 pt-3 border-b">
          <button
            onClick={() => onSprintSelect(activeSprint)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              selectedSprint?.id === activeSprint.id
                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
            <span className="truncate flex-1 text-left">{activeSprint.name}</span>
          </button>
        </div>
      )}

      {/* Sprint History */}
      <div className="px-3 pt-3 pb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Sprint History
        </span>
      </div>
      
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5 pb-4">
          {completedSprints.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-4 text-center">
              No completed sprints yet
            </p>
          ) : (
            completedSprints.map((sprint) => {
              const isSelected = selectedSprint?.id === sprint.id
              const completedTasks = sprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length
              const totalTasks = sprint.tasks.length
              
              return (
                <div key={sprint.id} className="flex items-center gap-1">
                  <button
                    onClick={() => onSprintSelect(sprint)}
                    className={cn(
                      "flex-1 text-left px-3 py-2.5 rounded-lg transition-all group",
                      isSelected 
                        ? "bg-accent" 
                        : "hover:bg-accent/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-400" />
                      <span className={cn(
                        "text-sm truncate flex-1",
                        isSelected ? "font-medium" : "text-muted-foreground group-hover:text-foreground"
                      )}>
                        {sprint.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-4">
                      <span className="text-[10px] text-muted-foreground">
                        {sprint.endDate ? formatDate(sprint.endDate) : 'No end date'}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">•</span>
                      <span className="text-[10px] text-muted-foreground">
                        {completedTasks}/{totalTasks} done
                      </span>
                    </div>
                  </button>
                  {isAdmin && onSprintReactivate && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSprintReactivate(sprint.id)}>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reactivate Sprint
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function AppLayout({ 
  children, 
  activeSprint,
  completedSprints, 
  selectedSprint,
  onSprintSelect,
  currentUser,
  onSprintReactivate,
  currentView = 'backlog',
  onViewChange,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-56 flex-shrink-0">
        <Sidebar 
          activeSprint={activeSprint}
          completedSprints={completedSprints} 
          selectedSprint={selectedSprint}
          onSprintSelect={onSprintSelect}
          currentUser={currentUser}
          onSprintReactivate={onSprintReactivate}
          currentView={currentView}
          onViewChange={onViewChange}
          className="w-full h-full" 
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="md:hidden fixed bottom-4 left-4 z-50 shadow-lg"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            History
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-56 p-0">
          <Sidebar 
            activeSprint={activeSprint}
            completedSprints={completedSprints} 
            selectedSprint={selectedSprint}
            onSprintSelect={(sprint) => {
              onSprintSelect(sprint)
              setSidebarOpen(false)
            }}
            currentUser={currentUser}
            onSprintReactivate={onSprintReactivate}
            currentView={currentView}
            onViewChange={(view) => {
              onViewChange?.(view)
              setSidebarOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden bg-background">
        {children}
      </main>
    </div>
  )
}
