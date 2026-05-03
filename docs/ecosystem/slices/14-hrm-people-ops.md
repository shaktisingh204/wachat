## 14. HRM & People Ops

1. Extend `hrmMenuGroups` with people-ops sections covering payroll, performance, learning, recruitment, benefits, expenses, and engagement under `/dashboard/hrm`.
2. Model multi-tenant `Employee`, `Position`, `Department`, `OrgUnit`, and `EmploymentContract` collections in MongoDB with workspace-scoped indexes and soft-delete fields.
3. Implement country-aware payroll engine supporting US (federal/state), UK (PAYE/NI), India (PF/ESI/TDS), EU (per-country), Singapore (CPF), Australia (PAYG/super) rule packs.
4. Build payroll run workflow with draft, approval, lock, payslip generation, bank file export (NACHA, BACS, SEPA, NEFT) and reversal handling.
5. Persist tax tables, statutory caps, and contribution rates in versioned reference collections refreshed annually with effective-dated rows.
6. Add attendance capture surfaces: web punch, mobile geofence (lat/long radius), Wi-Fi SSID anchor, biometric device webhook, and kiosk QR flow.
7. Build leave policies engine with accrual rules, carry-forward caps, blackout dates, holiday calendars per country, and compensatory-off automation.
8. Implement shift scheduler with templates, rotation patterns, swap requests requiring manager approval, and overtime threshold alerts.
9. Wire SabFlow nodes for `Hrm.OnAttendanceAnomaly`, `Hrm.OnLeaveSubmitted`, `Hrm.OnPayrollLocked`, `Hrm.OnEmployeeJoined`, and `Hrm.OnEmployeeOffboarded`.
10. Create performance module with goal trees (company, team, individual OKRs), check-in cadence, and progress scoring rolled to dashboards.
11. Add continuous feedback widget letting peers, managers, and reports drop kudos or constructive notes attached to goals or competencies.
12. Implement 360-degree review cycles with self, peer, upward, and skip-level forms, anonymized aggregation, and configurable weighting.
13. Build calibration sessions where committees adjust ratings on a 9-box grid with audit trail and lock once HR approves.
14. Develop LMS module storing courses, SCORM/xAPI packages, video lessons, quizzes, and certifications with passing-score gates.
15. Auto-assign compliance training (POSH, GDPR, HIPAA, anti-bribery, SOC2) on hire and on policy version bump with overdue escalation.
16. Track learner progress, time-on-task, quiz attempts, certificate issuance, and export to LinkedIn Learning or Coursera via OAuth.
17. Author onboarding journey templates that trigger SabFlow checklists: offer signature, BGV, equipment, accounts, buddy assignment, day-1 agenda.
18. Author offboarding journey covering exit interview, knowledge transfer, asset return, access revocation across SabNode modules, and final settlement.
19. Implement document vault with offer letters, contracts, ID proofs (passport, visa, I-9, Aadhaar), encryption at rest, retention policy, and DSR export.
20. Build benefits administration: plan catalog (medical, dental, vision, 401k/PF/superannuation), open enrollment windows, dependent management, and carrier file feeds.
21. Add expense management with receipt upload, OCR extraction (vendor, amount, currency, tax), policy validation, multi-level approval, and reimbursement via payroll or AP.
22. Build mileage tracker using Google Maps distance API and per-country reimbursement rates with auditable trip logs.
23. Connect time-tracking entries (project, task, billable flag) to payroll for hourly employees and to client invoicing in the CRM module.
24. Develop ATS with job requisitions, approval chains, multi-board posting (LinkedIn, Indeed, Naukri, Seek), and branded careers microsite.
25. Implement candidate sourcing tools: resume parsing, talent pool tags, AI-ranked matches against requisition skills, and outreach templates.
26. Build interview kits with structured scorecards, competency rubrics, panel scheduling via calendar OAuth, and recorded video screens.
27. Add candidate-to-employee conversion that auto-provisions records, contracts, and onboarding journeys without re-keying data.
28. Render employee directory with filters (department, location, skills) and dynamic org chart using a tree layout with drag-to-reorg drafts.
29. Build engagement surveys with eNPS, pulse cadence, anonymity guarantees, segment heatmaps, and driver analysis using regression on response data.
30. Create succession planning board mapping critical roles, ready-now/ready-later successors, risk-of-loss flags, and development plans.
31. Launch anonymous reporting hotline with encrypted intake, case management, investigator assignments, retaliation protection notes, and SLA tracking.
32. Generate compliance docs on demand: I-9 verification, EEO-1 report, GDPR Article 30 records, DPIA templates, and DSAR fulfillment exports.
33. Add RBAC roles `hrm.admin`, `hrm.manager`, `hrm.recruiter`, `hrm.payroll`, `hrm.employee` enforced on every API route via existing guard middleware.
34. Implement plan gating so payroll, ATS, LMS, and benefits unlock per pricing tier surfaced through the existing entitlement service.
35. Meter HRM credits for payslip generation, BGV checks, OCR scans, AI matches, and SMS reminders against the workspace credit ledger.
36. Cache org chart, directory, and policy lookups with `cacheTag('hrm:workspace:{id}')` and invalidate on writes via `updateTag`.
37. Persist long-running payroll runs and onboarding journeys as Vercel Workflow durable tasks with retry, pause, and resume semantics.
38. Push payroll variance, attendance anomaly, and license-expiry alerts to the unified notification hub with manager and HR routing rules.
39. Expose REST and GraphQL endpoints under `/api/hrm/*` with OpenAPI schema published to the developer platform for partner integrations.
40. Sync employee data bidirectionally with Slack, Microsoft Teams, Google Workspace, Okta, Azure AD, and BambooHR via SCIM and webhooks.
41. Add AI assistant tab that answers `how much PTO do I have`, `who reports to Priya`, `start my onboarding` using workspace-scoped retrieval.
42. Build mobile-friendly self-service for punch, leave apply, payslip download, expense claim, and survey response under existing PWA shell.
43. Render manager dashboards summarizing team attendance, pending approvals, performance debt, attrition risk, and headcount-vs-plan deltas.
44. Render exec dashboards with cost-per-hire, time-to-fill, attrition by cohort, payroll spend trend, training ROI, and DEI metrics.
45. Implement audit log capturing every read of sensitive PII (salary, SSN, medical) with reason codes for SOC2 and ISO27001 evidence.
46. Add anomaly detection on payroll runs flagging > 15% MoM variance per employee, missing tax deductions, and orphaned earnings codes.
47. Provide CSV/Excel import wizards for bulk hires, salary revisions, attendance backfill, and asset assignments with validation preview.
48. Schedule cron jobs for payroll cutoff reminders, probation expiry, contract renewal, certification expiry, and birthday/anniversary nudges.
49. Localize UI strings, date formats, currency, and statutory labels per workspace locale using existing i18n harness with country fallback.
50. Ship Playwright E2E suites covering payroll run, leave approval, onboarding, ATS hire-to-onboard, expense reimbursement, and offboarding paths.
