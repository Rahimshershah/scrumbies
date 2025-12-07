import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Creating demo data for DOB (Department of Buildings)...\n')

  // Create demo users
  const demoUsers = [
    {
      email: 'demo@dob.gov',
      name: 'Demo Admin',
      role: 'ADMIN' as const,
      password: await hash('demo123', 12),
    },
    {
      email: 'john.smith@dob.gov',
      name: 'John Smith',
      role: 'MEMBER' as const,
      password: await hash('demo123', 12),
    },
    {
      email: 'sarah.jones@dob.gov',
      name: 'Sarah Jones',
      role: 'MEMBER' as const,
      password: await hash('demo123', 12),
    },
    {
      email: 'mike.wilson@dob.gov',
      name: 'Mike Wilson',
      role: 'MEMBER' as const,
      password: await hash('demo123', 12),
    },
  ]

  const users = []
  for (const userData of demoUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    })
    if (existing) {
      console.log(`⚠️  User ${userData.email} already exists, skipping...`)
      users.push(existing)
    } else {
      const user = await prisma.user.create({ data: userData })
      users.push(user)
      console.log(`✅ Created user: ${user.name} (${user.email})`)
    }
  }

  const adminUser = users.find(u => u.role === 'ADMIN')!
  const memberUsers = users.filter(u => u.role === 'MEMBER')

  // Create DOB project
  let dobProject = await prisma.project.findUnique({
    where: { key: 'DOB' },
  })

  if (dobProject) {
    console.log(`⚠️  Project DOB already exists, using existing project...`)
  } else {
    dobProject = await prisma.project.create({
      data: {
        name: 'Department of Buildings',
        key: 'DOB',
        createdById: adminUser.id,
        members: {
          connect: users.map(u => ({ id: u.id })),
        },
      },
    })
    console.log(`✅ Created project: ${dobProject.name} (${dobProject.key})`)
  }

  // Create sprints
  const today = new Date()
  const sprints = [
    {
      name: 'Sprint 1 - Building Permits',
      status: 'ACTIVE' as const,
      startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      endDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      order: 0,
    },
    {
      name: 'Sprint 2 - Inspections',
      status: 'PLANNED' as const,
      startDate: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
      endDate: new Date(today.getTime() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      order: 1,
    },
    {
      name: 'Sprint 3 - Code Compliance',
      status: 'PLANNED' as const,
      startDate: new Date(today.getTime() + 22 * 24 * 60 * 60 * 1000), // 22 days from now
      endDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000), // 35 days from now
      order: 2,
    },
  ]

  const createdSprints = []
  for (const sprintData of sprints) {
    const existing = await prisma.sprint.findFirst({
      where: {
        projectId: dobProject.id,
        name: sprintData.name,
      },
    })
    if (existing) {
      console.log(`⚠️  Sprint "${sprintData.name}" already exists, skipping...`)
      createdSprints.push(existing)
    } else {
      const sprint = await prisma.sprint.create({
        data: {
          ...sprintData,
          projectId: dobProject.id,
        },
      })
      createdSprints.push(sprint)
      console.log(`✅ Created sprint: ${sprint.name}`)
    }
  }

  const activeSprint = createdSprints[0]
  const plannedSprint = createdSprints[1]

  // Create tasks for active sprint
  const activeSprintTasks = [
    {
      title: 'Implement online permit application form',
      description: 'Create a digital form for building permit applications with file upload capabilities',
      status: 'IN_PROGRESS' as const,
      priority: 'HIGH' as const,
      assigneeId: memberUsers[0].id,
      order: 0,
    },
    {
      title: 'Add payment processing integration',
      description: 'Integrate Stripe payment gateway for permit fees',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      assigneeId: memberUsers[1].id,
      order: 1,
    },
    {
      title: 'Build permit status tracking dashboard',
      description: 'Create a dashboard for applicants to track their permit status',
      status: 'READY_TO_TEST' as const,
      priority: 'MEDIUM' as const,
      assigneeId: memberUsers[0].id,
      order: 2,
    },
    {
      title: 'Set up automated email notifications',
      description: 'Send email updates when permit status changes',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      assigneeId: null,
      order: 3,
    },
    {
      title: 'Create permit document templates',
      description: 'Generate PDF templates for different permit types',
      status: 'BLOCKED' as const,
      priority: 'LOW' as const,
      assigneeId: memberUsers[2].id,
      order: 4,
    },
  ]

  // Create tasks for planned sprint
  const plannedSprintTasks = [
    {
      title: 'Schedule inspection appointments',
      description: 'Allow inspectors to schedule and manage inspection appointments',
      status: 'TODO' as const,
      priority: 'URGENT' as const,
      assigneeId: null,
      order: 0,
    },
    {
      title: 'Mobile app for inspectors',
      description: 'Build mobile app for field inspectors to log inspection results',
      status: 'TODO' as const,
      priority: 'HIGH' as const,
      assigneeId: memberUsers[1].id,
      order: 1,
    },
    {
      title: 'Inspection checklist templates',
      description: 'Create customizable inspection checklists for different building types',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      assigneeId: null,
      order: 2,
    },
  ]

  // Create backlog tasks
  const backlogTasks = [
    {
      title: 'Violation tracking system',
      description: 'Track and manage building code violations',
      status: 'TODO' as const,
      priority: 'MEDIUM' as const,
      assigneeId: null,
      order: 0,
    },
    {
      title: 'Public building database search',
      description: 'Allow public to search building records and permits',
      status: 'TODO' as const,
      priority: 'LOW' as const,
      assigneeId: null,
      order: 1,
    },
    {
      title: 'Integration with city GIS system',
      description: 'Connect with city Geographic Information System',
      status: 'TODO' as const,
      priority: 'LOW' as const,
      assigneeId: null,
      order: 2,
    },
  ]

  // Create tasks
  let taskCounter = dobProject.taskCounter || 0

  for (const taskData of activeSprintTasks) {
    taskCounter++
    const taskKey = `DOB-${String(taskCounter).padStart(3, '0')}`
    await prisma.task.create({
      data: {
        ...taskData,
        taskKey,
        taskNumber: taskCounter,
        projectId: dobProject.id,
        sprintId: activeSprint.id,
        createdById: adminUser.id,
        assignedAt: taskData.assigneeId ? new Date() : null,
      },
    })
    console.log(`✅ Created task: ${taskKey} - ${taskData.title}`)
  }

  for (const taskData of plannedSprintTasks) {
    taskCounter++
    const taskKey = `DOB-${String(taskCounter).padStart(3, '0')}`
    await prisma.task.create({
      data: {
        ...taskData,
        taskKey,
        taskNumber: taskCounter,
        projectId: dobProject.id,
        sprintId: plannedSprint.id,
        createdById: adminUser.id,
        assignedAt: taskData.assigneeId ? new Date() : null,
      },
    })
    console.log(`✅ Created task: ${taskKey} - ${taskData.title}`)
  }

  for (const taskData of backlogTasks) {
    taskCounter++
    const taskKey = `DOB-${String(taskCounter).padStart(3, '0')}`
    await prisma.task.create({
      data: {
        ...taskData,
        taskKey,
        taskNumber: taskCounter,
        projectId: dobProject.id,
        sprintId: null,
        createdById: adminUser.id,
        assignedAt: null,
      },
    })
    console.log(`✅ Created task: ${taskKey} - ${taskData.title}`)
  }

  // Update project task counter
  await prisma.project.update({
    where: { id: dobProject.id },
    data: { taskCounter },
  })

  console.log('\n✨ Demo data created successfully!\n')
  console.log('📋 Login Credentials:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Admin User:')
  console.log('  Email: demo@dob.gov')
  console.log('  Password: demo123')
  console.log('\nTeam Members:')
  console.log('  Email: john.smith@dob.gov | Password: demo123')
  console.log('  Email: sarah.jones@dob.gov | Password: demo123')
  console.log('  Email: mike.wilson@dob.gov | Password: demo123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch((e) => {
    console.error('❌ Error creating demo data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })





