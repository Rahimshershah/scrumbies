import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

function generateReportHTML(reports: any[], taskOptions: Record<string, { includeImages: boolean }>) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

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
          padding: 20px;
        }
        .header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e5e5;
        }
        .header h1 { font-size: 16px; margin-bottom: 2px; }
        .header p { color: #666; font-size: 8px; }
        
        .sprint {
          margin-bottom: 16px;
          page-break-inside: avoid;
        }
        .sprint-header {
          background: #f5f5f5;
          padding: 8px 10px;
          border-radius: 4px;
          margin-bottom: 8px;
        }
        .sprint-header h2 { font-size: 13px; margin-bottom: 2px; }
        .sprint-header .meta { font-size: 8px; color: #666; }
        
        .ai-summary {
          background: #f0f9ff;
          border-left: 3px solid #0ea5e9;
          padding: 6px 10px;
          margin-bottom: 8px;
          font-size: 9px;
        }
        .ai-summary .label { 
          font-weight: 600; 
          color: #0284c7; 
          margin-bottom: 2px;
          font-size: 8px;
        }
        
        .epic-group { margin-bottom: 10px; }
        .epic-header {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 5px;
          padding-bottom: 3px;
          border-bottom: 1px solid #e5e5e5;
        }
        .epic-color { width: 8px; height: 8px; border-radius: 50%; }
        .epic-name { font-weight: 600; font-size: 10px; }
        .epic-count { 
          font-size: 7px; 
          color: #666; 
          background: #f0f0f0;
          padding: 1px 5px;
          border-radius: 6px;
        }
        
        .task {
          padding: 5px 7px;
          margin-bottom: 3px;
          background: #fafafa;
          border-radius: 3px;
          border-left: 2px solid #22c55e;
        }
        .task.incomplete { border-left-color: #f59e0b; }
        .task-header {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 2px;
        }
        .task-key { font-family: monospace; font-size: 8px; color: #6366f1; }
        .task-title { font-weight: 500; font-size: 9px; }
        .task-carried {
          font-size: 6px;
          background: #fef3c7;
          color: #92400e;
          padding: 1px 3px;
          border-radius: 3px;
        }
        .task-description {
          font-size: 8px;
          color: #555;
          margin-top: 2px;
          line-height: 1.3;
        }
        .task-comments {
          font-size: 8px;
          color: #666;
          font-style: italic;
          margin-top: 3px;
          padding-left: 6px;
          border-left: 2px solid #ddd;
        }
        .task-meta {
          font-size: 7px;
          color: #888;
          margin-top: 3px;
        }
        
        .images {
          margin-top: 4px;
          display: flex;
          gap: 3px;
          flex-wrap: wrap;
        }
        .image-thumb {
          width: 32px;
          height: 32px;
          border-radius: 3px;
          object-fit: cover;
          border: 1px solid #e5e5e5;
        }
        .image-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 3px;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 7px;
          color: #666;
        }
        
        .footer {
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          font-size: 7px;
          color: #888;
        }
        
        @media print {
          body { padding: 10px; }
          .sprint { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Sprint Report</h1>
        <p>Generated on ${formatDate(new Date().toISOString())}</p>
      </div>
  `

  for (const report of reports) {
    const taskCount = report.tasksByEpic.reduce((sum: number, e: any) => sum + e.tasks.length, 0)
    const completedCount = report.tasksByEpic.reduce((sum: number, e: any) => 
      sum + e.tasks.filter((t: any) => t.status === 'DONE' || t.status === 'LIVE').length, 0
    )

    html += `
      <div class="sprint">
        <div class="sprint-header">
          <h2>${report.sprint.name}</h2>
          <div class="meta">
            ${report.sprint.startDate && report.sprint.endDate 
              ? `${formatDate(report.sprint.startDate)} - ${formatDate(report.sprint.endDate)} • ` 
              : ''}
            ${completedCount}/${taskCount} tasks completed
          </div>
        </div>
    `

    if (report.aiSummary) {
      html += `
        <div class="ai-summary">
          <div class="label">⚡ Sprint Summary</div>
          <div>${report.aiSummary}</div>
        </div>
      `
    }

    for (const group of report.tasksByEpic) {
      html += `
        <div class="epic-group">
          <div class="epic-header">
            ${group.epic 
              ? `<div class="epic-color" style="background: ${group.epic.color}"></div>
                 <span class="epic-name">${group.epic.name}</span>`
              : `<span class="epic-name" style="color: #888; font-style: italic;">No Epic</span>`
            }
            <span class="epic-count">${group.tasks.length}</span>
          </div>
      `

      for (const task of group.tasks) {
        const isComplete = task.status === 'DONE' || task.status === 'LIVE'
        const opts = taskOptions[task.id] || { includeImages: false }

        html += `
          <div class="task ${isComplete ? '' : 'incomplete'}">
            <div class="task-header">
              <span class="task-key">${task.taskKey}</span>
              <span class="task-title">${task.title}</span>
              ${!isComplete ? '<span class="task-carried">Carried</span>' : ''}
            </div>
        `

        // AI Description summary
        if (task.aiDescriptionSummary) {
          html += `<div class="task-description">${task.aiDescriptionSummary}</div>`
        }

        // AI Comments summary
        if (task.aiCommentsSummary) {
          html += `<div class="task-comments">💬 ${task.aiCommentsSummary}</div>`
        }

        // Meta info
        const metaParts = []
        if (task.assignee) metaParts.push(`👤 ${task.assignee.name}`)
        if (task.sprintCount > 1) metaParts.push(`🔄 ${task.sprintCount} sprints`)
        
        if (metaParts.length > 0) {
          html += `<div class="task-meta">${metaParts.join(' • ')}</div>`
        }

        // Images if enabled
        if (opts.includeImages && task.attachments && task.attachments.length > 0) {
          html += `<div class="images">`
          for (const att of task.attachments.slice(0, 4)) {
            if (att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              html += `<img class="image-thumb" src="${att.url}" alt="" />`
            } else {
              html += `<div class="image-placeholder">📄</div>`
            }
          }
          if (task.attachments.length > 4) {
            html += `<div class="image-placeholder">+${task.attachments.length - 4}</div>`
          }
          html += `</div>`
        }

        html += `</div>` // Close task
      }

      html += `</div>` // Close epic-group
    }

    html += `</div>` // Close sprint
  }

  html += `
      <div class="footer">
        Generated by Scrumbies • ${new Date().toISOString()}
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
    const { reports, taskOptions = {} } = body

    if (!reports || reports.length === 0) {
      return NextResponse.json({ error: 'No report data' }, { status: 400 })
    }

    const html = generateReportHTML(reports, taskOptions)

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `attachment; filename="sprint-report-${new Date().toISOString().split('T')[0]}.html"`,
      },
    })
  } catch (error) {
    console.error('Failed to generate PDF:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
