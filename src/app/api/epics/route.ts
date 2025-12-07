import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET - List all epics for a project
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 })
    }

    const epics = await prisma.epic.findMany({
      where: { projectId },
      include: {
        createdBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(epics)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch epics:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Create a new epic
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    const { name, description, color, startDate, endDate, projectId } = body

    if (!name || !projectId) {
      return NextResponse.json(
        { error: 'Name and project ID are required' },
        { status: 400 }
      )
    }

    // Get the highest order to place new epic at the end
    const lastEpic = await prisma.epic.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    })

    const epic = await prisma.epic.create({
      data: {
        name,
        description,
        color: color || '#6366f1',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        order: (lastEpic?.order ?? -1) + 1,
        projectId,
        createdById: user.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
    })

    return NextResponse.json(epic, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create epic:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

