import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { emitToProject } from '@/lib/socket'
import { sendEmail } from '@/lib/email'

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
      select: {
        authorId: true,
        content: true,
        author: { select: { id: true, email: true, name: true } },
        task: { select: { id: true, title: true, taskKey: true, projectId: true } },
      },
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

    // Broadcast the change to everyone viewing the project
    if (comment.task?.projectId) {
      emitToProject(comment.task.projectId, 'comment:updated', {
        projectId: comment.task.projectId,
        taskId: updated.taskId,
        comment: updated,
      })
    }

    // Email the comment's author when their comment is marked resolved
    // (only on resolve, not unresolve; never email the person who resolved it).
    if (resolved === true && comment.author && comment.author.id !== user.id && comment.author.email) {
      const baseUrl = process.env.NEXTAUTH_URL || 'https://scrumbies.hesab.com'
      const taskUrl = `${baseUrl}/?task=${updated.taskId}`
      const taskKey = comment.task?.taskKey || 'TASK'
      const taskTitle = comment.task?.title || 'a task'
      const snippet = (comment.content || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200)
      sendEmail({
        to: comment.author.email,
        toName: comment.author.name,
        subject: `[${taskKey}] Your comment was marked resolved`,
        html:
          `<p>Hi ${comment.author.name},</p>` +
          `<p><strong>${user.name}</strong> marked your comment on <strong>${taskTitle}</strong> (${taskKey}) as resolved.</p>` +
          (snippet
            ? `<blockquote style="border-left:3px solid #ddd;padding-left:10px;color:#555;">${snippet}</blockquote>`
            : '') +
          `<p><a href="${taskUrl}">View the task</a></p>`,
        text: `${user.name} marked your comment on ${taskTitle} (${taskKey}) as resolved. ${taskUrl}`,
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
