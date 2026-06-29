import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { emitToProject } from '@/lib/socket'

// Standard include shape returned by mutating handlers
const commentInclude = {
  author: {
    select: { id: true, name: true, avatarUrl: true },
  },
  mentions: {
    select: { id: true, name: true },
  },
  attachments: {
    include: {
      uploadedBy: {
        select: { id: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  resolvedBy: {
    select: { id: true, name: true, avatarUrl: true },
  },
}

// PATCH - Resolve/unresolve a comment, or edit its content/mentions
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only the author or an admin can modify
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { resolved, content, mentionIds } = body

    // Build update payload from the supported operations
    const data: Record<string, unknown> = {}

    // Operation A: resolve / unresolve
    if (typeof resolved === 'boolean') {
      data.resolved = resolved
      data.resolvedAt = resolved ? new Date() : null
      data.resolvedById = resolved ? user.id : null
    }

    // Operation B: edit content + reset mentions
    if (typeof content === 'string') {
      if (!content.trim()) {
        return NextResponse.json({ error: 'Content is required' }, { status: 400 })
      }
      data.content = content
      // Reset mentions to the provided set (clear when none supplied)
      data.mentions = Array.isArray(mentionIds) && mentionIds.length
        ? { set: mentionIds.map((mid: string) => ({ id: mid })) }
        : { set: [] }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No supported fields to update' },
        { status: 400 }
      )
    }

    const updated = await prisma.comment.update({
      where: { id },
      data,
      include: commentInclude,
    })

    // Derive the projectId via the comment's task, then broadcast the change
    const relatedTask = await prisma.task.findUnique({
      where: { id: updated.taskId },
      select: { projectId: true },
    })
    if (relatedTask?.projectId) {
      emitToProject(relatedTask.projectId, 'comment:updated', {
        projectId: relatedTask.projectId,
        taskId: updated.taskId,
        comment: updated,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to update comment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Find the comment
    const comment = await prisma.comment.findUnique({
      where: { id },
      select: { authorId: true },
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    // Only the author or an admin can delete
    if (comment.authorId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the comment
    await prisma.comment.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to delete comment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
