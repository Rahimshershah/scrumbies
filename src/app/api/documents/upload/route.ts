import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUploadsDir } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST - Upload a file as a document
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folderId = formData.get('folderId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 })
    }

    // Check if folder exists
    const folder = await prisma.folder.findUnique({ where: { id: folderId } })
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Validate file size (50MB for documents)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({
        error: 'File too large. Maximum size is 50MB.'
      }, { status: 400 })
    }

    // Create uploads directory
    const baseUploadsDir = getUploadsDir()
    const uploadsDir = join(baseUploadsDir, 'document-files')
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

    // Get max order for this folder
    const maxOrder = await prisma.document.aggregate({
      where: { folderId },
      _max: { order: true },
    })

    // Create document record with file type
    const document = await prisma.document.create({
      data: {
        title: file.name,
        type: 'file',
        fileUrl: `/api/uploads/document-files/${uniqueFilename}`,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        folderId,
        createdById: user.id,
        order: (maxOrder._max.order ?? -1) + 1,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { versions: true, comments: true },
        },
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to upload document file:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
