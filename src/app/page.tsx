import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppShell } from '@/components/app-shell'

export default async function Home() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Fetch current user with avatarUrl
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
    },
  })

  if (!currentUser) {
    redirect('/login')
  }

  // Fetch user's projects with explicit fields
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { members: { some: { id: session.user.id } } },
        { createdById: session.user.id },
      ],
    },
    select: {
      id: true,
      name: true,
      key: true,
      logoUrl: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Use the first project as default (client will handle localStorage preference)
  const currentProjectId = projects[0]?.id || null

  // Fetch initial data for the default project
  const [sprints, users, backlogTasks, epics] = await Promise.all([
    currentProjectId
      ? prisma.sprint.findMany({
          where: { projectId: currentProjectId },
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              orderBy: { order: 'asc' },
              include: {
                assignee: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                  },
                },
                epic: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                  },
                },
                splitFrom: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
                splitTasks: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    createdAt: true,
                  },
                },
                _count: {
                  select: { comments: true },
                },
              },
            },
          },
        })
      : [],
    currentProjectId
      ? prisma.user.findMany({
          where: {
            projects: { some: { id: currentProjectId } },
          },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
          orderBy: { name: 'asc' },
        })
      : [],
    currentProjectId
      ? prisma.task.findMany({
          where: { 
            sprintId: null,
            projectId: currentProjectId,
          },
          orderBy: { order: 'asc' },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
            epic: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            splitFrom: {
              select: {
                id: true,
                title: true,
              },
            },
            splitTasks: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
              },
            },
            _count: {
              select: { comments: true },
            },
          },
        })
      : [],
    currentProjectId
      ? prisma.epic.findMany({
          where: { projectId: currentProjectId },
          orderBy: { order: 'asc' },
          include: {
            createdBy: {
              select: { id: true, name: true, avatarUrl: true },
            },
            _count: {
              select: { tasks: true },
            },
          },
        })
      : [],
  ])

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AppShell
        user={currentUser}
        initialProjects={projects as any}
        initialProjectId={currentProjectId}
        initialSprints={sprints as any}
        initialBacklog={backlogTasks as any}
        initialEpics={epics as any}
        users={users}
        unreadCount={unreadCount}
      />
    </Suspense>
  )
}
