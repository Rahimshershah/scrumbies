import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { taskId, targetSprintId, newOrder } = body

    if (!taskId || targetSprintId === undefined || newOrder === undefined) {
      return NextResponse.json(
        { error: 'taskId, targetSprintId, and newOrder are required' },
        { status: 400 }
      )
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { sprintId: true, order: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const sourceSprintId = task.sprintId
    const oldOrder = task.order

    await prisma.$transaction(async (tx) => {
      if (sourceSprintId === targetSprintId) {
        // Same sprint - just reorder
        if (newOrder > oldOrder) {
          // Moving down
          await tx.task.updateMany({
            where: {
              sprintId: targetSprintId,
              order: { gt: oldOrder, lte: newOrder },
            },
            data: { order: { decrement: 1 } },
          })
        } else if (newOrder < oldOrder) {
          // Moving up
          await tx.task.updateMany({
            where: {
              sprintId: targetSprintId,
              order: { gte: newOrder, lt: oldOrder },
            },
            data: { order: { increment: 1 } },
          })
        }
      } else {
        // Different sprint
        // Decrement order of tasks in source sprint
        await tx.task.updateMany({
          where: {
            sprintId: sourceSprintId,
            order: { gt: oldOrder },
          },
          data: { order: { decrement: 1 } },
        })

        // Increment order of tasks in target sprint
        await tx.task.updateMany({
          where: {
            sprintId: targetSprintId,
            order: { gte: newOrder },
          },
          data: { order: { increment: 1 } },
        })
      }

      // Update the task
      await tx.task.update({
        where: { id: taskId },
        data: {
          sprintId: targetSprintId,
          order: newOrder,
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Reorder error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
