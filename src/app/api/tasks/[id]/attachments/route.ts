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

// GET - List attachments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: taskId } = await params

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(attachments)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch attachments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Upload attachment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: taskId } = await params

    // Check if task exists
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
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
        error: `File too large. Maximum size is 25MB.` 
      }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    // Use persistent storage location that works in both dev and standalone mode
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
    // Use API route for serving attachments in standalone mode
    const attachment = await prisma.attachment.create({
      data: {
        filename: file.name,
        url: `/api/uploads/attachments/${uniqueFilename}`,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        taskId,
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
    console.error('Failed to upload attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

