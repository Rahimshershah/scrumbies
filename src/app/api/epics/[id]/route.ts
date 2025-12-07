import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET - Get a single epic with its tasks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const epic = await prisma.epic.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            sprint: {
              select: { id: true, name: true, status: true, startDate: true, endDate: true },
            },
            _count: {
              select: { comments: true },
            },
          },
          orderBy: [
            { sprint: { startDate: 'asc' } },
            { order: 'asc' },
          ],
        },
        _count: {
          select: { tasks: true },
        },
      },
    })

    if (!epic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    return NextResponse.json(epic)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch epic:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update an epic
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await request.json()

    const { name, description, color, startDate, endDate, order } = body

    // Check if epic exists
    const existingEpic = await prisma.epic.findUnique({ where: { id } })
    if (!existingEpic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    const epic = await prisma.epic.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(color !== undefined && { color }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(order !== undefined && { order }),
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

    return NextResponse.json(epic)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update epic:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Delete an epic (tasks are preserved, just unlinked)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    // Check if epic exists
    const existingEpic = await prisma.epic.findUnique({ where: { id } })
    if (!existingEpic) {
      return NextResponse.json({ error: 'Epic not found' }, { status: 404 })
    }

    // The epic-task relation uses onDelete: SetNull, so tasks will be preserved
    await prisma.epic.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete epic:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

