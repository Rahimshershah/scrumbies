import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const backlog = searchParams.get('backlog') === 'true'

    const where: any = {}
    if (projectId) where.projectId = projectId
    if (backlog) where.sprintId = null

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        splitFrom: {
          select: {
            id: true,
            title: true,
          },
        },
        splitTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json(tasks)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, description, sprintId, projectId, assigneeId, team, status, priority, epicId } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Find max order for tasks in the same sprint or backlog
    const maxOrderTask = await prisma.task.findFirst({
      where: sprintId ? { sprintId } : { sprintId: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    // Generate task key if project is provided
    let taskKey: string | null = null
    let taskNumber: number | null = null

    if (projectId) {
      // Atomically increment the project's task counter
      const project = await prisma.project.update({
        where: { id: projectId },
        data: { taskCounter: { increment: 1 } },
        select: { key: true, taskCounter: true },
      })

      taskNumber = project.taskCounter
      // Format as XXX-001, XXX-002, etc.
      taskKey = `${project.key}-${String(taskNumber).padStart(3, '0')}`
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        taskKey,
        taskNumber,
        sprintId: sprintId || null,
        projectId: projectId || null,
        epicId: epicId || null,
        assigneeId: assigneeId || null,
        assignedAt: assigneeId ? new Date() : null,
        team: team || null,
        createdById: user.id,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        order: (maxOrderTask?.order ?? -1) + 1,
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        splitFrom: {
          select: {
            id: true,
            title: true,
            taskKey: true,
          },
        },
        splitTasks: {
          select: {
            id: true,
            title: true,
            taskKey: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    // Create activity record
    await prisma.activity.create({
      data: {
        type: 'CREATED',
        taskId: task.id,
        userId: user.id,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create task:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
