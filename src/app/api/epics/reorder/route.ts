import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { epicIds, projectId } = body

    if (!epicIds || !Array.isArray(epicIds) || !projectId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Update order for each epic
    await Promise.all(
      epicIds.map((id: string, index: number) =>
        prisma.epic.update({
          where: { id },
          data: { order: index },
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to reorder epics:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}



