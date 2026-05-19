# SabNode — CRM + HRM Master Plan
**Version:** 1.0 · **Date:** 2026-05-19 · **Author:** Engineering Team

> Step-by-step, exhaustive roadmap covering every completed feature, every open
> gap, every planned enhancement, and the full ecosystem vision for the CRM and
> HRM product lines inside SabNode.

---

## Table of Contents

1. [Project State Snapshot](#1-project-state-snapshot)
2. [CRM — Module Inventory](#2-crm--module-inventory)
3. [HRM — Module Inventory](#3-hrm--module-inventory)
4. [What Is Done](#4-what-is-done)
5. [What Remains (Short-term)](#5-what-remains-short-term)
6. [Phase 2 — Feature Completions](#6-phase-2--feature-completions)
7. [Phase 3 — Advanced Features & AI](#7-phase-3--advanced-features--ai)
8. [Phase 4 — Ecosystem & Integrations](#8-phase-4--ecosystem--integrations)
9. [Phase 5 — Mobile & Offline](#9-phase-5--mobile--offline)
10. [Infrastructure & Platform](#10-infrastructure--platform)
11. [Rust BFF Layer Roadmap](#11-rust-bff-layer-roadmap)
12. [UI/UX System Evolution](#12-uiux-system-evolution)
13. [Data Model Enhancements](#13-data-model-enhancements)
14. [Security & Compliance](#14-security--compliance)
15. [Testing Strategy](#15-testing-strategy)
16. [Observability & Monitoring](#16-observability--monitoring)
17. [Releases & Milestones](#17-releases--milestones)
18. [Appendix — All Rust Crates](#18-appendix--all-rust-crates)

---

## 1. Project State Snapshot

### Architecture (as of 2026-05-19)

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 16 App Router, ZoruUI, TailwindCSS | Production |
| API layer | Next.js Server Actions + Route Handlers | Production |
| Rust BFF | Axum 0.8 crates, dual-impl via `USE_RUST_CRM` flag | ~40% coverage |
| Database | MongoDB Atlas (primary), Redis (cache/sessions) | Production |
| Auth | Firebase Auth + httpOnly session cookies | Production |
| File storage | Cloudflare R2 via SabFiles | Production |
| Deployment | Vercel Fluid Compute, Node.js 24 | Production |
| Workflows | SabFlow engine (Rust + Node.js SSE bridge) | Beta |

### Rust Crate Count

- **Total CRM crates:** ~96 (fully catalogued below)
- **Total non-CRM crates:** ~70 (Wachat, Telegram, SEO, Auth, SabFlow, etc.)
- **Dual-impl wired (USE_RUST_CRM):** 7 action files live, 40 pending

### Key Commits Done This Sprint

| Commit | Description |
|---|---|
| `777ec95d3` | GrnStatus widened: 4 → 8 variants, `snake_case` serde |
| `9cb0c2bc7` | Full cargo +stable check clean — 0 errors across workspace |
| `1f249a9cd` | QR + URL Shortener: Rust DTOs, analytics, Vercel Cron hooks |
| `34562afa0` | EntityListShell migration: CrmModuleOverview + HrEntityPage |
| `ff6362263` | W7 CrmPageHeader sweep — inventory, tickets, banking, misc |
| `520f05e91` | URL shortener bio builder + QR campaigns + webhooks settings |

---

## 2. CRM — Module Inventory

### 2.1 Sales Module (`/crm/sales`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Dashboard | `/sales` | — | ✅ Done |
| Clients | `/sales/clients` | crm-contacts | ✅ Done |
| Contacts | `/sales/contacts` | crm-contacts | ✅ Done |
| Pipelines | `/sales/pipelines` | crm-pipelines | ✅ Done |
| Deals | `/sales/deals` | crm-deals | ✅ Done |
| Leads | `/sales/leads` | crm-auto-leads | ✅ Done |
| Quotations | `/sales/quotations` | crm-quotations | ✅ Done |
| Orders | `/sales/orders` | crm-sales-orders | ✅ Done |
| Invoices | `/sales/invoices` | crm-sales-types | ✅ Done |
| Recurring Invoices | `/sales/recurring-invoices` | crm-recurring-invoices | ✅ Done |
| Payments | `/sales/payments` | crm-payment-receipts | ✅ Done |
| Credit Notes | `/sales/credit-notes` | crm-credit-notes | ✅ Done |
| Delivery | `/sales/delivery` | crm-delivery-challans | ✅ Done |
| Proforma | `/sales/proforma` | crm-proforma-invoices | ✅ Done |
| Proposals | `/sales/proposals` | crm-proposals | ✅ Done |
| Subscriptions | `/sales/subscriptions` | crm-subscriptions | ✅ Done |
| Gift Cards | `/sales/gift-cards` | crm-gift-cards | ✅ Done |
| Coupons | `/sales/coupons` | crm-coupons | ✅ Done |
| Loyalty | `/sales/loyalty` | — | 🔶 Stub |
| Estimate Requests | `/sales/estimate-requests` | crm-estimate-requests | ✅ Done |
| Forms | `/sales/forms` | crm-forms | ✅ Done |
| Contracts | `/sales/contracts` | crm-contracts | ✅ Done |
| Promotions | `/sales/promotions` | — | 🔶 Stub |

### 2.2 Purchases Module (`/crm/purchases`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Dashboard | `/purchases` | — | ✅ Done |
| Vendors | `/purchases/vendors` | crm-vendors | ✅ Done |
| Leads | `/purchases/leads` | crm-purchase-leads | ✅ Done |
| RFQs | `/purchases/rfqs` | crm-rfqs | ✅ Done |
| Vendor Bids | `/purchases/vendor-bids` | crm-vendor-bids | ✅ Done |
| Orders | `/purchases/orders` | crm-purchase-orders | 🔶 Dual-impl pending |
| Goods Receipts (GRN) | `/inventory/grn` | crm-grns | ✅ Done |
| Expenses | `/purchases/expenses` | crm-expense-claims | ✅ Done |
| Recurring Expenses | `/purchases/recurring-expenses` | — | 🔶 Stub |
| Payouts | `/purchases/payouts` | crm-payouts | 🔶 Dual-impl pending |
| Debit Notes | `/purchases/debit-notes` | crm-debit-notes | 🔶 Dual-impl pending |
| Hire | `/purchases/hire` | crm-hire | ✅ Done |

### 2.3 Inventory Module (`/crm/inventory`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Dashboard | `/inventory` | — | ✅ Done |
| Items / Products | `/inventory/items` | crm-products | ✅ Done |
| Warehouses | `/inventory/warehouses` | crm-warehouses | 🔶 Dual-impl pending |
| GRN (Goods Receipt) | `/inventory/grn` | crm-grns | ✅ Done |
| Stock Adjustments | `/inventory/adjustments` | crm-stock-adjustments | ✅ Done |
| Stock Transfers | `/inventory/stock-transfers` | — | 🔶 Stub |
| Production Orders | `/inventory/production-orders` | crm-production-orders | ✅ Done |
| BOM (Bill of Materials) | `/inventory/bom` | crm-bom | ✅ Done |
| Batch & Expiry | `/inventory/batch-expiry` | — | 🔶 Stub |
| Stock Value | `/inventory/stock-value` | — | 🔶 Stub |
| PnL | `/inventory/pnl` | — | 🔶 Stub |
| All Transactions | `/inventory/all-transactions` | — | 🔶 Stub |
| Party Transactions | `/inventory/party-transactions` | — | 🔶 Stub |
| Purchase Orders | `/inventory/purchase-orders` | crm-purchase-orders | 🔶 Dual-impl pending |

### 2.4 Accounting Module (`/crm/accounting`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Dashboard | `/accounting` | — | ✅ Done |
| Chart of Accounts | `/accounting/groups` | crm-chart-of-accounts | ✅ Done |
| Vouchers | `/accounting/vouchers` | crm-vouchers | ✅ Done |
| Day Book | `/accounting/day-book` | — | 🔶 Stub |
| Trial Balance | `/accounting/trial-balance` | — | 🔶 Stub |
| Income Statement | `/accounting/income-statement` | — | 🔶 Stub |
| Balance Sheet | `/accounting/balance-sheet` | — | 🔶 Stub |
| Cash Flow | `/accounting/cash-flow` | — | 🔶 Stub |
| PnL | `/accounting/pnl` | — | 🔶 Stub |
| Charts | `/accounting/charts` | — | 🔶 Stub |

### 2.5 Banking Module (`/crm/banking`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Bank Accounts | `/banking` | crm-accounts | ✅ Done |
| Transactions | `/banking` | crm-bank-transactions | ✅ Done |
| Reconciliation | `/banking/reconciliation` | crm-reconciliation | ✅ Done |
| Petty Cash | `/crm/petty-cash` | crm-petty-cash | ✅ Done |

### 2.6 HR Module (`/crm/hr`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Directory | `/hr/directory` | crm-employees | ✅ Done |
| Org Chart | `/hr/org-chart` | — | ✅ Done |
| Departments | `/hr/departments` | crm-departments | ✅ Done |
| Designations | `/hr/designations` | crm-designations | ✅ Done |
| Employees | `/hr/employees` | crm-employees | ✅ Done |
| Announcements | `/hr/announcements` | crm-announcements | ✅ Done |
| Policies | `/hr/policies` | crm-policies | ✅ Done |
| Documents | `/hr/documents` | crm-documents | ✅ Done |
| Document Templates | `/hr/document-templates` | crm-document-templates | ✅ Done |
| Onboarding | `/hr/onboarding` | crm-onboarding | ✅ Done |
| Welcome Kit | `/hr/welcome-kit` | — | ✅ Done |
| Exits | `/hr/exits` | crm-exits | ✅ Done |
| Assets | `/hr/assets` | crm-assets | ✅ Done |
| Asset Assignments | `/hr/asset-assignments` | crm-asset-assignments | ✅ Done |
| Training | `/hr/training` | crm-training | ✅ Done |
| Learning Paths | `/hr/learning-paths` | — | ✅ Done |
| Certifications | `/hr/certifications` | crm-certifications | ✅ Done |
| Careers Page | `/hr/careers-page` | — | ✅ Done |
| Candidates | `/hr/candidates` | crm-candidates | ✅ Done |
| Jobs | `/hr/jobs` | — | ✅ Done |
| Offers | `/hr/offers` | crm-offers | ✅ Done |
| Interviews | `/hr/interviews` | — | ✅ Done |
| Timesheets | `/hr/timesheets` | — | ✅ Done |
| OKRs | `/hr/okrs` | crm-okrs | ✅ Done |
| Goals | `/hr/goal-setting` | crm-goals | ✅ Done |
| Feedback 360 | `/hr/feedback-360` | crm-feedback-360 | ✅ Done |
| Appraisal Reviews | `/hr/appraisal-reviews` | crm-appraisals | ✅ Done |
| KPI Tracking | `/hr/kpi-tracking` | — | ✅ Done |
| Surveys | `/hr/surveys` | crm-surveys | ✅ Done |
| One-on-Ones | `/hr/one-on-ones` | crm-one-on-ones | ✅ Done |
| Recognition | `/hr/recognition` | crm-recognitions | ✅ Done |
| Disciplinary | `/hr/disciplinary` | crm-disciplinary | ✅ Done |
| Probation | `/hr/probation` | crm-probation | ✅ Done |
| Succession | `/hr/succession` | crm-succession | ✅ Done |
| Compensation Bands | `/hr/compensation-bands` | crm-compensation-bands | ✅ Done |
| Travel | `/hr/travel` | crm-travel | ✅ Done |
| Expense Claims | `/hr/expense-claims` | crm-expense-claims | ✅ Done |

### 2.7 HR Payroll Module (`/crm/hr-payroll`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Dashboard | `/hr-payroll` | — | ✅ Done |
| Attendance | `/hr-payroll/attendance` | crm-attendance | ✅ Done |
| Leaves | `/hr-payroll/leave` | — | ✅ Done |
| Shifts | `/hr-payroll/shifts` | crm-shifts | ✅ Done |
| Shift Rotations | `/hr-payroll/shift-rotations` | crm-shift-rotations | ✅ Done |
| Shift Change Requests | `/hr-payroll/shift-change-requests` | crm-shift-change-requests | ✅ Done |
| Holidays | `/hr-payroll/holidays` | crm-holidays | ✅ Done |
| Salary Structure | `/hr-payroll/salary-structure` | crm-salary-structures | ✅ Done |
| Payroll | `/hr-payroll/payroll` | crm-payroll-runs | 🔶 Dual-impl pending |
| Payslips | `/hr-payroll/payslips` | crm-payslips | ✅ Done |
| Form 16 | `/hr-payroll/form-16` | crm-form-16 | ✅ Done |
| PF/ESI | `/hr-payroll/pf-esi` | crm-pf-esi | ✅ Done |
| TDS | `/hr-payroll/tds` | crm-tds | ✅ Done |
| Professional Tax | `/hr-payroll/professional-tax` | crm-professional-tax | ✅ Done |
| Reports | `/hr-payroll/reports` | — | ✅ Done |

### 2.8 Projects Module (`/crm/projects`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Projects List | `/projects` | — | ✅ Done |
| Project Detail | `/projects/[projectId]` | — | ✅ Done |
| Kanban Board | `/projects/kanban` | crm-tasks | ✅ Done |
| Gantt Chart | `/projects/gantt` | — | 🔶 Stub |
| Issues | `/projects/issues` | — | ✅ Done |
| Milestones | `/projects/milestones` | — | ✅ Done |
| Subtasks | `/projects/subtasks` | crm-subtasks | ✅ Done |
| Task Categories | `/projects/task-categories` | crm-task-categories | ✅ Done |
| Task Labels | `/projects/task-labels` | crm-task-labels | ✅ Done |
| Task Tags | `/projects/task-tags` | crm-task-tags | ✅ Done |
| Taskboard Columns | `/projects/taskboard-columns` | crm-taskboard-columns | ✅ Done |
| Activity | `/projects/activity` | — | ✅ Done |
| Categories | `/projects/categories` | crm-project-categories | ✅ Done |
| Project Tasks | sub-module | crm-project-tasks | ✅ Done |

### 2.9 Tickets Module (`/crm/tickets`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| Tickets List | `/tickets` | crm-tickets | ✅ Done |
| Ticket Detail | `/tickets/[id]` | crm-tickets | ✅ Done |
| Ticket Channels | `/tickets/channels` | crm-ticket-channels | ✅ Done |
| Ticket Groups | `/tickets/groups` | crm-ticket-groups | ✅ Done |
| Ticket Types | `/tickets/types` | crm-ticket-types | ✅ Done |
| Ticket Tags | `/tickets/tags` | crm-ticket-tags | ✅ Done |
| SLAs | `/tickets/slas` | crm-slas | ✅ Done |
| Reply Templates | `/tickets/reply-templates` | crm-reply-templates | ✅ Done |
| Agent Groups | `/tickets/agent-groups` | crm-agent-groups | ✅ Done |

### 2.10 Sales CRM Module (`/crm/sales-crm`)

| Sub-module | Route | Rust Crate | Status |
|---|---|---|---|
| CRM Dashboard | `/sales-crm` | — | ✅ Done |
| Contacts | `/sales-crm/contacts` | crm-contacts | ✅ Done |
| Leads | `/sales-crm/leads` | crm-auto-leads | ✅ Done |
| Deals | `/sales-crm/deals` | crm-deals | ✅ Done |
| Pipelines | `/sales-crm/pipelines` | crm-pipelines | ✅ Done |
| Activities | `/sales-crm/activities` | — | ✅ Done |
| Email Templates | `/sales-crm/email-templates` | crm-email-templates | ✅ Done |
| Form Submissions | `/sales-crm/submissions` | crm-form-submissions | ✅ Done |
| Automations | `/crm/automations` | crm-automations | ✅ Done |
| Conversions | `/crm/conversions` | crm-conversions | ✅ Done |

### 2.11 Reports Module (`/crm/reports`)

| Report | Rust Crate | Status |
|---|---|---|
| Sales Summary | crm-reports-types | ✅ Done |
| Purchase Summary | crm-reports-types | ✅ Done |
| Inventory Reports | crm-reports-types | ✅ Done |
| HR Reports | crm-reports-types | ✅ Done |
| Payroll Reports | crm-reports-types | ✅ Done |
| Finance Reports | crm-reports-types | ✅ Done |
| Custom Reports | — | 🔶 Planned |

### 2.12 Settings Module (`/crm/settings`)

| Setting Area | Rust Crate | Status |
|---|---|---|
| Company Profile | crm-company-profile | ✅ Done |
| Roles & Permissions | crm-roles | ✅ Done |
| Currencies | crm-currencies | ✅ Done |
| Taxes | crm-taxes | ✅ Done |
| Units | crm-units | ✅ Done |
| Brands | crm-brands | ✅ Done |
| Product Categories | crm-product-categories | ✅ Done |
| Account Groups | crm-account-groups | ✅ Done |
| Banking Types | crm-banking-types | ✅ Done |
| Accounting Types | crm-accounting-types | ✅ Done |
| Vendor Types | crm-vendor-types | ✅ Done |
| Sales Types | crm-sales-types | ✅ Done |
| Purchases Types | crm-purchases-types | ✅ Done |
| Expense Categories | crm-expense-categories | ✅ Done |
| Payment Accounts | crm-payment-accounts | ✅ Done |
| Tags | crm-tags | ✅ Done |
| Custom Fields | crm-custom-fields | ✅ Done |
| Saved Views | crm-saved-views | ✅ Done |
| Portal Users | crm-portal-users | ✅ Done |
| Project Categories | crm-project-categories | ✅ Done |

### 2.13 Additional CRM Modules

| Module | Route | Rust Crate | Status |
|---|---|---|---|
| POS | `/crm/pos` | crm-pos | 🔶 Dual-impl pending |
| Store | `/crm/store` | crm-store | 🔶 Dual-impl pending |
| Bookings | `/crm/bookings` | crm-bookings | ✅ Done |
| Budgets | `/crm/budgets` | crm-budgets | ✅ Done |
| Loans | `/crm/loans` | — | 🔶 Stub |
| Fixed Assets | `/crm/fixed-assets` | crm-fixed-assets | ✅ Done |
| Events | `/crm/events` | crm-events | ✅ Done |
| Dashboards | `/crm/dashboards` | crm-dashboards | ✅ Done |
| Analytics | `/crm/analytics` | — | 🔶 Stub |
| Audit Log | `/crm/audit-log` | — | ✅ Done |
| Import/Export | `/crm/import-export` | — | ✅ Done |
| Mentions | `/crm/mentions` | — | ✅ Done |
| Time Tracking | `/crm/time-tracking` | crm-time-logs | ✅ Done |
| Tasks (global) | `/crm/tasks` | crm-tasks | ✅ Done |
| Auto Leads Setup | `/crm/auto-leads-setup` | — | ✅ Done |
| Service Contracts | `/crm/service-contracts` | crm-service-contracts | ✅ Done |
| Tax | `/crm/tax` | crm-taxes | ✅ Done |
| Integrations | `/crm/integrations` | — | 🔶 Stub |
| Portal | `/crm/portal` | crm-portal-users | ✅ Done |

---

## 3. HRM — Module Inventory

> HRM runs as a sub-system of the CRM under `/crm/hr` and `/crm/hr-payroll`. A
> standalone `/hrm` namespace is planned for Phase 4. Rust type crates in
> `hrm-people-types` and `hrm-payroll-types` serve both namespaces.

### 3.1 People Management

| Feature | Status | Notes |
|---|---|---|
| Employee master | ✅ Done | Full CRUD, photo upload via SabFiles |
| Department hierarchy | ✅ Done | Nested department tree |
| Designation ladder | ✅ Done | Pay-grade linked |
| Org chart | ✅ Done | Interactive D3 tree |
| Directory search | ✅ Done | Full-text by name / dept / skill |
| Employee self-service portal | 🔶 Planned | Phase 2 |
| Emergency contacts | 🔶 Planned | Phase 2 |
| Biometric integration | 🔶 Planned | Phase 4 |

### 3.2 Recruitment & Hiring

| Feature | Status |
|---|---|
| Job postings | ✅ Done |
| Public careers page | ✅ Done |
| Candidate pipeline | ✅ Done |
| Interview scheduling | ✅ Done |
| Offer letters | ✅ Done |
| Background check integration | 🔶 Planned |
| AI resume screening | 🔶 Phase 3 |
| Referral program | 🔶 Phase 3 |

### 3.3 Time & Attendance

| Feature | Status |
|---|---|
| Daily attendance log | ✅ Done |
| Shift scheduling | ✅ Done |
| Shift rotation | ✅ Done |
| Shift change requests | ✅ Done |
| Holidays calendar | ✅ Done |
| Overtime tracking | 🔶 Phase 2 |
| Geo-fenced clock-in (mobile) | 🔶 Phase 5 |
| Biometric device sync | 🔶 Phase 4 |
| Timesheets | ✅ Done |
| Timesheet approval workflow | 🔶 Phase 2 |

### 3.4 Leave Management

| Feature | Status |
|---|---|
| Leave types (CL, SL, EL, etc.) | ✅ Done |
| Leave balance tracking | ✅ Done |
| Leave application & approval | ✅ Done |
| Leave encashment | 🔶 Phase 2 |
| Comp-off management | 🔶 Phase 2 |
| Leave carry-forward rules | 🔶 Phase 2 |
| Holiday-aware leave count | 🔶 Phase 2 |

### 3.5 Payroll

| Feature | Status |
|---|---|
| Salary structure templates | ✅ Done |
| Payroll run | ✅ Done (Rust crate exists) |
| Payslip generation | ✅ Done |
| Form 16 | ✅ Done |
| TDS computation | ✅ Done |
| PF/ESI | ✅ Done |
| Professional tax (state slabs) | ✅ Done |
| Loan deductions | 🔶 Phase 2 |
| Salary revision history | 🔶 Phase 2 |
| Multi-currency payroll | 🔶 Phase 3 |
| Bank payment file export (NEFT) | 🔶 Phase 2 |

### 3.6 Performance Management

| Feature | Status |
|---|---|
| OKR framework | ✅ Done |
| Goal setting | ✅ Done |
| KPI tracking | ✅ Done |
| Appraisal cycles | ✅ Done |
| 360 feedback | ✅ Done |
| One-on-one meetings | ✅ Done |
| Performance improvement plan (PIP) | 🔶 Phase 2 |
| Calibration sessions | 🔶 Phase 3 |
| Succession planning | ✅ Done |

### 3.7 Learning & Development

| Feature | Status |
|---|---|
| Training programs | ✅ Done |
| Learning paths | ✅ Done |
| Certifications tracking | ✅ Done |
| E-learning integration (SCORM) | 🔶 Phase 3 |
| Skills inventory | 🔶 Phase 2 |
| Training effectiveness metrics | 🔶 Phase 3 |

### 3.8 Employee Engagement

| Feature | Status |
|---|---|
| Recognition & awards | ✅ Done |
| Surveys | ✅ Done |
| Announcements | ✅ Done |
| Disciplinary actions | ✅ Done |
| Grievance management | 🔶 Phase 2 |
| Employee NPS | 🔶 Phase 3 |
| Pulse surveys | 🔶 Phase 3 |

---

## 4. What Is Done

### 4.1 Infrastructure Milestones ✅

- [x] **W1–W6**: All CRM pages migrated to ZoruUI component library
- [x] **W7–W8**: All 620+ `CrmPageHeader` usages replaced with `EntityListShell` / `EntityDetailShell` — 0 usages remain
- [x] **§1E**: All `ZoruSelect` replaced with `EnumFormField` / `EnumFilterField` — sweeps complete across all CRM modules
- [x] **96 Rust crates** built and passing `cargo +stable check` clean
- [x] **Dual-impl pattern** (`USE_RUST_CRM`) established and working for first 7 action files
- [x] **GrnStatus** widened to 8 variants with `snake_case` serde (matching TS enum)
- [x] **SabFlow marketplace** — 200+ workflow templates seeded
- [x] **Vercel Cron** hooks for URL health (6h), link scheduler (15min), QR scan notify (5min)

### 4.2 CRM Modules Fully Functional ✅

Sales: clients, contacts, pipelines, deals, leads, quotations, orders, invoices, recurring invoices, payments, credit notes, delivery challans, proforma, proposals, subscriptions, gift cards, coupons, contracts, estimate requests, forms

Purchases: vendors, leads, RFQs, vendor bids, expenses, payouts, debit notes

Inventory: items, GRN, stock adjustments, production orders, BOM, warehouses

Accounting: chart of accounts, vouchers, reconciliation, petty cash

Banking: bank accounts, transactions, reconciliation

HR: employees, departments, designations, org chart, announcements, policies, documents, onboarding, exits, assets, training, certifications, careers page, candidates, jobs, offers, interviews, OKRs, goals, appraisals, 360 feedback, surveys, recognition, disciplinary, probation, succession, compensation bands, travel, expense claims

Payroll: attendance, leave, shifts, salary structure, payroll runs, payslips, Form 16, PF/ESI, TDS, professional tax

Projects: project list, kanban, subtasks, milestones, task categories/labels/tags, activity

Tickets: tickets, channels, groups, types, tags, SLAs, reply templates, agent groups

---

## 5. What Remains (Short-term)

### 5.1 P3 Dual-Impl — 7 Action Files (Sprint in progress)

**Agent ae8a9101c384dffe2 is running this now.** Target files:

| Action File | Rust Crate | Status |
|---|---|---|
| `crm-debit-notes.actions.ts` | crm-debit-notes | In progress |
| `crm-payouts.actions.ts` | crm-payouts | In progress |
| `crm-payroll-runs.actions.ts` | crm-payroll-runs | In progress |
| `crm-pos.actions.ts` | crm-pos | In progress |
| `crm-purchase-orders.actions.ts` | crm-purchase-orders | In progress |
| `crm-store.actions.ts` | crm-store | In progress |
| `crm-warehouses.actions.ts` | crm-warehouses | In progress |

**After agent completes:** commit output, verify TypeScript compiles, flip `USE_RUST_CRM=true` in local `.env`.

### 5.2 P4 — Remaining 40 Mongo-Only Action Files

These files exist as TypeScript-only actions with no Rust crate counterpart yet. Each needs:

**Step 1** — Build Rust crate with `store.rs` + `dto.rs` + `handler.rs`
**Step 2** — Register route in `rust/src/routes/crm_*.rs`
**Step 3** — Add `USE_RUST_CRM` dual-impl to the TS action file

Priority order (by traffic / complexity):

1. `crm-contacts` — highest read volume, critical for pipeline/deals
2. `crm-deals` — core sales pipeline
3. `crm-tasks` — used in projects + global tasks
4. `crm-employees` — large record set, many joins
5. `crm-payslips` — payroll reporting critical path
6. `crm-products` — inventory read-heavy
7. `crm-invoices` — finance reporting
8. `crm-vouchers` — accounting audit trail
9. `crm-tickets` — customer support SLA-critical
10. `crm-attendance` — payroll dependency
11. `crm-proposals` — sales document generation
12. `crm-quotations` — sales pipeline
13. `crm-subscriptions` — recurring billing
14. `crm-contracts` — legal document store
15. `crm-salary-structures` — payroll dependency
16. (remaining 25 in order of module complexity)

### 5.3 Stub Pages That Need Full Implementation

The following routes exist as `page.tsx` shells with no real content:

| Route | What's needed |
|---|---|
| `/crm/analytics` | Full analytics dashboard — charts, KPIs, funnels |
| `/crm/integrations` | OAuth flows for Zapier, Make, Slack, G Suite |
| `/crm/loans` | Loan tracking, EMI schedule, deduction |
| `/crm/store` | E-commerce storefront management |
| `/inventory/stock-transfers` | Inter-warehouse transfer workflow |
| `/inventory/batch-expiry` | Batch tracking + expiry alerts |
| `/inventory/stock-value` | Weighted-average cost valuation report |
| `/inventory/all-transactions` | Ledger of all stock movements |
| `/inventory/party-transactions` | Vendor/customer-wise stock summary |
| `/inventory/pnl` | Inventory P&L by category/SKU |
| `/accounting/day-book` | Day-wise voucher journal |
| `/accounting/trial-balance` | Debit/credit column trial balance |
| `/accounting/income-statement` | P&L statement renderer |
| `/accounting/balance-sheet` | Balance sheet renderer |
| `/accounting/cash-flow` | Cash flow statement |
| `/accounting/pnl` | Accounting P&L view |
| `/sales/loyalty` | Points program management |
| `/sales/promotions` | Promo rule builder |
| `/projects/gantt` | Interactive Gantt chart |

### 5.4 § 1C — Observability Hardening (Deferred)

- Add structured logging (tracing) to all 96 Rust crates
- Ship Grafana dashboard: request latency, error rate per crate
- Add OpenTelemetry spans on MongoDB queries in `crm-db` layer
- Sentry integration for Rust panic backtraces

### 5.5 § 1D — Lineage Rail Validation

- Validate `LineageRef[]` chain at create time (PO → GRN → GIN chain)
- Add `lineage_graph` query endpoint to surface document chains in the UI
- Connect lineage breadcrumb in EntityDetailShell `rightRail`

---

## 6. Phase 2 — Feature Completions

> **Timeline:** 8 weeks · **Goal:** Every existing module reaches production-grade completeness.

### Step 1: Financial Reporting Engine (Weeks 1–2)

**Why:** Accounting module stubs need real aggregation pipelines.

Tasks:
- [ ] Build MongoDB aggregation pipeline for Trial Balance (debit-credit per account)
- [ ] Build Income Statement (revenue − expenses by period)
- [ ] Build Balance Sheet (assets = liabilities + equity snapshot)
- [ ] Build Cash Flow (direct method: operating + investing + financing)
- [ ] Build Day Book (chronological voucher journal with running balance)
- [ ] Expose all 5 as Rust handler endpoints with Vercel CDN caching (60s)
- [ ] Build PDF export via `@react-pdf/renderer` for each statement
- [ ] Add date-range picker + comparison period in the UI

### Step 2: Inventory Completions (Week 2–3)

Tasks:
- [ ] Stock Transfers: create transfer document → auto-adjust source & dest warehouse stock
- [ ] Batch & Expiry: FIFO/FEFO policy, expiry alert 30/15/7 days before
- [ ] Stock Valuation: Weighted Average Cost (WAC) calculator + SKU-level PnL
- [ ] Inter-warehouse price consistency rules
- [ ] Negative stock prevention (configurable per warehouse)
- [ ] Low-stock email/webhook alert on threshold breach
- [ ] Stock audit trail (every adjustment linked to actor + reason code)

### Step 3: Payroll Completions (Week 3–4)

Tasks:
- [ ] Loan deduction schedule (flat/reducing balance)
- [ ] Salary revision (increment history, effective date)
- [ ] One-click NEFT payment file export (per-bank format: HDFC, SBI, ICICI)
- [ ] Investment declaration form (80C, 80D, HRA) with auto TDS recalculation
- [ ] Full-and-final settlement calculator
- [ ] Arrears calculation on mid-month revision

### Step 4: Leave Completions (Week 4)

Tasks:
- [ ] Leave carry-forward rules (per leave type, annual reset)
- [ ] Leave encashment at FnF
- [ ] Comp-off: create comp-off credit when overtime approved
- [ ] Leave calendar (team view — who is out on which days)
- [ ] Auto-deduct leave when attendance is 0 and no approved leave
- [ ] Leave balance export to CSV/Excel

### Step 5: Timesheet Approvals (Week 4)

Tasks:
- [ ] Manager approval workflow for timesheets
- [ ] Timesheet reminder notifications (Vercel Cron daily at 9 PM)
- [ ] Billable vs non-billable time tagging per project
- [ ] Project budget burn vs. actuals (hours × rate)

### Step 6: Recruitment Enhancement (Week 5)

Tasks:
- [ ] Background check integration (Authbridge API)
- [ ] Automated candidate scoring rubric
- [ ] Interview feedback forms with weighted scoring
- [ ] Offer letter PDF generator with e-sign placeholder
- [ ] Candidate portal (public-facing status page)

### Step 7: Sales Completions (Week 5–6)

Tasks:
- [ ] Loyalty program: points earn/burn, tier logic (Silver/Gold/Platinum)
- [ ] Promotions rule engine: SKU/category discount, BOGO, minimum cart
- [ ] Sales commission calculator (% of invoice, milestone-based)
- [ ] Sales rep leaderboard
- [ ] Overdue invoice reminder automation (Day 1 / 7 / 15 / 30)
- [ ] Credit limit enforcement on sales orders

### Step 8: POS Completions (Week 6)

Tasks:
- [ ] Barcode scan → add to cart
- [ ] Cash drawer open command (ESC/POS serial)
- [ ] Thermal receipt print (80mm)
- [ ] Split payment (cash + card)
- [ ] Return / refund flow linked to original invoice
- [ ] Daily cash closing report
- [ ] Offline POS mode (IndexedDB queue, sync on reconnect)

### Step 9: Projects Gantt Chart (Week 7)

Tasks:
- [ ] Interactive Gantt using `@dhtmlx/gantt` or open-source `frappe-gantt`
- [ ] Drag-to-resize task bars
- [ ] Dependency arrows (Finish-to-Start, Start-to-Start)
- [ ] Critical path highlight
- [ ] Milestone diamonds
- [ ] Export to PNG/PDF

### Step 10: Grievance & Disciplinary (Week 7–8)

Tasks:
- [ ] Grievance ticket (employee raises → HR reviews → resolution recorded)
- [ ] Disciplinary show-cause notice template
- [ ] Warning letter auto-generation
- [ ] Disciplinary action history timeline on employee profile
- [ ] Appeal workflow (employee → HR → Director)

---

## 7. Phase 3 — Advanced Features & AI

> **Timeline:** 12 weeks after Phase 2 · **Goal:** Differentiated AI-powered workflows.

### Step 11: AI Sales Assistant

Tasks:
- [ ] Deal scoring model (probability-to-close based on activity recency, stage age, engagement)
- [ ] Next-best-action recommendations per deal
- [ ] Email draft generation (Claude Haiku) using deal/contact context
- [ ] Meeting summary auto-generation (post-call notes from audio transcript)
- [ ] Churn prediction for subscriptions (usage signals → risk score)
- [ ] Revenue forecast (ML model on historical close rates)

### Step 12: AI HR Assistant

Tasks:
- [ ] AI resume parser (extract skills, experience, education from PDF)
- [ ] AI job description generator from role/department/level inputs
- [ ] Attrition risk model (tenure, engagement score, manager NPS, pay parity gap)
- [ ] Auto-match candidates to open JDs
- [ ] Performance review draft generation based on KPI data
- [ ] Salary benchmarking (scrape public salary surveys, show pay gap vs market)

### Step 13: Intelligent Inventory

Tasks:
- [ ] Demand forecasting (ARIMA / simple ML on 12-month sales history)
- [ ] Auto-reorder when stock < reorder point
- [ ] Supplier lead-time analysis
- [ ] Slow-moving SKU identification (>90 days no movement)
- [ ] Stockout risk heatmap

### Step 14: Automation Rules Engine

Tasks:
- [ ] Trigger: document state change (invoice paid → auto close deal)
- [ ] Trigger: time-based (3 days after quote → reminder email)
- [ ] Trigger: field value change (deal stage moved to Won → create invoice)
- [ ] Action: send email (template + variable substitution)
- [ ] Action: create task assigned to owner
- [ ] Action: send webhook to SabFlow
- [ ] Action: update field on record
- [ ] Action: send notification (in-app + WhatsApp via SabWa)
- [ ] Condition builder: AND/OR groups with field comparators
- [ ] Rate-limit guardrails (max 10 actions/minute per tenant)

### Step 15: Custom Report Builder

Tasks:
- [ ] Drag-and-drop column selector (pick any field from any module)
- [ ] Grouping + aggregation (SUM, COUNT, AVG, MIN, MAX)
- [ ] Cross-module joins (e.g., Employee + Attendance + Payslip in one report)
- [ ] Saved reports with scheduled email delivery (Vercel Cron)
- [ ] Chart type picker (bar, line, pie, funnel, scatter)
- [ ] Export to CSV, Excel, PDF

### Step 16: Advanced Analytics Dashboard

Tasks:
- [ ] CRM KPI tiles: pipeline value, win rate, avg deal size, sales cycle days
- [ ] HR KPI tiles: headcount, attrition rate, avg tenure, open positions
- [ ] Payroll KPI tiles: total payroll cost, per-department cost, YoY growth
- [ ] Inventory KPI tiles: stock turnover, fill rate, days of supply
- [ ] Time-series charts with drill-down (click bar → open list)
- [ ] Cohort analysis for customer retention
- [ ] Funnel visualization for recruitment pipeline
- [ ] Heat-map calendar for attendance

### Step 17: Document Intelligence

Tasks:
- [ ] Invoice OCR (scan vendor invoice PDF → auto-populate purchase order fields)
- [ ] Contract clause extraction (identify key dates, amounts, parties)
- [ ] Auto-categorize expense receipts from image
- [ ] Smart search across all documents (vector search on MongoDB Atlas)
- [ ] Document expiry tracker with alerts (contracts, certifications, visas)

### Step 18: Calibration & Performance Planning

Tasks:
- [ ] 9-box grid placement (potential vs performance) per review cycle
- [ ] Forced ranking within department
- [ ] Compensation recommendations based on 9-box + market data
- [ ] Succession risk scoring (key-person dependency)
- [ ] High-potential employee fast-track program management

---

## 8. Phase 4 — Ecosystem & Integrations

> **Timeline:** Post Phase 3 · **Goal:** SabNode as the integration hub.

### Step 19: Standalone HRM Namespace

Tasks:
- [ ] Create `/hrm` route namespace (mirrors `/crm/hr` + `/crm/hr-payroll`)
- [ ] HRM-specific sidebar navigation and branding
- [ ] Plan gating: HRM available as standalone subscription without CRM
- [ ] Cross-link: CRM employee record ↔ HRM profile (shared MongoDB document)
- [ ] HRM mobile-first responsive redesign

### Step 20: Employee Self-Service Portal

Tasks:
- [ ] Employee portal at `/portal/hrm` (separate auth, employee JWT)
- [ ] View own payslips, tax documents (Form 16, Form 26AS)
- [ ] Apply for leave, view balance
- [ ] Submit expense claim with receipt upload (SabFiles)
- [ ] View attendance log + request correction
- [ ] View appraisal feedback
- [ ] Download documents issued by HR

### Step 21: Third-Party Integrations

Tasks:

**Accounting:**
- [ ] Tally XML export (sales invoices, purchase bills, vouchers)
- [ ] Zoho Books sync (bidirectional via Zoho Books API)
- [ ] QuickBooks Online (OAuth + webhook sync)

**Payments:**
- [ ] Razorpay: payment link on invoices, auto-reconcile on webhook
- [ ] Stripe: subscription billing integration
- [ ] PayU: Indian payment gateway

**Communication:**
- [ ] Slack: deal won / ticket opened notifications
- [ ] Gmail sync: associate emails to contacts/deals
- [ ] Google Calendar: interview scheduling sync
- [ ] WhatsApp (SabWa): invoice delivery, payment reminders

**HR:**
- [ ] LinkedIn: import candidate profiles
- [ ] Naukri.com: post jobs, import applications
- [ ] IndeedHire API
- [ ] Keka / greytHR migration scripts (import employee data)

**E-commerce:**
- [ ] Shopify: sync orders → CRM sales orders
- [ ] WooCommerce: product catalog sync, order import
- [ ] Amazon MWS: inventory sync (via existing SabFlow template)

**Biometric:**
- [ ] Essl device API (TCP socket reader in SabWa-node)
- [ ] ZKTeco SDK

### Step 22: Customer Portal

Tasks:
- [ ] Public customer portal at `/portal/crm/[token]`
- [ ] View/approve quotations online
- [ ] View and pay invoices (Razorpay integration)
- [ ] Download delivery documents
- [ ] Raise support tickets
- [ ] Track order status
- [ ] White-label branding (custom logo + color per company)

### Step 23: Vendor Portal

Tasks:
- [ ] Vendor login portal at `/portal/vendor/[token]`
- [ ] View and respond to RFQs
- [ ] Submit vendor bids
- [ ] View purchase orders
- [ ] Upload delivery notes and invoices
- [ ] Track payment status

### Step 24: API Developer Platform

Tasks:
- [ ] Public REST API docs (Swagger/OpenAPI auto-generated from Rust handlers)
- [ ] Personal access token management
- [ ] OAuth 2.0 flow for third-party apps
- [ ] Webhook subscriptions (configurable per event)
- [ ] API usage dashboard (calls/day, rate limit status)
- [ ] SDK generation (TypeScript, Python, Go)

---

## 9. Phase 5 — Mobile & Offline

> **Timeline:** Parallel to Phase 4 · **Goal:** Field-usable mobile experience.

### Step 25: Mobile App (React Native / Expo)

Tasks:
- [ ] Shared auth (Firebase token → same backend)
- [ ] Sales module: contacts, deals, calls, notes
- [ ] HR module: attendance clock-in/out (geo-fenced)
- [ ] Leave application
- [ ] Expense claim with camera receipt capture
- [ ] Payslip viewer
- [ ] Push notifications (Expo Push)
- [ ] Offline queue (failed actions retry on reconnect)

### Step 26: Progressive Web App (PWA)

Tasks:
- [ ] Service worker for offline shell caching
- [ ] Background sync for form submissions
- [ ] Install prompt on mobile browser
- [ ] Push notification subscription (Web Push API)

### Step 27: Geo-Fenced Clock-In

Tasks:
- [ ] Admin defines office location (lat/lng + radius)
- [ ] Employee app requests geolocation permission
- [ ] Clock-in only allowed within fence (or with manager override)
- [ ] Selfie capture on clock-in (anti-proxy)
- [ ] Out-of-fence alert to manager

---

## 10. Infrastructure & Platform

### Step 28: Database Optimization

Tasks:
- [ ] Add compound indexes on all hot query paths (see query plan analysis)
- [ ] MongoDB Atlas Search integration for full-text across all modules
- [ ] Atlas Vector Search for document intelligence (Phase 3)
- [ ] Read-replica routing for report queries (avoid write-primary contention)
- [ ] Slow-query alert when >200ms (Vercel Function timeout budget)
- [ ] Archival: move documents older than 3 years to cold-tier Atlas cluster

### Step 29: Caching Layer

Tasks:
- [ ] Upstash Redis integration (Vercel Marketplace)
- [ ] Cache catalogue data (products, accounts, departments) with 5-min TTL
- [ ] Cache user RBAC permissions with 1-min TTL
- [ ] Cache report results with 60s TTL + manual invalidation on write
- [ ] Session store for SabFlow execution state

### Step 30: Background Jobs

Tasks:
- [ ] Vercel Cron: daily payroll email digest
- [ ] Vercel Cron: weekly sales summary email
- [ ] Vercel Cron: monthly leave balance reset (carry-forward logic)
- [ ] Vercel Cron: contract expiry alert (T-30, T-7 days)
- [ ] Vercel Cron: subscription renewal invoice generation
- [ ] SabFlow workflow trigger: on any CRM event (deal stage, invoice created, etc.)
- [ ] Queue: bulk import jobs (CSV → MongoDB batch insert with validation)

### Step 31: Multi-Tenancy Hardening

Tasks:
- [ ] Enforce `tenantId` filter on every MongoDB query (row-level security)
- [ ] Add `tenantId` index to every collection
- [ ] Tenant-isolated S3/R2 bucket prefix (R2: `tenantId/...` prefix)
- [ ] Plan quota enforcement: max employees, max storage, max API calls
- [ ] Tenant data export (GDPR portability — full tenant dump as ZIP)
- [ ] Tenant data deletion (GDPR right-to-erasure — cascade soft-delete)

### Step 32: CI/CD & Release Management

Tasks:
- [ ] GitHub Actions: `cargo check + clippy + test` on every PR
- [ ] GitHub Actions: `tsc --noEmit + eslint + jest` on every PR
- [ ] Vercel Preview Deployment per PR (already works, add check status gate)
- [ ] Vercel Rolling Release: 5% canary → 20% → 100% with automatic rollback on error rate spike
- [ ] Rust binary size tracking (CI artifact — alert if >10MB growth)
- [ ] Bundle size tracking (Next.js — alert if >50KB growth per route)
- [ ] Dependency update automation (Renovate bot)

---

## 11. Rust BFF Layer Roadmap

### 11.1 Current State

| Status | Count |
|---|---|
| Crates with full CRUD (list/get/create/update/delete) | 96 |
| Crates with dual-impl TS wiring (USE_RUST_CRM) | 7 |
| Crates pending TS wiring | 89 |

### 11.2 Priority Queue for TS Wiring

**Tier 1 — High traffic, wire immediately:**
crm-contacts, crm-deals, crm-tasks, crm-employees, crm-products,
crm-payslips, crm-invoices (sales-types), crm-tickets, crm-attendance,
crm-vouchers

**Tier 2 — Medium traffic:**
crm-quotations, crm-proposals, crm-subscriptions, crm-contracts,
crm-salary-structures, crm-assets, crm-timesheets, crm-candidates,
crm-expense-claims, crm-budgets

**Tier 3 — Lower traffic, wire as part of module completions:**
All remaining 69 crates

### 11.3 Rust Crate Architecture Standards

Every CRM crate MUST follow this layout:

```
crates/crm-{module}/
├── src/
│   ├── lib.rs          — re-exports + module registration
│   ├── dto.rs          — ListQuery, CreateInput, UpdateInput + unit tests
│   ├── store.rs        — MongoDB CRUD (find_many, find_one, insert, update, delete)
│   ├── handler.rs      — Axum handlers calling store, returning ApiResult<Json<T>>
│   └── state.rs        — AppState sub-struct (MongoDb handle + config)
└── Cargo.toml
```

**Rules:**
- `dto.rs` must have `#[serde(rename_all = "camelCase")]` on all public structs
- `store.rs` must filter by `userId` + optional `tenantId` on every query
- `handler.rs` must call `rbac::check_permission()` before any mutation
- Every crate must export a `pub fn router() -> Router<AppState>` function
- All `enum` types use `#[serde(rename_all = "snake_case")]`
- `ListQuery` always has `page: Option<u32>`, `limit: Option<u32>`, `q: Option<String>`

### 11.4 Crates To Build (Net-New)

| Crate Needed | Module | Priority |
|---|---|---|
| crm-stock-transfers | Inventory | P1 |
| crm-batch-expiry | Inventory | P1 |
| crm-stock-valuation | Inventory | P2 |
| crm-loyalty | Sales | P2 |
| crm-promotions | Sales | P2 |
| crm-commissions | Sales | P2 |
| crm-grievances | HR | P2 |
| crm-loan-schedules | Payroll | P2 |
| crm-salary-revisions | Payroll | P2 |
| crm-comp-offs | Leave | P2 |
| crm-portal-sessions | Portal | P3 |
| crm-vendor-portal | Portal | P3 |
| crm-api-keys | Developer | P3 |
| crm-webhooks | Developer | P3 |

---

## 12. UI/UX System Evolution

### 12.1 EntityShell Completion

- [ ] `EntityDetailShell` right-rail: activity feed component (done for some, not all)
- [ ] `EntityDetailShell` audit section: standardize `createdAt/updatedAt/createdBy` display
- [ ] `EntityListShell` bulk action bar: generalize (currently per-module)
- [ ] `EntityListShell` view switcher: Table / Kanban / Calendar modes
- [ ] `EntityListShell` saved-view persistence: save column order + filters to MongoDB
- [ ] `EntityDetailShell` keyboard shortcuts: `e` to edit, `Esc` to go back, `d` to delete

### 12.2 Form System

- [ ] `EnumFormField` coverage: audit all forms — ensure no raw `<select>` elements remain
- [ ] `EnumFilterField` coverage: audit all list filters
- [ ] `CrmRichTextEditor` standardization: ensure all text-area fields use the same editor
- [ ] Multi-step form stepper component (used in POS, recruitment, payroll run)
- [ ] Autosave drafts (localStorage → show "resume draft" banner on re-open)
- [ ] Required field validation inline (not just on submit)
- [ ] Field dependency rules (show field B only when field A == value X)

### 12.3 Data Table

- [ ] Column resize persistence (localStorage)
- [ ] Column visibility toggle (per-user setting in MongoDB)
- [ ] Infinite scroll option (alternative to pagination for smaller datasets)
- [ ] Row-level context menu (right-click → edit, duplicate, delete)
- [ ] Frozen first column on horizontal scroll
- [ ] Export selected rows vs. all rows

### 12.4 Mobile Responsive

- [ ] All list pages: card layout on < 768px (currently table breaks)
- [ ] All detail pages: stacked layout on < 768px
- [ ] All modals: full-screen bottom sheet on mobile
- [ ] Bottom navigation bar on mobile for primary modules

### 12.5 Theming

- [ ] Dark mode support (ZoruUI dark tokens — CSS variables only, no class toggling)
- [ ] Per-tenant primary color override (brand color in company settings)
- [ ] High-contrast accessibility mode
- [ ] Print stylesheet for invoices / payslips (hide nav, format for A4)

---

## 13. Data Model Enhancements

### 13.1 Custom Fields System (crm-custom-fields)

Currently: schema exists, UI partially done.

Remaining:
- [ ] Custom field types: Text, Number, Date, Dropdown, Multi-select, Checkbox, URL, Phone
- [ ] Custom field display: show on list view as optional column
- [ ] Custom field search: index and include in `q` search
- [ ] Custom field validation: regex, min/max, required rules
- [ ] Custom field groups: organize fields into sections on detail page
- [ ] Custom field export: include in CSV/Excel export

### 13.2 Audit & Lineage

- [ ] Full audit log per document: every field change recorded with actor + timestamp
- [ ] Diff view: show before/after values in audit trail
- [ ] Lineage graph: PO → GRN → GIN → MRN chain visually (D3 DAG)
- [ ] Forward link population: auto-populate `gin_id` / `mrn_id` on GRN when GIN/MRN created

### 13.3 Tags & Saved Views

- [ ] Nested tag categories (currently flat)
- [ ] Tag usage count (show most used tags first)
- [ ] Saved views: share with team (currently user-private only)
- [ ] Saved views: schedule email delivery of view result
- [ ] Pin saved view to sidebar as quick link

### 13.4 Documents & Attachments

- [ ] All document types: link to SabFiles library entry (not direct URL)
- [ ] PDF preview inline (iframe with R2 signed URL)
- [ ] Attachment versioning (v1, v2, etc.)
- [ ] Attachment audit log (who downloaded when)
- [ ] Bulk download as ZIP

---

## 14. Security & Compliance

### Step 33: RBAC Hardening

Tasks:
- [ ] Audit every Rust handler: confirm `rbac::check_permission()` present
- [ ] Audit every TS server action: confirm `getServerSession` + permission check
- [ ] Field-level permissions: hide sensitive fields (salary, personal ID) based on role
- [ ] Module-level disable: plan can hide entire modules from navigation
- [ ] API key scopes: restrict API key to specific modules

### Step 34: Data Encryption

Tasks:
- [ ] Sensitive fields (salary, PAN, Aadhaar, bank account) encrypted at rest (MongoDB field-level encryption)
- [ ] API responses: mask PAN/Aadhaar in logs (regex redaction in Rust tracing layer)
- [ ] TLS 1.3 enforced on all Vercel routes (already platform default — verify config)

### Step 35: GDPR / Indian DPDP Compliance

Tasks:
- [ ] Consent collection: track marketing consent per contact
- [ ] Data subject access request: export all data for a person
- [ ] Right to erasure: cascade soft-delete with retention period override
- [ ] Privacy policy version tracking per user acceptance
- [ ] Cookie consent banner (SabNode public-facing pages)
- [ ] Data processing agreements per tenant

### Step 36: Penetration Testing Readiness

Tasks:
- [ ] OWASP Top 10 self-audit checklist
- [ ] SQL/NoSQL injection prevention review (parameterized all queries — verify)
- [ ] XSS prevention: CSP headers via Vercel headers config
- [ ] CSRF: verify all mutations use POST with session validation
- [ ] Rate limiting: Vercel Edge Middleware on `/api/*` (100 req/min per IP)
- [ ] Dependency vulnerability scanning (npm audit + cargo audit in CI)

---

## 15. Testing Strategy

### Step 37: Unit Tests

- [ ] All Rust `dto.rs` files: round-trip serde tests (CREATE + UPDATE + LIST)
- [ ] All Rust `store.rs` files: mock-MongoDB unit tests using `mongomock-async`
- [ ] TypeScript: Jest tests for all utility functions in `src/lib/crm/`
- [ ] TypeScript: Jest tests for all server actions (mock Mongo)

### Step 38: Integration Tests

- [ ] Rust: `cargo test` with real MongoDB in Docker (CI service container)
- [ ] Each CRUD route: test create → read → update → delete flow
- [ ] RBAC tests: verify each permission gate blocks unauthorized actors
- [ ] Dual-impl parity tests: `USE_RUST_CRM=true` and `false` return identical responses

### Step 39: E2E Tests (Playwright)

- [ ] Sales flow: create contact → create deal → create quotation → create invoice → mark paid
- [ ] Purchase flow: create vendor → create PO → create GRN → update stock
- [ ] HR flow: create employee → create salary structure → run payroll → generate payslip
- [ ] Recruitment flow: create job → create candidate → schedule interview → create offer

### Step 40: Performance Tests

- [ ] Load test: 100 concurrent users on `/crm/sales/invoices` list (k6)
- [ ] Load test: payroll run with 500 employees (Vercel Function timeout: < 30s)
- [ ] Stress test: bulk import 10,000 contacts from CSV
- [ ] MongoDB query time budget: all list queries < 100ms at p95

---

## 16. Observability & Monitoring

### Step 41: Logging

- [ ] Rust crates: `tracing` + `tracing-subscriber` in every handler
- [ ] Log levels: ERROR for failed DB ops, WARN for validation errors, INFO for request lifecycle
- [ ] Vercel log drain → Datadog or Better Stack (configure in Vercel dashboard)
- [ ] Structured log fields: `userId`, `tenantId`, `crate`, `duration_ms`, `status_code`

### Step 42: Metrics

- [ ] Vercel Analytics: Web Vitals per route (already available — review dashboard)
- [ ] Custom metrics: payroll run duration, GRN processing time
- [ ] Error rate alerting: PagerDuty webhook when error rate > 1% for 5 minutes
- [ ] Rust handler latency histogram (P50/P95/P99) per crate

### Step 43: Alerting

- [ ] Vercel alert: Function timeout (> 10s on any route)
- [ ] MongoDB Atlas alert: CPU > 70%, connections > 80% of pool
- [ ] Payroll run failure: immediate Slack + WhatsApp alert to admin
- [ ] Stock below reorder point: email/webhook alert
- [ ] Contract expiry within 30 days: daily digest email

---

## 17. Releases & Milestones

### Milestone 1: Short-term (4 weeks)
- P3 dual-impl agent output committed ✅ (in progress)
- P4 Tier-1 crates wired (contacts, deals, tasks, employees, products)
- All 19 stub pages implemented (basic functional level)
- cargo check always-green policy enforced in CI

### Milestone 2: Phase 2 Complete (12 weeks)
- All financial reports functional (trial balance, income statement, balance sheet, cash flow)
- Inventory complete (transfers, batch, valuation)
- Payroll complete (loans, NEFT export, investment declaration)
- Leave complete (carry-forward, encashment, comp-off)
- Gantt chart live

### Milestone 3: Phase 3 Complete (6 months)
- AI sales assistant (deal scoring, email drafts)
- AI HR assistant (resume parsing, attrition risk)
- Automation rules engine (100+ pre-built templates)
- Custom report builder
- Document intelligence (OCR, vector search)

### Milestone 4: Phase 4 Complete (9 months)
- Standalone HRM namespace
- Employee self-service portal
- Customer + vendor portals
- Key third-party integrations (Razorpay, Tally, Shopify, LinkedIn)
- Developer API platform

### Milestone 5: Phase 5 Complete (12 months)
- Mobile app (React Native/Expo) for Sales + HR + Expense
- PWA with offline support
- Geo-fenced attendance

---

## 18. Appendix — All Rust Crates

### CRM Crates (alphabetical)

```
crm-account-groups       crm-accounting-types     crm-accounts
crm-agent-groups         crm-announcements        crm-appraisals
crm-asset-assignments    crm-assets               crm-attendance
crm-auto-leads           crm-automations          crm-awards
crm-bank-transactions    crm-banking-types        crm-bills
crm-bom                  crm-bookings             crm-branches
crm-brands               crm-budgets              crm-candidates
crm-certifications       crm-chart-of-accounts    crm-common
crm-company-profile      crm-compensation-bands   crm-contacts
crm-contracts            crm-conversions          crm-core
crm-coupons              crm-credit-notes         crm-currencies
crm-custom-fields        crm-dashboards           crm-deals
crm-debit-notes          crm-delivery-challans    crm-departments
crm-disciplinary         crm-document-templates   crm-documents
crm-email-templates      crm-employees            crm-estimate-requests
crm-events               crm-exits                crm-expense-categories
crm-expense-claims       crm-extras-types         crm-feedback-360
crm-fixed-assets         crm-form-16              crm-form-submissions
crm-forms                crm-gift-cards           crm-goals
crm-grns                 crm-hire                 crm-holidays
crm-notices              crm-offers               crm-okrs
crm-onboarding           crm-one-on-ones          crm-payment-accounts
crm-payment-receipts     crm-payouts              crm-payroll-runs
crm-payroll-settings     crm-payslips             crm-petty-cash
crm-pf-esi               crm-pipelines            crm-policies
crm-portal-users         crm-pos                  crm-probation
crm-product-categories   crm-production-orders    crm-products
crm-professional-tax     crm-proforma-invoices    crm-project-categories
crm-project-tasks        crm-proposals            crm-pt-slabs
crm-purchase-leads       crm-purchase-orders      crm-purchases
crm-purchases-types      crm-quotations           crm-recognitions
crm-reconciliation       crm-recurring-invoices   crm-reply-templates
crm-reports-types        crm-rfqs                 crm-roles
crm-salary-structures    crm-sales-crm-types      crm-sales-orders
crm-sales-types          crm-saved-views          crm-service-contracts
crm-settings             crm-shift-change-requests crm-shift-rotations
crm-shifts               crm-slas                 crm-stock-adjustments
crm-store                crm-subscriptions        crm-subtasks
crm-succession           crm-surveys              crm-tags
crm-task-categories      crm-task-labels          crm-task-tags
crm-taskboard-columns    crm-tasks                crm-taxes
crm-tds                  crm-ticket-channels      crm-ticket-groups
crm-ticket-tags          crm-ticket-types         crm-tickets
crm-time-logs            crm-training             crm-travel
crm-units                crm-vendor-bids          crm-vendor-types
crm-vendors              crm-voucher-entries      crm-vouchers
crm-warehouses           wachat-facebook-crm
```

**Total: 97 CRM crates**

### HRM Type Crates

```
hrm-payroll-types        hrm-people-types
```

### SabFlow Crates

```
sabflow-engine           sabflow-engine-runtime   sabflow-executor
sabflow-node-derive      sabflow-nodes            sabflow-webhooks
```

### Platform Crates

```
admin    api    auth    common    db    observability    rbac
sabfiles users  developer-api-usage  developer-oauth
developer-personal-tokens  developer-webhooks
qr-codes  url-shortener
```

### Wachat / Telegram Crates

```
(30+ wachat-* crates for WhatsApp Business API)
(30+ telegram-* crates for Telegram Bot API)
```

---

*Plan auto-generated from live codebase state on 2026-05-19. Update this document whenever a milestone is closed or a new feature is scoped. Track sprint-level tasks in GitHub Issues / Linear.*
