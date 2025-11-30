import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// Helper function to get the base title (without the number suffix)
function getBaseTitle(title: string): string {
  // Remove any trailing " #N" pattern
  return title.replace(/\s+#\d+$/, '').trim()
}

// Helper function to find the next number in the chain
async function getNextChainNumber(taskId: string): Promise<number> {
  // Find the root task first
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

  // Count all tasks in the chain (including root)
  let count = 1 // Start with root
  
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
  return count + 1 // Next number in sequence
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    
    // Get options from request body
    let targetSprintId: string | null = null
    let transferComments = true
    let transferDescription = true
    try {
      const body = await request.json()
      targetSprintId = body.targetSprintId ?? null
      transferComments = body.transferComments ?? true
      transferDescription = body.transferDescription ?? true
    } catch {
      // No body provided, use defaults
    }

    const originalTask = await prisma.task.findUnique({
      where: { id },
      include: {
        comments: {
          include: {
            author: { select: { id: true, name: true } },
            mentions: { select: { id: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        sprint: { select: { name: true } },
        project: { select: { id: true, key: true } },
      },
    })

    if (!originalTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Determine the target sprint (use provided or same as original)
    const destSprintId = targetSprintId !== undefined ? targetSprintId : originalTask.sprintId

    // Get destination sprint name for activity
    let destSprintName = 'Backlog'
    if (destSprintId) {
      const destSprint = await prisma.sprint.findUnique({
        where: { id: destSprintId },
        select: { name: true },
      })
      destSprintName = destSprint?.name || 'Unknown Sprint'
    }

    // Find the max order in the destination sprint/backlog
    const maxOrderTask = await prisma.task.findFirst({
      where: destSprintId ? { sprintId: destSprintId } : { sprintId: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const newOrder = (maxOrderTask?.order ?? -1) + 1

    // Get the next number in the chain
    const nextNumber = await getNextChainNumber(id)
    
    // Get base title (strip any existing number)
    const baseTitle = getBaseTitle(originalTask.title)
    
    // Create the new title with number
    const newTitle = `${baseTitle} #${nextNumber}`

    // Generate task key if original task has a project
    let taskKey: string | null = null
    let taskNumber: number | null = null

    if (originalTask.projectId) {
      // Atomically increment the project's task counter
      const project = await prisma.project.update({
        where: { id: originalTask.projectId },
        data: { taskCounter: { increment: 1 } },
        select: { key: true, taskCounter: true },
      })

      taskNumber = project.taskCounter
      taskKey = `${project.key}-${String(taskNumber).padStart(3, '0')}`
    }

    // Create the split task (optionally with description)
    const splitTask = await prisma.task.create({
      data: {
        title: newTitle,
        taskKey,
        taskNumber,
        description: transferDescription ? originalTask.description : null,
        sprintId: destSprintId,
        projectId: originalTask.projectId, // Keep same project
        assigneeId: originalTask.assigneeId,
        createdById: user.id,
        team: originalTask.team,
        priority: originalTask.priority,
        status: 'TODO',
        order: newOrder,
        splitFromId: id,
      },
    })

    // Optionally copy all comments to the new task
    let commentsCopied = 0
    if (transferComments && originalTask.comments.length > 0) {
      for (const comment of originalTask.comments) {
        await prisma.comment.create({
          data: {
            content: comment.content,
            taskId: splitTask.id,
            authorId: comment.author.id,
            mentions: {
              connect: comment.mentions.map(m => ({ id: m.id })),
            },
          },
        })
        commentsCopied++
      }
    }

    // Create activity record on original task
    await prisma.activity.create({
      data: {
        type: 'SPLIT',
        metadata: { 
          newTaskId: splitTask.id, 
          newTaskTitle: splitTask.title,
          splitNumber: nextNumber,
          targetSprint: destSprintName,
          commentsCopied,
          descriptionCopied: transferDescription,
        },
        taskId: id,
        userId: user.id,
      },
    })

    // Create activity record on new task
    await prisma.activity.create({
      data: {
        type: 'CREATED',
        metadata: { 
          splitFrom: originalTask.title,
          splitNumber: nextNumber,
          fromSprint: originalTask.sprint?.name || 'Backlog',
        },
        taskId: splitTask.id,
        userId: user.id,
      },
    })

    // Fetch the complete split task with all relations
    const completeSplitTask = await prisma.task.findUnique({
      where: { id: splitTask.id },
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
            taskKey: true,
            sprintId: true,
            sprint: { select: { name: true } },
          },
        },
        splitTasks: {
          select: {
            id: true,
            title: true,
            taskKey: true,
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
        _count: {
          select: { comments: true },
        },
      },
    })

    return NextResponse.json(completeSplitTask, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to split task:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
