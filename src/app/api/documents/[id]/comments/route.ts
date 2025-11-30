import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { sendDocumentCommentEmail, sendMentionNotification } from '@/lib/email'

// GET all comments for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const comments = await prisma.documentComment.findMany({
      where: { documentId: id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const body = await request.json()
    const { content, mentionIds } = body

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 })
    }

    // Get document with folder and project info
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        folder: {
          include: {
            project: true,
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const comment = await prisma.documentComment.create({
      data: {
        documentId: id,
        content,
        authorId: user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const documentUrl = `${baseUrl}/?view=spaces&doc=${id}`
    const notifiedUserIds = new Set<string>([user.id]) // Don't notify the commenter

    // Handle @mentions
    if (mentionIds?.length) {
      const mentionedUsers = await prisma.user.findMany({
        where: { id: { in: mentionIds } },
        select: { id: true, email: true, name: true },
      })

      for (const mentionedUser of mentionedUsers) {
        if (!notifiedUserIds.has(mentionedUser.id)) {
          sendMentionNotification(
            mentionedUser.email,
            mentionedUser.name,
            user.name,
            document.title,
            content,
            documentUrl
          )
          notifiedUserIds.add(mentionedUser.id)
        }
      }
    }

    // Notify document creator (if not already notified)
    if (document.createdBy && document.createdBy.email && !notifiedUserIds.has(document.createdBy.id)) {
      sendDocumentCommentEmail({
        recipientEmail: document.createdBy.email,
        recipientName: document.createdBy.name,
        commenterName: user.name,
        documentTitle: document.title,
        folderName: document.folder?.name || 'Documents',
        commentContent: content,
        documentUrl,
        projectName: document.folder?.project?.name || 'Project',
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create comment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
