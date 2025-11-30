import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'

// GET all versions for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    })

    return NextResponse.json(versions)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST restore a specific version
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const { versionId } = body

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 })
    }

    // Get the version to restore
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
    })

    if (!version || version.documentId !== id) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Save current state as a new version before restoring
    const currentDoc = await prisma.document.findUnique({
      where: { id },
      select: { title: true, content: true },
    })

    if (currentDoc) {
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

    // Restore the document to the selected version
    const document = await prisma.document.update({
      where: { id },
      data: {
        title: version.title,
        content: version.content ?? undefined,
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

    return NextResponse.json(document)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to restore version:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
