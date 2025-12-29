import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { createReadStream } from 'fs'
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

    // Use the same uploads directory resolution as the upload route
    const baseUploadsDir = getUploadsDir()
    const attachmentsDir = join(baseUploadsDir, 'attachments')

    // Check multiple possible locations for backward compatibility
    const possiblePaths = [
      join(attachmentsDir, filename), // New location
      join(process.cwd(), 'public', 'uploads', 'attachments', filename), // Old dev location
      join(process.cwd(), 'uploads', 'attachments', filename), // Standalone relative
      join(process.cwd(), '..', 'uploads', 'attachments', filename), // Standalone parent
      join('/var/www/scrumbies', 'uploads', 'attachments', filename), // Production absolute
      join('/var/www/scrumbies', 'public', 'uploads', 'attachments', filename), // Production public
    ]

    let foundPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path
        break
      }
    }

    if (!foundPath) {
      console.error(`Attachment file not found: ${filename}. Checked paths:`, possiblePaths)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get file stats for size
    const fileStat = await stat(foundPath)
    const fileSize = fileStat.size

    // Determine content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType = getContentType(ext)

    // Extract original filename (after timestamp prefix)
    const originalFilename = filename.replace(/^\d+-/, '')

    // Handle Range requests for video/audio streaming
    const rangeHeader = request.headers.get('range')

    if (rangeHeader && (contentType.startsWith('video/') || contentType.startsWith('audio/'))) {
      // Parse Range header
      const parts = rangeHeader.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      // Read the specific chunk
      const fileBuffer = await readFile(foundPath)
      const chunk = fileBuffer.slice(start, end + 1)

      return new NextResponse(chunk, {
        status: 206, // Partial Content
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

    // For non-range requests, return the full file
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
    console.error('Failed to serve attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

function getContentType(ext: string | undefined): string {
  const mimeTypes: Record<string, string> = {
    // Images
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'txt': 'text/plain',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/vnd.rar',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    // Media
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    // Other
    'md': 'text/markdown',
  }
  
  return mimeTypes[ext || ''] || 'application/octet-stream'
}


