import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET search documents by title
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const documents = await prisma.document.findMany({
      where: {
        folder: {
          projectId,
        },
        ...(query && {
          title: {
            contains: query,
            mode: 'insensitive',
          },
        }),
      },
      select: {
        id: true,
        title: true,
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 10,
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(documents)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
