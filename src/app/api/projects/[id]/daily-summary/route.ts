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
        task: { select: { title: true, taskKey: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch today's comments (not captured in Activity)
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

    // Build activity summary for the AI
    const activitySummary = {
      tasksCreated: activities.filter(a => a.type === 'CREATED').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
      })),
      statusChanges: activities.filter(a => a.type === 'STATUS_CHANGED').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
        metadata: a.metadata,
      })),
      priorityChanges: activities.filter(a => a.type === 'PRIORITY_CHANGED').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
        metadata: a.metadata,
      })),
      assignments: activities.filter(a => a.type === 'ASSIGNED').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
        metadata: a.metadata,
      })),
      sprintMoves: activities.filter(a => a.type === 'MOVED_TO_SPRINT').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
        metadata: a.metadata,
      })),
      splits: activities.filter(a => a.type === 'SPLIT').map(a => ({
        task: a.task.taskKey || a.task.title,
        by: a.user.name,
      })),
      comments: comments.map(c => ({
        task: c.task.taskKey || c.task.title,
        by: c.author.name,
      })),
      sprintUpdates: sprints.filter(s => s.createdAt >= today).map(s => ({
        name: s.name,
        status: s.status,
        isNew: s.createdAt >= today,
      })),
    }

    // Generate AI summary
    const prompt = `You are a project management assistant. Generate a brief, scannable daily summary of today's project activity.

Project: ${project.name}

Today's Activity Data:
${JSON.stringify(activitySummary, null, 2)}

Rules:
- Use bullet points (•) for each item
- Keep it concise - max 5-6 bullet points
- Group similar activities (e.g., "5 tasks created by Sarah and Ahmed")
- Mention specific people by first name
- Highlight important changes (priority changes, sprint moves, UAT/completion)
- If there are many comments, summarize them (e.g., "8 comments added across 3 tasks")
- Start with a brief emoji that matches the tone (e.g., 📊 for normal day, 🚀 for busy day, 🔧 for bug fixes)
- Don't include a header/title, just the bullet points
- If nothing significant happened, say so briefly

Generate the summary now:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
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
