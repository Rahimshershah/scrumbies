import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET - Get invite details by token (public endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        invitedBy: {
          select: { name: true },
        },
        projects: {
          select: { id: true, name: true, key: true, logoUrl: true },
        },
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 })
    }

    if (invite.status === 'EXPIRED' || new Date() > invite.expiresAt) {
      // Mark as expired if not already
      if (invite.status !== 'EXPIRED') {
        await prisma.invite.update({
          where: { id: invite.id },
          data: { status: 'EXPIRED' },
        })
      }
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 })
    }

    return NextResponse.json({
      email: invite.email,
      invitedBy: invite.invitedBy.name,
      projects: invite.projects,
      expiresAt: invite.expiresAt,
    })
  } catch (error) {
    console.error('Failed to fetch invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST - Accept invite and create user account
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()
    const { name, password } = body

    if (!name || !password) {
      return NextResponse.json({ error: 'Name and password are required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: {
        projects: true,
      },
    })

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (invite.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'This invite has already been used' }, { status: 400 })
    }

    if (invite.status === 'EXPIRED' || new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'This invite has expired' }, { status: 400 })
    }

    // Check if user already exists (shouldn't happen, but just in case)
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } })
    if (existingUser) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user and update invite in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          email: invite.email,
          name,
          password: hashedPassword,
          role: 'MEMBER',
          projects: {
            connect: invite.projects.map(p => ({ id: p.id })),
          },
        },
      })

      // Update invite status
      await tx.invite.update({
        where: { id: invite.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
        },
      })

      return user
    })

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      email: result.email,
    })
  } catch (error) {
    console.error('Failed to accept invite:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}














