import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { sendMentionNotification, sendCommentNotificationEmail } from '@/lib/email'

// GET - Fetch all comments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id: taskId } = await params

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        mentions: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(comments)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch comments:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Create a new comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id: taskId } = await params

    const body = await request.json()
    const { content, mentionIds } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { 
        id: true, 
        title: true, 
        status: true, 
        taskKey: true,
        assigneeId: true,
        createdById: true,
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        authorId: user.id,
        taskStatusAtCreation: task.status, // Store what phase the task was in
        mentions: mentionIds?.length
          ? { connect: mentionIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
        mentions: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Create activity for comment
    await prisma.activity.create({
      data: {
        type: 'COMMENT_ADDED',
        metadata: { commentId: comment.id },
        taskId,
        userId: user.id,
      },
    })

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const taskUrl = `${baseUrl}/?task=${taskId}`
    const notifiedUserIds = new Set<string>([user.id]) // Don't notify the commenter

    // Create notifications for mentions and send emails
    if (mentionIds?.length) {
      await prisma.notification.createMany({
        data: mentionIds.map((userId: string) => ({
          type: 'MENTION' as const,
          userId,
          taskId,
          commentId: comment.id,
        })),
      })

      // Send email notifications for mentions
      const mentionedUsers = await prisma.user.findMany({
        where: { id: { in: mentionIds } },
        select: { id: true, email: true, name: true },
      })

      for (const mentionedUser of mentionedUsers) {
        if (!notifiedUserIds.has(mentionedUser.id)) {
          sendMentionNotification(
            mentionedUser.email,
            mentionedUser.name,
            user.name,
            task.title,
            content,
            taskUrl,
            task.taskKey || undefined
          )
          notifiedUserIds.add(mentionedUser.id)
        }
      }
    }

    // Notify task assignee (if not already notified via mention)
    if (task.assignee && task.assignee.email && !notifiedUserIds.has(task.assignee.id)) {
      sendCommentNotificationEmail({
        recipientEmail: task.assignee.email,
        recipientName: task.assignee.name,
        commenterName: user.name,
        taskKey: task.taskKey || 'TASK',
        taskTitle: task.title,
        commentContent: content,
        taskUrl,
      })
      notifiedUserIds.add(task.assignee.id)
    }

    // Notify task creator (if not already notified)
    if (task.createdBy && task.createdBy.email && !notifiedUserIds.has(task.createdBy.id)) {
      sendCommentNotificationEmail({
        recipientEmail: task.createdBy.email,
        recipientName: task.createdBy.name,
        commenterName: user.name,
        taskKey: task.taskKey || 'TASK',
        taskTitle: task.title,
        commentContent: content,
        taskUrl,
      })
    }

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create comment:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
