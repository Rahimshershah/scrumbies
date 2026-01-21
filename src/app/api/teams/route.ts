import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-utils'

// GET - Fetch all global teams with their project assignments
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const teams = await prisma.team.findMany({
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(teams)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch teams:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Create a new global team
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { name, key, color, bgColor, projectIds } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'Name and key are required' }, { status: 400 })
    }

    // Check if key already exists
    const existing = await prisma.team.findUnique({
      where: { key: key.toUpperCase() },
    })

    if (existing) {
      return NextResponse.json({ error: `A team with key "${key}" already exists` }, { status: 400 })
    }

    const team = await prisma.team.create({
      data: {
        name,
        key: key.toUpperCase(),
        color: color || '#64748b',
        bgColor: bgColor || '#f1f5f9',
        projects: projectIds?.length > 0 ? {
          connect: projectIds.map((id: string) => ({ id })),
        } : undefined,
      },
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    })

    return NextResponse.json(team)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Failed to create team:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update a team (name, color, or project assignments)
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { teamId, name, color, bgColor, projectIds } = body

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    // Verify the team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Build update data
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (color !== undefined) updateData.color = color
    if (bgColor !== undefined) updateData.bgColor = bgColor

    // Handle project assignments (replace all)
    if (projectIds !== undefined) {
      updateData.projects = {
        set: projectIds.map((id: string) => ({ id })),
      }
    }

    const updatedTeam = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      include: {
        projects: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
    })

    return NextResponse.json(updatedTeam)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Failed to update team:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Delete a team
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('teamId')

    if (!teamId) {
      return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
    }

    // Verify the team exists
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    await prisma.team.delete({
      where: { id: teamId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Failed to delete team:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
