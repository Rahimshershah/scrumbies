import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// POST - Create a new status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    
    // Only admins can manage settings
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage settings' }, { status: 403 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { name, key, color, bgColor, icon, isFinal } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'Name and key are required' }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.projectStatus.aggregate({
      where: { projectId },
      _max: { order: true },
    })

    const status = await prisma.projectStatus.create({
      data: {
        projectId,
        name,
        key: key.toUpperCase().replace(/\s+/g, '_'),
        color: color || '#64748b',
        bgColor: bgColor || '#f1f5f9',
        icon,
        isFinal: isFinal || false,
        order: (maxOrder._max.order ?? -1) + 1,
        isDefault: false,
      },
    })

    return NextResponse.json(status, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create status:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update statuses (bulk update for reordering or editing)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage settings' }, { status: 403 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { statuses } = body

    if (!Array.isArray(statuses)) {
      return NextResponse.json({ error: 'Statuses array is required' }, { status: 400 })
    }

    // Update each status
    const updates = statuses.map((status: any, index: number) =>
      prisma.projectStatus.update({
        where: { id: status.id },
        data: {
          name: status.name,
          color: status.color,
          bgColor: status.bgColor,
          icon: status.icon,
          isFinal: status.isFinal,
          order: index,
        },
      })
    )

    await prisma.$transaction(updates)

    // Fetch updated statuses
    const updatedStatuses = await prisma.projectStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(updatedStatuses)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update statuses:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Delete a status
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage settings' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusId = searchParams.get('statusId')

    if (!statusId) {
      return NextResponse.json({ error: 'Status ID is required' }, { status: 400 })
    }

    // Check if status is a default
    const status = await prisma.projectStatus.findUnique({
      where: { id: statusId },
    })

    if (!status) {
      return NextResponse.json({ error: 'Status not found' }, { status: 404 })
    }

    if (status.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default statuses' }, { status: 400 })
    }

    await prisma.projectStatus.delete({
      where: { id: statusId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete status:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}










