import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { sendWeeklyDigestEmail, WeeklyDigestTask } from '@/lib/email'

// POST - Send weekly digest emails
// This can be triggered by a cron job or manually by an admin
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    // Only admins can trigger digest emails
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    const { projectId, sendToAll } = body

    // Calculate week dates
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)
    
    const weekStartStr = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const weekEndStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    // Get project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get completed tasks from the past week
    const completedTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: { in: ['DONE', 'LIVE'] },
        updatedAt: { gte: weekStart },
      },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        updatedAt: true,
        assignee: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Get in-progress tasks
    const inProgressTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        assignee: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })

    // Get active sprint
    const activeSprint = await prisma.sprint.findFirst({
      where: {
        projectId,
        status: 'ACTIVE',
      },
      select: { name: true },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Format tasks for email
    const formatTasks = (tasks: Array<{ id: string; taskKey: string | null; title: string; status: string; assignee: { name: string } | null }>): WeeklyDigestTask[] =>
      tasks.map(task => ({
        key: task.taskKey || 'TASK',
        title: task.title,
        status: task.status,
        assignee: task.assignee?.name,
        url: `${baseUrl}/?task=${task.id}`,
      }))

    // Determine recipients
    const recipients = sendToAll
      ? project.members
      : [{ id: user.id, name: user.name, email: user.email }]

    let sentCount = 0
    for (const recipient of recipients) {
      if (recipient.email) {
        await sendWeeklyDigestEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          projectName: project.name,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          completedTasks: formatTasks(completedTasks),
          inProgressTasks: formatTasks(inProgressTasks),
          totalCompleted: completedTasks.length,
          totalInProgress: inProgressTasks.length,
          sprintName: activeSprint?.name,
          dashboardUrl: baseUrl,
        })
        sentCount++
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      completedCount: completedTasks.length,
      inProgressCount: inProgressTasks.length,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to send weekly digest:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// GET - Preview weekly digest for a project (doesn't send email)
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    // Calculate week dates
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)

    // Get completed tasks
    const completedTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: { in: ['DONE', 'LIVE'] },
        updatedAt: { gte: weekStart },
      },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        updatedAt: true,
        assignee: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Get in-progress tasks
    const inProgressTasks = await prisma.task.findMany({
      where: {
        projectId,
        status: 'IN_PROGRESS',
      },
      select: {
        id: true,
        taskKey: true,
        title: true,
        status: true,
        assignee: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      weekStart: weekStart.toISOString(),
      weekEnd: now.toISOString(),
      completedTasks,
      inProgressTasks,
      totalCompleted: completedTasks.length,
      totalInProgress: inProgressTasks.length,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to get weekly digest preview:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

