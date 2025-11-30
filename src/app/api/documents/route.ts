import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// POST create a new document
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const body = await request.json()
    const { title, folderId, content } = body

    if (!title || !folderId) {
      return NextResponse.json({ error: 'title and folderId are required' }, { status: 400 })
    }

    // Get max order for the folder
    const maxOrderDoc = await prisma.document.findFirst({
      where: { folderId },
      orderBy: { order: 'desc' },
      select: { order: true },
    })

    const document = await prisma.document.create({
      data: {
        title,
        folderId,
        content: content || null,
        createdById: user.id,
        order: (maxOrderDoc?.order ?? -1) + 1,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create document:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
