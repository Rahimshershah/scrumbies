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

    // Fetch sprints with all related data (no status filter — frontend controls which sprints are sent)
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

    // Build sprint name lookup
    const sprintNames = sprints.map(s => s.name)

    // Calculate date range across all selected sprints
    const allStartDates = sprints.map(s => s.startDate).filter(Boolean) as Date[]
    const allEndDates = sprints.map(s => s.endDate).filter(Boolean) as Date[]
    const sprintDateRange = allStartDates.length > 0 && allEndDates.length > 0
      ? {
          start: new Date(Math.min(...allStartDates.map(d => d.getTime()))).toISOString(),
          end: new Date(Math.max(...allEndDates.map(d => d.getTime()))).toISOString(),
        }
      : null

    // Flatten all tasks, deduplicate by task ID (keep first occurrence)
    const seenTaskIds = new Set<string>()
    const allTasks: (typeof sprints[0]['tasks'][0] & { sprintName: string; sprintEndDate: string | null })[] = []
    for (const sprint of sprints) {
      for (const task of sprint.tasks) {
        if (!seenTaskIds.has(task.id)) {
          seenTaskIds.add(task.id)
          allTasks.push({
            ...task,
            sprintName: sprint.name,
            sprintEndDate: sprint.endDate ? sprint.endDate.toISOString().split('T')[0] : null,
          })
        }
      }
    }

    // Fetch project teams for color/name info
    const projectTeams = await prisma.projectTeam.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })
    const teamMap = new Map(projectTeams.map(t => [t.key, { key: t.key, name: t.name, color: t.color, bgColor: t.bgColor }]))

    // Get epics for grouping
    const epicIds = [...new Set(allTasks.map(t => t.epicId).filter(Boolean))]
    const epics = await prisma.epic.findMany({
      where: { id: { in: epicIds as string[] } },
    })
    const epicMap = new Map(epics.map(e => [e.id, e]))

    // Helper to strip HTML
    const stripHtml = (html: string) => {
      if (!html) return ''
      return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
    }

    // Group tasks: team -> epic -> tasks
    const teamGroups = new Map<string | null, Map<string | null, any[]>>()

    for (const task of allTasks) {
      const teamKey = task.team || null
      if (!teamGroups.has(teamKey)) {
        teamGroups.set(teamKey, new Map())
      }
      const epicGroupsForTeam = teamGroups.get(teamKey)!
      const epicId = task.epicId || null
      if (!epicGroupsForTeam.has(epicId)) {
        epicGroupsForTeam.set(epicId, [])
      }

      // Count how many sprints this task has been in
      const sprintCount = await prisma.sprint.count({
        where: { tasks: { some: { id: task.id } } },
      })

      let aiDescriptionSummary: string | null = null
      let aiCommentsSummary: string | null = null

      if (openai && reportType === 'detailed') {
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

      epicGroupsForTeam.get(epicId)!.push({
        ...task,
        sprintCount,
        aiDescriptionSummary,
        aiCommentsSummary,
        hasComments: task.comments && task.comments.length > 0,
        hasDescription: !!task.description && stripHtml(task.description).length > 0,
        sprintName: task.sprintName,
      })
    }

    // Build tasksByTeam array, sorted: named teams alphabetically, null team last
    const sortedTeamKeys = [...teamGroups.keys()].sort((a, b) => {
      if (a === null) return 1
      if (b === null) return -1
      const nameA = teamMap.get(a)?.name || a
      const nameB = teamMap.get(b)?.name || b
      return nameA.localeCompare(nameB)
    })

    const tasksByTeam = []
    for (const teamKey of sortedTeamKeys) {
      const epicGroupsMap = teamGroups.get(teamKey)!
      const epicGroups = []

      // Sort epics: named epics first, null epic last
      const sortedEpicIds = [...epicGroupsMap.keys()].sort((a, b) => {
        if (a === null) return 1
        if (b === null) return -1
        return 0
      })

      for (const epicId of sortedEpicIds) {
        const epic = epicId ? epicMap.get(epicId) : null
        const tasks = epicGroupsMap.get(epicId) || []

        let epicSummary: string | undefined
        if (openai && reportType === 'summarized' && tasks.length > 0) {
          try {
            const taskList = tasks.map((t: any) => {
              const desc = t.description ? stripHtml(t.description).slice(0, 100) : ''
              const isComplete = t.status === 'DONE' || t.status === 'LIVE'
              const wasSplit = t.splitTasks && t.splitTasks.length > 0
              const isContinuation = !!t.splitFromId
              let statusInfo = ''
              if (isComplete && !wasSplit) statusInfo = '✓ COMPLETED'
              else if (wasSplit) statusInfo = '⇅ SPLIT (work continued in next sprint)'
              else if (isContinuation && isComplete) statusInfo = '✓ COMPLETED (continuation from previous sprint)'
              else if (isContinuation) statusInfo = '↳ CONTINUATION (in progress)'
              else statusInfo = '→ CARRIED OVER (not completed)'
              return `- ${t.taskKey} "${t.title}": ${statusInfo}. ${desc || ''}`
            }).join('\n')

            const epicName = epic?.name || 'Uncategorized tasks'
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: 'Summarize in 2-3 sentences. Be accurate about what was completed vs in progress.' },
                { role: 'user', content: `Epic: ${epicName}\n${tasks.length} tasks:\n${taskList}` },
              ],
              max_tokens: 150,
            })
            epicSummary = completion.choices[0]?.message?.content?.trim()
          } catch (error) {
            console.error('Failed to generate epic summary:', error)
          }
        }

        epicGroups.push({
          epic: epic ? { id: epic.id, name: epic.name, color: epic.color, description: epic.description } : null,
          tasks,
          epicSummary,
        })
      }

      tasksByTeam.push({
        team: teamKey ? (teamMap.get(teamKey) || { key: teamKey, name: teamKey, color: '#64748b', bgColor: '#f1f5f9' }) : null,
        epicGroups,
      })
    }

    // Generate overall AI summary
    let aiSummary: string | undefined
    if (openai) {
      try {
        const taskSummaries = allTasks.map(t => {
          const isComplete = t.status === 'DONE' || t.status === 'LIVE'
          const wasSplit = t.splitTasks && t.splitTasks.length > 0
          let status = ''
          if (isComplete && !wasSplit) status = '✓ COMPLETED'
          else if (wasSplit) status = '⇅ SPLIT'
          else if (t.splitFromId) status = '↳ CONTINUATION'
          else status = '→ CARRIED'
          return `- ${t.taskKey}: ${t.title} [${status}]`
        }).join('\n')

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize sprint accomplishments accurately in 2-3 sentences. Focus on what was delivered.' },
            { role: 'user', content: `Sprints: ${sprintNames.join(', ')}\n${allTasks.length} tasks:\n${taskSummaries}` },
          ],
          max_tokens: 150,
        })
        aiSummary = completion.choices[0]?.message?.content?.trim()
      } catch (error) {
        console.error('Failed to generate AI summary:', error)
      }
    }

    const mergedReport = {
      sprintNames,
      sprintDateRange,
      tasksByTeam,
      generatedAt: new Date().toISOString(),
      aiSummary,
    }

    return NextResponse.json({ mergedReport })
  } catch (error) {
    console.error('Failed to generate report:', error)
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
