import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// Bulk move tasks to a sprint (or backlog if sprintId is null)
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await request.json()
    const { taskIds, sprintId } = body

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'No tasks specified' }, { status: 400 })
    }

    // Get the max order in the target sprint/backlog
    const maxOrderResult = await prisma.task.aggregate({
      where: { sprintId: sprintId || null },
      _max: { order: true },
    })
    let nextOrder = (maxOrderResult._max.order ?? -1) + 1

    // Update all tasks
    const updates = await Promise.all(
      taskIds.map((taskId, index) =>
        prisma.task.update({
          where: { id: taskId },
          data: {
            sprintId: sprintId || null,
            order: nextOrder + index,
          },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            epic: true,
          },
        })
      )
    )

    return NextResponse.json({ tasks: updates, count: updates.length })
  } catch (error) {
    console.error('Failed to bulk move tasks:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Bulk delete tasks
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await request.json()
    const { taskIds } = body

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return NextResponse.json({ error: 'No tasks specified' }, { status: 400 })
    }

    // Delete all tasks (cascade will handle comments, attachments, etc.)
    const result = await prisma.task.deleteMany({
      where: {
        id: { in: taskIds },
      },
    })

    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    console.error('Failed to bulk delete tasks:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
