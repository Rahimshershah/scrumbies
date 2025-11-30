import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET a single document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
            projectId: true,
          },
        },
        taskLinks: {
          include: {
            task: {
              select: {
                id: true,
                taskKey: true,
                title: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json(document)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH update a document
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Check ownership - only creator or admin can edit
    const existingDoc = await prisma.document.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const isOwner = existingDoc.createdById === user.id
    const isAdmin = user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You can only edit your own documents' }, { status: 403 })
    }

    const body = await request.json()
    const { title, content, order, createVersion } = body

    // If createVersion is true, save current state as a version first
    if (createVersion) {
      const currentDoc = await prisma.document.findUnique({
        where: { id },
        select: { title: true, content: true },
      })

      if (currentDoc) {
        // Get next version number
        const lastVersion = await prisma.documentVersion.findFirst({
          where: { documentId: id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        })

        await prisma.documentVersion.create({
          data: {
            documentId: id,
            title: currentDoc.title,
            content: currentDoc.content ?? undefined,
            versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
            createdById: user.id,
          },
        })
      }
    }

    const document = await prisma.document.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content }),
        ...(order !== undefined && { order }),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            versions: true,
            comments: true,
          },
        },
      },
    })

    return NextResponse.json(document)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update document:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Check ownership - only creator or admin can delete
    const existingDoc = await prisma.document.findUnique({
      where: { id },
      select: { createdById: true },
    })

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const isOwner = existingDoc.createdById === user.id
    const isAdmin = user.role === 'ADMIN'

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'You can only delete your own documents' }, { status: 403 })
    }

    await prisma.document.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
