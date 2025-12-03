import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminLayout } from '@/components/admin/admin-layout'

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/')
  }

  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, read: false },
  })

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { members: { some: { id: session.user.id } } },
        { createdById: session.user.id },
      ],
    },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <AdminLayout 
      user={session.user} 
      unreadCount={unreadCount}
      projects={projects}
    >
      {children}
    </AdminLayout>
  )
}










