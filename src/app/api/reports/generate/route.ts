import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { sprintIds, projectId, useAI, taskOptions } = body

    if (!sprintIds || sprintIds.length === 0) {
      return NextResponse.json({ error: 'No sprints selected' }, { status: 400 })
    }

    // Fetch sprints with all related data
    const sprints = await prisma.sprint.findMany({
      where: {
        id: { in: sprintIds },
        projectId,
      },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
          include: {
            assignee: {
              select: { id: true, name: true, avatarUrl: true },
            },
            epic: true,
            attachments: {
              select: { id: true, filename: true, url: true },
            },
            comments: {
              orderBy: { createdAt: 'desc' },
              take: 10,
              include: {
                author: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { endDate: 'desc' },
    })

    // Get epics for grouping
    const epicIds = [...new Set(sprints.flatMap(s => s.tasks.map(t => t.epicId).filter(Boolean)))]
    const epics = await prisma.epic.findMany({
      where: { id: { in: epicIds as string[] } },
    })
    const epicMap = new Map(epics.map(e => [e.id, e]))

    // Process each sprint
    const reports = await Promise.all(sprints.map(async (sprint) => {
      // Group tasks by epic
      const tasksByEpic: { epic: any; tasks: any[] }[] = []
      const epicGroups = new Map<string | null, any[]>()

      for (const task of sprint.tasks) {
        const epicId = task.epicId || null
        if (!epicGroups.has(epicId)) {
          epicGroups.set(epicId, [])
        }
        
        // Count how many sprints this task has been in (simplified - count activities)
        const sprintCount = await prisma.sprint.count({
          where: {
            tasks: {
              some: {
                id: task.id,
              },
            },
          },
        })

        epicGroups.get(epicId)!.push({
          ...task,
          sprintCount,
        })
      }

      // Sort: epics first, then no-epic
      const sortedEpicIds = [...epicGroups.keys()].sort((a, b) => {
        if (a === null) return 1
        if (b === null) return -1
        return 0
      })

      for (const epicId of sortedEpicIds) {
        const epic = epicId ? epicMap.get(epicId) : null
        tasksByEpic.push({
          epic,
          tasks: epicGroups.get(epicId) || [],
        })
      }

      // Generate AI summary if requested
      let aiSummary = undefined
      if (useAI && process.env.OPENAI_API_KEY) {
        try {
          const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          })

          const taskSummaries = sprint.tasks.map(t => 
            `- ${t.taskKey}: ${t.title} (${t.status})`
          ).join('\n')

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a concise technical writer. Summarize sprint accomplishments in 2-3 sentences. Focus on what was delivered and key achievements. Be professional and brief.',
              },
              {
                role: 'user',
                content: `Summarize this sprint "${sprint.name}" with the following tasks:\n${taskSummaries}`,
              },
            ],
            max_tokens: 150,
          })

          aiSummary = completion.choices[0]?.message?.content
        } catch (error) {
          console.error('Failed to generate AI summary:', error)
        }
      }

      return {
        sprint: {
          id: sprint.id,
          name: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          status: sprint.status,
        },
        tasksByEpic,
        generatedAt: new Date().toISOString(),
        aiSummary,
      }
    }))

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Failed to generate report:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

