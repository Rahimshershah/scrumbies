import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

// Helper to strip HTML tags and decode common entities
function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

// Helper to generate PDF-compatible HTML
function generateReportHTML(reports: any[], taskOptions: Record<string, { includeComments: boolean; includeImages: boolean }>) {
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
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 2px solid #e5e5e5;
        }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header p { color: #666; font-size: 9px; }
        
        .sprint {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .sprint-header {
          background: #f5f5f5;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .sprint-header h2 { font-size: 14px; margin-bottom: 2px; }
        .sprint-header .meta { font-size: 9px; color: #666; }
        
        .ai-summary {
          background: #f0f9ff;
          border-left: 3px solid #0ea5e9;
          padding: 8px 12px;
          margin-bottom: 10px;
          font-size: 9px;
        }
        .ai-summary .label { 
          font-weight: 600; 
          color: #0284c7; 
          margin-bottom: 4px;
          font-size: 8px;
        }
        
        .epic-group {
          margin-bottom: 12px;
        }
        .epic-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e5e5e5;
        }
        .epic-color {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .epic-name { font-weight: 600; font-size: 11px; }
        .epic-count { 
          font-size: 8px; 
          color: #666; 
          background: #f0f0f0;
          padding: 1px 6px;
          border-radius: 8px;
        }
        
        .task {
          padding: 6px 8px;
          margin-bottom: 4px;
          background: #fafafa;
          border-radius: 4px;
          border-left: 3px solid #22c55e;
        }
        .task.incomplete { border-left-color: #f59e0b; }
        .task-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
        }
        .task-key {
          font-family: monospace;
          font-size: 9px;
          color: #6366f1;
        }
        .task-title { font-weight: 500; font-size: 10px; }
        .task-carried {
          font-size: 7px;
          background: #fef3c7;
          color: #92400e;
          padding: 1px 4px;
          border-radius: 4px;
        }
        .task-description {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        .task-meta {
          font-size: 8px;
          color: #888;
          margin-top: 4px;
          display: flex;
          gap: 8px;
        }
        
        .comments {
          margin-top: 6px;
          padding-left: 8px;
          border-left: 2px solid #e5e5e5;
        }
        .comment {
          font-size: 8px;
          margin-bottom: 2px;
        }
        .comment-author { font-weight: 500; }
        .comment-text { color: #666; }
        
        .images {
          margin-top: 6px;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .image-thumb {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          border: 1px solid #e5e5e5;
        }
        .image-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: #666;
        }
        
        .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #e5e5e5;
          text-align: center;
          font-size: 8px;
          color: #888;
        }
        
        @media print {
          body { padding: 0; }
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
          <div class="label">AI Summary</div>
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
            <span class="epic-count">${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''}</span>
          </div>
      `

      for (const task of group.tasks) {
        const isComplete = task.status === 'DONE' || task.status === 'LIVE'
        const opts = taskOptions[task.id] || { includeComments: false, includeImages: false }

        html += `
          <div class="task ${isComplete ? '' : 'incomplete'}">
            <div class="task-header">
              <span class="task-key">${task.taskKey}</span>
              <span class="task-title">${task.title}</span>
              ${!isComplete ? '<span class="task-carried">Carried Over</span>' : ''}
            </div>
        `

        if (task.description) {
          const desc = stripHtml(task.description)
          const truncated = desc.slice(0, 160)
          html += `<div class="task-description">${truncated}${desc.length > 160 ? '...' : ''}</div>`
        }

        // Meta info
        const metaParts = []
        if (task.assignee) metaParts.push(`👤 ${task.assignee.name}`)
        if (task.sprintCount > 1) metaParts.push(`🔄 ${task.sprintCount} sprints`)
        
        if (metaParts.length > 0) {
          html += `<div class="task-meta">${metaParts.join(' • ')}</div>`
        }

        // Comments if enabled
        if (opts.includeComments && task.comments && task.comments.length > 0) {
          html += `<div class="comments">`
          for (const comment of task.comments.slice(0, 3)) {
            const text = stripHtml(comment.content)
            const truncated = text.slice(0, 80)
            html += `
              <div class="comment">
                <span class="comment-author">${comment.author.name}:</span>
                <span class="comment-text">${truncated}${text.length > 80 ? '...' : ''}</span>
              </div>
            `
          }
          if (task.comments.length > 3) {
            html += `<div class="comment" style="color: #888;">+${task.comments.length - 3} more comments</div>`
          }
          html += `</div>`
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

    // Generate HTML for the report
    const html = generateReportHTML(reports, taskOptions)

    // Return HTML that can be printed to PDF by the browser
    // The client will use window.print() or a PDF library
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

