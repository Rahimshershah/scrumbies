'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Task } from '@/types'
import { TaskCard } from './task-card'
import { InlineTaskInput } from './inline-task-input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BacklogSectionProps {
  tasks: Task[]
  users: { id: string; name: string; avatarUrl?: string | null }[]
  projectId?: string
  onTaskClick: (task: Task) => void
  onCreateTask: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
}

export function BacklogSection({
  tasks,
  users,
  projectId,
  onTaskClick,
  onCreateTask,
  onTaskUpdate,
}: BacklogSectionProps) {
  const [isAddingTask, setIsAddingTask] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog-drop-zone',
  })

  const handleCreateTask = (task: Task) => {
    onCreateTask(task)
    setIsAddingTask(false)
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-md transition-colors bg-card",
        isOver && "border-primary bg-accent/50"
      )}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            onClick={() => onTaskClick(task)}
            onUpdate={onTaskUpdate}
          />
        ))}
      </SortableContext>

      {/* Inline task creation */}
      {isAddingTask ? (
        <div className="px-2 py-1.5">
          <InlineTaskInput
            sprintId={null}
            projectId={projectId}
            users={users}
            onSave={handleCreateTask}
            onCancel={() => setIsAddingTask(false)}
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs text-muted-foreground hover:text-foreground rounded-none border-t"
          onClick={() => setIsAddingTask(true)}
        >
          + Add task
        </Button>
      )}

      {/* Empty state */}
      {tasks.length === 0 && !isAddingTask && (
        <div className="text-center py-4 text-muted-foreground text-xs">
          No backlog items. Drag here or add tasks.
        </div>
      )}
    </div>
  )
}
