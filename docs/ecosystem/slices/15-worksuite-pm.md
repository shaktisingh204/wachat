## 15. Worksuite (Project Management)

1. Extend `app/actions/worksuite/projects` with portfolio grouping, RAG status rollups, custom fields, and per-workspace tenant scoping enforced via existing RBAC middleware.
2. Build hierarchical task model (epic > story > subtask) backed by Mongo with materialized path indexing for fast tree queries and drag-reorder operations.
3. Ship Kanban board view with WIP limits, swimlanes by assignee or label, and optimistic-UI card moves persisted via debounced server action batches.
4. Render Gantt chart using a virtualized canvas timeline supporting zoom (day/week/month/quarter) with critical-path highlighting computed server-side.
5. Implement task dependencies (FS, SS, FF, SF) with cycle detection and automatic downstream date shifting when predecessors slip past their deadline.
6. Add sprint planning module with capacity-aware backlog grooming, story-point velocity charts, and burndown/burnup graphs per sprint iteration.
7. Create roadmap view aggregating epics across projects, swimlaned by initiative, with quarter-over-quarter milestone bars and confidence indicators.
8. Build time-tracking timer widget with idle detection (mouse/keyboard via browser Idle API) prompting users to discard or keep idle minutes.
9. Persist time entries with billable flag, hourly rate snapshot, project/task linkage, and immutable audit log for invoice reconciliation.
10. Compute project profitability dashboards comparing logged hours times rate, plus expenses, against fixed budget or cap with burn-rate forecasting.
11. Provision branded client-portal subdomains (`{slug}.clients.sabnode.app`) using existing wildcard DNS plumbing with per-tenant theme/logo overrides.
12. Restrict client portal sessions via separate JWT audience and ACL ensuring clients see only their projects, invoices, files, and approval requests.
13. Support fixed-fee contract billing with milestone-triggered invoices auto-generated when milestone status flips to `approved` by the assigned client user.
14. Support time-and-materials contract billing aggregating approved billable entries within a period into a draft invoice with line-item grouping.
15. Support retainer contracts with monthly hour pools, rollover rules, overage rates, and automated low-balance alerts to account managers.
16. Implement team-chat channels per project with file attachments stored on Firebase, message reactions, and threaded replies indexed for search.
17. Add screen-recording capture using `MediaRecorder` API uploading webm chunks to blob storage with auto-generated transcript via existing AI gateway.
18. Build dependency graph visualizer (force-directed) showing inter-task and inter-project blockers with click-through to the blocking item.
19. Track milestones as first-class entities with target/actual dates, stakeholder sign-off workflow, and automatic Slack/email digest on slippage.
20. Ship resource scheduler showing per-person allocation across projects with drag-to-reassign and conflict detection against PTO calendar.
21. Add capacity-planning view forecasting team utilization 4-12 weeks ahead using committed allocations plus pipeline deals weighted by close probability.
22. Generate billable-hour reports filterable by client, project, person, and tag, exportable to CSV/PDF with customizable column sets.
23. Listen for `crm.deal.won` events on the data fabric and auto-create projects from the deal's service-offering template with mapped stakeholders.
24. Define service-offering templates (tasks, milestones, durations, default assignees, budget) cloneable when spinning up new client projects.
25. Build retrospective tool capturing went-well/improve/action-items per sprint with anonymous voting and auto-conversion of actions into backlog tasks.
26. Implement Jira importer parsing project XML/JSON exports mapping issue types, custom fields, comments, attachments, and sprint history.
27. Implement Asana importer using their REST API with OAuth, mapping sections to columns, tasks to tasks, and preserving subtask hierarchy.
28. Add automation-rule engine (trigger/condition/action) reusing the SabFlow node runtime so PM rules execute on the same workflow infrastructure.
29. Provide rule recipes such as `when status=Done then log time and notify reviewer` and `when due-date<3d then escalate to lead`.
30. Add task templates and checklists with required-completion enforcement before transitioning to a downstream status column.
31. Implement `@mentions` across tasks, comments, and chat with notification fanout to in-app, email, and (if connected) Slack/Teams.
32. Add document collaboration tab per project using a Yjs-backed CRDT editor for shared notes, specs, and meeting agendas with presence cursors.
33. Build approval workflows for deliverables, change requests, and time sheets with multi-step routing and SLA timers per approval gate.
34. Track change orders against fixed-fee contracts with delta-budget, delta-scope, and delta-timeline fields requiring client portal sign-off.
35. Surface project health score combining schedule variance, budget variance, open blockers, and overdue tasks with weighted ML-tuned weights.
36. Add personal "My Work" inbox aggregating assigned tasks, mentions, due-soon items, and approvals across all projects in priority order.
37. Implement tags/labels with workspace-level taxonomy, color coding, and saved filters shared across the team for consistent reporting.
38. Build PTO/leave calendar integration so resource scheduler greys out unavailable days and capacity charts auto-discount holidays per region.
39. Add invoicing pipeline that converts approved time entries and milestones into Stripe-Invoice drafts via existing billing-monetization slice.
40. Expose webhooks for `task.created`, `task.statusChanged`, `project.completed`, `timeEntry.logged`, and `milestone.reached` for ecosystem integrations.
41. Add public REST and GraphQL endpoints under `/api/v1/worksuite/*` documented in the developer-platform slice with per-key rate limits.
42. Cache project list and task counts in Redis keyed by `tenant:{id}:project:{id}:v{ver}` invalidated via `updateTag` on mutations.
43. Implement offline-first mobile companion using IndexedDB queue replaying mutations on reconnect with conflict resolution via last-writer-wins plus log.
44. Add granular permissions (project.view, task.edit, time.approve, contract.create, portal.access) overlaid on existing role matrix.
45. Provide AI assistant inside each project that answers "what's blocking us?", drafts status updates, and suggests next-best-actions using project context.
46. Add Pomodoro/focus timer integrated with time tracking so a completed focus block auto-creates a billable entry against the active task.
47. Generate weekly client status emails compiled from completed tasks, hours burned, milestones reached, and risks, sent every Friday at workspace TZ.
48. Build SLA tracking for support-style projects with first-response and resolution timers, breach alerts, and historical compliance reporting.
49. Add cost-rate vs bill-rate per resource so profitability calculations distinguish margin per person and roll up to portfolio-level P&L views.
50. Instrument every PM action with telemetry events (`worksuite.*`) feeding the cross-module data fabric for funnel analysis and adoption dashboards.
