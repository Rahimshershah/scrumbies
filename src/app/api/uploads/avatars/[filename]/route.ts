import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
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
    const avatarsDir = join(baseUploadsDir, 'avatars')
    let filePath = join(avatarsDir, filename)
    
    // Check multiple possible locations for backward compatibility
    const possiblePaths = [
      filePath, // New location
      join(process.cwd(), 'public', 'uploads', 'avatars', filename), // Old dev location
      join(process.cwd(), 'uploads', 'avatars', filename), // Standalone relative
      join(process.cwd(), '..', 'uploads', 'avatars', filename), // Standalone parent
      join('/var/www/scrumbies', 'uploads', 'avatars', filename), // Production absolute (if exists)
    ]
    
    let foundPath: string | null = null
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        foundPath = path
        break
      }
    }
    
    if (!foundPath) {
      console.error(`Avatar file not found: ${filename}. Checked paths:`, possiblePaths)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    filePath = foundPath

    const fileBuffer = await readFile(filePath)
    
    // Determine content type based on file extension
    const ext = filename.split('.').pop()?.toLowerCase()
    const contentType = 
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' :
      ext === 'webp' ? 'image/webp' :
      'image/jpeg'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Failed to serve avatar:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

