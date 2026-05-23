# Chunk 23: Human Resources (HR) Module

This chunk implements the core features of the Human Resources Management (HRM) module. It covers the complete employee lifecycle from recruitment (Jobs, Interviews, Offers) to daily operations (Documents, Events, Expense Claims, Notices, OKRs, Feedback) and finally to offboarding (Exits).

## Overview
All pages in this chunk heavily rely on generic layout components like `EntityListShell` and `EntityDetailShell`. Forms are constructed using generic builders, and data is sourced via Next.js Server Actions calling Rust-based backend APIs (e.g., `getHrEntityById`, `getEventById`).

---

### Route / Component
`src/app/dashboard/hrm/hr/documents/*`
- **Current Features**: List, view, create, and edit HR documents (contracts, IDs, certifications). Features category, employee mapping, and an expiry tracking system. Also allows filtering documents by type or status.
- **Possible Features**: Add e-signature integration (DocuSign/PandaDoc). Bulk document upload capability for faster onboarding. Expiry reminders via email or Slack.
- **Errors**: No major issues detected. However, error boundaries might be missing for cases where the API fails to fetch documents list.
- **Enhancement Plan**: Implement an embedded document viewer (PDF preview) in the UI directly instead of opening them in a new tab.

---

### Route / Component
`src/app/dashboard/hrm/hr/events/*`
- **Current Features**: Workspace events tracking (meetings, celebrations). Shows details such as time, online/offline location, RSVP counts, max attendees, organizer details, and recurring event rules.
- **Possible Features**: ICS calendar export or direct Google Calendar / Outlook integration. Allow employees to RSVP natively through the dashboard.
- **Errors**: `event.attendeeIds` is used to count attendees statically. If `attendeeIds` is missing or the type structure changes, it could fail. No proper visual fallback handling if the image banner URL fails to load.
- **Enhancement Plan**: Add a calendar view mode to the `/events` list page instead of just a table. Add "Add to Calendar" buttons in the detail view.

---

### Route / Component
`src/app/dashboard/hrm/hr/exits/*`
- **Current Features**: Handles employee offboarding processes. Tracks exit dates, notice periods, clearance status, Full and Final (F&F) settlement amounts, No Objection Certificates (NOC), and asset returns.
- **Possible Features**: Automated exit checklist generation assigned to IT and Finance departments. Alumni network opt-in forms. 
- **Errors**: F&F confirmation actions and NOC marking exist but might lack hard validation ensuring departmental clearance is achieved before F&F processing. Missing React Suspense boundaries for loading states.
- **Enhancement Plan**: Improve workflow visibility by implementing a visual progress stepper tracking the key stages: Resignation -> Clearance -> NOC -> F&F.

---

### Route / Component
`src/app/dashboard/hrm/hr/expense-claims/*`
- **Current Features**: Reimbursement and claims management. Employees can submit an expense claim, log line-items (itemized expenses), state currency, amounts, and managers can approve/reimburse.
- **Possible Features**: OCR integration to automatically parse uploaded receipts. Bulk approval actions. Multi-currency automatic conversion for standardized reporting.
- **Errors**: Use of a `void _zoruCn;` hack as a workaround for linting errors in `expense-claims/new/page.tsx` and `edit/page.tsx`. This should be removed.
- **Enhancement Plan**: Allow uploading multiple itemized receipts for individual line-items instead of a single global receipt for the entire claim.

---

### Route / Component
`src/app/dashboard/hrm/hr/feedback-360/*`
- **Current Features**: Standard 360-degree feedback loop tracking for employees.
- **Possible Features**: Anonymous peer feedback options. Manager summary generation via AI to digest feedback texts quickly.
- **Errors**: Standard implementation without major bugs. 
- **Enhancement Plan**: Implement spider-web/radar charts for 360 feedback visualization to display strengths and weaknesses across different attributes graphically.

---

### Route / Component
`src/app/dashboard/hrm/hr/interviews/*`
- **Current Features**: Interview tracking with details on the candidate, interview round, meeting link, duration, and outcomes (rating, strengths, weaknesses, feedback).
- **Possible Features**: Deep integration with Google Meet / Zoom to auto-generate meeting links. Resume preview alongside interview details. Dynamic Scorecard templates.
- **Errors**: Heavy usage of `any` typing when dealing with API responses (`const i = raw as any;`). This defeats TypeScript's purpose and is error-prone.
- **Enhancement Plan**: Type safety must be strictly enforced by extracting or creating proper `Interview` and `Candidate` interfaces in the types package.

---

### Route / Component
`src/app/dashboard/hrm/hr/jobs/*`
- **Current Features**: Job listing system. Tracks required experience, salary ranges, working modes, publish/close dates, filled openings, responsibilities, and requirements.
- **Possible Features**: Integration with external job boards (LinkedIn, Indeed). Shareable public career pages.
- **Errors**: No sanitization or rich formatting for description/responsibilities rendering which might cause layout shifts if the text is badly formatted (currently uses `<pre>`).
- **Enhancement Plan**: Convert raw text descriptions into a rich text editor (e.g., TipTap or Lexical) for better formatting and display them properly in the detail view.

---

### Route / Component
`src/app/dashboard/hrm/hr/learning-paths/*`
- **Current Features**: Employee training paths, courses, and compliance training assignments.
- **Possible Features**: SCORM integration, quizzing, and automatic certification generation upon path completion.
- **Errors**: None observed. Standard CRUD setup.
- **Enhancement Plan**: Add gamification elements (badges, visual completion rings) for completed paths on the employee dashboard.

---

### Route / Component
`src/app/dashboard/hrm/hr/notices/*`
- **Current Features**: Organization-wide announcements and HR notices.
- **Possible Features**: Acknowledgement tracking (read receipts/signatures for mandatory notices like policy changes).
- **Errors**: Missing specific validation for expiry dates.
- **Enhancement Plan**: Add priority flags (High, Medium, Low) with visual indicators and push notification integration for high-priority notices.

---

### Route / Component
`src/app/dashboard/hrm/hr/offers/*`
- **Current Features**: Job offer tracking and metadata logging.
- **Possible Features**: Integration with document signing APIs (e.g., DocuSign) for seamless signature handling. Auto-generation of offer letter PDFs from dynamic templates.
- **Errors**: None observed.
- **Enhancement Plan**: Include a granular workflow state to track offer negotiation (e.g., "Counter-Offered", "Rescinded").

---

### Route / Component
`src/app/dashboard/hrm/hr/okrs/*`
- **Current Features**: Objectives and Key Results tracking for individuals and departments.
- **Possible Features**: Hierarchical alignment (linking individual OKRs to department OKRs). History tracking of score updates.
- **Errors**: None observed.
- **Enhancement Plan**: Visualization of OKR alignment using a tree or dependency graph view.
