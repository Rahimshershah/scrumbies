import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (existingAdmin) {
    console.log('Admin user already exists:', existingAdmin.email)
    return
  }

  // Create default admin user
  const password = await hash('admin123', 12)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password,
      name: 'Admin',
      role: 'ADMIN',
    },
  })

  console.log('Created admin user:', admin.email)
  console.log('Default password: admin123')
  console.log('Please change this password after first login!')

  // Create a sample sprint
  const sprint = await prisma.sprint.create({
    data: {
      name: 'Sprint 1',
      status: 'ACTIVE',
      order: 0,
    },
  })

  console.log('Created sample sprint:', sprint.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
