# Masterplan Chunk 10 - Projects, Milestones & Subtasks

## Route / Component Analysis

### Projects
- `/dashboard/crm/projects/page.tsx` (Project List)
- `/dashboard/crm/projects/new/page.tsx` (Project Creation)

### Milestones
- `/dashboard/crm/projects/milestones/page.tsx` (Milestone List)
- `/dashboard/crm/projects/milestones/new/page.tsx` (Milestone Creation)
- `/dashboard/crm/projects/milestones/[id]/page.tsx` (Milestone Detail)
- `/dashboard/crm/projects/milestones/[id]/edit/page.tsx` (Milestone Edit)

### Subtasks
- `/dashboard/crm/projects/subtasks/page.tsx` (Subtask List)
- `/dashboard/crm/projects/subtasks/new/page.tsx` (Subtask Creation)
- `/dashboard/crm/projects/subtasks/[id]/page.tsx` (Subtask Detail)
- `/dashboard/crm/projects/subtasks/[id]/edit/page.tsx` (Subtask Edit)

## Current Features
- **Consistent Shell Pattern:** Extensive use of `EntityListShell`, `EntityDetailShell`, and `EntityFormShell` ensuring a unified look and feel.
- **Projects:** The list page is sophisticated, featuring Table, Kanban, and Gantt view toggles. The creation form is heavily sectioned (Basic Info, Timeline, Budget, Notes). Bulk operations (archive, delete) are supported.
- **Milestones:** The list page provides KPI metrics (Total, Reached, Pending, Overdue) and supports bulk completion/deletion and CSV exports. It implements inline creation and editing via a `MilestoneDialog`. The detail page tracks a progress percentage and costs.
- **Subtasks:** Tracks actionable sub-items attached to parent tasks (either project tasks or generic CRM tasks). The list page includes KPI metrics (Open, Completed, Overdue) and an inline `SubTaskDialog` for creation and edits. 

## Possible Features
- **Projects:** Introduce team allocation and utilization metrics directly in the list view. Allow drag-and-drop state updates directly within the Kanban and Gantt views.
- **Subtasks:** Introduce bulk actions (e.g., bulk complete, bulk assign) similar to the features present on the Milestones list page. Introduce a dependency or ordering UI since subtasks have an `order` property.

## Errors / Issues
- **DRY Violation & Redundancy:** Both Milestones and Subtasks list pages implement inline forms (`MilestoneDialog`, `SubTaskDialog`) with their own form markup and logic. At the same time, dedicated `/new` and `/[id]/edit` routes exist which wrap shared `MilestoneForm` and `SubtaskForm` components. This is a severe DRY violation and leads to fragmented logic.
- **Unfinished Implementation in Projects List:** The `projects/page.tsx` contains a TODO (`TODO 1D.1: wire <EntityFormField> chips for client + category filters`). The `clientFilter` and `categoryFilter` use hidden inputs instead of actual UI controls.

## Enhancement Plan
- **Resolve Form Duplication:** Refactor the `MilestoneDialog` and `SubTaskDialog` to import and utilize the shared `<MilestoneForm>` and `<SubtaskForm>` components, or entirely remove the inline dialogs in favor of strictly using the `/new` and `/edit` routes for consistency.
- **Implement Missing Project Filters:** Address the `TODO` in `projects/page.tsx` by replacing the hidden inputs with `<EntityFormField>` selectors for `clientId` and `categoryId` filtering.
- **Expand Subtask Bulk Operations:** Add a bulk action bar to the Subtasks list page to allow users to mass-complete or mass-delete subtasks, matching the UX provided in Milestones.
