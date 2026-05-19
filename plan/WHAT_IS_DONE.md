# What Is Done — SabNode CRM + HRM
**Last updated:** 2026-05-19

A flat checklist of every completed item. Every checked box here maps to at least one commit in main.

---

## Infrastructure & Architecture

- [x] Next.js 16 App Router with ZoruUI component library
- [x] Axum Rust BFF workspace — 96+ CRM crates, cargo check clean
- [x] MongoDB Atlas as primary database
- [x] Firebase Auth + httpOnly session cookie for Next.js auth
- [x] Cloudflare R2 via SabFiles for all file storage
- [x] Vercel Fluid Compute deployment (Node.js 24 runtime)
- [x] SabFlow engine (Rust executor + Node.js SSE bridge)
- [x] `USE_RUST_CRM` dual-impl flag pattern established
- [x] Vercel Cron: url-health (6h), link-scheduler (15min), qr-scan-notify (5min)
- [x] RBAC system (`crm-roles` crate + TS permission check layer)

## UI Component Migrations

- [x] **W1–W8**: All 620+ `CrmPageHeader` usages → `EntityListShell` / `EntityDetailShell` (0 remaining)
- [x] **§1E**: All `ZoruSelect` → `EnumFormField` / `EnumFilterField` (100% coverage)
- [x] `crm-module-overview.tsx` — migrated shared overview component
- [x] `hr-entity-page.tsx` — migrated 782-line shared HR component
- [x] `EntityListShell` component: title, subtitle, primaryAction, filters, search, bulkBar, empty, loading, pagination, viewSwitcher
- [x] `EntityDetailShell` component: eyebrow, title, status (with tone), actions, rightRail, audit, back

## Rust Crate Milestones

- [x] `GrnStatus` widened from 4 → 8 variants (Draft, Received, Partial, Inspected, QcFailed, Posted, Closed, Rejected) with `snake_case` serde
- [x] `ALLOWED_STATUSES` constant updated in `crm-grns/dto.rs`
- [x] `ExecutionContext` extended with `continue_on_fail: bool` + `metrics: Arc<NodeMetrics>`
- [x] `NoOpNode` implemented with `#[async_trait]`
- [x] `CodeNode` + `WebhookTriggerNode` stub re-exports created
- [x] Duplicate `pub mod` declarations removed from `sabflow-executor/queue/src/lib.rs`
- [x] `is_bool()` → `is_boolean()` fixed in `convert_to_file.rs`
- [x] QR codes + URL shortener: missing `CreateBody` fields filled in `from_form.rs`
- [x] All cargo compile errors fixed (0 errors on `cargo +stable check`)

## Dual-Impl Wired (USE_RUST_CRM)

- [x] 7 action files wired: crm-debit-notes, crm-payouts, crm-payroll-runs, crm-pos, crm-purchase-orders, crm-store, crm-warehouses (agent ae8a9101 in progress)

## CRM Modules — Fully Functional

### Sales
- [x] Clients / Contacts full CRUD
- [x] Pipelines (drag-and-drop stage management)
- [x] Deals (with pipeline association)
- [x] Leads + Auto-leads setup
- [x] Quotations with PDF generation
- [x] Sales Orders with status workflow
- [x] Invoices (standard + recurring)
- [x] Payments / receipts
- [x] Credit Notes
- [x] Delivery Challans
- [x] Proforma Invoices
- [x] Proposals (with rich-text editor)
- [x] Subscriptions (with renewal logic)
- [x] Gift Cards
- [x] Coupons
- [x] Contracts
- [x] Estimate Requests
- [x] Forms + Form Submissions

### Purchases
- [x] Vendors full CRUD
- [x] Purchase Leads
- [x] RFQs (Request for Quotation)
- [x] Vendor Bids
- [x] Purchase Orders (Mongo + Rust dual-impl)
- [x] Expenses / Expense Claims
- [x] Payouts (Rust dual-impl)
- [x] Debit Notes (Rust dual-impl)
- [x] Hire management

### Inventory
- [x] Items / Products full CRUD with categories
- [x] Warehouses (Rust dual-impl)
- [x] GRN (Goods Receipt Notes) — 8-variant status workflow
- [x] Stock Adjustments (increase/decrease with reason codes)
- [x] Production Orders
- [x] Bill of Materials (BOM)

### Accounting
- [x] Chart of Accounts (hierarchical account groups)
- [x] Vouchers (journal entries)
- [x] Reconciliation

### Banking
- [x] Bank Accounts management
- [x] Bank Transactions
- [x] Bank Reconciliation
- [x] Petty Cash

### HR
- [x] Employee master (photo, personal, professional details)
- [x] Departments + Designations
- [x] Org Chart (interactive tree)
- [x] Directory with search
- [x] Announcements
- [x] Policies (upload + display)
- [x] Documents + Document Templates
- [x] Onboarding workflows
- [x] Welcome Kit
- [x] Exit management (Full & Final)
- [x] Asset inventory + Asset Assignments
- [x] Training programs
- [x] Learning Paths
- [x] Certifications tracking
- [x] Careers Page (public job board)
- [x] Candidates pipeline
- [x] Job Postings
- [x] Interview scheduling
- [x] Offer Letters
- [x] Timesheets
- [x] OKRs
- [x] Goal Setting
- [x] 360 Feedback
- [x] Appraisal Reviews
- [x] KPI Tracking
- [x] Surveys
- [x] One-on-Ones
- [x] Recognition & Awards
- [x] Disciplinary Actions
- [x] Probation management
- [x] Succession Planning
- [x] Compensation Bands
- [x] Travel requests
- [x] Expense Claims

### Payroll
- [x] Attendance logging
- [x] Leave management
- [x] Shifts + Shift Rotations + Shift Change Requests
- [x] Holiday calendar
- [x] Salary Structure templates
- [x] Payroll Runs (Rust dual-impl)
- [x] Payslip generation + PDF
- [x] Form 16
- [x] PF / ESI
- [x] TDS computation
- [x] Professional Tax (state-wise slabs)
- [x] Payroll Reports

### Projects
- [x] Project list + detail
- [x] Kanban board
- [x] Task management (subtasks, labels, tags, categories)
- [x] Milestones
- [x] Taskboard Columns (drag-and-drop)
- [x] Activity feed
- [x] Project categories

### Tickets
- [x] Ticket list + detail
- [x] Channels (email, WhatsApp, web)
- [x] Groups + Types + Tags
- [x] SLA definitions
- [x] Reply Templates
- [x] Agent Groups

### Settings
- [x] Company Profile
- [x] Roles & Permissions (RBAC)
- [x] Currencies, Taxes, Units
- [x] Brands, Product Categories
- [x] Account Groups, Banking/Accounting/Vendor/Sales/Purchases Types
- [x] Expense Categories, Payment Accounts
- [x] Tags, Custom Fields, Saved Views
- [x] Portal Users

### Additional Modules
- [x] POS (Rust dual-impl)
- [x] Store (Rust dual-impl)
- [x] Bookings
- [x] Budgets
- [x] Fixed Assets
- [x] Events
- [x] Custom Dashboards
- [x] Audit Log
- [x] Import/Export (CSV)
- [x] Mentions
- [x] Time Tracking
- [x] Auto Leads Setup
- [x] Service Contracts

## SabFlow
- [x] 200+ marketplace workflow templates seeded
- [x] SabFlow editor with manual trigger + SSE progress
- [x] Full n8n parity plan documented

## Other Modules
- [x] URL Shortener with analytics, bio builder, webhooks settings
- [x] QR Code generator with campaigns
- [x] Wachat (WhatsApp Business) — ZoruUI migration complete
- [x] Telegram multi-feature suite (30+ crates)
