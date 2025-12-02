import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// Get the full chain of linked tasks (all ancestors and descendants)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    // Find the root task (traverse up the chain)
    let rootId = id
    let currentTask = await prisma.task.findUnique({
      where: { id },
      select: { splitFromId: true },
    })

    while (currentTask?.splitFromId) {
      rootId = currentTask.splitFromId
      currentTask = await prisma.task.findUnique({
        where: { id: rootId },
        select: { splitFromId: true },
      })
    }

    // Now traverse down from root to get the full chain
    const chain: any[] = []
    const sprintsInChain = new Set<string>()

    async function traverseChain(taskId: string, depth: number = 0) {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          sprint: { select: { id: true, name: true, status: true } },
          assignee: { select: { id: true, name: true, avatarUrl: true } },
          splitTasks: {
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          },
          _count: { select: { comments: true } },
        },
      })

      if (!task) return

      // Track unique sprints
      if (task.sprint) {
        sprintsInChain.add(task.sprint.id)
      } else {
        sprintsInChain.add('backlog')
      }

      chain.push({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        sprint: task.sprint,
        assignee: task.assignee,
        commentCount: task._count.comments,
        createdAt: task.createdAt,
        depth,
        isRoot: depth === 0,
        isCurrent: task.id === id,
      })

      // Traverse children
      for (const child of task.splitTasks) {
        await traverseChain(child.id, depth + 1)
      }
    }

    await traverseChain(rootId)

    return NextResponse.json({
      chain,
      sprintCount: sprintsInChain.size,
      totalTasks: chain.length,
      rootTaskId: rootId,
      currentTaskId: id,
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to get task chain:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}







