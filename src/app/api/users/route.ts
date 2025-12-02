import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAuth } from '@/lib/auth-utils'

export async function GET() {
  try {
    await requireAdmin()

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(users)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { email, password, name, role } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    const hashedPassword = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'MEMBER',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      )
    }

    if (!['ADMIN', 'MEMBER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json(user)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Failed to update user:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await requireAuth()

    if (currentUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('id')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Delete related records first (since schema doesn't have cascade delete for all relations)
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete activities created by this user
      await tx.activity.deleteMany({
        where: { userId },
      })

      // Delete comments authored by this user
      await tx.comment.deleteMany({
        where: { authorId: userId },
      })

      // Delete attachments uploaded by this user
      await tx.attachment.deleteMany({
        where: { uploadedById: userId },
      })

      // Delete notifications for this user
      await tx.notification.deleteMany({
        where: { userId },
      })

      // Delete invites sent by this user
      await tx.invite.deleteMany({
        where: { invitedById: userId },
      })

      // Delete document comments authored by this user
      await tx.documentComment.deleteMany({
        where: { authorId: userId },
      })

      // Delete document versions created by this user
      await tx.documentVersion.deleteMany({
        where: { createdById: userId },
      })

      // Unassign tasks from this user (set assigneeId to null)
      await tx.task.updateMany({
        where: { assigneeId: userId },
        data: { assigneeId: null },
      })

      // For tasks created by this user, we need to handle them carefully
      // Option 1: Delete tasks (might be too destructive)
      // Option 2: Transfer ownership to another admin or set createdById to null
      // For now, let's transfer ownership to the current admin user
      const adminUsers = await tx.user.findMany({
        where: { role: 'ADMIN', id: { not: userId } },
        take: 1,
      })

      if (adminUsers.length > 0) {
        // Transfer task ownership to another admin
        await tx.task.updateMany({
          where: { createdById: userId },
          data: { createdById: adminUsers[0].id },
        })

        // Transfer project ownership to another admin
        await tx.project.updateMany({
          where: { createdById: userId },
          data: { createdById: adminUsers[0].id },
        })

        // Transfer document ownership to another admin
        await tx.document.updateMany({
          where: { createdById: userId },
          data: { createdById: adminUsers[0].id },
        })
      } else {
        // If no other admin exists, we can't delete this user
        throw new Error('Cannot delete user: No other admin exists to transfer ownership')
      }

      // Remove user from project memberships (many-to-many relation)
      // We need to find projects where user is a member and disconnect them
      const projectsWithUser = await tx.project.findMany({
        where: {
          members: {
            some: { id: userId },
          },
        },
        select: { id: true },
      })

      for (const project of projectsWithUser) {
        await tx.project.update({
          where: { id: project.id },
          data: {
            members: {
              disconnect: { id: userId },
            },
          },
        })
      }

      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if ((error as Error).message.includes('Cannot delete user')) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 })
    }
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
