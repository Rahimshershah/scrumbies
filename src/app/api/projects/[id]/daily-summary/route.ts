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
        author: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, taskKey: true } },
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

    // Get current user's name for personalization
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true },
    })
    const userName = currentUser?.name || 'You'
    const userFirstName = userName.split(' ')[0]

    // Filter for activities relevant to this user:
    // 1. Tasks assigned TO them
    // 2. Comments that mention them
    // 3. Activity on tasks they own
    const myTaskIds = await prisma.task.findMany({
      where: { projectId, assigneeId: user.id },
      select: { id: true },
    }).then(tasks => tasks.map(t => t.id))

    // Tasks assigned to me today
    const assignedToMe = activities.filter(a =>
      a.type === 'ASSIGNED' && (a.metadata as any)?.assigneeId === user.id
    )

    // Comments that mention me (check content for @mention)
    const mentionedInComments = comments.filter(c =>
      c.content?.toLowerCase().includes(`@${userName.toLowerCase()}`) ||
      c.content?.toLowerCase().includes(`@${userFirstName.toLowerCase()}`)
    )

    // Activity on my tasks (tasks assigned to me)
    const activityOnMyTasks = activities.filter(a => myTaskIds.includes(a.taskId))

    // Comments on my tasks
    const commentsOnMyTasks = comments.filter(c => myTaskIds.includes(c.taskId))

    // Build personalized summary
    const personalizedData = {
      assignedToMe: assignedToMe.map(a => ({
        task: a.task.title,
        key: a.task.taskKey,
        by: a.user.name,
      })),
      mentionedIn: mentionedInComments.map(c => ({
        task: c.task.taskKey || c.task.title,
        by: c.author.name,
      })),
      myTasksUpdated: activityOnMyTasks.filter(a => a.userId !== user.id).map(a => ({
        task: a.task.title,
        key: a.task.taskKey,
        type: a.type,
        by: a.user.name,
      })),
      commentsOnMyTasks: commentsOnMyTasks.filter(c => c.author.id !== user.id).map(c => ({
        task: c.task.taskKey || c.task.title,
        by: c.author.name,
      })),
    }

    // Check if there's anything relevant for this user
    const hasRelevantActivity =
      personalizedData.assignedToMe.length > 0 ||
      personalizedData.mentionedIn.length > 0 ||
      personalizedData.myTasksUpdated.length > 0 ||
      personalizedData.commentsOnMyTasks.length > 0

    if (!hasRelevantActivity) {
      return NextResponse.json({
        summary: "Nothing new for you today. Your tasks are quiet!",
        generated: false,
      })
    }

    // Generate AI summary
    const prompt = `You are a personal assistant giving a quick update. Summarize what happened today that's relevant to ${userFirstName}.

Data:
${JSON.stringify(personalizedData, null, 2)}

Rules:
- Keep it SHORT - 1-2 sentences max
- Be direct: "You were assigned...", "Sarah commented on your task...", "Your task was moved to..."
- If multiple items, group them briefly
- Use a friendly but concise tone
- Start with a relevant emoji (📬 for assignments, 💬 for comments, 📋 for updates)
- No fluff, just the key info

Write the personalized summary:`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
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
