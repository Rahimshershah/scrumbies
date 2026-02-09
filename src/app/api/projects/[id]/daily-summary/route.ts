import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth()
    const projectId = params.id

    // Verify user has access to this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        members: { some: { id: user.id } },
      },
      select: { id: true, name: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get start of today (midnight)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch today's activities
    const activities = await prisma.activity.findMany({
      where: {
        task: { projectId },
        createdAt: { gte: today },
      },
      include: {
        user: { select: { name: true } },
        task: { select: { title: true, taskKey: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch today's comments with content
    const comments = await prisma.comment.findMany({
      where: {
        task: { projectId },
        createdAt: { gte: today },
      },
      include: {
        author: { select: { name: true } },
        task: { select: { title: true, taskKey: true } },
      },
    })

    // Fetch sprints created or status changed today
    const sprints = await prisma.sprint.findMany({
      where: {
        projectId,
        OR: [
          { createdAt: { gte: today } },
          { updatedAt: { gte: today } },
        ],
      },
      select: { name: true, status: true, createdAt: true, updatedAt: true },
    })

    // If no activity today, return a simple message
    if (activities.length === 0 && comments.length === 0 && sprints.length === 0) {
      return NextResponse.json({
        summary: "No activity recorded today yet. Check back later!",
        generated: false,
      })
    }

    // Helper to strip HTML tags from rich text content
    const stripHtml = (html: string) => {
      return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || ''
    }

    // Helper to truncate text
    const truncate = (text: string, maxLen: number) => {
      if (!text || text.length <= maxLen) return text
      return text.slice(0, maxLen) + '...'
    }

    // Build detailed activity summary for the AI
    const activitySummary = {
      tasksCreated: activities.filter(a => a.type === 'CREATED').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
      })),
      statusChanges: activities.filter(a => a.type === 'STATUS_CHANGED').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
        from: (a.metadata as any)?.oldStatus,
        to: (a.metadata as any)?.newStatus,
      })),
      priorityChanges: activities.filter(a => a.type === 'PRIORITY_CHANGED').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
        from: (a.metadata as any)?.oldPriority,
        to: (a.metadata as any)?.newPriority,
      })),
      assignments: activities.filter(a => a.type === 'ASSIGNED').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
        assignedTo: (a.metadata as any)?.assigneeName,
      })),
      sprintMoves: activities.filter(a => a.type === 'MOVED_TO_SPRINT').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
        toSprint: (a.metadata as any)?.sprintName,
      })),
      splits: activities.filter(a => a.type === 'SPLIT').map(a => ({
        key: a.task.taskKey,
        title: a.task.title,
        by: a.user.name,
      })),
      comments: comments.map(c => ({
        task: c.task.taskKey || c.task.title,
        by: c.author.name,
        content: truncate(stripHtml(c.content), 150),
      })),
      sprintUpdates: sprints.filter(s => s.createdAt >= today).map(s => ({
        name: s.name,
        status: s.status,
      })),
    }

    // Generate AI summary
    const prompt = `You are an executive assistant summarizing today's project activity. Write a concise executive summary paragraph (2-4 sentences) that tells the story of what happened today.

Project: ${project.name}

Today's Activity:
${JSON.stringify(activitySummary, null, 2)}

Guidelines:
- Write in flowing paragraph form, NOT bullet points
- Be specific: mention actual task names, what comments discussed, who did what
- Summarize comment content briefly (e.g., "Sarah noted the payment flow needs testing")
- Group related work (e.g., "The team focused on checkout improvements...")
- Mention key people by first name
- Highlight important status changes (things marked done, urgent, blocked)
- Keep it to 2-4 sentences, like a daily standup update
- Start with an emoji that fits the tone (📊 normal, 🚀 productive, 🔧 fixes, ⚠️ blockers)
- Be conversational but professional

Write the executive summary now:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    })

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.'

    return NextResponse.json({
      summary,
      generated: true,
      activityCount: activities.length + comments.length,
    })
  } catch (error) {
    console.error('Daily summary error:', error)

    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // If OpenAI fails, return a fallback
    if ((error as any)?.status === 401 || (error as any)?.code === 'invalid_api_key') {
      return NextResponse.json({
        error: 'AI service not configured',
        summary: 'AI summary unavailable. Please check API configuration.',
        generated: false,
      }, { status: 200 })
    }

    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
