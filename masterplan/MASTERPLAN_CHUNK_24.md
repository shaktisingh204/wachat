# Page Analysis: HR Modules (Chunk 24)

This document contains a detailed analysis of the HR module pages assigned in Chunk 24. These files largely follow a uniform architectural pattern, leveraging reusable UI shells (`EntityListShell`, `HrListShell`, `HrFormPage`) and calling server-actions directly.

## 1. OKRs (Objectives and Key Results)
- **Route / Component:** `src/app/dashboard/hrm/hr/okrs/*`
- **Current Features:** List, detail, and form views for managing OKRs. The list page features search, status filtering, and visual progress bars for tracking alignment. Handles deletion via an AlertDialog and transitions.
- **Possible Features:** A hierarchical tree view to visualize alignment between company, team, and individual OKRs. Integration with performance review cycles.
- **Errors / Risks:** There is a known mismatch highlighted in a comment: `okrStatus enum has 'off_track'/'cancelled'. Resolve Rust DTO first.` The frontend filters rely on `missed`/`behind`. This could cause hydration issues or failed filtering if backend values differ.
- **Enhancement Plan:** Resolve the Rust DTO enum mismatch to ensure strict type safety. Add an aligned visual graph view for OKRs.

## 2. Onboarding Workflows
- **Route / Component:** `src/app/dashboard/hrm/hr/onboarding/*`
- **Current Features:** Manages new hire onboarding tasks. The detail page (`[id]/page.tsx`) displays an action group (Edit, Mark complete, Send welcome kit) and dynamic checklists. A right rail links directly to the `employeeId` and offers a chain transition to a Probation workflow.
- **Possible Features:** Automated trigger for welcome emails and IT provisioning checklists based on role. Bulk checklist item completion.
- **Errors / Risks:** In `[id]/page.tsx`, the server component fetches the entire onboarding collection (`getOnboardingTemplates()`) and uses an array `.find()` to locate the active record. This O(N) lookup is inefficient and noted via a `TODO 1D.2`.
- **Enhancement Plan:** Implement a `getOnboardingById` server action to efficiently fetch single records.

## 3. One-on-Ones
- **Route / Component:** `src/app/dashboard/hrm/hr/one-on-ones/*`
- **Current Features:** Lists check-ins between managers and reports. Offers two views: a tabular view and a custom `CalendarView` (monthly grid). Tracks duration, mood, agenda, discussion points, and action items.
- **Possible Features:** Sync check-in times with Google Calendar/Outlook. Send automated pre-meeting reminders. Allow adding quick action items inline from the detail page.
- **Errors / Risks:** `actionItems` are stored as newline-separated strings and split manually. Date parsing for the calendar view lacks deep fallback checks if data is malformed.
- **Enhancement Plan:** Refactor action items into a structured array schema. Move the KPI aggregations to the server to avoid heavy client-side iteration over large arrays.

## 4. Org Chart
- **Route / Component:** `src/app/dashboard/hrm/hr/org-chart/page.tsx`
- **Current Features:** Dynamically renders a nested reporting hierarchy from CRM employee records. Uses a recursive `OrgNode` component to display nested direct reports with expandable/collapsible chevrons.
- **Possible Features:** Drag-and-drop to reassign managers. Export Org Chart to PDF/PNG. 
- **Errors / Risks:** `resolveManagerId` relies on duck typing for the `reporting_to` property (checking `_id` vs `id`). If the employee tree becomes very deep or wide, the recursive React component rendering may suffer severe performance degradation.
- **Enhancement Plan:** Implement a canvas-based or virtualized tree library (e.g., React Flow or D3) to handle large enterprise hierarchies efficiently.

## 5. HR Dashboard Root
- **Route / Component:** `src/app/dashboard/hrm/hr/page.tsx`
- **Current Features:** Fetches multi-domain HR data (KPIs, onboardings, jobs, announcements, policies, employees) concurrently using `Promise.all`. Feeds into the `HrOverviewClient` widget board.
- **Possible Features:** Customizable drag-and-drop widget layout. Quick-action shortcuts on the dashboard.
- **Errors / Risks:** Uses `JSON.parse(JSON.stringify(data))` extensively to strip MongoDB ObjectIds and avoid Next.js serialization warnings. This is a CPU-heavy anti-pattern for large payloads.
- **Enhancement Plan:** Use proper DTO mappers at the edge of the server-action layer to convert `_id` to strings rather than double-serializing the entire payload.

## 6. Policies
- **Route / Component:** `src/app/dashboard/hrm/hr/policies/*`
- **Current Features:** Tracks handbooks and versioned guidelines. Includes robust versioning fields, expiry dates, and tracks "employee acknowledgement" counts.
- **Possible Features:** In-app e-signature integration for formal acknowledgements. Automated notification blasts when a policy is updated or about to expire.
- **Errors / Risks:** Inline policy content is dumped into a `<pre>` tag. If text includes long un-broken strings, it could break layouts.
- **Enhancement Plan:** Integrate a safe Markdown or Rich Text renderer for the policy `content` field.

## 7. Probation
- **Route / Component:** `src/app/dashboard/hrm/hr/probation/*`
- **Current Features:** Manages probationary periods. The detail page parses and displays a structured array of evaluation criteria (Target, Achieved, Score) alongside an overall recommendation.
- **Possible Features:** Automated 30/60/90-day review reminders. Self-evaluation forms for the employee to fill out.
- **Errors / Risks:** Heavy use of `as Record<string, unknown>` and `as any` type casting during form initialization and row rendering masks potential underlying schema drifts.
- **Enhancement Plan:** Strictly type the `CrmProbationDoc` interfaces to eliminate `any` casting.

## 8. Recognition
- **Route / Component:** `src/app/dashboard/hrm/hr/recognition/*`
- **Current Features:** Tracks peer-to-peer Kudos, Spot Awards, and points. Features a real-time KPI strip that calculates total points awarded and public shoutouts.
- **Possible Features:** Leaderboard dashboard. Slack/Teams integration to broadcast public recognitions to company channels.
- **Errors / Risks:** Calculation of points assumes `r.points` is cleanly convertible to a number. Non-numeric data may introduce `NaN` into the aggregate metrics.
- **Enhancement Plan:** Perform KPI point aggregations securely on the database level (e.g., MongoDB `$sum`).

## 9. Succession Planning
- **Route / Component:** `src/app/dashboard/hrm/hr/succession/*`
- **Current Features:** Tracks role continuity and successor readiness. Highlights "Ready-now", "1yr", and "2yr" readiness tiers using distinct color tones.
- **Possible Features:** Gap analysis visualization. Matrix grid linking to the Org Chart.
- **Errors / Risks:** KPI formulas rely entirely on dynamic property access `(r as any).readiness` indicating the type definition `HrSuccessionPlan` is severely outdated.
- **Enhancement Plan:** Update `HrSuccessionPlan` interface. Develop a visual lineage tool for critical roles.

## 10. Surveys & Additional Modules (Training, Timesheets, Travel)
- **Route / Component:** `src/app/dashboard/hrm/hr/surveys/*`, `/training/*`, `/timesheets/*`, `/travel/*`
- **Current Features:** Surveys calculate response rates (`responsesCount / targetCount`). Training tracks total learning hours. All modules adhere strictly to the `HrListShell` / `HrFormPage` pattern.
- **Possible Features:** Advanced charting for Survey analytics. LMS integration for Training.
- **Errors / Risks:** Identical to previous modules—client-side aggregation of KPIs over unbound arrays (`rows.filter().length`). 
- **Enhancement Plan:** Systematically migrate all KPI generation from the client to dedicated server-side aggregation endpoints for scalability.
