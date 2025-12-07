import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const sprints = await prisma.sprint.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { order: 'asc' },
      include: {
        tasks: {
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
        },
      },
    })

    return NextResponse.json(sprints)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { name, startDate, endDate, status, projectId } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const maxOrderSprint = await prisma.sprint.findFirst({
      where: projectId ? { projectId } : {},
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const sprint = await prisma.sprint.create({
      data: {
        name,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: status || 'PLANNED',
        projectId: projectId || null,
        order: (maxOrderSprint?.order ?? -1) + 1,
      },
      include: {
        tasks: true,
      },
    })

    return NextResponse.json(sprint, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
