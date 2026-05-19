# New Features Roadmap — SabNode CRM + HRM
**Last updated:** 2026-05-19

Every planned new feature, enhancement, and product idea — step-by-step.

---

## Category 1: Sales & Revenue Features

### 1.1 Smart Deal Intelligence
**What:** AI-powered deal health scoring and next-action recommendations.
**Steps:**
1. Collect deal signals: last activity date, email open rate, stage age, contact engagement score
2. Build scoring model (start with rule-based, migrate to ML in Phase 3)
3. Display health score badge (green/amber/red) on deal card and list
4. Show "Next best action" card on deal detail page
5. Alert manager when deal goes cold (no activity > X days)
6. Weekly digest email: deals at risk, deals overdue for follow-up

### 1.2 Revenue Forecasting
**What:** Predict monthly/quarterly revenue from pipeline.
**Steps:**
1. Build probability-weighted pipeline model (deal value × win probability)
2. Show forecast bar chart: committed + likely + pipeline bands
3. Compare forecast vs. target vs. actuals
4. Drill down: which deals make up each band
5. AI-adjusted forecast using historical win rates per stage

### 1.3 Sales Gamification
**What:** Motivate sales reps through leaderboards and achievements.
**Steps:**
1. Leaderboard: rank by revenue closed, deals won, calls made this month
2. Achievement badges: "First Deal Closed", "100K Month", "Clean Pipeline"
3. Weekly winner announcement (send via SabWa to team WhatsApp group)
4. Goal vs. actual progress bar per rep

### 1.4 Smart Email Sequences
**What:** Automated multi-step email follow-up sequences for leads and deals.
**Steps:**
1. Sequence builder: define N steps (email, call task, LinkedIn task) with delays
2. Enroll contact in sequence manually or by automation rule
3. Skip step if contact replies (auto-detect reply via Gmail sync)
4. Sequence analytics: open rate, reply rate, unsubscribe rate per step
5. A/B test subject lines within a sequence

### 1.5 Subscription Billing Engine
**What:** Full MRR/ARR tracking with dunning management.
**Steps:**
1. Subscription lifecycle: active → past_due → cancelled → churned
2. Dunning: auto-retry payment on Day 1, 3, 7 after failure
3. Dunning email sequence (payment failed, reminder, final notice)
4. MRR/ARR dashboard: new MRR, expansion, churn, net MRR
5. Subscription health score per customer

---

## Category 2: Purchase & Supply Chain Features

### 2.1 Supplier Scorecard
**What:** Rate and track supplier performance over time.
**Steps:**
1. Metrics: on-time delivery %, quality rejection rate, price variance, response time
2. Auto-calculate from GRN data (received date vs. promised date, accepted vs. received qty)
3. Scorecard dashboard per vendor
4. Quarterly supplier review report (PDF export)
5. Auto-disqualify vendors below minimum score threshold

### 2.2 Purchase Requisition Workflow
**What:** Formal internal request → approval → PO creation chain.
**Steps:**
1. Employee raises purchase requisition (item, qty, justification, budget code)
2. Department head approves/rejects
3. Finance approves if above threshold
4. Approved requisition → auto-create draft PO
5. Track requisition to PO to GRN lineage chain

### 2.3 Three-Way Match
**What:** Auto-validate GRN qty + vendor invoice amount against PO.
**Steps:**
1. On vendor invoice entry, match to PO (amount) and GRN (qty)
2. Three-way match status: Matched / Quantity Discrepancy / Amount Discrepancy / Both
3. Block payment approval if match fails (configurable tolerance %)
4. Exception queue for manual resolution
5. Audit trail for every exception resolution

### 2.4 Vendor Performance Analytics
**What:** Comprehensive supplier analytics dashboard.
**Steps:**
1. Delivery performance chart (on-time % by month)
2. Quality chart (rejection rate by vendor by quarter)
3. Price trend chart (unit cost over time per SKU per vendor)
4. Spend analysis (total spend by vendor, by category, by month)
5. Preferred vendor recommendation per SKU (lowest cost + highest quality score)

---

## Category 3: Inventory & Warehouse Features

### 3.1 Multi-Warehouse Routing
**What:** Smart routing of orders across warehouses based on stock availability.
**Steps:**
1. On sales order confirmation, check stock across all warehouses
2. Suggest optimal fulfillment warehouse (closest to delivery address + sufficient stock)
3. Auto-split order across multiple warehouses if needed
4. Track per-warehouse fulfillment status separately
5. Merge delivery into single shipment where possible

### 3.2 Lot & Serial Traceability
**What:** Full forward/backward traceability for regulated industries.
**Steps:**
1. Record batch/lot/serial at every stock movement (GRN, transfer, sale)
2. Forward trace: given a batch, show all customers who received it
3. Backward trace: given a customer order, show the source batches
4. Recall management: flag all affected orders when a batch is recalled
5. Expiry-near alert + auto-quarantine in warehouse

### 3.3 Cycle Count / Spot Check
**What:** Systematic periodic inventory verification.
**Steps:**
1. Schedule cycle count by location, category, or ABC class
2. Generate count sheet (list of items with blank qty column)
3. Warehouse staff counts and records actual qty
4. System highlights variances (expected vs. actual)
5. Auto-create stock adjustment for approved variances
6. Cycle count report with shrinkage trend analysis

### 3.4 Reorder Point Automation
**What:** Never run out of stock — auto-trigger purchase.
**Steps:**
1. Per-SKU: set reorder point, reorder quantity, preferred supplier
2. Daily check: stock on hand + pending GRNs < reorder point → trigger
3. Auto-create draft PO (pending review by purchase manager)
4. Notify purchase manager via in-app + WhatsApp
5. Dashboard: items below reorder point, items with pending auto-PO

### 3.5 ABC / XYZ Classification
**What:** Classify inventory by value (ABC) and demand variability (XYZ).
**Steps:**
1. Calculate annual consumption value per SKU
2. Sort and split: A = top 70% value, B = 20%, C = 10%
3. Calculate demand variability (coefficient of variation) per SKU
4. XYZ: X = stable demand, Y = variable, Z = highly irregular
5. Combined matrix: AX = high value + stable (critical), CZ = low value + irregular (de-stock)
6. Policy recommendations per class (review frequency, safety stock level)

---

## Category 4: HR & People Features

### 4.1 HR Chatbot (AI-Powered)
**What:** Employee self-service chatbot for HR queries.
**Steps:**
1. Answer: "How many leaves do I have left?", "What is the notice period policy?"
2. Action: apply for leave, check payslip, raise grievance via chat
3. Powered by Claude Haiku with knowledge base from company policies
4. Escalate to HR when chatbot can't answer
5. Available via web widget + WhatsApp (SabWa)

### 4.2 Employee Pulse System
**What:** Regular short surveys to measure engagement in real-time.
**Steps:**
1. Weekly/monthly pulse survey (3–5 questions, takes 2 minutes)
2. Rotating question bank (avoid survey fatigue)
3. Anonymous aggregated results per department
4. Trend chart: engagement score over time
5. Alert HR manager when score drops > 10% month-over-month
6. Action plan tracker (what did we do about low scores?)

### 4.3 Pay Equity Analysis
**What:** Identify and address gender/diversity pay gaps.
**Steps:**
1. Group employees by: role, level, department, gender, tenure band
2. Calculate median and mean salary per group
3. Flag groups where gap > configurable threshold (e.g., 5%)
4. Drill down to individual records contributing to gap
5. Simulation: what salary adjustments would close the gap, and at what cost?
6. Pay equity report (PDF) for board/compliance review

### 4.4 Skills Inventory
**What:** Track every employee's skills for project staffing and L&D planning.
**Steps:**
1. Skill taxonomy: define skill categories + individual skills (with proficiency levels 1–5)
2. Employees self-rate skills (with manager validation)
3. Skills gap analysis: required skills for role vs. current employee skills
4. Skills search: "Find employees who know Python + MongoDB"
5. L&D recommendation: enroll in training to close top skill gaps
6. Skills coverage heatmap per department

### 4.5 Dynamic Org Chart
**What:** Real-time org chart with headcount and cost overlays.
**Steps:**
1. Auto-generate from department/designation/reporting-manager data
2. Switch views: role hierarchy, project team, location-based
3. Headcount overlay: show count at each level
4. Cost overlay: show total salary cost at each node (manager sees own branch)
5. Vacancy indicators: unfilled positions shown as dotted boxes
6. Export as PNG / PDF

### 4.6 Internal Job Board
**What:** Employees apply for internal positions before external hiring.
**Steps:**
1. Mark a job as "Internal Only" or "Internal + External"
2. Internal job board visible to all employees on self-service portal
3. Employee applies with profile (no extra resume needed)
4. Track internal applications separately from external
5. Internal referral credit system (referring colleague gets recognition)

### 4.7 Learning Management System (LMS)
**What:** Full in-house LMS with courses, quizzes, and certificates.
**Steps:**
1. Course builder: upload video (SabFiles), add PDF, add quiz
2. Quiz engine: multiple choice, true/false, short answer
3. Completion tracking per employee per course
4. Certificate generation (PDF with digital signature) on course completion
5. SCORM 1.2 player for third-party e-learning content
6. Mandatory training assignment with deadline + escalation to manager

---

## Category 5: Finance & Accounting Features

### 5.1 Budget vs. Actuals Tracking
**What:** Compare planned budget to actual spend in real-time.
**Steps:**
1. Budget creation: enter monthly amounts per cost center / GL account
2. Actuals auto-populate from voucher entries
3. Budget vs. actuals bar chart (remaining, overspent highlighted red)
4. Variance analysis: explain overspent lines with notes
5. Budget revision: version history of budget changes
6. Department heads get spend alerts when > 80% of budget consumed

### 5.2 Multi-Currency Accounting
**What:** Handle transactions in any currency with auto-forex gain/loss.
**Steps:**
1. Set base currency per company (INR/USD/AED/etc.)
2. Each transaction can have a different transaction currency
3. Auto-fetch exchange rate (fixer.io API, cached daily)
4. Forex gain/loss voucher auto-created on settlement vs. invoice date rate
5. Realized vs. unrealized forex gain/loss report
6. Multi-currency balance sheet (translated at closing rate)

### 5.3 Project Accounting
**What:** P&L per project (revenue and costs directly linked to project).
**Steps:**
1. Tag invoices and expenses to a project code
2. Time-log entries billable at project rate → project revenue
3. Project P&L: revenue − direct costs − allocated overhead
4. WIP (Work-in-Progress) accounting for long-running projects
5. Project profitability report (ranked by margin %)

### 5.4 Tax Filing Assistants
**What:** Pre-populated GST returns and TDS returns.
**Steps:**
1. GSTR-1: auto-populate from sales invoices by HSN code
2. GSTR-3B: summarized tax liability per filing period
3. GSTR-2A reconciliation: match purchase ITC with supplier filings
4. TDS return (Form 24Q, 26Q): pre-populate from payroll + vendor payments
5. Export in government-specified JSON/CSV format for direct upload to portal

---

## Category 6: Operations & Productivity Features

### 6.1 Workflow Automation 2.0 (Advanced SabFlow Integration)
**What:** Any CRM event triggers a SabFlow workflow.
**Steps:**
1. Trigger connector: CRM event → SabFlow webhook
2. Pre-built triggers: Invoice Created, Deal Won, Employee Joined, Leave Approved
3. Bi-directional: SabFlow can update CRM records via API
4. Visual automation builder (no-code) embedded in CRM settings
5. 100+ pre-built automation templates (see FEATURES_TEMPLATES.md)

### 6.2 Smart Notifications
**What:** Context-aware, actionable notifications instead of dumb alerts.
**Steps:**
1. Notification types: requires action (approve/reject inline), informational, alert
2. Delivery channels: in-app bell, email, WhatsApp (SabWa), Slack
3. Smart bundling: group 10 similar notifications into one digest
4. Snooze: snooze a notification for 1h / 1d / 1w
5. Notification preferences per user per module
6. Notification history: searchable log of all past notifications

### 6.3 Global Search 2.0
**What:** Unified search across all modules with natural language queries.
**Steps:**
1. MongoDB Atlas Search index on all major collections
2. Search results categorized by module (contacts, deals, invoices, employees)
3. Recent searches and pinned searches
4. Natural language: "invoices overdue this month" → filter results
5. Keyboard shortcut: Cmd+K / Ctrl+K search palette
6. Search analytics: what are users searching for (no results → data gap)

### 6.4 Collaboration Layer
**What:** Add comments, @mentions, and activity feeds to every record.
**Steps:**
1. Comment thread on every document (deal, invoice, employee, ticket)
2. @mention any user → they get notified
3. React to comments (👍, ✅, 🔴)
4. Activity feed: auto-generated entries for every field change
5. Watch a record: get notified of any activity
6. Collaborative editing for proposal/quotation text (yjs CRDT — already in SabFlow)

### 6.5 Bulk Operations
**What:** Perform actions on 100+ records at once.
**Steps:**
1. Multi-select rows in any list (checkbox column)
2. Bulk actions: update status, assign to, add tag, delete, export
3. Bulk import from CSV with validation report (errors + successes)
4. Bulk email (send invoice to 50 clients simultaneously)
5. Bulk payslip generation + email (run payroll for 200 employees in one click)

---

## Category 7: Analytics & Intelligence

### 7.1 Executive Dashboard
**What:** Single-pane-of-glass view for founders/executives.
**Steps:**
1. Revenue this month (actual vs. target), growth % vs. last month
2. Pipeline value at each stage
3. Headcount by department with open positions
4. Top 5 customers by revenue, top 5 at-risk customers
5. Payroll cost trend (6-month chart)
6. Inventory health (stock-outs, overstock alerts)
7. Ticket SLA compliance rate
8. Customizable widget layout (drag-to-rearrange)

### 7.2 Data Warehouse Export
**What:** Export all CRM/HRM data to BigQuery / Snowflake for BI tools.
**Steps:**
1. Schema documentation for all collections
2. Nightly export to BigQuery (Vercel Cron + MongoDB change streams)
3. Pre-built Looker Studio / Metabase dashboards
4. Incremental export (only changed documents since last run)
5. Export control: tenant chooses which modules to export

### 7.3 Predictive Analytics Module
**What:** ML-powered predictions surfaced in the UI.
**Steps:**
1. Invoice payment prediction: will this invoice be paid on time? (based on customer history)
2. Employee attrition risk (30-day rolling score)
3. Demand forecast per SKU (auto-reorder suggestion)
4. Deal close date prediction (based on similar deals)
5. Customer LTV prediction (from order history + payment behaviour)

---

## Category 8: Platform & Ecosystem Features

### 8.1 White-Label CRM
**What:** Partners can offer SabNode CRM under their own brand.
**Steps:**
1. Custom domain support (partner.theircrm.com → SabNode)
2. Custom logo, colors, favicon per tenant
3. White-label email sender domain (mail from partner domain)
4. Remove all SabNode branding from UI + documents
5. Partner billing: partner billed wholesale, charges customers retail

### 8.2 Marketplace for Extensions
**What:** Third-party developers publish extensions (add-on modules).
**Steps:**
1. Extension manifest format (name, version, permissions, entry points)
2. Extension sandbox: runs in iframe with postMessage API
3. Extension marketplace listing page
4. Extension install/uninstall per tenant
5. Extension revenue sharing with developers (70/30 split)

### 8.3 SabNode Public API v2
**What:** RESTful API for external developers to build on top of SabNode CRM.
**Steps:**
1. OpenAPI 3.1 spec auto-generated from all Rust handlers
2. Versioned API (`/v2/` prefix)
3. Rate limiting per API key (configurable tiers)
4. Webhook events: all CRUD operations on all entities
5. Interactive API playground (Swagger UI hosted on docs.sabnode.com)
6. Official SDKs: TypeScript, Python, Go

### 8.4 SabNode App Store
**What:** Pre-built integration apps that users can install in one click.
**Steps:**
1. App store UI in `/crm/integrations`
2. Each app shows: description, required permissions, install count, reviews
3. OAuth install flow per app
4. App configuration page (API keys, field mappings)
5. App activity log (last synced, records synced, errors)
6. Uninstall with optional data purge

---

## Category 9: Compliance & Governance

### 9.1 Audit Trail 2.0
**What:** Immutable, queryable audit log for every action in the system.
**Steps:**
1. Record every create/update/delete with: actor, timestamp, IP, device, before/after values
2. Diff view: side-by-side before/after for each field change
3. Export audit log for date range (compliance reports)
4. Tamper-proof: write-once storage (MongoDB append-only collection)
5. RBAC: only admin + auditor roles can view audit log

### 9.2 Data Retention Policies
**What:** Auto-archive or delete old data per compliance rules.
**Steps:**
1. Per-collection retention rules (e.g., invoices = 7 years, attendance = 5 years)
2. Archive: move to cold-tier Atlas after retention date
3. Purge: hard-delete after extended retention period
4. Exemption: legal hold flag prevents deletion
5. Retention audit report: what data is scheduled for purge this quarter

### 9.3 E-Signature Integration
**What:** Legally binding electronic signatures on contracts, offers, invoices.
**Steps:**
1. Integration with DocuSign or SignNow (Indian eSign providers: eMudhra, NSDL)
2. Send document for signature from contract / offer letter detail page
3. Recipient signs in browser (no download required)
4. Signed PDF auto-attached to document record in SabFiles
5. Signature certificate stored with audit trail

---

## Category 10: Communications

### 10.1 CRM Email Client
**What:** Send and receive emails directly within CRM (no Gmail tab switching).
**Steps:**
1. Connect Gmail/Outlook (OAuth) per user
2. Email inbox inside CRM: see emails from contacts
3. Send email from deal/contact page (pre-fill To from record)
4. Auto-link incoming emails to the matching contact/deal
5. Email templates with variable substitution
6. Schedule email: send at specific time

### 10.2 WhatsApp CRM (SabWa Integration)
**What:** Send WhatsApp messages to contacts directly from CRM records.
**Steps:**
1. "Send WhatsApp" button on contact/deal/invoice detail page
2. Select approved template + fill variables
3. Message appears in SabWa conversation thread linked to contact
4. Reply from SabWa → shows in CRM activity feed
5. Broadcast: send invoice/payment reminder to 100 contacts via WhatsApp

### 10.3 Call Center Integration
**What:** Click-to-call and call logging inside CRM.
**Steps:**
1. Integration with Exotel / Ozonetel (Indian cloud telephony)
2. Click phone number on contact → auto-dial via browser
3. Auto-create call log on answer (duration, outcome)
4. Call recording linked to contact record
5. Missed call → auto-create follow-up task
6. Call analytics: total calls, connect rate, avg duration per rep

---

*All features above map to phases in CRM_HRM_MASTER_PLAN.md. Update status here when items move to "What Is Done".*
