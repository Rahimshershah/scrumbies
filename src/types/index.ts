export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'READY_TO_TEST' | 'BLOCKED' | 'DONE' | 'LIVE'
export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED'
export type Role = 'ADMIN' | 'MEMBER'
export type Team = string // Dynamic - references ProjectTeam.key
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ActivityType = 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'MOVED_TO_SPRINT' | 'SPLIT' | 'DESCRIPTION_UPDATED' | 'COMMENT_ADDED' | 'PRIORITY_CHANGED'

export interface User {
  id: string
  name: string
  email?: string
  avatarUrl?: string | null
  role?: Role
}

export interface Task {
  id: string
  taskKey?: string | null // e.g., "BB-001"
  taskNumber?: number | null
  title: string
  description?: string | null
  status: TaskStatus
  priority: Priority
  order: number
  team?: Team | null
  sprintId?: string | null
  sprint?: { id: string; name: string } | null
  assignee?: User | null
  assigneeId?: string | null
  assignedAt?: string | null
  createdBy?: User | null
  createdById?: string | null
  splitFrom?: { id: string; title: string; taskKey?: string | null; sprintId?: string | null; sprint?: { name: string } | null } | null
  splitFromId?: string | null
  splitTasks?: { id: string; title: string; taskKey?: string | null; status: TaskStatus; sprintId?: string | null; sprint?: { name: string } | null; createdAt: string }[]
  _count?: { comments: number }
  createdAt?: string
  updatedAt?: string
}

export interface TaskChainItem {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  sprint: { id: string; name: string; status: SprintStatus } | null
  assignee: User | null
  commentCount: number
  createdAt: string
  depth: number
  isRoot: boolean
  isCurrent: boolean
}

export interface TaskChain {
  chain: TaskChainItem[]
  sprintCount: number
  totalTasks: number
  rootTaskId: string
  currentTaskId: string
}

export interface Activity {
  id: string
  type: ActivityType
  metadata?: Record<string, any> | null
  createdAt: string
  user: User
}

export interface Sprint {
  id: string
  name: string
  startDate?: string | null
  endDate?: string | null
  status: SprintStatus
  order: number
  tasks: Task[]
}

export interface Comment {
  id: string
  content: string
  createdAt: string
  author: User
  mentions: User[]
  taskStatusAtCreation?: TaskStatus | null // What phase the task was in when comment was made
}

export interface Attachment {
  id: string
  filename: string
  url: string
  size: number
  mimeType: string
  createdAt: string
  uploadedBy: User
}

export interface Notification {
  id: string
  type: 'MENTION' | 'ASSIGNMENT'
  read: boolean
  createdAt: string
  task?: { id: string; title: string }
  comment?: { id: string; content: string }
}

export interface Project {
  id: string
  name: string
  key: string
  logoUrl?: string | null
  createdAt?: string
  _count?: {
    sprints: number
    tasks: number
    members: number
  }
}
