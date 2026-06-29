import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUploadsDir } from '@/lib/utils'

// Route segment config for App Router
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds timeout for large uploads

// GET - List attachments for a comment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: commentId } = await params

    const attachments = await prisma.commentAttachment.findMany({
      where: { commentId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch comment attachments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Upload attachment for a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: commentId } = await params

    // Check if comment exists
    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (25MB for all files)
    const maxSize = 25 * 1024 * 1024 // 25MB
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large. Maximum size is 25MB.`,
      }, { status: 400 })
    }

    // Reuse the same attachments directory as task attachments
    const baseUploadsDir = getUploadsDir()
    const uploadsDir = join(baseUploadsDir, 'attachments')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`
    const filePath = join(uploadsDir, uniqueFilename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Create attachment record in database
    const attachment = await prisma.commentAttachment.create({
      data: {
        filename: file.name,
        url: `/api/uploads/attachments/${uniqueFilename}`,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        commentId,
        uploadedById: user.id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to upload comment attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
