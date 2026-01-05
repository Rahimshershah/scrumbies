# UAT Sprint Feature Design

## Overview

Add a new "UAT Sprint" option that transitions an active sprint into a UAT (User Acceptance Testing) phase. Unlike "Complete Sprint" which archives the sprint, UAT sprints remain visible in the backlog in a collapsed state.

## Requirements

1. Keep UAT sprints visible in the backlog view (not archived)
2. Split/move items in TODO, BLOCKED, or IN_PROGRESS status
3. Items in DONE, LIVE, or READY_TO_TEST (Testing) remain in the sprint
4. UAT sprints display collapsed by default, expandable on click

## Data Model

### SprintStatus Enum Update

```prisma
enum SprintStatus {
  PLANNED
  ACTIVE
  UAT        // New status
  COMPLETED
}
```

### Status Transitions

- PLANNED → ACTIVE (Start Sprint)
- ACTIVE → UAT (UAT Sprint)
- ACTIVE → COMPLETED (Complete Sprint)
- UAT → COMPLETED (Complete Sprint)
- COMPLETED → UAT (Admin only)

## UAT Sprint Action

### Trigger
New dropdown menu option "UAT Sprint" on ACTIVE sprints.

### Task Handling
- **Tasks to handle (split/move/close):** TODO, IN_PROGRESS, BLOCKED
- **Tasks that stay:** READY_TO_TEST, DONE, LIVE

### Modal
Reuse CompleteSprintModal pattern with:
- Same 3 options: Split to Next Sprint, Move to Next Sprint, Close All
- Title: "UAT Sprint"
- Final status: UAT

### API Endpoint
New route: `/api/sprints/[id]/uat/route.ts`

## Backlog View Display

### Sprint Order
1. UAT Sprints (collapsed by default) - at the very top
2. Active Sprints (expanded)
3. Planned Sprints (expanded)

### UAT Sprint Collapsed State
- Sprint header with name and "UAT" badge
- Summary stats: "3 Testing, 4 Done, 1 Live"
- Click to expand/collapse
- Chevron icon for state indication

### UAT Sprint Expanded State
- Full task list visible
- Drag-drop enabled
- All task actions available

### Section Heading
"UAT SPRINTS" with count badge

### Persistence
Local storage for expand/collapse state per sprint

## Files to Modify

1. `prisma/schema.prisma` - Add UAT status
2. `src/app/api/sprints/[id]/uat/route.ts` - New endpoint
3. `src/app/api/sprints/[id]/route.ts` - Allow UAT transitions
4. `src/components/backlog/sprint-section.tsx` - Add UAT action, collapsible UI
5. `src/components/backlog/backlog-view.tsx` - UAT sprint section
6. `src/components/backlog/uat-sprint-modal.tsx` - New modal (or extend existing)
