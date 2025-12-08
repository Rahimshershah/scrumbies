import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { unlink } from 'fs/promises'
import { join } from 'path'

// DELETE - Delete an attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Find attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Only the uploader or an admin can delete
    if (attachment.uploadedById !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete file from disk
    // Handle both old (/uploads/...) and new (/api/uploads/...) URL formats
    try {
      const filename = attachment.url.split('/').pop()
      if (filename) {
        const possiblePaths = [
          join(process.cwd(), 'public', 'uploads', 'attachments', filename),
          join(process.cwd(), 'uploads', 'attachments', filename),
          join('/var/www/scrumbies', 'uploads', 'attachments', filename),
          join('/var/www/scrumbies', 'public', 'uploads', 'attachments', filename),
        ]
        
        for (const filePath of possiblePaths) {
          try {
            await unlink(filePath)
            break // File deleted successfully
          } catch {
            // Try next path
          }
        }
      }
    } catch (e) {
      // File might not exist, continue with database deletion
      console.warn('Could not delete file:', e)
    }

    // Delete from database
    await prisma.attachment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}















