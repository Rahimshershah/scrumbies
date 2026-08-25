import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { taskId, targetSprintId, newOrder, orderedTaskIds } = body

    if (!taskId || targetSprintId === undefined || !Number.isInteger(newOrder) || newOrder < 0) {
      return NextResponse.json(
        { error: 'taskId, targetSprintId, and newOrder are required' },
        { status: 400 }
      )
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { sprintId: true, projectId: true },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const sourceSprintId = task.sprintId
    await prisma.$transaction(async (tx) => {
      const containerWhere = (sprintId: string | null) => ({
        sprintId,
        projectId: task.projectId,
      })

      if (sourceSprintId === targetSprintId) {
        const currentTasks = await tx.task.findMany({
          where: containerWhere(targetSprintId),
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: { id: true },
        })
        const currentIds = currentTasks.map(item => item.id)
        let reorderedIds: string[]

        if (Array.isArray(orderedTaskIds)) {
          const requestedIds = orderedTaskIds.filter((id): id is string => typeof id === 'string')
          const currentIdSet = new Set(currentIds)
          const isExactContainerOrder = requestedIds.length === currentIds.length
            && new Set(requestedIds).size === requestedIds.length
            && requestedIds.every(id => currentIdSet.has(id))

          if (!isExactContainerOrder) {
            throw new Error('Invalid ordered task list')
          }
          reorderedIds = requestedIds
        } else {
          reorderedIds = currentIds.filter(id => id !== taskId)
          reorderedIds.splice(Math.min(newOrder, reorderedIds.length), 0, taskId)
        }

        await Promise.all(reorderedIds.map((id, index) =>
          tx.task.update({ where: { id }, data: { order: index } })
        ))
      } else {
        const [sourceTasks, targetTasks] = await Promise.all([
          tx.task.findMany({
            where: containerWhere(sourceSprintId),
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          }),
          tx.task.findMany({
            where: containerWhere(targetSprintId),
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
          }),
        ])

        const sourceIds = sourceTasks.map(item => item.id).filter(id => id !== taskId)
        const targetIds = targetTasks.map(item => item.id).filter(id => id !== taskId)
        targetIds.splice(Math.min(newOrder, targetIds.length), 0, taskId)

        await Promise.all(sourceIds.map((id, index) =>
          tx.task.update({ where: { id }, data: { order: index } })
        ))
        await Promise.all(targetIds.map((id, index) =>
          tx.task.update({
            where: { id },
            data: id === taskId
              ? { sprintId: targetSprintId, order: index }
              : { order: index },
          })
        ))
      }
    })

    // Fetch all tasks in the target sprint with their updated order values
    // IMPORTANT: Filter by projectId to prevent showing tasks from other projects
    const updatedTasks = await prisma.task.findMany({
      where: { sprintId: targetSprintId, projectId: task.projectId },
      orderBy: { order: 'asc' },
      include: {
        assignee: {
          select: { id: true, name: true, avatarUrl: true },
        },
        epic: {
          select: { id: true, name: true, color: true },
        },
        splitFrom: {
          select: { id: true, title: true },
        },
        splitTasks: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
        _count: {
          select: { comments: true },
        },
      },
    })

    // If source sprint is different, also fetch its tasks
    let sourceTasks = null
    if (sourceSprintId !== targetSprintId) {
      sourceTasks = await prisma.task.findMany({
        where: { sprintId: sourceSprintId, projectId: task.projectId },
        orderBy: { order: 'asc' },
        include: {
          assignee: {
            select: { id: true, name: true, avatarUrl: true },
          },
          epic: {
            select: { id: true, name: true, color: true },
          },
          splitFrom: {
            select: { id: true, title: true },
          },
          splitTasks: {
            select: { id: true, title: true, status: true, createdAt: true },
          },
          _count: {
            select: { comments: true },
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      targetSprintId,
      targetTasks: updatedTasks,
      sourceSprintId,
      sourceTasks,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Reorder error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
