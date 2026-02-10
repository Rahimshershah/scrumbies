import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getUploadsDir } from '@/lib/utils'

// DELETE - Remove attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Find the attachment
    const attachment = await prisma.documentAttachment.findUnique({
      where: { id },
      include: {
        document: {
          select: { createdById: true },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Only uploader, document owner, or admin can delete
    const isUploader = attachment.uploadedById === user.id
    const isDocumentOwner = attachment.document.createdById === user.id
    const isAdmin = user.role === 'ADMIN'

    if (!isUploader && !isDocumentOwner && !isAdmin) {
      return NextResponse.json({ error: 'Not authorized to delete this attachment' }, { status: 403 })
    }

    // Delete the file from disk
    const filename = attachment.url.split('/').pop()
    if (filename) {
      const baseUploadsDir = getUploadsDir()
      const filePath = join(baseUploadsDir, 'document-attachments', filename)

      if (existsSync(filePath)) {
        await unlink(filePath)
      }
    }

    // Delete from database
    await prisma.documentAttachment.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete document attachment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
