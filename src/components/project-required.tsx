'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface ProjectRequiredProps {
  user: {
    id: string
    name: string
    role: string
  }
}

export function ProjectRequired({ user }: ProjectRequiredProps) {
  const router = useRouter()
  const [projectName, setProjectName] = useState('')
  const [projectKey, setProjectKey] = useState('')
  const [projectLogo, setProjectLogo] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = user.role === 'ADMIN'

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setProjectLogo(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  async function handleCreateProject() {
    if (!projectName.trim() || !projectKey.trim()) {
      setError('Project name and key are required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          key: projectKey.trim().toUpperCase(),
          logoUrl: projectLogo,
        }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create project')
      }
    } catch (err) {
      setError('Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-57px)] flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-accent/20">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Welcome to Scrumbies</CardTitle>
          <CardDescription>
            {isAdmin 
              ? "Create your first project to get started with sprint planning."
              : "Ask an admin to create a project and add you as a member."
            }
          </CardDescription>
        </CardHeader>
        
        {isAdmin ? (
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="flex justify-center">
              <div 
                className="w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                {projectLogo ? (
                  <img src={projectLogo} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <svg className="w-8 h-8 mx-auto text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px] text-muted-foreground">Add logo</span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name *</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., HesabPay"
                className="text-lg"
              />
            </div>

            {/* Project Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Key *</label>
              <Input
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase().slice(0, 5))}
                placeholder="e.g., HP"
                maxLength={5}
                className="text-lg font-mono"
              />
              <p className="text-xs text-muted-foreground">
                A short identifier (2-5 characters) used to prefix task IDs
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </div>
            )}

            <Button 
              onClick={handleCreateProject} 
              disabled={creating || !projectName.trim() || !projectKey.trim()}
              className="w-full"
              size="lg"
            >
              {creating ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </>
              )}
            </Button>
          </CardContent>
        ) : (
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-muted-foreground">
              You don't have access to any projects yet.<br />
              Contact an administrator to get started.
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

