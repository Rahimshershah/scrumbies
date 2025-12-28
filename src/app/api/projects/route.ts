import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// Default statuses to create for new projects
const DEFAULT_STATUSES = [
  { key: 'TODO', name: 'To Do', color: '#475569', bgColor: '#f1f5f9', order: 0, isDefault: true, isFinal: false },
  { key: 'IN_PROGRESS', name: 'In Progress', color: '#1d4ed8', bgColor: '#dbeafe', order: 1, isDefault: true, isFinal: false },
  { key: 'READY_TO_TEST', name: 'Ready to Test', color: '#d97706', bgColor: '#fef3c7', order: 2, isDefault: true, isFinal: false },
  { key: 'BLOCKED', name: 'Blocked', color: '#dc2626', bgColor: '#fee2e2', order: 3, isDefault: true, isFinal: false },
  { key: 'DONE', name: 'Done', color: '#16a34a', bgColor: '#dcfce7', order: 4, isDefault: true, isFinal: true },
  { key: 'LIVE', name: 'Live', color: '#9333ea', bgColor: '#f3e8ff', order: 5, isDefault: true, isFinal: true },
]

// Default teams to create for new projects
const DEFAULT_TEAMS = [
  { key: 'WEB', name: 'Web', color: '#2563eb', bgColor: '#dbeafe', order: 0, isDefault: true },
  { key: 'MOBILE', name: 'Mobile', color: '#7c3aed', bgColor: '#ede9fe', order: 1, isDefault: true },
  { key: 'OPS', name: 'Operations', color: '#059669', bgColor: '#d1fae5', order: 2, isDefault: true },
]

export async function GET() {
  try {
    const user = await requireAuth()

    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { id: user.id } } },
          { createdById: user.id },
        ],
      },
      select: {
        id: true,
        name: true,
        key: true,
        logoUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(projects)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    // Only admins can create projects
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create projects' }, { status: 403 })
    }

    const body = await request.json()
    const { name, key, logoUrl } = body

    if (!name || !key) {
      return NextResponse.json({ error: 'Name and key are required' }, { status: 400 })
    }

    // Validate key format (2-5 uppercase letters)
    if (!/^[A-Z]{2,5}$/.test(key)) {
      return NextResponse.json({ 
        error: 'Key must be 2-5 uppercase letters' 
      }, { status: 400 })
    }

    // Check if key is unique
    const existingProject = await prisma.project.findUnique({
      where: { key },
    })

    if (existingProject) {
      return NextResponse.json({ 
        error: 'A project with this key already exists' 
      }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        name,
        key,
        logoUrl: logoUrl || null,
        createdById: user.id,
        members: {
          connect: { id: user.id }, // Creator is automatically a member
        },
      },
    })

    // Initialize default statuses and teams for the new project
    await prisma.projectStatus.createMany({
      data: DEFAULT_STATUSES.map(s => ({ ...s, projectId: project.id })),
    })

    await prisma.projectTeam.createMany({
      data: DEFAULT_TEAMS.map(t => ({ ...t, projectId: project.id })),
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
