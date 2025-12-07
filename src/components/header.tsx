'use client'

import { useState, useEffect, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { NotificationPanel } from './notification-panel'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Project } from '@/types'
import type { AppView } from './app-shell'

interface HeaderProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    avatarUrl?: string | null
  }
  unreadCount: number
  projects?: Project[]
  currentProjectId?: string
  onProjectChange?: (projectId: string) => void
  onUserUpdate?: (user: { name: string; email: string; avatarUrl?: string | null }) => void
  currentView?: AppView
  onViewChange?: (view: AppView) => void
  onTaskSelect?: (taskId: string) => void
  onUnreadCountChange?: () => void
}

export function Header({ user, unreadCount, projects: initialProjects, currentProjectId, onProjectChange, onUserUpdate, currentView = 'backlog', onViewChange, onTaskSelect, onUnreadCountChange }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [projects, setProjects] = useState<Project[]>(initialProjects || [])
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0] || null
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectKey, setNewProjectKey] = useState('')
  const [newProjectLogo, setNewProjectLogo] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Profile state
  const [showProfile, setShowProfile] = useState(false)
  const [profileName, setProfileName] = useState(user.name)
  const [profileEmail, setProfileEmail] = useState(user.email)
  const [profileAvatar, setProfileAvatar] = useState(user.avatarUrl || null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Sync projects from props
  useEffect(() => {
    if (initialProjects) {
      setProjects(initialProjects)
    }
  }, [initialProjects])

  async function handleCreateProject() {
    if (!newProjectName.trim() || !newProjectKey.trim()) return
    
    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          key: newProjectKey.trim(),
          logoUrl: newProjectLogo,
        }),
      })
      
      if (res.ok) {
        const project = await res.json()
        setProjects(prev => [...prev, project])
        onProjectChange?.(project.id)
        setShowCreateProject(false)
        setNewProjectName('')
        setNewProjectKey('')
        setNewProjectLogo(null)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setCreating(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewProjectLogo(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  async function handleLogoUpload(projectId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const logoUrl = reader.result as string
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoUrl }),
        })
        if (res.ok) {
          const updated = await res.json()
          setProjects(prev => prev.map(p => p.id === projectId ? updated : p))
        }
      } catch (error) {
        console.error('Failed to upload logo:', error)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const res = await fetch('/api/user/profile', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const updated = await res.json()
        setProfileAvatar(updated.avatarUrl)
        onUserUpdate?.({ name: updated.name, email: updated.email, avatarUrl: updated.avatarUrl })
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to upload avatar')
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error)
    } finally {
      setUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  async function handleSaveProfile() {
    if (!profileName.trim()) return

    // Validate password ONLY if user is actually trying to change it
    // (i.e., both currentPassword and newPassword are provided)
    setPasswordError('')
    const isChangingPassword = currentPassword && newPassword
    if (isChangingPassword) {
      if (newPassword.length < 6) {
        setPasswordError('New password must be at least 6 characters')
        return
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('New passwords do not match')
        return
      }
    }

    // If only partial password fields are filled, clear them (user probably didn't mean to change password)
    if ((currentPassword || newPassword || confirmPassword) && !isChangingPassword) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }

    setSavingProfile(true)
    try {
      const body: Record<string, string> = {
        name: profileName.trim(),
      }

      // Include password change only if both current and new passwords are provided
      if (isChangingPassword) {
        body.currentPassword = currentPassword
        body.newPassword = newPassword
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const updated = await res.json()
        onUserUpdate?.({ name: updated.name, email: updated.email, avatarUrl: updated.avatarUrl })
        setShowProfile(false)
        // Clear password fields
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        const error = await res.json()
        if (error.error?.includes('password')) {
          setPasswordError(error.error)
        } else {
          alert(error.error || 'Failed to update profile')
        }
      }
    } catch (error) {
      console.error('Failed to save profile:', error)
    } finally {
      setSavingProfile(false)
    }
  }

  // Sync profile state when user prop changes
  useEffect(() => {
    setProfileName(user.name)
    setProfileEmail(user.email)
    setProfileAvatar(user.avatarUrl || null)
  }, [user])

  return (
    <>
      <header className="bg-background border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a
              href="/"
              className="text-xl font-bold hover:text-primary transition-colors"
              onClick={() => {
                localStorage.setItem('scrumbies_current_view', 'backlog')
              }}
            >
              Scrumbies
            </a>
            
            {/* Project Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 h-9">
                  {currentProject ? (
                    <>
                      <Avatar className="w-6 h-6">
                        {currentProject.logoUrl ? (
                          <AvatarImage src={currentProject.logoUrl} alt={currentProject.name} />
                        ) : null}
                        <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                          {currentProject.key.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{currentProject.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select Project</span>
                  )}
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Projects
                </div>
                {projects.map((project) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => onProjectChange?.(project.id)}
                    className="gap-2"
                  >
                    <Avatar className="w-6 h-6">
                      {project.logoUrl ? (
                        <AvatarImage src={project.logoUrl} alt={project.name} />
                      ) : null}
                      <AvatarFallback className="text-[10px] bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                        {project.key.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span className="font-medium">{project.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{project.key}</span>
                    </div>
                    {currentProject?.id === project.id && (
                      <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </DropdownMenuItem>
                ))}
                {projects.length === 0 && (
                  <div className="px-2 py-4 text-sm text-center text-muted-foreground">
                    No projects yet
                  </div>
                )}
                {user.role === 'ADMIN' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowCreateProject(true)} className="gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Project
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Switcher */}
            <div className="flex items-center border rounded-lg p-0.5 bg-muted/30">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-7 px-3 rounded-md transition-all ${
                  currentView === 'backlog' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium hover:bg-primary/90' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                }`}
                onClick={() => onViewChange?.('backlog')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Backlog
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-7 px-3 rounded-md transition-all ${
                  currentView === 'epics' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium hover:bg-primary/90' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                }`}
                onClick={() => onViewChange?.('epics')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Epics
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={`h-7 px-3 rounded-md transition-all ${
                  currentView === 'spaces' 
                    ? 'bg-primary text-primary-foreground shadow-sm font-medium hover:bg-primary/90' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                }`}
                onClick={() => onViewChange?.('spaces')}
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Spaces
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  const wasOpen = showNotifications
                  setShowNotifications(!showNotifications)
                  
                  // If opening the panel and there are unread notifications, mark all as read
                  if (!wasOpen && unreadCount > 0) {
                    try {
                      await fetch('/api/notifications', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ markAllRead: true }),
                      })
                      onUnreadCountChange?.()
                    } catch (error) {
                      console.error('Failed to mark notifications as read:', error)
                    }
                  }
                }}
                className="relative"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>

              {showNotifications && (
                <NotificationPanel 
                  onClose={() => setShowNotifications(false)} 
                  onTaskSelect={onTaskSelect}
                  onMarkAllRead={onUnreadCountChange}
                />
              )}
            </div>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Avatar className="w-8 h-8">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:inline">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-3 flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    {user.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={user.name} />
                    ) : null}
                    <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowProfile(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Edit Profile
                </DropdownMenuItem>
                {user.role === 'ADMIN' && (
                  <>
                    <DropdownMenuItem asChild>
                      <a href="/admin/users" className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Users & Invites
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <a href="/admin/settings" className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Project Settings
                      </a>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Create Project Modal */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Logo Upload */}
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {newProjectLogo ? (
                  <img src={newProjectLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">Project Logo</p>
                <p className="text-xs text-muted-foreground">Click to upload an image</p>
              </div>
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name *</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g., HesabPay"
              />
            </div>

            {/* Project Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Key *</label>
              <Input
                value={newProjectKey}
                onChange={(e) => setNewProjectKey(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="e.g., HP"
                maxLength={5}
              />
              <p className="text-xs text-muted-foreground">
                A short identifier for the project (2-5 characters)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateProject(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProject} 
              disabled={creating || !newProjectName.trim() || !newProjectKey.trim()}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}>
            <div className="space-y-6 py-4">
              {/* Avatar Upload */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar className="w-24 h-24">
                    {profileAvatar ? (
                      <AvatarImage src={profileAvatar} alt={profileName} />
                    ) : null}
                    <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                      {profileName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute bottom-0 right-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
                  >
                    {uploadingAvatar ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p className="text-xs text-muted-foreground">Click the camera icon to upload a new photo</p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Your name"
                />
              </div>

              {/* Email (read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  {profileEmail}
                </div>
              </div>

              {/* Role (read-only) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <div className="px-3 py-2 bg-muted rounded-md text-sm">
                  {user.role === 'ADMIN' ? 'Administrator' : 'Member'}
                </div>
              </div>

              {/* Password Change Section */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Change Password</h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Current Password</label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">New Password</label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Confirm New Password</label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-500">{passwordError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Leave blank to keep current password</p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowProfile(false)}>
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={savingProfile || !profileName.trim()}
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </>
  )
}
