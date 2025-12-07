import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

function generateReportHTML(
  reports: any[], 
  taskOptions: Record<string, { includeImages: boolean }>,
  reportType: 'detailed' | 'summarized',
  baseUrl: string
) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const getTaskUrl = (taskId: string) => `${baseUrl}?task=${taskId}`

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
        }
        .sprint-meta {
          font-size: 11px;
          opacity: 0.85;
          margin-top: 8px;
        }
        .sprint-stats {
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
        
        /* Epic Group */
        .epic-group {
          border: 1px solid #e2e8f0;
          border-top: none;
          padding: 14px;
          background: #fff;
        }
        .epic-group:last-child {
          border-radius: 0 0 8px 8px;
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
        }
        .epic-count {
          font-size: 9px;
          color: #64748b;
          background: #f1f5f9;
          padding: 3px 8px;
          border-radius: 10px;
        }

        /* Epic Summary (for summarized report) */
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
        .epic-tasks-list {
          margin-top: 10px;
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
        
        /* Task (for detailed report) */
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
        }
        
        /* Images */
        .images {
          margin-top: 10px;
        }
        .image-thumb {
          width: 48px;
          height: 48px;
          border-radius: 4px;
          object-fit: cover;
          border: 1px solid #e2e8f0;
          display: inline-block;
          margin: 2px;
        }
        .image-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 4px;
          background: #f1f5f9;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          color: #64748b;
          border: 1px solid #e2e8f0;
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
        .legend-title {
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 12px;
        }
        .legend-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .legend-item-text {
          font-size: 9px;
          color: #475569;
        }
        
        /* Footer */
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
          .sprint { page-break-inside: avoid; }
          a { color: #6366f1 !important; }
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
          <div class="sprint-title">🏃 ${report.sprint.name}</div>
          <div class="sprint-meta">
            ${report.sprint.startDate && report.sprint.endDate 
              ? `📅 ${formatDate(report.sprint.startDate)} → ${formatDate(report.sprint.endDate)} • ` 
              : ''}
            📋 ${taskCount} tasks
          </div>
          <div class="sprint-stats">
            <div class="stat-box">
              <div class="stat-number">${completedCount}</div>
              <div class="stat-label">Completed</div>
            </div>
            ${splitCount > 0 ? `
            <div class="stat-box">
              <div class="stat-number">${splitCount}</div>
              <div class="stat-label">Split</div>
            </div>
            ` : ''}
            ${carriedCount > 0 ? `
            <div class="stat-box">
              <div class="stat-number">${carriedCount}</div>
              <div class="stat-label">Carried</div>
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
              ? `<span class="epic-color" style="background: ${group.epic.color}"></span>
                 <span class="epic-name">${group.epic.name}</span>`
              : `<span class="epic-name" style="color: #64748b;">📁 Uncategorized</span>`
            }
            <span class="epic-count">${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''}</span>
          </div>
      `

      // SUMMARIZED VIEW
      if (reportType === 'summarized') {
        html += `
          <div class="epic-summary">
            ${group.epicSummary 
              ? `<div class="epic-summary-text">${group.epicSummary}</div>`
              : `<div class="epic-summary-text" style="color: #64748b; font-style: italic;">
                  ${group.tasks.length} task${group.tasks.length !== 1 ? 's' : ''} completed in this epic
                </div>`
            }
            <div class="epic-tasks-list">
              ${group.tasks.map((t: any) => `<span class="task-chip"><a href="${getTaskUrl(t.id)}">${t.taskKey}</a></span>`).join('')}
            </div>
          </div>
        `
      } else {
        // DETAILED VIEW
        for (const task of group.tasks) {
          const isComplete = task.status === 'DONE' || task.status === 'LIVE'
          const isSplitFrom = !!task.splitFromId
          const hasSplitTasks = task.splitTasks && task.splitTasks.length > 0
          const opts = taskOptions[task.id] || { includeImages: false }

          html += `
            <div class="task">
              <div class="task-header">
                <a href="${getTaskUrl(task.id)}" class="task-key">${task.taskKey}</a>
                <span class="task-title">${task.title}</span>
          `
          
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

          html += `</div>`

          if (task.aiDescriptionSummary) {
            html += `<div class="task-description">${task.aiDescriptionSummary}</div>`
          }

          if (task.aiCommentsSummary) {
            html += `<div class="task-comments">💬 ${task.aiCommentsSummary}</div>`
          }

          const metaParts = []
          if (task.assignee) metaParts.push(`👤 ${task.assignee.name}`)
          if (task.sprintCount > 1) metaParts.push(`🔄 ${task.sprintCount} sprints`)
          
          if (metaParts.length > 0) {
            html += `<div class="task-meta">${metaParts.join(' • ')}</div>`
          }

          if (opts.includeImages && task.attachments && task.attachments.length > 0) {
            html += `<div class="images">`
            for (const att of task.attachments.slice(0, 6)) {
              if (att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                html += `<img class="image-thumb" src="${att.url}" alt="" />`
              } else {
                html += `<span class="image-placeholder">📄</span>`
              }
            }
            if (task.attachments.length > 6) {
              html += `<span class="image-placeholder">+${task.attachments.length - 6}</span>`
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

  // Legend (only for detailed reports)
  if (reportType === 'detailed') {
    html += `
      <div class="legend">
        <div class="legend-title">📖 Legend</div>
        <div class="legend-grid">
          <div class="legend-item">
            <span class="label label-complete">✓ Complete</span>
            <span class="legend-item-text">Task fully completed</span>
          </div>
          <div class="legend-item">
            <span class="label label-carried">→ Carried</span>
            <span class="legend-item-text">Continues next sprint</span>
          </div>
          <div class="legend-item">
            <span class="label label-split">⇅ Split</span>
            <span class="legend-item-text">Task was split</span>
          </div>
          <div class="legend-item">
            <span class="label label-continuation">↳ Continuation</span>
            <span class="legend-item-text">From a split task</span>
          </div>
        </div>
      </div>
    `
  }

  html += `
      <div class="footer">
        ${reportType === 'summarized' ? 'Summarized' : 'Detailed'} Sprint Report • Generated by Scrumbies • ${formatDate(new Date().toISOString())}
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
    const { reports, taskOptions = {}, reportType = 'detailed', format = 'html' } = body

    if (!reports || reports.length === 0) {
      return NextResponse.json({ error: 'No report data' }, { status: 400 })
    }

    // Get base URL from request
    const url = new URL(request.url)
    const baseUrl = `${url.protocol}//${url.host}`

    const html = generateReportHTML(reports, taskOptions, reportType, baseUrl)

    // If PDF format requested, use puppeteer
    if (format === 'pdf') {
      try {
        // Dynamic import for puppeteer
        let browser
        
        if (process.env.NODE_ENV === 'production') {
          // Production: use @sparticuz/chromium
          const chromium = await import('@sparticuz/chromium')
          const puppeteer = await import('puppeteer-core')
          
          browser = await puppeteer.default.launch({
            args: chromium.default.args,
            defaultViewport: { width: 800, height: 600 },
            executablePath: await chromium.default.executablePath(),
            headless: true,
          })
        } else {
          // Development: use regular puppeteer
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
        // Fall back to HTML if PDF generation fails
      }
    }

    // Return HTML (default)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    })
  } catch (error) {
    console.error('Failed to generate report:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
