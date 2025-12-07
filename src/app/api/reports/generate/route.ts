import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-utils'
import OpenAI from 'openai'

// Helper to strip HTML tags
function stripHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()

    const body = await request.json()
    const { sprintIds, projectId } = body

    if (!sprintIds || sprintIds.length === 0) {
      return NextResponse.json({ error: 'No sprints selected' }, { status: 400 })
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY
    let openai: OpenAI | null = null
    if (hasOpenAI) {
      openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
        
        // Count how many sprints this task has been in
        const sprintCount = await prisma.sprint.count({
          where: {
            tasks: {
              some: { id: task.id },
            },
          },
        })

        // Get clean description
        const cleanDescription = stripHtml(task.description || '')
        
        // Get clean comments
        const cleanComments = task.comments.map((c: any) => ({
          author: c.author.name,
          content: stripHtml(c.content),
        }))

        // Generate AI summary for this task if it has content
        let aiDescriptionSummary: string | null = null
        let aiCommentsSummary: string | null = null

        if (openai && (cleanDescription || cleanComments.length > 0)) {
          try {
            // Summarize description if exists
            if (cleanDescription && cleanDescription.length > 50) {
              const descCompletion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'Summarize this task description in 1-2 concise sentences. Be direct and professional. If it\'s already short, just clean it up.',
                  },
                  {
                    role: 'user',
                    content: cleanDescription,
                  },
                ],
                max_tokens: 100,
              })
              aiDescriptionSummary = descCompletion.choices[0]?.message?.content || null
            } else if (cleanDescription) {
              aiDescriptionSummary = cleanDescription
            }

            // Summarize comments if exists
            if (cleanComments.length > 0) {
              const commentsText = cleanComments
                .map((c: any) => `${c.author}: ${c.content}`)
                .join('\n')
              
              const commentsCompletion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                  {
                    role: 'system',
                    content: 'Summarize the key discussion points from these comments in 1-2 sentences. Focus on decisions made, blockers mentioned, or important updates. Be concise.',
                  },
                  {
                    role: 'user',
                    content: commentsText,
                  },
                ],
                max_tokens: 100,
              })
              aiCommentsSummary = commentsCompletion.choices[0]?.message?.content || null
            }
          } catch (error) {
            console.error('Failed to generate task AI summary:', error)
            // Fall back to clean text
            if (cleanDescription) {
              aiDescriptionSummary = cleanDescription.slice(0, 200) + (cleanDescription.length > 200 ? '...' : '')
            }
          }
        } else {
          // No AI - just use clean text
          if (cleanDescription) {
            aiDescriptionSummary = cleanDescription.slice(0, 200) + (cleanDescription.length > 200 ? '...' : '')
          }
          if (cleanComments.length > 0) {
            aiCommentsSummary = cleanComments.slice(0, 2).map((c: any) => `${c.author}: ${c.content.slice(0, 60)}...`).join(' | ')
          }
        }

        epicGroups.get(epicId)!.push({
          ...task,
          sprintCount,
          aiDescriptionSummary,
          aiCommentsSummary,
          hasComments: cleanComments.length > 0,
          hasDescription: !!cleanDescription,
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

      // Generate sprint-level AI summary
      let aiSummary = undefined
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
          console.error('Failed to generate sprint AI summary:', error)
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
