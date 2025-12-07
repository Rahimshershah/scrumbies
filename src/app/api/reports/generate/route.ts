import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { sprintIds, projectId, reportType = 'detailed' } = body

    if (!sprintIds || sprintIds.length === 0) {
      return NextResponse.json({ error: 'No sprints selected' }, { status: 400 })
    }

    const openai = process.env.OPENAI_API_KEY 
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) 
      : null

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
            splitFrom: {
              select: { id: true, taskKey: true, title: true },
            },
            splitTasks: {
              select: { id: true, taskKey: true, title: true },
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

    // Helper to strip HTML
    const stripHtml = (html: string) => {
      if (!html) return ''
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
    }

    // Process each sprint
    const reports = await Promise.all(sprints.map(async (sprint) => {
      // Group tasks by epic
      const tasksByEpic: { epic: any; tasks: any[]; epicSummary?: string }[] = []
      const epicGroups = new Map<string | null, any[]>()

      for (const task of sprint.tasks) {
        const epicId = task.epicId || null
        if (!epicGroups.has(epicId)) {
          epicGroups.set(epicId, [])
        }
        
        // Count how many sprints this task has been in
        const sprintCount = await prisma.sprint.count({
          where: {
            tasks: { some: { id: task.id } },
          },
        })

        let aiDescriptionSummary: string | null = null
        let aiCommentsSummary: string | null = null

        // Only generate individual task summaries for detailed reports
        if (openai && reportType === 'detailed') {
          // Summarize description
          if (task.description && stripHtml(task.description).length > 50) {
            try {
              const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  { role: 'system', content: 'Summarize this task description in one brief sentence (max 25 words). Be direct and factual.' },
                  { role: 'user', content: stripHtml(task.description) },
                ],
                max_tokens: 60,
              })
              aiDescriptionSummary = completion.choices[0]?.message?.content?.trim() || null
            } catch (error) {
              console.error(`Failed to summarize description for task ${task.id}:`, error)
            }
          }

          // Summarize comments
          if (task.comments && task.comments.length > 0) {
            try {
              const commentsText = task.comments.map(c => `${c.author.name}: ${stripHtml(c.content)}`).join('\n')
              if (commentsText.length > 50) {
                const completion = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: 'Summarize these task comments in one brief sentence (max 20 words). Focus on key decisions or updates.' },
                    { role: 'user', content: commentsText },
                  ],
                  max_tokens: 50,
                })
                aiCommentsSummary = completion.choices[0]?.message?.content?.trim() || null
              }
            } catch (error) {
              console.error(`Failed to summarize comments for task ${task.id}:`, error)
            }
          }
        }

        epicGroups.get(epicId)!.push({
          ...task,
          sprintCount,
          aiDescriptionSummary,
          aiCommentsSummary,
          hasComments: task.comments && task.comments.length > 0,
          hasDescription: !!task.description && stripHtml(task.description).length > 0,
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
        const tasks = epicGroups.get(epicId) || []
        
        let epicSummary: string | undefined

        // For summarized reports, generate one summary per epic
        if (openai && reportType === 'summarized' && tasks.length > 0) {
          try {
            const taskList = tasks.map(t => {
              const desc = t.description ? stripHtml(t.description).slice(0, 100) : ''
              return `- ${t.taskKey} "${t.title}": ${desc || 'No description'} (${t.status})`
            }).join('\n')

            const epicName = epic?.name || 'Uncategorized tasks'
            
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { 
                  role: 'system', 
                  content: 'You are writing sprint report summaries. Summarize the following tasks under this epic in 2-3 sentences. Focus on what was accomplished, key features delivered, and any patterns. Be professional and concise.' 
                },
                { 
                  role: 'user', 
                  content: `Epic: ${epicName}\n\n${tasks.length} tasks:\n${taskList}` 
                },
              ],
              max_tokens: 150,
            })
            epicSummary = completion.choices[0]?.message?.content?.trim()
          } catch (error) {
            console.error(`Failed to generate epic summary:`, error)
          }
        }

        tasksByEpic.push({
          epic,
          tasks,
          epicSummary,
        })
      }

      // Generate sprint-level AI summary
      let aiSummary: string | undefined
      if (openai) {
        try {
          const taskSummaries = sprint.tasks.map(t => 
            `- ${t.taskKey}: ${t.title} (${t.status})`
          ).join('\n')

          const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'Summarize sprint accomplishments in 2-3 sentences. Focus on deliverables and achievements. Be professional and brief.',
              },
              {
                role: 'user',
                content: `Sprint "${sprint.name}" - ${sprint.tasks.length} tasks:\n${taskSummaries}`,
              },
            ],
            max_tokens: 150,
          })

          aiSummary = completion.choices[0]?.message?.content?.trim()
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
