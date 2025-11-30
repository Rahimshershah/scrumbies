import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import { randomBytes } from 'crypto'
import { sendInviteEmail } from '@/lib/email'

// GET - List all invites (admin only)
export async function GET() {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const invites = await prisma.invite.findMany({
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        projects: {
          select: { id: true, name: true, key: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(invites)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to fetch invites:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Create a new invite
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, projectIds } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json({ error: 'At least one project must be selected' }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Check if there's already a pending invite for this email
    const existingInvite = await prisma.invite.findFirst({
      where: {
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      return NextResponse.json({ error: 'An invite is already pending for this email' }, { status: 400 })
    }

    // Generate unique token
    const token = randomBytes(32).toString('hex')

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create the invite
    const invite = await prisma.invite.create({
      data: {
        email,
        token,
        expiresAt,
        invitedById: user.id,
        projects: {
          connect: projectIds.map((id: string) => ({ id })),
        },
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        projects: {
          select: { id: true, name: true, key: true },
        },
      },
    })

    // Send invite email
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${token}`
    
    try {
      await sendInviteEmail(email, user.name, inviteUrl, invite.projects.map(p => p.name))
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request if email fails - invite is still created
    }

    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to create invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PATCH - Resend an invite (regenerate token and send email again)
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { inviteId } = body

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    // Find the invite
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: {
        projects: {
          select: { id: true, name: true, key: true },
        },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 400 })
    }

    // Generate new token and reset expiration
    const newToken = randomBytes(32).toString('hex')
    const newExpiresAt = new Date()
    newExpiresAt.setDate(newExpiresAt.getDate() + 7)

    // Update the invite
    const updatedInvite = await prisma.invite.update({
      where: { id: inviteId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: 'PENDING',
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
        projects: {
          select: { id: true, name: true, key: true },
        },
      },
    })

    // Send the invite email again
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/${newToken}`

    try {
      await sendInviteEmail(invite.email, user.name, inviteUrl, invite.projects.map(p => p.name))
    } catch (emailError) {
      console.error('Failed to send invite email:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json(updatedInvite)
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to resend invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE - Cancel an invite
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const inviteId = searchParams.get('id')

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 })
    }

    // Check if invite exists and is pending
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status !== 'PENDING') {
      return NextResponse.json({ error: 'Only pending invites can be cancelled' }, { status: 400 })
    }

    // Delete the invite
    await prisma.invite.delete({
      where: { id: inviteId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Failed to cancel invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

