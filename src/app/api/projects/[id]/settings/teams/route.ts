import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// POST - Create a new team
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
    const { name, key, color, bgColor, icon } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'Name and key are required' }, { status: 400 })
    }

    // Get max order
    const maxOrder = await prisma.projectTeam.aggregate({
      where: { projectId },
      _max: { order: true },
    })

    const team = await prisma.projectTeam.create({
      data: {
        projectId,
        name,
        key: key.toUpperCase().replace(/\s+/g, '_'),
        color: color || '#64748b',
        bgColor: bgColor || '#f1f5f9',
        icon,
        order: (maxOrder._max.order ?? -1) + 1,
        isDefault: false,
      },
    })

    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create team:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update teams (bulk update for reordering or editing)
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
    const { teams } = body

    if (!Array.isArray(teams)) {
      return NextResponse.json({ error: 'Teams array is required' }, { status: 400 })
    }

    // Update each team
    const updates = teams.map((team: any, index: number) =>
      prisma.projectTeam.update({
        where: { id: team.id },
        data: {
          name: team.name,
          color: team.color,
          bgColor: team.bgColor,
          icon: team.icon,
          order: index,
        },
      })
    )

    await prisma.$transaction(updates)

    // Fetch updated teams
    const updatedTeams = await prisma.projectTeam.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(updatedTeams)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update teams:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Delete a team
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can manage settings' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'Team ID is required' }, { status: 400 })
    }

    // Check if team is a default
    const team = await prisma.projectTeam.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    if (team.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default teams' }, { status: 400 })
    }

    await prisma.projectTeam.delete({
      where: { id: teamId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete team:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}













