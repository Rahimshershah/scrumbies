# Enhanced Sprint Reports Design

## Date: 2026-02-22

## Summary

Enhance the Reports section with four changes:
1. Include UAT sprints in the sprint selector (not just COMPLETED)
2. Merge multi-sprint reports into a single view grouped by Team then Epic
3. Add inline go-live date pickers at epic and task level
4. Update PDF template to reflect all the above

## Requirements (from user)

- Select sprints in UAT status, not just COMPLETED
- Select multiple sprints (e.g., Sprint 58 + 59) and get a combined report
- Group tasks by team first (Mobile, Web), then by epic within each team
- Add go-live date picker per epic (cascades to all tasks) and per individual task (overrides epic date)
- Dates appear inline in report preview and in downloaded PDF

## Design Decisions

- **Team first, then Epic** grouping hierarchy
- **Merged report** when multiple sprints selected (not separate sections per sprint)
- **Inline date pickers** in report preview (not a separate config step)
- Go-live dates are **client-side state only** — not persisted to DB, just included in PDF output
- Sprint origin shown as small badge on each task

## Architecture

### API: `/api/reports/generate` (POST)

Currently returns `{ reports: ReportData[] }` — one per sprint.

New behavior: returns `{ mergedReport: MergedReportData }` containing:

```typescript
interface MergedReportData {
  sprintNames: string[]          // e.g. ["Sprint 58", "Sprint 59"]
  sprintDateRange: { start: string; end: string } | null
  tasksByTeam: {
    team: { key: string; name: string; color: string; bgColor: string } | null
    epicGroups: {
      epic: Epic | null
      tasks: ReportTask[]
      epicSummary?: string
    }[]
  }[]
  generatedAt: string
  aiSummary?: string
}
```

Changes to the route:
- Accept UAT sprints (remove COMPLETED-only filter — already no filter in DB query, just needs frontend to send UAT sprint IDs)
- After fetching all tasks from all selected sprints, deduplicate by task ID (a task in multiple sprints appears once)
- Group by `task.team` first, then by `task.epicId` within each team
- Sort teams: teams with tasks first alphabetically, "No Team" last

### Frontend: `reports-view.tsx`

1. **Sprint selector**: Change filter from `s.status === 'COMPLETED'` to include `'UAT'`
2. **Report data shape**: Update state and rendering to use `MergedReportData`
3. **Team sections**: Render team headers with team color, containing epic sub-groups
4. **Go-live dates**:
   - State: `goLiveDates: Record<string, string>` keyed by epic ID or task ID
   - Epic date picker: sets date for the epic key; all tasks in that epic inherit it unless overridden
   - Task date picker: sets date for the task key; overrides epic date
   - Helper: `getGoLiveDate(taskId, epicId)` returns task-specific date or falls back to epic date
5. **Pass go-live dates** to PDF download request

### PDF: `/api/reports/pdf` (POST)

- Accept `goLiveDates` in request body
- Update `generateReportHTML` to render team-grouped layout with go-live date column
- Team header sections with colored background
- Go-live date badge next to epic headers and task rows

## Files to Change

1. `src/components/reports/reports-view.tsx` — main UI changes
2. `src/app/api/reports/generate/route.ts` — merged report grouping logic
3. `src/app/api/reports/pdf/route.ts` — PDF template with team groups + go-live dates
