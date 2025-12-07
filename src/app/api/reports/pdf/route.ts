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

  // Count task stats across all reports
  let totalTasks = 0
  let completedTasks = 0
  let splitTasks = 0
  let carriedTasks = 0

  for (const report of reports) {
    for (const group of report.tasksByEpic) {
      for (const task of group.tasks) {
        totalTasks++
        const isComplete = task.status === 'DONE' || task.status === 'LIVE'
        const isSplit = task.splitFromId || (task.splitTasks && task.splitTasks.length > 0)
        
        if (isComplete) completedTasks++
        if (isSplit) splitTasks++
        if (!isComplete) carriedTasks++
      }
    }
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
          font-size: 9px;
          line-height: 1.35;
          color: #1a1a1a;
          padding: 24px;
          background: #fff;
        }
        
        /* Sprint Section */
        .sprint {
          margin-bottom: 24px;
          page-break-inside: avoid;
        }
        .sprint-header {
          background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
          color: white;
          padding: 16px 20px;
          border-radius: 8px 8px 0 0;
        }
        .sprint-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .sprint-title .icon { font-size: 18px; }
        .sprint-meta {
          font-size: 11px;
          opacity: 0.85;
          display: flex;
          gap: 16px;
          margin-top: 8px;
        }
        .sprint-meta span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .sprint-stats {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }
        .stat-box {
          background: rgba(255,255,255,0.15);
          padding: 6px 12px;
          border-radius: 6px;
          text-align: center;
        }
        .stat-number { font-size: 16px; font-weight: 700; }
        .stat-label { font-size: 8px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* AI Summary */
        .ai-summary {
          background: #fefce8;
          border: 1px solid #fde047;
          border-top: none;
          padding: 12px 16px;
          font-size: 11px;
          line-height: 1.5;
        }
        .ai-summary-label {
          font-weight: 600;
          color: #a16207;
          font-size: 10px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .ai-summary-text { color: #713f12; }
        
        /* Epic Group */
        .epic-group {
          border: 1px solid #e2e8f0;
          border-top: none;
          padding: 12px;
          background: #fff;
        }
        .epic-group:last-child {
          border-radius: 0 0 8px 8px;
        }
        .epic-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 1px dashed #e2e8f0;
        }
        .epic-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }
        .epic-name {
          font-weight: 600;
          font-size: 11px;
          color: #1e293b;
        }
        .epic-count {
          font-size: 9px;
          color: #64748b;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 10px;
        }
        
        /* Task */
        .task {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 6px;
          background: #fff;
        }
        .task-header {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .task-key {
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 9px;
          color: #6366f1;
          font-weight: 500;
        }
        .task-title {
          font-weight: 500;
          font-size: 10px;
          color: #1e293b;
          flex: 1;
        }
        
        /* Status Labels */
        .label {
          font-size: 7px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 3px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .label-complete {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #bbf7d0;
        }
        .label-carried {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        }
        .label-split {
          background: #e0e7ff;
          color: #3730a3;
          border: 1px solid #c7d2fe;
        }
        .label-continuation {
          background: #f3e8ff;
          color: #6b21a8;
          border: 1px solid #e9d5ff;
        }
        
        /* Task Content */
        .task-description {
          font-size: 9px;
          color: #475569;
          margin-top: 6px;
          line-height: 1.4;
          padding-left: 8px;
          border-left: 2px solid #e2e8f0;
        }
        .task-comments {
          font-size: 9px;
          color: #64748b;
          margin-top: 6px;
          padding: 6px 8px;
          background: #f8fafc;
          border-radius: 4px;
          font-style: italic;
        }
        .task-comments::before {
          content: "💬 ";
        }
        .task-meta {
          font-size: 8px;
          color: #94a3b8;
          margin-top: 6px;
          display: flex;
          gap: 12px;
        }
        
        /* Images */
        .images {
          margin-top: 8px;
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .image-thumb {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          object-fit: cover;
          border: 1px solid #e2e8f0;
        }
        .image-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 4px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }
        
        /* Legend */
        .legend {
          margin-top: 32px;
          padding: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          page-break-inside: avoid;
        }
        .legend-title {
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .legend-items {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .legend-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .legend-item .label { flex-shrink: 0; }
        .legend-item-text {
          font-size: 9px;
          color: #475569;
          line-height: 1.4;
        }
        
        /* Footer */
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 8px;
          color: #94a3b8;
        }
        
        @media print {
          body { padding: 16px; }
          .sprint { page-break-inside: avoid; }
          .legend { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
  `

  for (const report of reports) {
    const taskCount = report.tasksByEpic.reduce((sum: number, e: any) => sum + e.tasks.length, 0)
    const completedCount = report.tasksByEpic.reduce((sum: number, e: any) => 
      sum + e.tasks.filter((t: any) => t.status === 'DONE' || t.status === 'LIVE').length, 0
    )
    const splitCount = report.tasksByEpic.reduce((sum: number, e: any) => 
      sum + e.tasks.filter((t: any) => t.splitFromId || (t.splitTasks && t.splitTasks.length > 0)).length, 0
    )
    const carriedCount = taskCount - completedCount

    html += `
      <div class="sprint">
        <div class="sprint-header">
          <div class="sprint-title">
            <span class="icon">🏃</span>
            ${report.sprint.name}
          </div>
          <div class="sprint-meta">
            ${report.sprint.startDate && report.sprint.endDate 
              ? `<span>📅 ${formatDate(report.sprint.startDate)} → ${formatDate(report.sprint.endDate)}</span>` 
              : ''}
            <span>📋 ${taskCount} tasks</span>
          </div>
          <div class="sprint-stats">
            <div class="stat-box">
              <div class="stat-number">${completedCount}</div>
              <div class="stat-label">Completed</div>
            </div>
            ${splitCount > 0 ? `
            <div class="stat-box">
              <div class="stat-number">${splitCount}</div>
              <div class="stat-label">Split/Cont.</div>
            </div>
            ` : ''}
            ${carriedCount > 0 ? `
            <div class="stat-box">
              <div class="stat-number">${carriedCount}</div>
              <div class="stat-label">Carried Over</div>
            </div>
            ` : ''}
          </div>
        </div>
    `

    if (report.aiSummary) {
      html += `
        <div class="ai-summary">
          <div class="ai-summary-label">⚡ AI Sprint Summary</div>
          <div class="ai-summary-text">${report.aiSummary}</div>
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
              : `<span class="epic-name" style="color: #64748b;">📁 Uncategorized</span>`
            }
            <span class="epic-count">${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''}</span>
          </div>
      `

      for (const task of group.tasks) {
        const isComplete = task.status === 'DONE' || task.status === 'LIVE'
        const isSplitFrom = !!task.splitFromId // This task is a continuation
        const hasSplitTasks = task.splitTasks && task.splitTasks.length > 0 // This task was split
        const opts = taskOptions[task.id] || { includeImages: false }

        html += `
          <div class="task">
            <div class="task-header">
              <span class="task-key">${task.taskKey}</span>
              <span class="task-title">${task.title}</span>
        `
        
        // Add status labels
        if (isComplete) {
          html += `<span class="label label-complete">✓ Complete</span>`
        } else {
          html += `<span class="label label-carried">→ Carried</span>`
        }
        
        if (isSplitFrom) {
          html += `<span class="label label-continuation">↳ Continuation</span>`
        }
        
        if (hasSplitTasks) {
          html += `<span class="label label-split">⇅ Split</span>`
        }

        html += `</div>` // Close task-header

        // AI Description summary
        if (task.aiDescriptionSummary) {
          html += `<div class="task-description">${task.aiDescriptionSummary}</div>`
        }

        // AI Comments summary
        if (task.aiCommentsSummary) {
          html += `<div class="task-comments">${task.aiCommentsSummary}</div>`
        }

        // Meta info
        const metaParts = []
        if (task.assignee) metaParts.push(`👤 ${task.assignee.name}`)
        if (task.sprintCount > 1) metaParts.push(`🔄 Across ${task.sprintCount} sprints`)
        
        if (metaParts.length > 0) {
          html += `<div class="task-meta">${metaParts.join(' &nbsp;•&nbsp; ')}</div>`
        }

        // Images if enabled
        if (opts.includeImages && task.attachments && task.attachments.length > 0) {
          html += `<div class="images">`
          for (const att of task.attachments.slice(0, 6)) {
            if (att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
              html += `<img class="image-thumb" src="${att.url}" alt="" />`
            } else {
              html += `<div class="image-placeholder">📄</div>`
            }
          }
          if (task.attachments.length > 6) {
            html += `<div class="image-placeholder">+${task.attachments.length - 6}</div>`
          }
          html += `</div>`
        }

        html += `</div>` // Close task
      }

      html += `</div>` // Close epic-group
    }

    html += `</div>` // Close sprint
  }

  // Add Legend
  html += `
    <div class="legend">
      <div class="legend-title">📖 Report Legend</div>
      <div class="legend-items">
        <div class="legend-item">
          <span class="label label-complete">✓ Complete</span>
          <span class="legend-item-text">Task was fully completed during this sprint</span>
        </div>
        <div class="legend-item">
          <span class="label label-carried">→ Carried</span>
          <span class="legend-item-text">Task was not completed and will continue in next sprint</span>
        </div>
        <div class="legend-item">
          <span class="label label-split">⇅ Split</span>
          <span class="legend-item-text">Task was split into continuation tasks to track ongoing work</span>
        </div>
        <div class="legend-item">
          <span class="label label-continuation">↳ Continuation</span>
          <span class="legend-item-text">This task continues work from a previous split task</span>
        </div>
      </div>
    </div>
  `

  html += `
      <div class="footer">
        Sprint Report • Generated by Scrumbies • ${formatDate(new Date().toISOString())}
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
