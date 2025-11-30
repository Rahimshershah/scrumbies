# Zyra - Sprint Backlog Tool Design

## Overview

A Jira-like sprint backlog management tool for internal team use. Core focus is the backlog view where sprints contain tasks that can be reordered via drag-and-drop.

## Users & Access

- ~15 team members
- Simple email/password authentication (admin creates accounts)
- Self-hosted on own server
- Responsive design (desktop + mobile browsers)

## Core Features

### Sprint Backlog View
- Main view shows all sprints with their tasks
- Sprints displayed vertically, scrollable
- Tasks within sprints can be reordered (drag-drop)
- Tasks can be moved between sprints (drag-drop)
- Refresh-based sync (no real-time WebSockets)

### Tasks
- Title with optional tags in brackets: `[web] Fix login bug`
- Description (rich text)
- Four statuses: TO DO → IN PROGRESS → READY TO TEST → DONE
- Single assignee (team member)
- Comments with @mentions

### Task Splitting
- Clone a task and link to original
- "Split from" relationship visible on cloned tasks

### Notifications
- In-app notification bell with unread count
- Email notifications for @mentions and assignments

## Data Model

```
User
├── id, email, password (hashed), name, avatarUrl
├── createdAt, updatedAt
└── role: ADMIN | MEMBER

Sprint
├── id, name, startDate, endDate
├── order (for sorting sprints)
└── status: ACTIVE | COMPLETED | PLANNED

Task
├── id, title, description (rich text)
├── status: TODO | IN_PROGRESS | READY_TO_TEST | DONE
├── order (position within sprint)
├── tags: string[]
├── sprintId, assigneeId, createdById
├── splitFromId (nullable)
└── createdAt, updatedAt

Comment
├── id, content, taskId, authorId
├── mentions: userId[]
└── createdAt

Notification
├── id, userId, type, taskId, commentId
├── read: boolean
└── createdAt
```

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Drag & Drop:** dnd-kit
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** NextAuth.js with credentials provider
- **Email:** Nodemailer (SMTP)
- **Deployment:** Docker

## Non-Features (Intentionally Excluded)

- Task ID prefixes (HES-1234 style)
- Time estimates
- Priority indicators
- Project/team labels
- Real-time sync
- Native mobile app
