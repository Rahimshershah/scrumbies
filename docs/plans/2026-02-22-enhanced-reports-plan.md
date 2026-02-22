# Enhanced Sprint Reports Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the Reports section to support UAT sprints, merged multi-sprint reports grouped by team then epic, and inline go-live date pickers.

**Architecture:** Modify the `/api/reports/generate` API to return a merged report structure grouped by team → epic. Update the frontend to include UAT sprints, render team-grouped layout, and add date pickers. Update the PDF template to match.

**Tech Stack:** Next.js 14, Prisma, React, TypeScript, Tailwind CSS

---

### Task 1: Update API — Merged Report with Team Grouping

**Files:**
- Modify: `src/app/api/reports/generate/route.ts`

**Step 1: Rewrite the report generation to produce a merged, team-grouped report**

Replace the entire POST handler in `src/app/api/reports/generate/route.ts`. Key changes:
- Fetch all tasks from all selected sprints, deduplicate by task ID
- Fetch project teams from `ProjectTeam` table for color/name info
- Group tasks by `task.team` (string key), then by `task.epicId` within each team
- Sort: named teams alphabetically first, "No Team" last
- AI summaries still generated per-epic and overall
- Include `task.team` and sprint name in each task's response data

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { sprintIds, projectId, reportType = 'detailed' } = body

    if (!sprintIds || sprintIds.length === 0) {
      return NextResponse.json({ error: 'No sprints selected' }, { status: 400 })
    }

    const openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null

    // Fetch sprints with all related data (no status filter — frontend controls which sprints are sent)
    const sprints = await prisma.sprint.findMany({
      where: {
        id: { in: sprintIds },
        projectId,
      },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            epic: true,
            attachments: {
              select: { id: true, filename: true, url: true },
            },
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              include: {
                author: {
                  select: { name: true },
                },
              },
            },
            splitFrom: {
              select: { id: true, taskKey: true, title: true },
            },
            splitTasks: {
              select: { id: true, taskKey: true, title: true },
            },
          },
        },
      },
      orderBy: { endDate: 'desc' },
    })

    // Build sprint name lookup
    const sprintNameMap = new Map(sprints.map(s => [s.id, s.name]))
    const sprintNames = sprints.map(s => s.name)

    // Calculate date range across all selected sprints
    const allStartDates = sprints.map(s => s.startDate).filter(Boolean) as Date[]
    const allEndDates = sprints.map(s => s.endDate).filter(Boolean) as Date[]
    const sprintDateRange = allStartDates.length > 0 && allEndDates.length > 0
      ? {
          start: new Date(Math.min(...allStartDates.map(d => d.getTime()))).toISOString(),
          end: new Date(Math.max(...allEndDates.map(d => d.getTime()))).toISOString(),
        }
      : null

    // Flatten all tasks, deduplicate by task ID (keep first occurrence)
    const seenTaskIds = new Set<string>()
    const allTasks: (typeof sprints[0]['tasks'][0] & { sprintName: string })[] = []
    for (const sprint of sprints) {
      for (const task of sprint.tasks) {
        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id)
          allTasks.push({ ...task, sprintName: sprint.name })
        }
      }
    }

    // Fetch project teams for color/name info
    const projectTeams = await prisma.projectTeam.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })
    const teamMap = new Map(projectTeams.map(t => [t.key, { key: t.key, name: t.name, color: t.color, bgColor: t.bgColor }]))

    // Get epics for grouping
    const epicIds = [...new Set(allTasks.map(t => t.epicId).filter(Boolean))]
    const epics = await prisma.epic.findMany({
      where: { id: { in: epicIds as string[] } },
    })
    const epicMap = new Map(epics.map(e => [e.id, e]))

    // Helper to strip HTML
    const stripHtml = (html: string) => {
      if (!html) return ''
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
    }

    // Group tasks: team -> epic -> tasks
    const teamGroups = new Map<string | null, Map<string | null, any[]>>()

    for (const task of allTasks) {
      const teamKey = task.team || null
      if (!teamGroups.has(teamKey)) {
        teamGroups.set(teamKey, new Map())
      }
      const epicGroupsForTeam = teamGroups.get(teamKey)!
      const epicId = task.epicId || null
      if (!epicGroupsForTeam.has(epicId)) {
        epicGroupsForTeam.set(epicId, [])
      }

      // Count how many sprints this task has been in
      const sprintCount = await prisma.sprint.count({
        where: { tasks: { some: { id: task.id } } },
      })

      let aiDescriptionSummary: string | null = null
      let aiCommentsSummary: string | null = null

      if (openai && reportType === 'detailed') {
        if (task.description && stripHtml(task.description).length > 50) {
          try {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Summarize this task description in one brief sentence (max 25 words). Be direct and factual.' },
                { role: 'user', content: stripHtml(task.description) },
              ],
              max_tokens: 60,
            })
            aiDescriptionSummary = completion.choices[0]?.message?.content?.trim() || null
          } catch (error) {
            console.error(`Failed to summarize description for task ${task.id}:`, error)
          }
        }

        if (task.comments && task.comments.length > 0) {
          try {
            const commentsText = task.comments.map(c => `${c.author.name}: ${stripHtml(c.content)}`).join('\n')
            if (commentsText.length > 50) {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'Summarize these task comments in one brief sentence (max 20 words). Focus on key decisions or updates.' },
                  { role: 'user', content: commentsText },
                ],
                max_tokens: 50,
              })
              aiCommentsSummary = completion.choices[0]?.message?.content?.trim() || null
            }
          } catch (error) {
            console.error(`Failed to summarize comments for task ${task.id}:`, error)
          }
        }
      }

      epicGroupsForTeam.get(epicId)!.push({
        ...task,
        sprintCount,
        aiDescriptionSummary,
        aiCommentsSummary,
        hasComments: task.comments && task.comments.length > 0,
        hasDescription: !!task.description && stripHtml(task.description).length > 0,
        sprintName: task.sprintName,
      })
    }

    // Build tasksByTeam array, sorted: named teams alphabetically, null team last
    const sortedTeamKeys = [...teamGroups.keys()].sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      const nameA = teamMap.get(a)?.name || a
      const nameB = teamMap.get(b)?.name || b
      return nameA.localeCompare(nameB)
    })

    const tasksByTeam = []
    for (const teamKey of sortedTeamKeys) {
      const epicGroupsMap = teamGroups.get(teamKey)!
      const epicGroups = []

      // Sort epics: named epics first, null epic last
      const sortedEpicIds = [...epicGroupsMap.keys()].sort((a, b) => {
        if (a === null) return 1
        if (b === null) return -1
        return 0
      })

      for (const epicId of sortedEpicIds) {
        const epic = epicId ? epicMap.get(epicId) : null
        const tasks = epicGroupsMap.get(epicId) || []

        let epicSummary: string | undefined
        if (openai && reportType === 'summarized' && tasks.length > 0) {
          try {
            const taskList = tasks.map((t: any) => {
              const desc = t.description ? stripHtml(t.description).slice(0, 100) : ''
              const isComplete = t.status === 'DONE' || t.status === 'LIVE'
              const wasSplit = t.splitTasks && t.splitTasks.length > 0
              const isContinuation = !!t.splitFromId
              let statusInfo = ''
              if (isComplete && !wasSplit) statusInfo = '✓ COMPLETED'
              else if (wasSplit) statusInfo = '⇅ SPLIT (work continued in next sprint)'
              else if (isContinuation && isComplete) statusInfo = '✓ COMPLETED (continuation from previous sprint)'
              else if (isContinuation) statusInfo = '↳ CONTINUATION (in progress)'
              else statusInfo = '→ CARRIED OVER (not completed)'
              return `- ${t.taskKey} "${t.title}": ${statusInfo}. ${desc || ''}`
            }).join('\n')

            const epicName = epic?.name || 'Uncategorized tasks'
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Summarize in 2-3 sentences. Be accurate about what was completed vs in progress.' },
                { role: 'user', content: `Epic: ${epicName}\n${tasks.length} tasks:\n${taskList}` },
              ],
              max_tokens: 150,
            })
            epicSummary = completion.choices[0]?.message?.content?.trim()
          } catch (error) {
            console.error('Failed to generate epic summary:', error)
          }
        }

        epicGroups.push({
          epic: epic ? { id: epic.id, name: epic.name, color: epic.color, description: epic.description } : null,
          tasks,
          epicSummary,
        })
      }

      tasksByTeam.push({
        team: teamKey ? (teamMap.get(teamKey) || { key: teamKey, name: teamKey, color: '#64748b', bgColor: '#f1f5f9' }) : null,
        epicGroups,
      })
    }

    // Generate overall AI summary
    let aiSummary: string | undefined
    if (openai) {
      try {
        const taskSummaries = allTasks.map(t => {
          const isComplete = t.status === 'DONE' || t.status === 'LIVE'
          const wasSplit = t.splitTasks && t.splitTasks.length > 0
          let status = ''
          if (isComplete && !wasSplit) status = '✓ COMPLETED'
          else if (wasSplit) status = '⇅ SPLIT'
          else if (t.splitFromId) status = '↳ CONTINUATION'
          else status = '→ CARRIED'
          return `- ${t.taskKey}: ${t.title} [${status}]`
        }).join('\n')

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize sprint accomplishments accurately in 2-3 sentences. Focus on what was delivered.' },
            { role: 'user', content: `Sprints: ${sprintNames.join(', ')}\n${allTasks.length} tasks:\n${taskSummaries}` },
          ],
          max_tokens: 150,
        })
        aiSummary = completion.choices[0]?.message?.content?.trim()
      } catch (error) {
        console.error('Failed to generate AI summary:', error)
      }
    }

    const mergedReport = {
      sprintNames,
      sprintDateRange,
      tasksByTeam,
      generatedAt: new Date().toISOString(),
      aiSummary,
    }

    return NextResponse.json({ mergedReport })
  } catch (error) {
    console.error('Failed to generate report:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

**Step 2: Verify the API compiles**

Run: `cd /Users/sherrahim/Desktop/Code/zyra && npx tsc --noEmit src/app/api/reports/generate/route.ts 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/app/api/reports/generate/route.ts
git commit -m "feat: merged team-grouped report API for enhanced reports"
```

---

### Task 2: Update Frontend — UAT Sprints, Merged Report View, Team Grouping, Go-Live Dates

**Files:**
- Modify: `src/components/reports/reports-view.tsx`

**Step 1: Rewrite the reports view component**

Replace the entire content of `src/components/reports/reports-view.tsx`. Key changes:
- Filter sprints to include both `COMPLETED` and `UAT` (line 49 currently only has COMPLETED)
- New `MergedReportData` interface matching the API response
- New `goLiveDates` state: `Record<string, string>` keyed by epic ID or task ID
- Helper `getGoLiveDate(taskId, epicId)` that returns task date or falls back to epic date
- Render team sections with colored headers
- Within each team: epic sub-groups with tasks
- Date picker on each epic header (cascades to tasks)
- Date picker on each task row (overrides epic)
- Sprint badge on each task showing which sprint it came from
- Pass `goLiveDates` to PDF download

```typescript
'use client'

import { useState } from 'react'
import { Sprint, Task, Epic } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ReportsViewProps {
  projectId: string
  sprints: Sprint[]
  epics: Epic[]
}

interface ReportTask extends Task {
  sprintCount?: number
  sprintName?: string
  attachments?: { id: string; filename: string; url: string }[]
  aiDescriptionSummary?: string | null
  aiCommentsSummary?: string | null
  hasComments?: boolean
  hasDescription?: boolean
}

interface TeamGroup {
  team: { key: string; name: string; color: string; bgColor: string } | null
  epicGroups: {
    epic: { id: string; name: string; color: string; description?: string | null } | null
    tasks: ReportTask[]
    epicSummary?: string
  }[]
}

interface MergedReportData {
  sprintNames: string[]
  sprintDateRange: { start: string; end: string } | null
  tasksByTeam: TeamGroup[]
  generatedAt: string
  aiSummary?: string
}

type ReportType = 'detailed' | 'summarized'

export function ReportsView({ projectId, sprints, epics }: ReportsViewProps) {
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState<MergedReportData | null>(null)
  const [reportType, setReportType] = useState<ReportType>('detailed')
  const [goLiveDates, setGoLiveDates] = useState<Record<string, string>>({})

  // Task-level options - only for images now
  const [taskOptions, setTaskOptions] = useState<Record<string, { includeImages: boolean }>>({})

  // Include both COMPLETED and UAT sprints
  const availableSprints = sprints.filter(s => s.status === 'COMPLETED' || s.status === 'UAT')

  const toggleSprint = (sprintId: string) => {
    setSelectedSprintIds(prev =>
      prev.includes(sprintId)
        ? prev.filter(id => id !== sprintId)
        : [...prev, sprintId]
    )
  }

  const selectAllSprints = () => {
    setSelectedSprintIds(availableSprints.map(s => s.id))
  }

  const clearSelection = () => {
    setSelectedSprintIds([])
  }

  const setEpicGoLiveDate = (epicId: string, date: string) => {
    setGoLiveDates(prev => ({ ...prev, [`epic:${epicId}`]: date }))
  }

  const setTaskGoLiveDate = (taskId: string, date: string) => {
    setGoLiveDates(prev => ({ ...prev, [`task:${taskId}`]: date }))
  }

  const getGoLiveDate = (taskId: string, epicId: string | null | undefined): string => {
    // Task-level date takes priority
    if (goLiveDates[`task:${taskId}`]) return goLiveDates[`task:${taskId}`]
    // Fall back to epic-level date
    if (epicId && goLiveDates[`epic:${epicId}`]) return goLiveDates[`epic:${epicId}`]
    return ''
  }

  const generateReport = async () => {
    if (selectedSprintIds.length === 0) return

    setGenerating(true)
    setReportData(null)
    setGoLiveDates({})
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintIds: selectedSprintIds,
          projectId,
          reportType,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReportData(data.mergedReport)
      }
    } catch (error) {
      console.error('Failed to generate report:', error)
    } finally {
      setGenerating(false)
    }
  }

  const downloadPDF = async () => {
    if (!reportData) return

    setLoading(true)
    try {
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mergedReport: reportData,
          taskOptions,
          reportType,
          goLiveDates,
          format: 'pdf',
        }),
      })

      if (res.ok) {
        const contentType = res.headers.get('Content-Type')

        if (contentType?.includes('application/pdf')) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `sprint-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        } else {
          const html = await res.text()
          const blob = new Blob([html], { type: 'text/html' })
          const url = URL.createObjectURL(blob)
          const printWindow = window.open(url, '_blank')
          if (printWindow) {
            printWindow.onload = () => {
              setTimeout(() => printWindow.print(), 500)
            }
          }
          setTimeout(() => URL.revokeObjectURL(url), 60000)
        }
      }
    } catch (error) {
      console.error('Failed to download PDF:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskImages = (taskId: string) => {
    setTaskOptions(prev => ({
      ...prev,
      [taskId]: {
        includeImages: !prev[taskId]?.includeImages,
      },
    }))
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Sprint Reports</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered summaries for completed and UAT sprints
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reportData && (
              <Button variant="outline" onClick={generateReport} disabled={generating}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regenerate
              </Button>
            )}
            <Button
              onClick={generateReport}
              disabled={selectedSprintIds.length === 0 || generating}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sprint Selection */}
        <div className="w-72 border-r flex flex-col">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-sm">Select Sprints</h2>
              <div className="flex gap-2">
                <button onClick={selectAllSprints} className="text-xs text-primary hover:underline">All</button>
                <button onClick={clearSelection} className="text-xs text-muted-foreground hover:underline">Clear</button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSprintIds.length} of {availableSprints.length} selected
            </p>
          </div>

          {/* Report Type Selection */}
          <div className="p-3 border-b bg-muted/30">
            <h3 className="font-medium text-xs mb-2">Report Type</h3>
            <div className="space-y-2">
              <label className={cn(
                "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                reportType === 'detailed' ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
              )}>
                <input
                  type="radio"
                  name="reportType"
                  value="detailed"
                  checked={reportType === 'detailed'}
                  onChange={() => setReportType('detailed')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-xs">Detailed</div>
                  <div className="text-[10px] text-muted-foreground">List all tasks with individual summaries</div>
                </div>
              </label>
              <label className={cn(
                "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                reportType === 'summarized' ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"
              )}>
                <input
                  type="radio"
                  name="reportType"
                  value="summarized"
                  checked={reportType === 'summarized'}
                  onChange={() => setReportType('summarized')}
                  className="mt-0.5"
                />
                <div>
                  <div className="font-medium text-xs">Summarized</div>
                  <div className="text-[10px] text-muted-foreground">One AI summary per epic, compact view</div>
                </div>
              </label>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {availableSprints.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs">No completed or UAT sprints</p>
                </div>
              ) : (
                availableSprints.map((sprint) => {
                  const isSelected = selectedSprintIds.includes(sprint.id)
                  const completedTasks = sprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length
                  const isUAT = sprint.status === 'UAT'

                  return (
                    <button
                      key={sprint.id}
                      onClick={() => toggleSprint(sprint.id)}
                      className={cn(
                        "w-full text-left p-2 rounded-lg transition-all border",
                        isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} className="h-3.5 w-3.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-xs truncate">{sprint.name}</span>
                            {isUAT && (
                              <Badge variant="outline" className="text-[8px] h-4 bg-amber-50 text-amber-700 border-amber-200 flex-shrink-0">
                                UAT
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {sprint.endDate && formatDate(sprint.endDate)} • {completedTasks}/{sprint.tasks.length}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Preview Area */}
        <div className="flex-1 flex flex-col bg-muted/30">
          {!reportData ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-14 h-14 mx-auto mb-3 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h3 className="font-medium">AI-Powered Reports</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select sprints and generate to get AI summaries
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-3 border-b bg-background flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-sm">
                    {reportType === 'detailed' ? 'Detailed Report' : 'Summarized Report'}
                  </h2>
                  <p className="text-[10px] text-muted-foreground">
                    {reportData.sprintNames.join(' + ')}
                    {reportType === 'detailed' && ' • Toggle images per task'}
                  </p>
                </div>
                <Button size="sm" onClick={downloadPDF} disabled={loading}>
                  {loading ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 max-w-3xl mx-auto">
                  {/* Combined Report Header */}
                  <div className="bg-background rounded-lg border shadow-sm">
                    <div className="p-3 bg-muted/30 rounded-t-lg">
                      <h3 className="font-bold">{reportData.sprintNames.join(' + ')}</h3>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {reportData.sprintDateRange && (
                          <>{formatDate(reportData.sprintDateRange.start)} - {formatDate(reportData.sprintDateRange.end)} • </>
                        )}
                        {reportData.tasksByTeam.reduce((sum, tg) => sum + tg.epicGroups.reduce((s, eg) => s + eg.tasks.length, 0), 0)} tasks
                      </div>

                      {reportData.aiSummary && (
                        <div className="mt-2 p-2 bg-primary/5 rounded border border-primary/20">
                          <div className="flex items-center gap-1 text-[10px] font-medium text-primary mb-0.5">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Overall Summary
                          </div>
                          <p className="text-xs text-muted-foreground">{reportData.aiSummary}</p>
                        </div>
                      )}
                    </div>

                    {/* Team Sections */}
                    <div className="divide-y">
                      {reportData.tasksByTeam.map((teamGroup, teamIdx) => (
                        <div key={teamGroup.team?.key || 'no-team'}>
                          {/* Team Header */}
                          <div
                            className="px-3 py-2 flex items-center gap-2 border-b"
                            style={{
                              backgroundColor: teamGroup.team ? `${teamGroup.team.bgColor}` : '#f8fafc',
                              borderLeft: teamGroup.team ? `4px solid ${teamGroup.team.color}` : '4px solid #94a3b8'
                            }}
                          >
                            <span
                              className="font-semibold text-sm"
                              style={{ color: teamGroup.team?.color || '#475569' }}
                            >
                              {teamGroup.team?.name || 'No Team'}
                            </span>
                            <Badge variant="outline" className="text-[9px] h-4">
                              {teamGroup.epicGroups.reduce((s, eg) => s + eg.tasks.length, 0)} tasks
                            </Badge>
                          </div>

                          {/* Epic Groups within this team */}
                          <div className="divide-y">
                            {teamGroup.epicGroups.map((group) => (
                              <div key={group.epic?.id || 'no-epic'} className="p-3">
                                {/* Epic Header with Go-Live Date */}
                                <div className="flex items-center gap-2 mb-2">
                                  {group.epic ? (
                                    <>
                                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group.epic.color }} />
                                      <span className="font-medium text-xs">{group.epic.name}</span>
                                    </>
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">No Epic</span>
                                  )}
                                  <Badge variant="outline" className="text-[9px] h-4">
                                    {group.tasks.length}
                                  </Badge>

                                  {/* Epic-level Go-Live Date */}
                                  {group.epic && (
                                    <div className="ml-auto flex items-center gap-1.5">
                                      <span className="text-[9px] text-muted-foreground">Go Live:</span>
                                      <Input
                                        type="date"
                                        value={goLiveDates[`epic:${group.epic.id}`] || ''}
                                        onChange={(e) => setEpicGoLiveDate(group.epic!.id, e.target.value)}
                                        className="h-6 w-32 text-[10px] px-1.5"
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Summarized View */}
                                {reportType === 'summarized' ? (
                                  <div className="p-2 rounded border bg-muted/20">
                                    {group.epicSummary ? (
                                      <p className="text-xs text-muted-foreground leading-relaxed">{group.epicSummary}</p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic">
                                        {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                                      </p>
                                    )}
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {group.tasks.map((task) => (
                                        <span key={task.id} className="text-[9px] px-1.5 py-0.5 bg-muted rounded font-mono">
                                          {task.taskKey}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  /* Detailed View */
                                  <div className="space-y-1.5">
                                    {group.tasks.map((task) => {
                                      const opts = taskOptions[task.id] || { includeImages: false }
                                      const isComplete = task.status === 'DONE' || task.status === 'LIVE'
                                      const hasImages = task.attachments && task.attachments.length > 0
                                      const taskDate = getGoLiveDate(task.id, group.epic?.id)

                                      return (
                                        <div key={task.id} className="p-2 rounded border bg-muted/20">
                                          {/* Task header */}
                                          <div className="flex items-start gap-1.5">
                                            <div className={cn(
                                              "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                              isComplete ? "bg-green-500" : "bg-amber-500"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[9px] font-mono text-primary/70">{task.taskKey}</span>
                                                <span className="font-medium text-xs truncate">{task.title}</span>
                                                {!isComplete && (
                                                  <Badge variant="outline" className="text-[8px] h-3.5 bg-amber-50 text-amber-700 border-amber-200">
                                                    Carried
                                                  </Badge>
                                                )}
                                                {task.sprintName && (
                                                  <Badge variant="secondary" className="text-[8px] h-3.5">
                                                    {task.sprintName}
                                                  </Badge>
                                                )}
                                              </div>

                                              {task.aiDescriptionSummary && (
                                                <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                                                  {task.aiDescriptionSummary}
                                                </p>
                                              )}

                                              {task.aiCommentsSummary && (
                                                <div className="mt-1.5 pl-2 border-l-2 border-primary/30">
                                                  <p className="text-[10px] text-muted-foreground italic">
                                                    {task.aiCommentsSummary}
                                                  </p>
                                                </div>
                                              )}

                                              {/* Meta + Go-Live Date + Image toggle */}
                                              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                {task.assignee && (
                                                  <span className="text-[9px] text-muted-foreground">
                                                    {task.assignee.name}
                                                  </span>
                                                )}
                                                {task.sprintCount && task.sprintCount > 1 && (
                                                  <span className="text-[9px] text-muted-foreground">
                                                    {task.sprintCount} sprints
                                                  </span>
                                                )}

                                                {/* Task-level Go-Live Date */}
                                                <div className="flex items-center gap-1 ml-auto">
                                                  <Input
                                                    type="date"
                                                    value={goLiveDates[`task:${task.id}`] || ''}
                                                    onChange={(e) => setTaskGoLiveDate(task.id, e.target.value)}
                                                    placeholder={taskDate ? undefined : undefined}
                                                    className={cn(
                                                      "h-5 w-28 text-[9px] px-1",
                                                      !goLiveDates[`task:${task.id}`] && taskDate ? "text-muted-foreground" : ""
                                                    )}
                                                  />
                                                  {!goLiveDates[`task:${task.id}`] && taskDate && (
                                                    <span className="text-[8px] text-muted-foreground italic">(epic)</span>
                                                  )}
                                                </div>

                                                {hasImages && (
                                                  <label className="flex items-center gap-1 text-[9px] cursor-pointer">
                                                    <Checkbox
                                                      checked={opts.includeImages}
                                                      onCheckedChange={() => toggleTaskImages(task.id)}
                                                      className="h-3 w-3"
                                                    />
                                                    <span>Images ({task.attachments?.length})</span>
                                                  </label>
                                                )}
                                              </div>

                                              {opts.includeImages && task.attachments && task.attachments.length > 0 && (
                                                <div className="mt-1.5 flex gap-1 flex-wrap">
                                                  {task.attachments.slice(0, 4).map((att) => (
                                                    <div key={att.id} className="w-10 h-10 rounded border bg-muted overflow-hidden">
                                                      {att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                        <img src={att.url} alt="" className="w-full h-full object-cover" />
                                                      ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-[8px]">file</div>
                                                      )}
                                                    </div>
                                                  ))}
                                                  {task.attachments.length > 4 && (
                                                    <div className="w-10 h-10 rounded border bg-muted flex items-center justify-center text-[9px]">
                                                      +{task.attachments.length - 4}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify the component compiles**

Run: `cd /Users/sherrahim/Desktop/Code/zyra && npx tsc --noEmit src/components/reports/reports-view.tsx 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/components/reports/reports-view.tsx
git commit -m "feat: reports UI with UAT sprints, team grouping, go-live dates"
```

---

### Task 3: Update PDF Template — Team Sections and Go-Live Dates

**Files:**
- Modify: `src/app/api/reports/pdf/route.ts`

**Step 1: Rewrite the PDF generation to use team-grouped merged report**

Replace the entire content of `src/app/api/reports/pdf/route.ts`. Key changes:
- Accept `mergedReport` (new shape) and `goLiveDates` in request body
- `generateReportHTML` renders team sections with colored headers
- Go-live date badges on epic headers and task rows
- Combined sprint title header
- Same CSS styling approach but with team color sections

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

function generateReportHTML(
  mergedReport: any,
  taskOptions: Record<string, { includeImages: boolean }>,
  reportType: 'detailed' | 'summarized',
  goLiveDates: Record<string, string>,
  baseUrl: string
) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatGoLiveDate = (date: string) => {
    return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const getTaskUrl = (taskId: string) => `${baseUrl}?task=${taskId}`

  const getGoLiveDate = (taskId: string, epicId: string | null): string => {
    if (goLiveDates[`task:${taskId}`]) return goLiveDates[`task:${taskId}`]
    if (epicId && goLiveDates[`epic:${epicId}`]) return goLiveDates[`epic:${epicId}`]
    return ''
  }

  const totalTasks = mergedReport.tasksByTeam.reduce((sum: number, tg: any) =>
    sum + tg.epicGroups.reduce((s: number, eg: any) => s + eg.tasks.length, 0), 0
  )
  const completedCount = mergedReport.tasksByTeam.reduce((sum: number, tg: any) =>
    sum + tg.epicGroups.reduce((s: number, eg: any) =>
      s + eg.tasks.filter((t: any) => t.status === 'DONE' || t.status === 'LIVE').length, 0), 0
  )
  const carriedCount = totalTasks - completedCount

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 10px;
          line-height: 1.4;
          color: #1a1a1a;
          padding: 24px;
          background: #fff;
        }

        /* Report Header */
        .report-header {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 8px 8px 0 0;
        }
        .report-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .report-meta {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 8px;
        }
        .report-stats {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }
        .stat-box {
          background: rgba(255,255,255,0.15);
          padding: 8px 14px;
          border-radius: 6px;
          text-align: center;
        }
        .stat-number { font-size: 18px; font-weight: 700; }
        .stat-label { font-size: 8px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }

        /* AI Summary */
        .ai-summary {
          background: #fefce8;
          border: 1px solid #fde047;
          border-top: none;
          padding: 14px 18px;
          font-size: 12px;
          line-height: 1.6;
        }
        .ai-summary-label {
          font-weight: 600;
          color: #a16207;
          font-size: 10px;
          margin-bottom: 4px;
        }
        .ai-summary-text { color: #713f12; }

        /* Team Section */
        .team-section {
          border: 1px solid #e2e8f0;
          border-top: none;
          background: #fff;
        }
        .team-section:last-child {
          border-radius: 0 0 8px 8px;
        }
        .team-header {
          padding: 10px 14px;
          font-weight: 600;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .team-badge {
          font-size: 9px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(0,0,0,0.08);
        }

        /* Epic Group */
        .epic-group {
          padding: 14px;
          border-bottom: 1px solid #f1f5f9;
        }
        .epic-group:last-child {
          border-bottom: none;
        }
        .epic-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .epic-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
          display: inline-block;
        }
        .epic-name {
          font-weight: 600;
          font-size: 12px;
          color: #1e293b;
          flex: 1;
        }
        .epic-count {
          font-size: 9px;
          color: #64748b;
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 10px;
        }
        .go-live-badge {
          font-size: 9px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 4px;
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }

        /* Epic Summary */
        .epic-summary {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 10px;
        }
        .epic-summary-text {
          font-size: 11px;
          color: #374151;
          line-height: 1.6;
        }
        .task-chip {
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 9px;
          background: #e2e8f0;
          color: #475569;
          padding: 3px 8px;
          border-radius: 4px;
          display: inline-block;
          margin: 2px 4px 2px 0;
        }
        .task-chip a {
          color: #6366f1;
          text-decoration: none;
        }

        /* Task */
        .task {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 12px;
          margin-bottom: 8px;
          background: #fff;
        }
        .task-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .task-key {
          font-family: 'SF Mono', Monaco, Consolas, monospace;
          font-size: 10px;
          color: #6366f1;
          font-weight: 500;
          text-decoration: none;
        }
        .task-title {
          font-weight: 500;
          font-size: 11px;
          color: #1e293b;
          flex: 1;
        }
        .sprint-badge {
          font-size: 8px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #f1f5f9;
          color: #64748b;
        }

        /* Status Labels */
        .label {
          font-size: 8px;
          font-weight: 600;
          padding: 3px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          display: inline-block;
        }
        .label-complete { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
        .label-carried { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
        .label-split { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
        .label-continuation { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }

        /* Task Content */
        .task-description {
          font-size: 10px;
          color: #475569;
          margin-top: 8px;
          line-height: 1.5;
          padding-left: 10px;
          border-left: 3px solid #e2e8f0;
        }
        .task-comments {
          font-size: 10px;
          color: #64748b;
          margin-top: 8px;
          padding: 8px 10px;
          background: #f8fafc;
          border-radius: 4px;
          font-style: italic;
        }
        .task-meta {
          font-size: 9px;
          color: #94a3b8;
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* Images */
        .images { margin-top: 10px; }
        .image-thumb {
          width: 48px; height: 48px; border-radius: 4px;
          object-fit: cover; border: 1px solid #e2e8f0;
          display: inline-block; margin: 2px;
        }

        /* Legend */
        .legend {
          margin-top: 30px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .legend-title { font-size: 12px; font-weight: 600; color: #1e293b; margin-bottom: 12px; }
        .legend-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .legend-item { display: flex; align-items: center; gap: 8px; }
        .legend-item-text { font-size: 9px; color: #475569; }

        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 9px;
          color: #94a3b8;
        }

        @media print {
          body { padding: 16px; }
          .team-section { page-break-inside: avoid; }
          a { color: #6366f1 !important; }
        }
      </style>
    </head>
    <body>
  `

  // Report Header
  html += `
    <div class="report-header">
      <div class="report-title">${mergedReport.sprintNames.join(' + ')}</div>
      <div class="report-meta">
        ${mergedReport.sprintDateRange
          ? `${formatDate(mergedReport.sprintDateRange.start)} - ${formatDate(mergedReport.sprintDateRange.end)} • `
          : ''}
        ${totalTasks} tasks
      </div>
      <div class="report-stats">
        <div class="stat-box">
          <div class="stat-number">${completedCount}</div>
          <div class="stat-label">Completed</div>
        </div>
        ${carriedCount > 0 ? `
        <div class="stat-box">
          <div class="stat-number">${carriedCount}</div>
          <div class="stat-label">Carried</div>
        </div>
        ` : ''}
      </div>
    </div>
  `

  if (mergedReport.aiSummary) {
    html += `
      <div class="ai-summary">
        <div class="ai-summary-label">AI Summary</div>
        <div class="ai-summary-text">${mergedReport.aiSummary}</div>
      </div>
    `
  }

  // Team Sections
  for (const teamGroup of mergedReport.tasksByTeam) {
    const teamColor = teamGroup.team?.color || '#64748b'
    const teamBg = teamGroup.team?.bgColor || '#f8fafc'
    const teamName = teamGroup.team?.name || 'No Team'
    const teamTaskCount = teamGroup.epicGroups.reduce((s: number, eg: any) => s + eg.tasks.length, 0)

    html += `
      <div class="team-section">
        <div class="team-header" style="background: ${teamBg}; border-left: 4px solid ${teamColor}; color: ${teamColor};">
          ${teamName}
          <span class="team-badge">${teamTaskCount} task${teamTaskCount !== 1 ? 's' : ''}</span>
        </div>
    `

    for (const group of teamGroup.epicGroups) {
      const epicGoLive = group.epic?.id ? goLiveDates[`epic:${group.epic.id}`] : null

      html += `
        <div class="epic-group">
          <div class="epic-header">
            ${group.epic
              ? `<span class="epic-color" style="background: ${group.epic.color}"></span>
                 <span class="epic-name">${group.epic.name}</span>`
              : `<span class="epic-name" style="color: #64748b;">Uncategorized</span>`
            }
            <span class="epic-count">${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''}</span>
            ${epicGoLive ? `<span class="go-live-badge">Go Live: ${formatGoLiveDate(epicGoLive)}</span>` : ''}
          </div>
      `

      if (reportType === 'summarized') {
        html += `
          <div class="epic-summary">
            ${group.epicSummary
              ? `<div class="epic-summary-text">${group.epicSummary}</div>`
              : `<div class="epic-summary-text" style="color: #64748b; font-style: italic;">
                  ${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''}
                </div>`
            }
            <div style="margin-top: 10px;">
              ${group.tasks.map((t: any) => `<span class="task-chip"><a href="${getTaskUrl(t.id)}">${t.taskKey}</a></span>`).join('')}
            </div>
          </div>
        `
      } else {
        for (const task of group.tasks) {
          const isComplete = task.status === 'DONE' || task.status === 'LIVE'
          const isSplitFrom = !!task.splitFromId
          const hasSplitTasks = task.splitTasks && task.splitTasks.length > 0
          const opts = taskOptions[task.id] || { includeImages: false }
          const taskGoLive = getGoLiveDate(task.id, group.epic?.id || null)

          html += `
            <div class="task">
              <div class="task-header">
                <a href="${getTaskUrl(task.id)}" class="task-key">${task.taskKey}</a>
                <span class="task-title">${task.title}</span>
          `

          if (isComplete) {
            html += `<span class="label label-complete">Complete</span>`
          } else {
            html += `<span class="label label-carried">Carried</span>`
          }

          if (isSplitFrom) html += `<span class="label label-continuation">Continuation</span>`
          if (hasSplitTasks) html += `<span class="label label-split">Split</span>`
          if (task.sprintName) html += `<span class="sprint-badge">${task.sprintName}</span>`
          if (taskGoLive) html += `<span class="go-live-badge">Go Live: ${formatGoLiveDate(taskGoLive)}</span>`

          html += `</div>`

          if (task.aiDescriptionSummary) {
            html += `<div class="task-description">${task.aiDescriptionSummary}</div>`
          }
          if (task.aiCommentsSummary) {
            html += `<div class="task-comments">${task.aiCommentsSummary}</div>`
          }

          const metaParts = []
          if (task.assignee) metaParts.push(task.assignee.name)
          if (task.sprintCount > 1) metaParts.push(`${task.sprintCount} sprints`)
          if (metaParts.length > 0) {
            html += `<div class="task-meta">${metaParts.join(' &bull; ')}</div>`
          }

          if (opts.includeImages && task.attachments && task.attachments.length > 0) {
            html += `<div class="images">`
            for (const att of task.attachments.slice(0, 6)) {
              if (att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                html += `<img class="image-thumb" src="${att.url}" alt="" />`
              }
            }
            html += `</div>`
          }

          html += `</div>`
        }
      }

      html += `</div>`
    }

    html += `</div>`
  }

  // Legend
  if (reportType === 'detailed') {
    html += `
      <div class="legend">
        <div class="legend-title">Legend</div>
        <div class="legend-grid">
          <div class="legend-item">
            <span class="label label-complete">Complete</span>
            <span class="legend-item-text">Task fully completed</span>
          </div>
          <div class="legend-item">
            <span class="label label-carried">Carried</span>
            <span class="legend-item-text">Continues next sprint</span>
          </div>
          <div class="legend-item">
            <span class="label label-split">Split</span>
            <span class="legend-item-text">Task was split</span>
          </div>
          <div class="legend-item">
            <span class="label label-continuation">Continuation</span>
            <span class="legend-item-text">From a split task</span>
          </div>
          <div class="legend-item">
            <span class="go-live-badge">Go Live: Date</span>
            <span class="legend-item-text">Expected go-live date</span>
          </div>
        </div>
      </div>
    `
  }

  html += `
      <div class="footer">
        ${reportType === 'summarized' ? 'Summarized' : 'Detailed'} Sprint Report &bull; Generated by Scrumbies &bull; ${formatDate(new Date().toISOString())}
      </div>
    </body>
    </html>
  `

  return html
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { mergedReport, taskOptions = {}, reportType = 'detailed', goLiveDates = {}, format = 'html' } = body

    if (!mergedReport) {
      return NextResponse.json({ error: 'No report data' }, { status: 400 })
    }

    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    const html = generateReportHTML(mergedReport, taskOptions, reportType, goLiveDates, baseUrl)

    if (format === 'pdf') {
      try {
        let browser

        if (process.env.NODE_ENV === 'production') {
          const chromium = await import('@sparticuz/chromium')
          const puppeteer = await import('puppeteer-core')

          browser = await puppeteer.default.launch({
            args: chromium.default.args,
            defaultViewport: { width: 800, height: 600 },
            executablePath: await chromium.default.executablePath(),
            headless: true,
          })
        } else {
          const puppeteer = await import('puppeteer')
          browser = await puppeteer.default.launch({
            headless: true,
          })
        }

        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        })

        await browser.close()

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="sprint-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf"`,
          },
        })
      } catch (pdfError) {
        console.error('PDF generation failed, falling back to HTML:', pdfError)
      }
    }

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Failed to generate report:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

**Step 2: Verify compilation**

Run: `cd /Users/sherrahim/Desktop/Code/zyra && npx tsc --noEmit src/app/api/reports/pdf/route.ts 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/app/api/reports/pdf/route.ts
git commit -m "feat: PDF template with team grouping and go-live dates"
```

---

### Task 4: Integration Test — Manual Verification

**Step 1: Start dev server and test**

Run: `cd /Users/sherrahim/Desktop/Code/zyra && npm run dev`

**Verify:**
1. Navigate to `/?view=reports`
2. Sprint selector shows both COMPLETED and UAT sprints (UAT has amber badge)
3. Select 2+ sprints, click Generate Report
4. Report shows team sections (Mobile, Web, No Team) with colored headers
5. Within each team: epic groups with tasks
6. Each task shows sprint origin badge
7. Epic-level date picker appears — setting it shows "(epic)" hint on task dates
8. Task-level date picker overrides epic date
9. Click Download PDF — PDF includes team sections and go-live dates

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: enhanced reports with multi-sprint merge, team grouping, go-live dates"
```
