'use client'

import { useState } from 'react'
import { Sprint, Task, Epic } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface ReportsViewProps {
  projectId: string
  sprints: Sprint[]
  epics: Epic[]
}

interface ReportTask extends Task {
  sprintCount?: number
  attachments?: { id: string; filename: string; url: string }[]
  aiDescriptionSummary?: string | null
  aiCommentsSummary?: string | null
  hasComments?: boolean
  hasDescription?: boolean
}

interface ReportData {
  sprint: Sprint
  tasksByEpic: {
    epic: Epic | null
    tasks: ReportTask[]
    epicSummary?: string // AI summary of all tasks in this epic
  }[]
  generatedAt: string
  aiSummary?: string
}

type ReportType = 'detailed' | 'summarized'

export function ReportsView({ projectId, sprints, epics }: ReportsViewProps) {
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState<ReportData[] | null>(null)
  const [reportType, setReportType] = useState<ReportType>('detailed')
  
  // Task-level options - only for images now
  const [taskOptions, setTaskOptions] = useState<Record<string, { includeImages: boolean }>>({})

  const completedSprints = sprints.filter(s => s.status === 'COMPLETED')

  const toggleSprint = (sprintId: string) => {
    setSelectedSprintIds(prev => 
      prev.includes(sprintId)
        ? prev.filter(id => id !== sprintId)
        : [...prev, sprintId]
    )
  }

  const selectAllSprints = () => {
    setSelectedSprintIds(completedSprints.map(s => s.id))
  }

  const clearSelection = () => {
    setSelectedSprintIds([])
  }

  const generateReport = async () => {
    if (selectedSprintIds.length === 0) return

    setGenerating(true)
    setReportData(null)
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
        setReportData(data.reports)
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
          reports: reportData,
          taskOptions,
          reportType,
        }),
      })

      if (res.ok) {
        const html = await res.text()
        
        // Dynamically import html2pdf
        const html2pdf = (await import('html2pdf.js')).default
        
        // Parse the HTML and extract styles + body content
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        
        // Create a container with the styles and body content
        const container = document.createElement('div')
        
        // Copy styles
        const styles = doc.querySelectorAll('style')
        styles.forEach(style => {
          const newStyle = document.createElement('style')
          newStyle.textContent = style.textContent
          container.appendChild(newStyle)
        })
        
        // Copy body content
        const bodyContent = doc.body.innerHTML
        const contentDiv = document.createElement('div')
        contentDiv.innerHTML = bodyContent
        container.appendChild(contentDiv)
        
        // Add to DOM temporarily
        container.style.position = 'absolute'
        container.style.left = '-9999px'
        container.style.width = '210mm' // A4 width
        document.body.appendChild(container)
        
        // Generate PDF
        const opt = {
          margin: [10, 10, 10, 10],
          filename: `sprint-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true,
            logging: false,
            windowWidth: 794, // A4 at 96dpi
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all'], before: ['.sprint'] }
        }
        
        await html2pdf().set(opt).from(container).save()
        
        // Cleanup
        document.body.removeChild(container)
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
              AI-powered summaries for completed sprints
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
              {selectedSprintIds.length} of {completedSprints.length} selected
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
              {completedSprints.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs">No completed sprints</p>
                </div>
              ) : (
                completedSprints.map((sprint) => {
                  const isSelected = selectedSprintIds.includes(sprint.id)
                  const completedTasks = sprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length

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
                          <div className="font-medium text-xs truncate">{sprint.name}</div>
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
                    {reportData.length} sprint{reportData.length !== 1 ? 's' : ''}
                    {reportType === 'detailed' && ' • Toggle images per task'}
                  </p>
                </div>
                <Button size="sm" onClick={downloadPDF} disabled={loading}>
                  {loading ? 'Generating...' : 'Download PDF'}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4 max-w-3xl mx-auto">
                  {reportData.map((report) => (
                    <div key={report.sprint.id} className="bg-background rounded-lg border shadow-sm">
                      {/* Sprint Header */}
                      <div className="p-3 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold">{report.sprint.name}</h3>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {report.sprint.startDate && report.sprint.endDate && (
                                <>{formatDate(report.sprint.startDate)} - {formatDate(report.sprint.endDate)} • </>
                              )}
                              {report.tasksByEpic.reduce((sum, e) => sum + e.tasks.length, 0)} tasks
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Completed</Badge>
                        </div>
                        
                        {/* Sprint AI Summary */}
                        {report.aiSummary && (
                          <div className="mt-2 p-2 bg-primary/5 rounded border border-primary/20">
                            <div className="flex items-center gap-1 text-[10px] font-medium text-primary mb-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              Sprint Summary
                            </div>
                            <p className="text-xs text-muted-foreground">{report.aiSummary}</p>
                          </div>
                        )}
                      </div>

                      {/* Tasks by Epic */}
                      <div className="divide-y">
                        {report.tasksByEpic.map((group) => (
                          <div key={group.epic?.id || 'no-epic'} className="p-3">
                            {/* Epic Header */}
                            <div className="flex items-center gap-2 mb-2">
                              {group.epic ? (
                                <>
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.epic.color }} />
                                  <span className="font-medium text-xs">{group.epic.name}</span>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">No Epic</span>
                              )}
                              <Badge variant="outline" className="text-[9px] h-4">
                                {group.tasks.length}
                              </Badge>
                            </div>

                            {/* Summarized View - Show epic summary instead of individual tasks */}
                            {reportType === 'summarized' ? (
                              <div className="p-2 rounded border bg-muted/20">
                                {group.epicSummary ? (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{group.epicSummary}</p>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">
                                    {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''} completed
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
                              /* Detailed View - Show individual tasks */
                              <div className="space-y-1.5">
                                {group.tasks.map((task) => {
                                  const opts = taskOptions[task.id] || { includeImages: false }
                                  const isComplete = task.status === 'DONE' || task.status === 'LIVE'
                                  const hasImages = task.attachments && task.attachments.length > 0
                                  
                                  return (
                                    <div key={task.id} className="p-2 rounded border bg-muted/20">
                                      {/* Task header */}
                                      <div className="flex items-start gap-1.5">
                                        <div className={cn(
                                          "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                          isComplete ? "bg-green-500" : "bg-amber-500"
                                        )} />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-mono text-primary/70">{task.taskKey}</span>
                                            <span className="font-medium text-xs truncate">{task.title}</span>
                                            {!isComplete && (
                                              <Badge variant="outline" className="text-[8px] h-3.5 bg-amber-50 text-amber-700 border-amber-200">
                                                Carried
                                              </Badge>
                                            )}
                                          </div>
                                          
                                          {/* AI Description Summary - only if exists */}
                                          {task.aiDescriptionSummary && (
                                            <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                                              {task.aiDescriptionSummary}
                                            </p>
                                          )}

                                          {/* AI Comments Summary - only if exists */}
                                          {task.aiCommentsSummary && (
                                            <div className="mt-1.5 pl-2 border-l-2 border-primary/30">
                                              <p className="text-[10px] text-muted-foreground italic">
                                                💬 {task.aiCommentsSummary}
                                              </p>
                                            </div>
                                          )}

                                          {/* Meta + Image toggle */}
                                          <div className="flex items-center gap-3 mt-1.5">
                                            {task.assignee && (
                                              <span className="text-[9px] text-muted-foreground">
                                                👤 {task.assignee.name}
                                              </span>
                                            )}
                                            {task.sprintCount && task.sprintCount > 1 && (
                                              <span className="text-[9px] text-muted-foreground">
                                                🔄 {task.sprintCount} sprints
                                              </span>
                                            )}
                                            {hasImages && (
                                              <label className="flex items-center gap-1 text-[9px] cursor-pointer ml-auto">
                                                <Checkbox 
                                                  checked={opts.includeImages}
                                                  onCheckedChange={() => toggleTaskImages(task.id)}
                                                  className="h-3 w-3"
                                                />
                                                <span>Images ({task.attachments?.length})</span>
                                              </label>
                                            )}
                                          </div>

                                          {/* Image thumbnails if enabled */}
                                          {opts.includeImages && task.attachments && task.attachments.length > 0 && (
                                            <div className="mt-1.5 flex gap-1 flex-wrap">
                                              {task.attachments.slice(0, 4).map((att) => (
                                                <div key={att.id} className="w-10 h-10 rounded border bg-muted overflow-hidden">
                                                  {att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                    <img src={att.url} alt="" className="w-full h-full object-cover" />
                                                  ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[8px]">📄</div>
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
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
