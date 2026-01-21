import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/auth-utils'

// GET - Fetch all teams with their project info (admin only)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const teams = await prisma.projectTeam.findMany({
      include: {
        project: {
          select: {
            id: true,
            name: true,
            key: true,
          },
        },
      },
      orderBy: [
        { project: { name: 'asc' } },
        { order: 'asc' },
      ],
    })

    return NextResponse.json(teams)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    console.error('Failed to fetch teams:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Update a team's project assignment
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { teamId, projectId } = body

    if (!teamId || !projectId) {
      return NextResponse.json({ error: 'teamId and projectId are required' }, { status: 400 })
    }

    // Verify the team exists
    const team = await prisma.projectTeam.findUnique({
      where: { id: teamId },
    })

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Verify the target project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if a team with the same key already exists in the target project
    const existingTeam = await prisma.projectTeam.findFirst({
      where: {
        projectId,
        key: team.key,
        id: { not: teamId },
      },
    })

    if (existingTeam) {
      return NextResponse.json({
        error: `A team with key "${team.key}" already exists in ${project.name}`
      }, { status: 400 })
    }

    // Update the team's project
    const updatedTeam = await prisma.projectTeam.update({
      where: { id: teamId },
      data: { projectId },
      include: {
        project: {
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
