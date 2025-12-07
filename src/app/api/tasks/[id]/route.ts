import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { sendTaskAssignmentEmail } from '@/lib/email'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        splitFrom: {
          select: {
            id: true,
            title: true,
            sprintId: true,
            sprint: { select: { name: true } },
          },
        },
        splitTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            sprintId: true,
            sprint: { select: { name: true } },
            createdAt: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            mentions: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json(task)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const { title, description, status, priority, assigneeId, team, sprintId, epicId, order } = body

    // Get current task for activity tracking
    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        team: true,
        taskKey: true,
        sprintId: true,
        assigneeId: true,
        sprint: { select: { name: true } },
        assignee: { select: { name: true } },
      },
    })

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const updateData: any = {}
    const activities: any[] = []

    if (title !== undefined && title !== currentTask.title) {
      updateData.title = title
    }
    if (description !== undefined && description !== currentTask.description) {
      updateData.description = description
      activities.push({ type: 'DESCRIPTION_UPDATED' })
    }
    if (status !== undefined && status !== currentTask.status) {
      updateData.status = status
      activities.push({
        type: 'STATUS_CHANGED',
        metadata: { from: currentTask.status, to: status },
      })
    }
    if (priority !== undefined && priority !== currentTask.priority) {
      updateData.priority = priority
      activities.push({
        type: 'PRIORITY_CHANGED',
        metadata: { from: currentTask.priority, to: priority },
      })
    }
    if (assigneeId !== undefined && assigneeId !== currentTask.assigneeId) {
      updateData.assigneeId = assigneeId
      updateData.assignedAt = assigneeId ? new Date() : null
      const newAssignee = assigneeId
        ? await prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true, email: true } })
        : null
      activities.push({
        type: 'ASSIGNED',
        metadata: { from: currentTask.assignee?.name || null, to: newAssignee?.name || null },
      })
      
      // Send assignment notification email
      if (newAssignee && newAssignee.email && newAssignee.id !== user.id) {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        sendTaskAssignmentEmail({
          recipientEmail: newAssignee.email,
          recipientName: newAssignee.name,
          assignerName: user.name,
          taskKey: currentTask.taskKey || 'TASK',
          taskTitle: currentTask.title,
          taskDescription: currentTask.description || undefined,
          taskPriority: currentTask.priority || undefined,
          taskStatus: currentTask.status,
          sprintName: currentTask.sprint?.name || undefined,
          taskUrl: `${baseUrl}/?task=${id}`,
        })
      }
    }
    if (team !== undefined) {
      updateData.team = team
    }
    if (sprintId !== undefined && sprintId !== currentTask.sprintId) {
      updateData.sprintId = sprintId
      const newSprint = sprintId
        ? await prisma.sprint.findUnique({ where: { id: sprintId }, select: { name: true } })
        : null
      activities.push({
        type: 'MOVED_TO_SPRINT',
        metadata: { from: currentTask.sprint?.name || 'Backlog', to: newSprint?.name || 'Backlog' },
      })
    }
    if (order !== undefined) updateData.order = order
    if (epicId !== undefined) updateData.epicId = epicId

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        splitFrom: {
          select: {
            id: true,
            title: true,
            sprintId: true,
            sprint: { select: { name: true } },
          },
        },
        splitTasks: {
          select: {
            id: true,
            title: true,
            status: true,
            sprintId: true,
            sprint: { select: { name: true } },
            createdAt: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
        epic: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    // Create activity records
    if (activities.length > 0) {
      await prisma.activity.createMany({
        data: activities.map((a) => ({
          type: a.type,
          metadata: a.metadata || null,
          taskId: id,
          userId: user.id,
        })),
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update task:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Check if task exists and get creator
    const task = await prisma.task.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Only admin or task creator can delete
    const isAdmin = user.role === 'ADMIN'
    const isCreator = task.createdById === user.id

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ error: 'You can only delete tasks you created' }, { status: 403 })
    }

    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
