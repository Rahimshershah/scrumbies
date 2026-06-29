import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUploadsDir } from '@/lib/utils'

// Route segment config for App Router
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST - Upload an inline image for the comment/rich-text editor.
// Returns { url } so the editor can embed an <img src> instead of a base64
// data URL (large base64 payloads have destabilized the server).
export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Images only
    if (!file.type || !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (10MB for inline images)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'Image too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Store like attachments (reuse the attachments directory + serve route)
    const baseUploadsDir = getUploadsDir()
    const uploadsDir = join(baseUploadsDir, 'attachments')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_') || 'image'
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`
    const filePath = join(uploadsDir, uniqueFilename)

    // Write file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    const url = `/api/uploads/attachments/${uniqueFilename}`

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to upload inline image:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
