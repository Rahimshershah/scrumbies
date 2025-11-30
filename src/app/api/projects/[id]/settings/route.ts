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

// GET - Fetch project settings (statuses and teams)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: projectId } = await params

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Check if project has custom settings, if not create defaults
    const existingStatuses = await prisma.projectStatus.count({ where: { projectId } })
    
    if (existingStatuses === 0) {
      // Create default statuses - skipDuplicates in case of race conditions
      try {
        await prisma.projectStatus.createMany({
          data: DEFAULT_STATUSES.map(s => ({ ...s, projectId })),
          skipDuplicates: true,
        })
      } catch (e) {
        console.error('Error creating default statuses:', e)
      }
    }

    const existingTeams = await prisma.projectTeam.count({ where: { projectId } })
    
    if (existingTeams === 0) {
      // Create default teams - skipDuplicates in case of race conditions
      try {
        await prisma.projectTeam.createMany({
          data: DEFAULT_TEAMS.map(t => ({ ...t, projectId })),
          skipDuplicates: true,
        })
      } catch (e) {
        console.error('Error creating default teams:', e)
      }
    }

    // Fetch all settings
    const [statuses, teams] = await Promise.all([
      prisma.projectStatus.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
      prisma.projectTeam.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
      }),
    ])

    return NextResponse.json({ statuses, teams })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : ''
    console.error('Failed to fetch project settings:', errorMessage, errorStack)
    return NextResponse.json({ error: errorMessage || 'Internal Server Error' }, { status: 500 })
  }
}


