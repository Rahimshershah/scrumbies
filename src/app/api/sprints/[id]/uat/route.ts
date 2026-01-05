import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// Helper function to get the base title (without the number suffix)
function getBaseTitle(title: string): string {
  return title.replace(/\s+#\d+$/, '').trim()
}

// Helper function to find the next number in the chain
async function getNextChainNumber(taskId: string): Promise<number> {
  let rootId = taskId
  let currentTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { splitFromId: true },
  })

  while (currentTask?.splitFromId) {
    rootId = currentTask.splitFromId
    currentTask = await prisma.task.findUnique({
      where: { id: rootId },
      select: { splitFromId: true },
    })
  }

  let count = 1

  async function countChildren(parentId: string): Promise<number> {
    const children = await prisma.task.findMany({
      where: { splitFromId: parentId },
      select: { id: true },
    })

    let total = children.length
    for (const child of children) {
      total += await countChildren(child.id)
    }
    return total
  }

  count += await countChildren(rootId)
  return count + 1
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: sprintId } = await params

    const body = await request.json()
    const { action, targetSprintId } = body
    // action: 'close_all' | 'move_all' | 'split_all'

    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        tasks: {
          where: {
            // UAT Sprint: Only handle TODO, IN_PROGRESS, BLOCKED
            // Keep READY_TO_TEST, DONE, LIVE in the sprint
            status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] }
          },
          include: {
            comments: {
              include: {
                author: { select: { id: true, name: true } },
                mentions: { select: { id: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    })

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found' }, { status: 404 })
    }

    const openTasks = sprint.tasks

    // Get the next sprint for move/split operations
    let nextSprint = null
    if (action === 'move_all' || action === 'split_all') {
      if (targetSprintId) {
        nextSprint = await prisma.sprint.findUnique({
          where: { id: targetSprintId },
        })
      } else {
        // Find the next planned sprint
        nextSprint = await prisma.sprint.findFirst({
          where: { status: 'PLANNED' },
          orderBy: { order: 'asc' },
        })
      }

      if (!nextSprint && (action === 'move_all' || action === 'split_all')) {
        return NextResponse.json({
          error: 'No target sprint available. Please create a new sprint first.'
        }, { status: 400 })
      }
    }

    const results: any = {
      closedTasks: [],
      movedTasks: [],
      splitTasks: [],
    }

    if (action === 'close_all') {
      // Mark all open tasks as DONE
      for (const task of openTasks) {
        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { status: 'DONE' },
        })

        await prisma.activity.create({
          data: {
            type: 'STATUS_CHANGED',
            metadata: { from: task.status, to: 'DONE', reason: 'Sprint moved to UAT' },
            taskId: task.id,
            userId: user.id,
          },
        })

        results.closedTasks.push(updated)
      }
    } else if (action === 'move_all' && nextSprint) {
      // Move all open tasks to next sprint
      for (const task of openTasks) {
        const updated = await prisma.task.update({
          where: { id: task.id },
          data: { sprintId: nextSprint.id },
        })

        await prisma.activity.create({
          data: {
            type: 'MOVED_TO_SPRINT',
            metadata: { from: sprint.name, to: nextSprint.name, reason: 'Sprint moved to UAT' },
            taskId: task.id,
            userId: user.id,
          },
        })

        results.movedTasks.push(updated)
      }
    } else if (action === 'split_all' && nextSprint) {
      // Split all open tasks to next sprint (copy with comments)
      // First mark original tasks as DONE, then create split tasks
      for (const task of openTasks) {
        const nextNumber = await getNextChainNumber(task.id)
        const baseTitle = getBaseTitle(task.title)
        const newTitle = `${baseTitle} #${nextNumber}`

        // Mark original task as DONE first
        const originalStatus = task.status
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'DONE' },
        })

        // Record status change activity
        await prisma.activity.create({
          data: {
            type: 'STATUS_CHANGED',
            metadata: { from: originalStatus, to: 'DONE', reason: 'Sprint moved to UAT - task split' },
            taskId: task.id,
            userId: user.id,
          },
        })

        // Find max order in target sprint
        const maxOrderTask = await prisma.task.findFirst({
          where: { sprintId: nextSprint.id },
          orderBy: { order: 'desc' },
          select: { order: true },
        })
        const newOrder = (maxOrderTask?.order ?? -1) + 1

        // Generate task key if task has a project
        let taskKey: string | null = null
        let taskNumber: number | null = null

        if (task.projectId) {
          const project = await prisma.project.update({
            where: { id: task.projectId },
            data: { taskCounter: { increment: 1 } },
            select: { key: true, taskCounter: true },
          })
          taskNumber = project.taskCounter
          taskKey = `${project.key}-${String(taskNumber).padStart(3, '0')}`
        }

        // Create split task
        const splitTask = await prisma.task.create({
          data: {
            title: newTitle,
            taskKey,
            taskNumber,
            description: task.description,
            sprintId: nextSprint.id,
            projectId: task.projectId, // Keep same project
            assigneeId: task.assigneeId,
            createdById: user.id,
            team: task.team,
            priority: task.priority,
            status: 'TODO',
            order: newOrder,
            splitFromId: task.id,
          },
        })

        // Copy comments
        if (task.comments && task.comments.length > 0) {
          for (const comment of task.comments) {
            if (comment.author?.id) {
              await prisma.comment.create({
                data: {
                  content: comment.content,
                  taskId: splitTask.id,
                  authorId: comment.author.id,
                  mentions: comment.mentions?.length > 0 ? {
                    connect: comment.mentions.map(m => ({ id: m.id })),
                  } : undefined,
                },
              })
            }
          }
        }

        // Create activity on original for the split
        await prisma.activity.create({
          data: {
            type: 'SPLIT',
            metadata: {
              newTaskId: splitTask.id,
              newTaskTitle: splitTask.title,
              splitNumber: nextNumber,
              targetSprint: nextSprint.name,
              reason: 'Sprint moved to UAT',
            },
            taskId: task.id,
            userId: user.id,
          },
        })

        // Create activity on new task
        await prisma.activity.create({
          data: {
            type: 'CREATED',
            metadata: {
              splitFrom: task.title,
              splitNumber: nextNumber,
              fromSprint: sprint.name,
            },
            taskId: splitTask.id,
            userId: user.id,
          },
        })

        results.splitTasks.push(splitTask)
      }
    }

    // Mark sprint as UAT (not COMPLETED)
    const uatSprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: { status: 'UAT' },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            splitFrom: {
              select: { id: true, title: true },
            },
            splitTasks: {
              select: { id: true, title: true, status: true, createdAt: true },
            },
          },
        },
      },
    })

    return NextResponse.json({
      sprint: uatSprint,
      results,
      targetSprint: nextSprint,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to move sprint to UAT:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
