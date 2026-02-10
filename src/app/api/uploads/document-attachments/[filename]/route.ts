import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUploadsDir } from '@/lib/utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const baseUploadsDir = getUploadsDir()
    const attachmentsDir = join(baseUploadsDir, 'document-attachments')

    // Check multiple possible locations
    const possiblePaths = [
      join(attachmentsDir, filename),
      join(process.cwd(), 'uploads', 'document-attachments', filename),
      join('/var/www/scrumbies', 'uploads', 'document-attachments', filename),
    ]

    let foundPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path
        break
      }
    }

    if (!foundPath) {
      console.error(`Document attachment not found: ${filename}`)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileStat = await stat(foundPath)
    const fileSize = fileStat.size

    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType = getContentType(ext)

    const originalFilename = filename.replace(/^\d+-/, '')

    // Handle Range requests for media streaming
    const rangeHeader = request.headers.get('range')

    if (rangeHeader && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      const fileBuffer = await readFile(foundPath)
      const chunk = fileBuffer.slice(start, end + 1)

      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Disposition': `inline; filename="${originalFilename}"`,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    const fileBuffer = await readFile(foundPath)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${originalFilename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to serve document attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function getContentType(ext: string | undefined): string {
  const mimeTypes: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'zip': 'application/zip',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
  }

  return mimeTypes[ext || ''] || 'application/octet-stream'
}
