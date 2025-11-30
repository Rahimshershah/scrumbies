import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET folders for a project
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const folders = await prisma.folder.findMany({
      where: { projectId },
      include: {
        documents: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            title: true,
            order: true,
            updatedAt: true,
            createdById: true,
          },
        },
      },
      orderBy: { order: 'asc' },
    })

    return NextResponse.json(folders)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create a new folder
export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { name, projectId } = body

    if (!name || !projectId) {
      return NextResponse.json({ error: 'name and projectId are required' }, { status: 400 })
    }

    // Get max order for the project
    const maxOrderFolder = await prisma.folder.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const folder = await prisma.folder.create({
      data: {
        name,
        projectId,
        order: (maxOrderFolder?.order ?? -1) + 1,
      },
      include: {
        documents: true,
      },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create folder:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
