'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sprint, Task, Epic } from '@/types'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ReportsViewProps {
  projectId: string
  sprints: Sprint[]
  epics: Epic[]
}

interface ReportTask extends Task {
  sprintCount?: number
  attachments?: { id: string; filename: string; url: string }[]
  comments?: { id: string; content: string; author: { name: string }; createdAt: string }[]
}

interface ReportData {
  sprint: Sprint
  tasksByEpic: {
    epic: Epic | null
    tasks: ReportTask[]
  }[]
  generatedAt: string
  aiSummary?: string
}

export function ReportsView({ projectId, sprints, epics }: ReportsViewProps) {
  const [selectedSprintIds, setSelectedSprintIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reportData, setReportData] = useState<ReportData[] | null>(null)
  const [useAI, setUseAI] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  
  // Task-level options
  const [taskOptions, setTaskOptions] = useState<Record<string, { includeComments: boolean; includeImages: boolean }>>({})

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
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprintIds: selectedSprintIds,
          projectId,
          useAI,
          taskOptions,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setReportData(data.reports)
        setShowPreview(true)
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
        }),
      })

      if (res.ok) {
        const html = await res.text()
        
        // Open in new window and trigger print
        const printWindow = window.open('', '_blank')
        if (printWindow) {
          printWindow.document.write(html)
          printWindow.document.close()
          
          // Wait for content to load then print
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print()
            }, 250)
          }
        }
      }
    } catch (error) {
      console.error('Failed to download PDF:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleTaskOption = (taskId: string, option: 'includeComments' | 'includeImages') => {
    setTaskOptions(prev => ({
      ...prev,
      [taskId]: {
        includeComments: prev[taskId]?.includeComments || false,
        includeImages: prev[taskId]?.includeImages || false,
        [option]: !prev[taskId]?.[option],
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
              Generate compact PDF reports for completed sprints
            </p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={useAI} 
                onCheckedChange={(checked) => setUseAI(checked === true)}
              />
              <span>AI Summary</span>
            </label>
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
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
        <div className="w-80 border-r flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm">Select Sprints</h2>
              <div className="flex gap-2">
                <button 
                  onClick={selectAllSprints}
                  className="text-xs text-primary hover:underline"
                >
                  All
                </button>
                <button 
                  onClick={clearSelection}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSprintIds.length} of {completedSprints.length} selected
            </p>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {completedSprints.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No completed sprints</p>
                  <p className="text-xs mt-1">Complete a sprint to generate reports</p>
                </div>
              ) : (
                completedSprints.map((sprint) => {
                  const isSelected = selectedSprintIds.includes(sprint.id)
                  const completedTasks = sprint.tasks.filter(t => t.status === 'DONE' || t.status === 'LIVE').length
                  const totalTasks = sprint.tasks.length

                  return (
                    <button
                      key={sprint.id}
                      onClick={() => toggleSprint(sprint.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all border",
                        isSelected 
                          ? "bg-primary/10 border-primary" 
                          : "hover:bg-muted border-transparent"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isSelected} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{sprint.name}</div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            {sprint.endDate && (
                              <span>{formatDate(sprint.endDate)}</span>
                            )}
                            <span>•</span>
                            <span>{completedTasks}/{totalTasks} done</span>
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
                <svg className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="font-medium text-lg">No Report Generated</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Select sprints and click "Generate Report" to preview
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 border-b bg-background flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Report Preview</h2>
                  <p className="text-xs text-muted-foreground">
                    {reportData.length} sprint{reportData.length !== 1 ? 's' : ''} • 
                    Click on tasks to toggle comments/images inclusion
                  </p>
                </div>
                <Button onClick={downloadPDF} disabled={loading}>
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download PDF
                    </>
                  )}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-6 space-y-6 max-w-4xl mx-auto">
                  {reportData.map((report) => (
                    <div key={report.sprint.id} className="bg-background rounded-lg border shadow-sm">
                      {/* Sprint Header */}
                      <div className="p-4 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-lg">{report.sprint.name}</h3>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                              {report.sprint.startDate && report.sprint.endDate && (
                                <span>
                                  {formatDate(report.sprint.startDate)} - {formatDate(report.sprint.endDate)}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                {report.tasksByEpic.reduce((sum, e) => sum + e.tasks.length, 0)} tasks
                              </span>
                            </div>
                          </div>
                          <Badge variant="secondary">Completed</Badge>
                        </div>
                        
                        {/* AI Summary */}
                        {report.aiSummary && (
                          <div className="mt-3 p-3 bg-primary/5 rounded-md border border-primary/20">
                            <div className="flex items-center gap-2 text-xs font-medium text-primary mb-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              AI Summary
                            </div>
                            <p className="text-sm text-muted-foreground">{report.aiSummary}</p>
                          </div>
                        )}
                      </div>

                      {/* Tasks by Epic */}
                      <div className="divide-y">
                        {report.tasksByEpic.map((group, idx) => (
                          <div key={group.epic?.id || 'no-epic'} className="p-4">
                            {/* Epic Header */}
                            <div className="flex items-center gap-2 mb-3">
                              {group.epic ? (
                                <>
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: group.epic.color }}
                                  />
                                  <span className="font-medium text-sm">{group.epic.name}</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground italic">No Epic</span>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}
                              </Badge>
                            </div>

                            {/* Tasks */}
                            <div className="space-y-2">
                              {group.tasks.map((task) => {
                                const opts = taskOptions[task.id] || { includeComments: false, includeImages: false }
                                const isComplete = task.status === 'DONE' || task.status === 'LIVE'
                                
                                return (
                                  <div 
                                    key={task.id}
                                    className="p-2 rounded border bg-muted/20 hover:bg-muted/40 transition-colors"
                                  >
                                    <div className="flex items-start gap-2">
                                      {/* Status indicator */}
                                      <div className={cn(
                                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                        isComplete ? "bg-green-500" : "bg-amber-500"
                                      )} />
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[10px] font-mono text-primary/70">
                                            {task.taskKey}
                                          </span>
                                          <span className="font-medium text-sm truncate">
                                            {task.title}
                                          </span>
                                          {!isComplete && (
                                            <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">
                                              Carried Over
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {/* Description preview - 80 chars */}
                                        {task.description && (
                                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                            {task.description.slice(0, 80)}{task.description.length > 80 ? '...' : ''}
                                          </p>
                                        )}

                                        {/* Meta info */}
                                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                                          {task.assignee && (
                                            <span className="flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                              </svg>
                                              {task.assignee.name}
                                            </span>
                                          )}
                                          {task.sprintCount && task.sprintCount > 1 && (
                                            <span className="flex items-center gap-1">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                              </svg>
                                              {task.sprintCount} sprints
                                            </span>
                                          )}
                                        </div>

                                        {/* Toggle options */}
                                        <div className="flex items-center gap-4 mt-2">
                                          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                            <Checkbox 
                                              checked={opts.includeComments}
                                              onCheckedChange={() => toggleTaskOption(task.id, 'includeComments')}
                                              className="h-3 w-3"
                                            />
                                            <span>Include comments</span>
                                            {task.comments && task.comments.length > 0 && (
                                              <span className="text-muted-foreground">({task.comments.length})</span>
                                            )}
                                          </label>
                                          <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                            <Checkbox 
                                              checked={opts.includeImages}
                                              onCheckedChange={() => toggleTaskOption(task.id, 'includeImages')}
                                              className="h-3 w-3"
                                            />
                                            <span>Include images</span>
                                            {task.attachments && task.attachments.length > 0 && (
                                              <span className="text-muted-foreground">({task.attachments.length})</span>
                                            )}
                                          </label>
                                        </div>

                                        {/* Preview of comments if enabled */}
                                        {opts.includeComments && task.comments && task.comments.length > 0 && (
                                          <div className="mt-2 pl-2 border-l-2 border-muted space-y-1">
                                            {task.comments.slice(0, 3).map((comment) => (
                                              <div key={comment.id} className="text-[10px]">
                                                <span className="font-medium">{comment.author.name}:</span>{' '}
                                                <span className="text-muted-foreground">
                                                  {comment.content.slice(0, 60)}{comment.content.length > 60 ? '...' : ''}
                                                </span>
                                              </div>
                                            ))}
                                            {task.comments.length > 3 && (
                                              <div className="text-[10px] text-muted-foreground">
                                                +{task.comments.length - 3} more
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        {/* Preview of images if enabled */}
                                        {opts.includeImages && task.attachments && task.attachments.length > 0 && (
                                          <div className="mt-2 flex gap-1 flex-wrap">
                                            {task.attachments.slice(0, 4).map((att) => (
                                              <div 
                                                key={att.id}
                                                className="w-12 h-12 rounded border bg-muted flex items-center justify-center text-[9px] text-muted-foreground overflow-hidden"
                                              >
                                                {att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                  <img 
                                                    src={att.url} 
                                                    alt="" 
                                                    className="w-full h-full object-cover"
                                                  />
                                                ) : (
                                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                  </svg>
                                                )}
                                              </div>
                                            ))}
                                            {task.attachments.length > 4 && (
                                              <div className="w-12 h-12 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
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

