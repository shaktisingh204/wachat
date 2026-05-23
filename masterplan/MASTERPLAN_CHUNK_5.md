# Masterplan - Chunk 5 Analysis

This document provides a detailed analysis of 45 Next.js page files assigned in Chunk 5. These files are all part of the `src/app/dashboard/crm/hr/` directory and currently function as legacy redirect handlers, permanently redirecting users from the old `/dashboard/crm/hr/...` routes to the new `/dashboard/hrm/hr/...` routes.

---

## 1. HR Disciplinary Pages
**Routes / Components:**
- `src/app/dashboard/crm/hr/disciplinary/page.tsx`
- `src/app/dashboard/crm/hr/disciplinary/new/page.tsx`
- `src/app/dashboard/crm/hr/disciplinary/[caseId]/page.tsx`
- `src/app/dashboard/crm/hr/disciplinary/[caseId]/edit/page.tsx`

**Current Features:**
The code currently implements a `LegacyHrRedirect` component for the HR Disciplinary module. For the index and `new` routes, it uses a simple `permanentRedirect`. For dynamic routes (`[caseId]` and `[caseId]/edit`), it asynchronously awaits `params` and `searchParams`, encodes the dynamic parameters, and appends the query string before executing a `permanentRedirect`.

**Possible Features:**
In the new `/dashboard/hrm/` destination, this module should support:
- Disciplinary case tracking (warnings, hearings, outcomes).
- Evidence and document attachment support.
- Role-based visibility (HR vs. employee).

**Errors:**
- **Loss of array query params:** In the dynamic routes, when a query parameter has multiple values (e.g., `?tag=1&tag=2`), the code uses `usp.set(key, value[0])`, discarding all subsequent values.
- **No error boundaries:** Because `permanentRedirect` works by throwing a `NEXT_REDIRECT` error, this is usually caught by Next.js, but any failure in `await params` could result in an unhandled exception if no boundary exists.

**Enhancement Plan:**
- Use Next.js `next.config.js` for these static permanent redirects instead of client-side/server-component component-level redirects. This avoids spinning up React components just to throw a redirect error and dramatically improves server performance and routing clarity.
- Update query string parsing to use `.append()` for array-based values instead of `.set()`.

---

## 2. HR Document Templates
**Route / Component:**
- `src/app/dashboard/crm/hr/document-templates/page.tsx`

**Current Features:**
A static `LegacyHrRedirect` that permanently redirects users to `/dashboard/hrm/hr/document-templates`.

**Possible Features:**
In the HRM platform, this should provide a builder for offer letters, NDAs, and performance reviews, complete with variable placeholders (`{{employeeName}}`).

**Errors:**
- No implementation bugs, as it's a simple function call.

**Enhancement Plan:**
- Move this rule to `redirects()` in `next.config.js`.

---

## 3. HR Documents
**Routes / Components:**
- `src/app/dashboard/crm/hr/documents/page.tsx`
- `src/app/dashboard/crm/hr/documents/new/page.tsx`
- `src/app/dashboard/crm/hr/documents/[id]/page.tsx`
- `src/app/dashboard/crm/hr/documents/[id]/edit/page.tsx`

**Current Features:**
Redirects standard and dynamic document management paths to the HRM namespace, carrying over `[id]` and query parameters safely (mostly).

**Possible Features:**
The eventual implementation should offer document categorization, secure e-signatures, expiration tracking (e.g., for visas), and role-based access control.

**Errors:**
- Same array-based query param loss bug as the Disciplinary module.

**Enhancement Plan:**
- Migrate away from component-based routing for legacy support and consolidate all `/dashboard/crm/hr/documents/*` routing logic in middleware or `next.config.js` to lower TTFB (Time to First Byte).

---

## 4. HR Exits
**Routes / Components:**
- `src/app/dashboard/crm/hr/exits/page.tsx`
- `src/app/dashboard/crm/hr/exits/new/page.tsx`
- `src/app/dashboard/crm/hr/exits/[id]/page.tsx`
- `src/app/dashboard/crm/hr/exits/[id]/edit/page.tsx`

**Current Features:**
Handles redirecting legacy exit/offboarding routes to the new architecture. 

**Possible Features:**
The new routes should encompass resignation workflows, exit interviews, final payroll clearances, and IT asset retrieval checklists.

**Errors:**
- Minor loss of query params for arrays.
- Possible unhandled dynamic parameter extraction if the route changes or `params` object is structured unexpectedly.

**Enhancement Plan:**
- Configure a wildcard redirect `source: '/dashboard/crm/hr/exits/:path*'` in `next.config.js` to eliminate these 4 files completely and reduce bundle/repo size.

---

## 5. HR Expense Claims, Feedback 360, & OKRs
**Routes / Components:**
- `src/app/dashboard/crm/hr/expense-claims/page.tsx`
- `src/app/dashboard/crm/hr/feedback-360/page.tsx`
- `src/app/dashboard/crm/hr/okrs/page.tsx`

**Current Features:**
Static redirects for performance management and expense claims to the HRM destination.

**Possible Features:**
- **Expense Claims:** OCR for receipt scanning, multi-level approval workflows.
- **Feedback 360:** Anonymous peer reviews, spider-chart visualizations for skills.
- **OKRs:** Hierarchical cascading objectives linking company goals to individual KPIs.

**Errors:**
- None in current implementation.

**Enhancement Plan:**
- These files are completely unnecessary overhead in the `app/` router. Define them in `next.config.js` and delete the files to optimize the Next.js build.

---

## 6. HR Interviews & Jobs
**Routes / Components:**
- `src/app/dashboard/crm/hr/interviews/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr/jobs/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`

**Current Features:**
Migrates ATS (Applicant Tracking System) components from the CRM namespace to the HRM namespace. Handles query variables and `[id]` params.

**Possible Features:**
- **Jobs:** Job board integrations, JD generator, applicant pipelines (Kanban view).
- **Interviews:** Scorecards, scheduling integrations (Google Calendar/Zoom), feedback consolidation.

**Errors:**
- Only the query parameter array loss limitation.

**Enhancement Plan:**
- Replace these 8 component-level redirects with server-level wildcard redirects to bypass the React component tree entirely, improving SEO and client rendering speed.

---

## 7. HR Learning Paths
**Routes / Components:**
- `src/app/dashboard/crm/hr/learning-paths/page.tsx`
- `src/app/dashboard/crm/hr/learning-paths/new/page.tsx`
- `src/app/dashboard/crm/hr/learning-paths/[id]/page.tsx`
- `src/app/dashboard/crm/hr/learning-paths/[id]/edit/page.tsx`

**Current Features:**
Legacy redirect wrapper for LMS (Learning Management System) entities.

**Possible Features:**
Future iterations in HRM should include rich text module creation, video tracking (SCORM compliance), and quizzes.

**Errors:**
- The standard query parameter truncation bug.

**Enhancement Plan:**
- Shift to `next.config.js` redirects.

---

## 8. HR Offers & Onboarding
**Routes / Components:**
- `src/app/dashboard/crm/hr/offers/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`
- `src/app/dashboard/crm/hr/onboarding/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`

**Current Features:**
Redirect logic for the applicant-to-employee pipeline.

**Possible Features:**
- **Offers:** Document generation, dynamic compensation calculation, e-signature.
- **Onboarding:** Checklist workflows, automatic provisioning of software licenses, automated welcome emails.

**Errors:**
- No critical errors. Minor query string array limitation.

**Enhancement Plan:**
- A single glob pattern `redirect` in configuration would capture both offers and onboarding entirely.

---

## 9. One-on-Ones, Org Chart, Policies, Probation, Recognition, Succession
**Routes / Components:**
- `src/app/dashboard/crm/hr/one-on-ones/page.tsx`
- `src/app/dashboard/crm/hr/org-chart/page.tsx`
- `src/app/dashboard/crm/hr/policies/page.tsx`
- `src/app/dashboard/crm/hr/probation/page.tsx`
- `src/app/dashboard/crm/hr/recognition/page.tsx`
- `src/app/dashboard/crm/hr/succession/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/edit/page.tsx`

**Current Features:**
These represent the core employee engagement and structure modules, all currently delegating requests to `/dashboard/hrm/hr/*`.

**Possible Features:**
- **One-on-Ones:** Shared agendas, action items, AI summary notes.
- **Org Chart:** Interactive D3.js or react-flow tree structure with zoom and pan.
- **Probation & Succession:** automated alerts for 30/60/90-day reviews, matrix for 9-box talent grids.

**Errors:**
- Minimal, except dynamic param handling in the succession dynamic routes.

**Enhancement Plan:**
- Transition all these components out of `src/app/` to prevent unnecessary route generation during `next build`. Consolidating this within `next.config.js` or `middleware.ts` allows Next.js to handle the redirect at the edge, saving compute and improving UX.

---

## 10. HR Root Directory
**Route / Component:**
- `src/app/dashboard/crm/hr/page.tsx`

**Current Features:**
Redirects the primary HR dashboard view to the HRM module.

**Possible Features:**
The destination should act as an HR overview: employee headcount, active open roles, upcoming anniversaries/birthdays, and pending approvals.

**Errors:**
- None.

**Enhancement Plan:**
- Migrate to Next.js config redirects.

---

## Overall Architectural Conclusion
Across all 45 files in this chunk, the implementation demonstrates a massive migration from `crm/hr/` to `hrm/hr/`. While using server components and `permanentRedirect` is functional in Next.js 13+, keeping 45 individual dummy page files creates file-system bloat, increases Next.js router compilation time, and introduces edge-case bugs (like dropping array query parameters). The primary enhancement strategy is to delete these files and replace them with wildcard redirect rules inside `next.config.js` or `middleware.ts`.
