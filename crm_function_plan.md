# SabNode CRM + HRM — Function Plan

A comprehensive, exhaustive list of every CRM/HRM feature and the **maximum possible input fields** that should be supported per feature. Use this as the source of truth when wiring forms, schemas (Mongo + zod), action validators, and the sidebar IA.

> Convention: ★ = required, ◇ = optional, ⚙ = system/auto-set, 🔒 = role-gated.

---

## 0 · Cross-cutting fields (every entity should support)

- ⚙ `_id` (ObjectId)
- ⚙ `projectId`, `userId`, `tenantId`
- ⚙ `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- ◇ `tags[]`, `customFields{}`, `attachments[]` (SabFiles refs), `notes[]`
- ◇ `status`, `priority`, `archived`, `deletedAt` (soft-delete)
- ◇ `assignedTo`, `teamId`, `pipelineId`, `stageId`
- ◇ `source`, `referrerId`, `campaignId`, `utm{ source, medium, campaign, term, content }`

---

## 1 · CRM — Sales

### 1.1 Clients & Prospects
Type ★, First name ★, Last name ★, Display name, Salutation, Company name, GSTIN, PAN, Aadhaar (masked), CIN, MSME no., Industry, Sub-industry, Designation, Department, Email (primary) ★, Email (alt[]), Phone (primary) ★, Phone (alt[]), WhatsApp, Telegram, LinkedIn, Twitter/X, Website, Currency, Price list, Credit limit, Credit period (days), Payment terms, Tax preference (taxable/exempt), Tax registration no., Place of supply, Billing address (line1, line2, city, state, country, pincode), Shipping address[] (multi), Default warehouse, Sales agent, Default discount %, Default tax rate, Opening balance + as-of date, Source, Lead score, Stage, Pipeline, Tags[], Avatar, DOB, Anniversary, Preferred contact channel, Preferred language, Timezone, Customer rating, Loyalty tier, Notes, Custom fields, Attachments.

### 1.2 Quotations / Estimates
Quotation no. ⚙, Date ★, Valid until ★, Client ★, Reference no., Sales agent, Pipeline, Deal, Subject, Currency, Exchange rate, Place of supply, Billing/Shipping address, Items[] (item, description, HSN/SAC, qty, unit, rate, discount %, tax rate, CGST/SGST/IGST, total), Sub-total, Discount (overall), Shipping charge, Adjustment, Round-off, Total, Terms & conditions, Customer notes, Attachments[], Signature image, Template, Thumbnail, PDF status, Email log, WhatsApp send log, Status (draft/sent/accepted/rejected/expired/converted), Converted-to (SO/Invoice), Revision history.

### 1.3 Proforma Invoices
Same shape as Quotation + Proforma no., Linked SO, Advance %, Advance amount, Expected delivery, Payment due date, Status (draft/sent/paid/converted).

### 1.4 Sales Orders
SO no. ⚙, Date ★, Client ★, Quotation ref, PO no., PO date, Expected shipment date, Delivery method, Payment terms, Items[] + qty pending/delivered/invoiced, Warehouse (per line), Sub-total/Tax/Discount/Total, Shipping address, Customer notes, Internal notes, Attachments, Status (open/partial/fulfilled/closed/cancelled), Linked deliveries/invoices.

### 1.5 Delivery Challans
Challan no. ⚙, Date ★, SO ref, Client ★, Vehicle no., Driver name, Driver phone, Transporter, LR no., LR date, Mode of transport, E-way bill no., Items[] (qty, batch, expiry, serial nos.), Dispatch warehouse, Ship-to address, Reason for transport, Attachments, Status.

### 1.6 Invoices
Invoice no. ⚙, Date ★, Due date ★, Client ★, Place of supply, Reverse charge?, GST treatment, Items[] (HSN, qty, rate, disc %, tax %, CGST/SGST/IGST/CESS), TCS %, TDS %, Round-off, Total, Amount paid ⚙, Balance ⚙, Payment terms, Bank details (for receipts), UPI ID, QR image, Customer notes, T&C, E-invoice IRN, QR string, Acknowledgement no./date, E-way bill no., Attachments, Status (draft/sent/paid/partially_paid/overdue/cancelled), Recurring config (frequency, end date, next run).

### 1.7 Payment Receipts
Receipt no. ⚙, Date ★, Client ★, Mode (cash/cheque/UPI/NEFT/RTGS/IMPS/card/wallet), Bank account ★, Cheque no./date, Reference/Txn id, Amount ★, Currency, Exchange rate, Apply to invoices[] (multi-line), Excess as advance?, TDS deducted by customer?, Bank charges, Notes, Attachments, Status (received/cleared/bounced).

### 1.8 Credit Notes
CN no. ⚙, Date ★, Client ★, Linked invoice, Reason (return/discount/price-adjust/cancel), Items[], Tax recalc, Refund mode (cash/credit/replacement), Refund txn id, Status, Attachments.

### 1.9 Sales Pipelines / Forms / Analytics
Pipeline name, Stages[] (label, color, probability %, order), Default stage, Win/Loss reasons[], Owner, Visibility, Forms (label, fields[], theme, redirect URL, captcha, submit webhook).

---

## 2 · CRM — Purchases

### 2.1 Vendors & Suppliers
Same field set as Clients + Vendor type (goods/services/both), MSME registered, MSME category, MSME number, Vendor rating, Default purchase ledger, Default expense ledger, TDS section, TDS rate, Lead time (days), Min order qty, Vendor portal email.

### 2.2 Purchase Orders
PO no. ⚙, Date ★, Vendor ★, Expected delivery, Items[] (item, HSN, qty, rate, disc, tax), Ship-to warehouse, Billing branch, Payment terms, T&C, Approval workflow (requested by, approved by, approved at), Attachments, Status (draft/awaiting-approval/approved/sent/partial/received/closed/cancelled).

### 2.3 Purchases & Expenses (Bills)
Bill no., Vendor invoice no., Bill date ★, Due date, Vendor ★, Items[] or Expense lines[] (account, amount, tax, project), TDS section, TDS amount, Reverse charge?, Place of supply, Sub-total/Tax/Total, Paid/Balance, Recurring config, Attachments, Status, Linked PO, Linked GRN.

### 2.4 Debit Notes
DN no. ⚙, Date ★, Vendor ★, Linked bill, Reason, Items[], Refund mode, Refund txn id, Status.

### 2.5 Payout Receipts
Payment no., Date ★, Vendor ★, Mode, Bank ★, Cheque/Reference, Amount ★, Apply to bills[], Excess as advance?, TDS deducted?, Notes, Attachments.

### 2.6 Purchase Leads / Hire & Services
Lead title, Vendor candidate, Category, Required by, Quantity, Estimated budget, Specs, Attachments, Stage (sourcing/quotes-received/negotiating/awarded/closed-lost), Owner.

---

## 3 · CRM — Inventory

### 3.1 Items / Products
Type (goods/service/bundle), Name ★, SKU ★, Barcode, Variant of, HSN/SAC, GST rate, Cess, Unit ★ (PCS/KG/L/HRS/...), Alt units & conversion, Sub-unit, Brand, Category[], Manufacturer, MPN, Country of origin, Description, Short description, Features, Specifications[], Selling price ★, Selling currency, MRP, Discount %, Wholesale price, Tax inclusive?, Purchase price ★, Purchase currency, Vendor[], Lead time, Reorder point, Reorder qty, Max stock, Track inventory?, Track batches?, Track serials?, Track expiry?, Opening stock per warehouse[], Opening stock value, Image[] (SabFiles), Thumbnail, Gallery, Dimensions (L×W×H), Weight, Volume, Color, Size, Material, Custom attributes[], Tax preference, Sales account, Purchase account, Stock account, COGS account, Active?, Tags[].

### 3.2 Warehouses
Name ★, Code ★, Type (main/branch/franchise/3PL/virtual), Address, GSTIN, Manager, Manager phone, Capacity (units/sqft), Climate-controlled?, Active?, Default for project?, Tags.

### 3.3 Stock Adjustments
Adjustment no. ⚙, Date ★, Warehouse ★, Reason (damage/theft/correction/found/transfer-in/transfer-out), Reference doc, Items[] (qty before/after, batch, serial, cost), Total impact, Approved by, Notes, Attachments.

### 3.4 Reports
Product-wise P&L, Stock Value Report, Batch Expiry Report (with thresholds), Party Transactions Report, All Transactions Report — filters: date range, warehouse, item, category, batch, vendor/customer.

---

## 4 · CRM — Accounting

### 4.1 Account Groups / Chart of Accounts
Code, Name ★, Parent group, Nature (assets/liabilities/equity/income/expense), Sub-nature, Affects gross profit?, Tax behavior, Currency, Opening balance + as-of date, Active?, Description.

### 4.2 Voucher Books
Type (sales/purchase/payment/receipt/contra/journal/credit-note/debit-note), Name ★, Prefix, Suffix, Starting number, Padding, Reset frequency (none/yearly/monthly), Active?, Default for module?, Approval required?, Approvers[].

### 4.3 Reports
Balance Sheet, Trial Balance, Profit & Loss, Income Statement, Day Book, Cash Flow Statement — filters: from/to, branch, project, comparison period, format (T-form/vertical), include zero balances?, drill-down level.

---

## 5 · CRM — Sales CRM (Leads/Deals/Tasks)

### 5.1 Leads
First/Last name ★, Email, Phone, Company, Title, Source, Sub-source, Campaign, Utm{}, Status, Lead score, Owner, Pipeline/Stage, Estimated value, Currency, Probability %, Expected close, Address, Industry, Notes, Tags, Consent (email/SMS/WhatsApp), Custom fields, Attachments, Activity log ⚙.

### 5.2 Contacts
Same as Lead but linked to a Client; plus relationship (decision-maker/influencer/champion/blocker), reports-to, secondary owner.

### 5.3 Deals
Title ★, Pipeline ★, Stage ★, Owner ★, Client/Lead ★, Amount ★, Currency, Probability %, Expected close ★, Actual close, Won/Lost reason, Competitors[], Products[] (item, qty, rate, discount), Notes, Files, Activities, Tags, Custom fields.

### 5.4 Tasks
Title ★, Description, Type (call/email/meeting/todo/follow-up), Status, Priority, Assignee ★, Due date ★, Reminders[], Linked entity (lead/deal/client/ticket/invoice), Checklist[], Attachments, Recurring config, Outcome.

### 5.5 Automations
Trigger (lead-created, stage-change, time-based, form-submit, etc.), Conditions[], Actions[] (email, WhatsApp, SMS, assign, create-task, webhook, update-field), Active?, Throttle, Logs.

### 5.6 Forms
Name, Description, Fields[] (label, type, required, options, validation), Theme, Redirect URL, Submit message, Success webhook, Honeypot, reCAPTCHA, Map-to entity, Default owner, Tags applied, Embed snippet ⚙.

### 5.7 Analytics & Reports
Leads Summary, Team Sales Report, Client Performance Report, Lead Source Report, Pipeline Velocity, Conversion Funnel, Sales Forecast, Activity Report, Win/Loss Analysis.

---

## 6 · CRM — Banking & Payments

### 6.1 Bank Accounts
Account name ★, Bank name ★, Account no. ★, IFSC ★, Branch, Account type (savings/current/OD/CC), Currency, Opening balance + as-of, GL ledger, Statement format (CSV/MT940/OFX), Auto-fetch (provider/credentials), Active?, Default?, UPI VPA, SWIFT, IBAN.

### 6.2 Employee Accounts
Same shape, linked to employeeId; salary disbursement default flag.

### 6.3 Reconciliation
Statement upload, Period, Match rules, Tolerance, Auto-match results, Manual matches, Adjustments[], Closing balance check, Sign-off by/at.

---

## 7 · CRM — Reports

GSTR-1, GSTR-2B, GSTR-3B, Invoice Aging, Payment Report, Expense Report, Income Report, Profit & Loss, Tax Report, Top Clients, Top Products, Sales Deals, Leads Conversion, Birthday/Anniversary, Agent Performance, Project Status, Late Report, Overdue Tasks, Task Report, Ticket Report, Attendance Report, Leave Report, Leave Balance Report — each with: from/to, group-by, format (PDF/XLSX/CSV), schedule (one-time/cron), recipients[].

---

## 8 · CRM — Integrations & Settings

Tally, Zoho Books, QuickBooks, Razorpay, Stripe, PayU, Paytm, Cashfree, Shiprocket, Delhivery, GSTN, e-Invoice, e-Way bill, Google Calendar, Outlook, Gmail, Slack, Telegram, WhatsApp Cloud, Twilio, Webhook, Zapier, Make.com.
Settings: numbering schemas, default tax rates, default currency, fiscal year, branches, branding (logo, signature, watermark), email templates, WhatsApp/SMS templates, terms libraries, role/permission matrix, custom fields per entity, custom links, menu reordering, plan/credit usage view.

---

## 9 · HRM — Payroll

### 9.1 Employees
Personal: Salutation, First/Middle/Last name ★, Display name, DOB ★, Gender, Marital status, Spouse, Children[], Blood group, Nationality, Religion, Languages[], Photo, Personal email, Personal phone, Emergency contact (name/phone/relation), Identity (Aadhaar, PAN, Passport+expiry, Driving licence, Voter ID), Bank (acct no, IFSC, bank, branch, name on acct), UAN, ESIC no., Address (current, permanent).

Employment: Employee ID ★, Joining date ★, Confirmation date, Probation end, Type (full-time/part-time/contract/intern/consultant), Department ★, Designation ★, Reporting manager, Dotted-line manager, Work location, Shift, Work email ★, Work phone, Extension, Asset list[], Skills[], Certifications[], Education[], Past employment[], Salary structure ★, CTC, Variable %, Notice period, Status (active/on-leave/terminated/resigned), Exit date, Exit reason.

Documents: Offer letter, Appointment, Contract, NDA, KYC docs, Education certs, ID proofs, Visa (number, type, issued, valid till, country), Work permit.

### 9.2 Departments / Designations
Code, Name ★, Parent department, Head, Cost center, Description, Active?, Color, Designation level/grade, Min/Max CTC band, Reports-to designation.

### 9.3 Attendance
Date ★, Employee ★, Shift, Punch-in time, Punch-in location (lat/long, IP, device), Punch-in selfie, Punch-out time/location/selfie, Break in/out, Total hours ⚙, Overtime hours ⚙, Status (present/absent/half-day/leave/holiday/WFH), Late by, Early-out by, Source (manual/biometric/web/mobile), Approver, Notes.

### 9.4 Leave Management
Leave types (CL/SL/EL/ML/PL/Comp-off/Unpaid/...): code, name, paid?, accrual rule, max balance, carry-forward, encashable?, gender-restricted?, min service. Application: type ★, from ★, to ★, half-day, days ⚙, reason, attachments, approver chain, status, leave balance snapshot.

### 9.5 Holidays
Date ★, Name ★, Type (national/regional/religious/optional/restricted), Recurring?, Applicable locations[], Notes.

### 9.6 Payroll Run
Period ★, Pay date, Lock date, Employees[], Earnings[] (basic, HRA, conveyance, special, bonus, OT, incentives, arrears), Deductions[] (PF, ESI, PT, TDS, loan, LOP), Reimbursements[], Gross, Net, Cost-to-company, Bank file (NEFT/IMPS), Status (draft/processing/approved/disbursed/closed), Approvals.

### 9.7 Salary Structure
Name, Effective date, Components[] (name, code, type=earning|deduction|reimbursement, calc=fixed|%basic|%CTC|formula, taxable?, statutory?, prorate?, frequency, max cap, min cap), Applicable to (employee/department/grade), Active?.

### 9.8 Payslips
Auto-generated per run; fields: header (company, period), employee details, earnings table, deductions table, net pay in words, YTD totals, attendance summary, leave balance, bank info, signature, watermark, locked?, sent?, downloaded log.

### 9.9 Statutory Compliance
PF: UAN, PF no., employer/employee %, wage ceiling, PF challan upload.
ESI: ESI no., employer/employee %, wage ceiling, ESI challan.
PT: state, slabs, monthly amount, challan.
TDS: section (192/194C/194J/...), PAN, deductee type, gross, deduction, challan, certificate.
Form 16: AY, employer TAN, Part A (TDS summary), Part B (income computation), digital signature, dispatch log.

### 9.10 Performance & Appraisal
Goal Setting, KPI Tracking, Appraisal Reviews — fields: cycle, employee, reviewer(s), self-rating, manager-rating, peer-rating, normalized score, increment %, new CTC, promotion?, comments, approver.

### 9.11 Reports
Attendance Report, Leave Report, Leave Balance, Payroll Summary, Salary Register, PF/ESI/PT/TDS registers, Form 24Q, Form 12BA, Bank Disbursement Sheet — exports + scheduled emails.

### 9.12 HRM Settings
Workflows, Approval chains, Working days, Overtime rules, Late marking rules, Leave year, Notice period rules, Probation rules, Resignation workflow, Asset return checklist, Notification templates.

---

## 10 · HRM — HR (People Ops)

Recruitment: Job Postings (title, location, dept, type, openings, JD, skills, salary range, experience, education, status, careers-page visibility, expiry), Candidates (full ATS profile, resume, parsed skills, source, stage, ratings, interview history, offer status), Interviews (round, panel, mode, link, slot, feedback form), Offers (template, CTC, joining date, validity, e-sign, status), Careers Page (slug, theme, intro, jobs list, application form fields).

Onboarding: Onboarding (checklist, owner, due dates, completion %), Welcome Kits (items, assigned, delivered), Probation Tracker (start, end, milestones, review, decision), Org Chart (visualizer settings), Directory (search filters, visibility).

People Performance: OKRs & Goals (objective, KRs, weight, period, owner, progress %, score), 360 Feedback (cycle, raters, anonymous?, questions, summary), Recognition (kudos type, points, message, public?), Surveys & Pulse (questions, audience, anonymous?, schedule, results), One-on-Ones (template, agenda, action items).

Learning: Training Programs (title, mode, instructor, schedule, capacity, attendance, score, certificate), Certifications (employee, name, issuer, issued, expiry, file), Learning Paths (steps, prerequisites, completion).

Documents & Assets: Documents (employee, type, file, expiry, verified?), Document Templates, Asset Register (asset id, type, model, serial, value, condition, status), Asset Assignments (employee, from, to, return condition, photos).

Time & Expenses: Timesheets (week, project, task, hours/day, status, approver), Travel Requests (purpose, mode, from/to, dates, advance, status), Expense Claims (lines: date, category, amount, receipt, project, approver, reimbursed?).

Exit & Comp: Exits (type, notice start, last day, F&F, exit interview, NOC, asset return, knowledge transfer), Succession Plans (role, candidates, readiness), Compensation Bands (level, min/mid/max), Announcements (audience, scheduled, channels), Policy Library (policy, version, file, acknowledgement).

---

## 11 · Sidebar IA (target structure for agents)

```
CRM
├── Dashboard
├── Sales
│   ├── Clients & Prospects · Quotations · Proforma · Sales Orders
│   ├── Delivery Challans · Invoices · Payment Receipts · Credit Notes
│   ├── Pipelines · Forms
├── Purchases
│   ├── Vendors · Purchases & Expenses · Purchase Orders · Payouts
│   ├── Debit Notes · Purchase Leads · Hire & Services
├── Inventory
│   ├── All Items · Warehouses · Stock Adjustments
│   ├── Reports → P&L · Stock Value · Batch Expiry · Party Txns · All Txns
├── Accounting
│   ├── Account Groups · Chart of Accounts · Voucher Books
│   ├── Reports → Balance Sheet · Trial Balance · P&L · Income Statement · Day Book · Cash Flow
├── Sales CRM
│   ├── Leads · Contacts · Deals · Tasks · Automations
│   ├── Pipelines · Pipeline Stages · Statuses · Sources · Categories · Products · Agents
│   ├── Forms · Custom Forms · Notes · Consent · Settings
│   ├── Reports → Leads Summary · Team Sales · Client Performance · Lead Source
├── Banking
│   ├── All Accounts · Bank Accounts · Employee Accounts · Bank Transactions · Reconciliation
├── HRM
│   ├── Recruitment → Jobs · Candidates · Interviews · Offers · Careers Page
│   ├── People → Directory · Onboarding · Welcome Kits · Probation · Org Chart
│   ├── Attendance & Leave → Daily Attendance · Leave · Holidays · Shifts · Rotations · Change Requests · Time Logs · Weekly Timesheets
│   ├── Payroll → Employees · Add Employee · Departments · Designations · Salary Structure · Run Payroll · Payslips
│   ├── Compliance → PF/ESI · Professional Tax · TDS · Form 16
│   ├── Performance → Goals · KPIs · Appraisals · OKRs · 360 Feedback · One-on-Ones · Recognition · Surveys
│   ├── Learning → Training · Certifications · Learning Paths
│   ├── Docs & Assets → Documents · Templates · Assets · Assignments
│   ├── Travel & Expenses → Timesheets · Travel · Expense Claims
│   ├── Exit & Comp → Exits · Succession · Compensation Bands · Announcements · Policies
│   ├── Reports → Attendance · Leave · Payroll Summary · Salary Register
│   └── Settings
├── Reports
│   ├── GST → GSTR-1 · GSTR-2B
│   ├── Sales → Top Clients · Top Products · Sales Deals · Invoice Aging · Payment Report
│   ├── Operations → Late · Overdue Tasks · Task · Ticket · Project Status · Agent Performance
│   ├── HR → Attendance · Leave · Leave Balance · Birthday/Anniversary
│   ├── Finance → Income · Expense · P&L · Tax · Leads Conversion
├── Integrations
└── CRM Settings
```

This is the IA the sidebar agent should produce. All current card pages should redirect (or 404) once their items live in the sidebar.

---

## 12 · Additional Features (advanced / cross-cutting)

### 12.1 Subscriptions & Recurring
Plan ★, billing cycle (weekly/monthly/quarterly/annual/custom-cron), trial days, setup fee, prorate?, dunning rules, retry schedule, grace period, auto-pause on failure?, tax mode, mid-cycle change behavior (immediate/next-cycle/end-of-period), cancellation policy, renewal reminders[], gateway, customer portal slug, webhook on event[].

### 12.2 Contracts & E-Signature
Title ★, party A/B, type (NDA/MSA/SOW/AMC/employment/vendor), template, version, effective date ★, expiry, auto-renew?, renewal notice (days), values inserted via merge tokens, signers[] (name, email, phone, role, order, fallback), signing method (typed/drawn/uploaded/Aadhaar e-sign/DSC), audit trail (IP, geo, device, timestamps), watermark, status (draft/sent/viewed/partially_signed/completed/expired/voided), reminders, attachments, post-sign webhook.

### 12.3 RFQ / Bid Management
RFQ no., scope, vendors invited[], deadline, attachments, vendor responses[] (price, lead time, T&C, attachments, score), evaluation matrix, awarded vendor, conversion to PO.

### 12.4 GRN / GIN / MRN (Inventory documents)
GRN: PO ref ★, vendor invoice no., received qty per line, accepted/rejected qty, batch, expiry, serials, QC status, warehouse, store-keeper, photos.
GIN (Goods Issue Note): department, issued-to employee, project, items, qty, return date.
MRN (Material Return): from warehouse, to vendor/inventory, reason, items, condition.

### 12.5 BOM / Manufacturing
BOM: finished good ★, components[] (item, qty, unit, scrap %, optional?), labour, overhead, output qty, version, effective date, status.
Job Card / Production Order: BOM ref, planned qty, start/end, machine, operator, actual yield, scrap, downtime reasons, cost roll-up.

### 12.6 POS / Online Store
Outlet, terminal, cashier, shift, opening cash, items scan, customer, applied promotions, payment splits, change, receipt template, hold/recall, refund/exchange.
Online store: storefront slug, theme, collections, products, pricing rules, taxes, shipping zones, checkout fields, gateways, abandoned cart recovery.

### 12.7 Coupons / Promotions / Loyalty / Gift Cards
Coupon: code, type (% / flat / BOGO / free-ship), min cart, max uses (total + per customer), validity, applicable products/categories/customers, stackable?, exclusions.
Loyalty: tiers (name, threshold, multiplier, perks), points per ₹, expiry, redemption ratio, partner stores.
Gift Card: code, issued-to, value, balance, expiry, transferable?, redemption log.

### 12.8 Tickets / Help Desk / SLA
Ticket: subject ★, requester, channel (email/web/WhatsApp/chat/phone/portal), product, category, priority, severity, due-by ⚙ (from SLA), assignee, status, satisfaction rating, internal notes, attachments, linked deal/invoice, parent/child, merge log.
SLA: name, conditions, first-response target, resolution target, business hours, escalation matrix.

### 12.9 Knowledge Base & FAQ
Category, slug, title, body (rich), tags, status (draft/published), visibility (public/portal/internal), helpful?-counter, view count, related articles, last reviewed, owner.

### 12.10 Customer / Vendor / Employee Portals
Self-serve login, document downloads (invoices, payslips, Form 16), raise tickets, approve quotes, accept e-sign, update KYC, view balance, request leave (employee), apply for leads (vendor).

### 12.11 Field Service / Dispatch / AMC
Service contract (AMC): customer, asset[], coverage, start/end, frequency, technician, billing, escalation.
Service request: type, priority, location, scheduled at, technician, parts used, time spent, photos, customer signature, invoice generated?

### 12.12 Bookings / Reservations / Appointments
Resource (room/equipment/staff), service, customer, slot start/end, recurring rule, capacity, payment status, reminders, cancellation policy, no-show flag.

### 12.13 Fixed Assets & Depreciation
Asset code, name, category, purchase date, supplier, cost, useful life, depreciation method (SLM/WDV/units), residual value, location, custodian, condition, warranty, insurance, AMC, retire/sell entry, accumulated depreciation ⚙, NBV ⚙.

### 12.14 Budgets & Forecasting
Budget head (account/department/project/cost-center), period, plan amount, actual ⚙, variance ⚙, alerts at %, owner, approver, scenario (best/base/worst).

### 12.15 Cash & Petty Cash
Petty cash float per branch/employee, top-up, expense voucher, denomination count, daily reconciliation, IOU register.

### 12.16 Loans & Advances
Type (employee salary advance / customer loan / vendor advance), principal, interest rate, tenure, EMI schedule ⚙, prepayment rules, NPA flag, guarantor, documents, repayment auto-deduct from payroll?

### 12.17 Multi-currency & FX
Base currency, supported currencies[], FX provider, rate as-of, manual override, realised gain/loss, unrealised, revaluation run.

### 12.18 Multi-branch / Multi-location / Cost Centers
Branch (code, name, address, GSTIN, manager, opening balance), Cost center (code, name, parent, default ledger, budget), Project (code, name, customer, budget, billable?, members[]).

### 12.19 Reviews / NPS / Referral
NPS survey: trigger event, audience, scale, follow-up question, dispatch channel, scoring, dashboard.
Referral: referrer, referee, code, status, reward (points/credit/cash), payout.

### 12.20 Communications & Templates
Universal template store: type (email/SMS/WhatsApp/PDF/portal), category, language, variables (merge tokens with descriptors), preview, locked variants, A/B variants, last used, owner.
Reminder/Notification rules: event, audience, channel, lead-time, frequency, throttle, mute window.

### 12.21 Audit Log & Activity Timeline
Per-entity timeline (created, edited fields with diff, status changes, comments, attachments added, emails sent, calls logged, e-signs, payments). Global audit (user, IP, geo, action, target, before/after, reason).

### 12.22 Workflow & Approvals
Definition: name, entity, trigger condition, steps[] (approver = user/role/manager/dynamic, parallel?, SLA, on-reject, on-timeout), version, active, audit.
Run: state (pending/approved/rejected/escalated), comments per step, attachments per step.

### 12.23 Bulk Import / Export / Data Hygiene
Per entity: CSV/XLSX/JSON, mapping wizard, dedupe key, validation report, dry-run, schedule. Hygiene: dedupe rules, merge UI, blacklist, GDPR/DPDP erase request workflow, consent ledger.

### 12.24 Custom Dashboards / BI
Widgets (metric/line/bar/donut/table/funnel/heatmap/map/list), data source (saved view / SQL-like query / report), filters, drill-down, share/embed, refresh interval.

### 12.25 Saved Views / Filters / Segments
Per list: filters (with AND/OR groups), columns, sort, density, share scope (private/team/global), pinned. Audience segments built from any entity (used by automations, broadcasts, dashboards).

### 12.26 Background Jobs / Scheduling
PM2 worker queues already exist — exposed UI: job type, schedule (cron / once / on-event), payload, retries, last run, next run, logs.

### 12.27 Tax & Compliance India (deepening)
HSN/SAC master, GST rate slabs, e-invoice IRP credentials, e-way bill credentials, GSTR-1/2B/3B/9 generation + reconciliation, ITC ledger, RCM register, TCS u/s 206C, TDS u/s 194Q, MSME 45-day rule alerts, SAC for services, GSTR-CMP-08 (composition), 8-digit HSN for >₹5cr turnover toggle.

### 12.28 HR — Disciplinary, Grievance, Awards, Disciplinary
Cases: type, employee, raised by, severity, evidence, hearings, decision, appeal.
Awards/Recognitions: program, criteria, nominations, voting, winner, payout, certificate.

---

## 13 · Cross-feature linking plan

Every field that **references another entity** must be a **searchable, type-ahead, paginated picker** — not a free-text input, not a static native `<select>`. This unlocks: data integrity, instant navigation between modules, single source of truth, and automation (reminders, automations, reports) that work across the whole graph.

### 13.1 Master entity catalogue (every "linkable" entity)

| Entity | Search by | Display chip | Quick-create? | Recent items? |
|---|---|---|---|---|
| Client | name, GSTIN, phone, email, code | name + GSTIN + city | yes | yes |
| Vendor | name, GSTIN, phone, email | name + GSTIN | yes | yes |
| Lead / Contact | name, phone, email, company | name + company + stage | yes | yes |
| Deal | title, client name | title + amount + stage | yes | yes |
| Employee | name, employeeId, dept, designation, email | name + designation + dept | yes (HR only) | yes |
| Item / Product | name, SKU, barcode, HSN | thumb + name + SKU + price | yes | yes |
| Warehouse | name, code, city | name + code | yes | no |
| Bank account | name, last-4, IFSC | name + last-4 | yes | no |
| Account (COA) | code, name | code + name + nature | yes | yes |
| Pipeline / Stage | name | name + color dot | no | no |
| Department | name, code | name + head | yes | no |
| Designation | name, level | name + level | yes | no |
| Tax rate | name, % | rate + label | no | yes |
| Currency | code | code + symbol + name | no | yes |
| Project / Cost center / Branch | code, name | code + name | yes | yes |
| Document template | name, type | name + type | no | yes |
| User / Agent / Owner | name, email, role | avatar + name + role | no | yes |
| Tag | name | name | yes (inline) | yes |
| Source / Status / Category | name | name | yes (inline) | yes |
| HSN / SAC | code, description | code + desc + GST% | no | yes |
| Pincode | pincode | pincode + city + state | no | no |
| State / Country | name, ISO | flag + name | no | no |
| Asset | code, name, serial | code + name + custodian | no | no |
| Ticket | id, subject | #id + subject + priority | no | yes |
| Invoice / Quotation / SO / PO / Bill / Receipt | doc no., client/vendor | no. + party + amount + date | no | yes |
| Coupon | code | code + value + status | no | no |
| Plan / Subscription | name | name + cycle + price | no | yes |
| Shift | name, timing | name + timing | no | no |
| Holiday | date | date + name | no | no |

> Rule: **if a field stores a foreign id, it MUST use the picker.** No free-text input for entity references.

### 13.2 Where these pickers must replace existing fields

Below is the audit map — wherever the form has the **left** field today, change to a picker bound to the **right** entity:

- Invoice / Quotation / SO / Proforma / Delivery / Receipt / Credit Note → `client` (Client picker), `salesAgent` (User), `pipeline/deal` (Deal), `warehouse` (Warehouse), `taxRate` (Tax), `currency` (Currency), `template` (Template), `branch` (Branch), `project` (Project), each `lineItem.itemId` (Item), `paymentMethod`/`bankAccount` (Bank).
- Bill / PO / Debit Note / Payout → `vendor` (Vendor), the rest analogous.
- Lead / Contact / Deal / Task → `owner` (User), `pipelineId/stageId` (Pipeline+Stage), `source` (Source), `client/contact` (Client/Contact), linked `dealId`, `taskId`, `ticketId`.
- Item form → `vendor[]` (Vendor multi), `category` (Category), `brand` (Brand), `manufacturer` (Manufacturer), `salesAccount` / `purchaseAccount` / `stockAccount` / `cogsAccount` (Account), `taxRate` (Tax), `unit/altUnit` (Unit), `hsn` (HSN/SAC), `defaultWarehouse` (Warehouse).
- Employee form → `department` (Department), `designation` (Designation), `manager` (Employee), `dottedManager` (Employee), `shift` (Shift), `salaryStructure` (Salary Structure), `bankAccount` (BankAccount), `branch` (Branch).
- Payroll Run → `employees[]` (Employee multi).
- Leave application → `type` (Leave Type), `approver` (Employee).
- Asset / GRN / MRN → `item` (Item), `vendor` (Vendor), `warehouse` (Warehouse), `assignedTo` (Employee).
- Tickets → `requester` (Client | Lead | Employee), `assignee` (User), `product` (Item).
- Reports / Dashboards / Saved Views — every filter chip uses a picker.
- Automations / Workflows — every "if X equals" / "set Y to" picks the entity through a picker (with attribute drill-down).

### 13.3 Reusable component spec — `<EntityPicker>`

A single component, configured per entity. New code MUST use it; existing one-off `<Select>`s should be migrated.

```ts
// src/components/crm/entity-picker.tsx
type EntityKey =
  | 'client' | 'vendor' | 'lead' | 'contact' | 'deal' | 'employee'
  | 'item' | 'warehouse' | 'bankAccount' | 'account' | 'pipeline'
  | 'stage' | 'department' | 'designation' | 'taxRate' | 'currency'
  | 'project' | 'costCenter' | 'branch' | 'template' | 'user'
  | 'tag' | 'source' | 'status' | 'category' | 'hsn' | 'pincode'
  | 'state' | 'country' | 'asset' | 'ticket' | 'invoice' | 'quotation'
  | 'salesOrder' | 'purchaseOrder' | 'bill' | 'receipt' | 'coupon'
  | 'plan' | 'subscription' | 'shift' | 'holiday';

interface EntityPickerProps<T extends EntityKey> {
  entity: T;                              // drives endpoint, schema, chip
  value: string | string[] | null;        // id(s)
  onChange: (next: string | string[] | null, hydrated?: any | any[]) => void;
  multi?: boolean;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  filter?: Record<string, unknown>;       // e.g. { active: true }, { warehouseId }
  scope?: 'project' | 'tenant' | 'global';
  allowCreate?: boolean;                  // shows "+ Create new …" inside dropdown
  createInitial?: Partial<EntityShape<T>>;// pre-fill quick-create modal
  recentLimit?: number;                   // default 5 — shown when search empty
  showChipMeta?: boolean;                 // default true
  hydrate?: 'always' | 'on-demand';       // include full doc back to onChange
  popoverWidth?: 'trigger' | 'auto' | number;
  onCreated?: (created: any) => void;
}
```

Behaviour:
1. **Search**: 200ms debounce, server `q` param + entity-specific filters; results are paginated (cursor or page+limit, infinite-scroll).
2. **Empty state**: shows "Recent" (last 5 used or last 5 viewed by current user — stored in `userPrefs.recent.<entity>`).
3. **Hydrate on mount**: when `value` is set but the option list doesn't include it, fetch by id and prepend.
4. **Quick-create**: when `allowCreate=true`, last item in the dropdown is "+ Create new <entity>" → opens the entity's existing create form in a side-sheet/modal (re-using the route component, not duplicating). On success calls `onChange` and `onCreated`.
5. **Keyboard**: arrow-keys, Enter to select, Cmd/Ctrl+K to clear, Cmd/Ctrl+Click chip to navigate to entity detail.
6. **Multi**: chips with × to remove; bulk paste (comma/newline) parses into multi-id resolution against canonical fields (e.g. SKUs for items).
7. **Inline detail peek**: hover/long-press a chip shows a 320px popover with summary and quick links (View · Edit · Open in module). Reuse `<EntityPeek entity=… id=… />`.
8. **Field-level RBAC**: respects plan + role; if user lacks `read.<entity>` the picker degrades to read-only chip.

### 13.4 API contract — `/api/crm/lookup/[entity]`

One unified server action **and** route per entity for type-ahead. Reuse existing actions where they exist.

```ts
// app/api/crm/lookup/[entity]/route.ts
GET ?q=&page=&limit=&filter=<json-base64>&ids=<csv>&scope=&projectId=
→ { items: T[], page, limit, total, hasMore, recent?: T[] }
```

Each entity provides:
- `searchableFields[]`: ordered list of fields searched (full-text index in Mongo).
- `chip(item)`: returns `{ primary, secondary, tertiary, avatarUrl, color }` — drives the visual chip without leaking schema details.
- `defaultFilter(ctx)`: e.g. `{ active: true, archived: { $ne: true } }`.
- `permissions(ctx)`: which roles may read.

Implementation note: build one `lookupRegistry` map in `src/app/actions/crm-lookup.actions.ts` with one entry per entity, and a single server action `lookupEntity(entity, params)`. The picker calls the action via a thin client wrapper.

### 13.5 Cross-feature data lineage (the chain)

Every document keeps a `lineage` array of `{ kind, id, no, createdAt }` references so the UI can show the chain:

```
Lead → Deal → Quotation → Sales Order → Delivery Challan → Invoice → Receipt
                              ↓                                ↑
                        Proforma ──────────────────── Credit Note (issued back)
```

```
RFQ → Vendor Bid → Purchase Order → GRN → Bill → Payout
                                          ↓
                                      Debit Note
```

UI: a "Linked Documents" rail on the right side of every detail page, ordered by lineage with status badges and click-through. Conversion buttons ("Convert to Invoice", "Convert to SO") add to lineage and pre-fill the next form using the previous doc's fields.

### 13.6 Universal "Quick-add" + Cmd-K

Global `Cmd/Ctrl+K` palette:
- Search across every entity (uses lookup registry — same backend).
- Top results grouped by entity.
- Actions: open detail, "create new" wizard for any entity, run a saved view, jump to a sidebar route.
- Recent + pinned items per user.

### 13.7 Inline create / edit / convert (no page jumps)

- Convert quotation → SO/Invoice opens a side-sheet with all fields prefilled from lineage.
- Editing a customer from inside an invoice opens a side-sheet, saves and refreshes the picker chip without losing the invoice draft (autosave drafts to local + Redis).
- Bulk row edit on lists (table inline-editing) for fields that are pickers → still uses `<EntityPicker>` but in compact mode.

### 13.8 Custom fields → still pickable

Custom field type `entity_ref` (with target entity key) plugs into `<EntityPicker>` automatically. This means a user-defined "Account Manager" field on Clients (target = User) gets the same picker, recent items, peek and quick-create — no developer changes per custom field.

### 13.9 Performance & cost

- Mongo text indexes per searchable field set; compound `{ projectId, name }`.
- Redis cache: per-tenant per-entity LRU of last 1000 items keyed by `<tenantId>:<entity>`.
- Picker prefetches first page on focus (not mount) to avoid overfetching list pages.
- Bulk operations (e.g. import) bypass the picker and resolve via the same lookup registry server-side, in batches of 500.

### 13.10 Migration / rollout phasing

> **Backend-language directive (2026-05-06):** From this point on, any *new* CRM backend code introduced by §13.10 work (lookup endpoints, conversion/lineage actions, codemod-installed helpers, etc.) is to be authored in **Rust** in `rust/crates/`. Already-shipped TypeScript server actions (e.g. `crm-lookup.actions.ts`) stay as-is — no retroactive rewrite. Steps that only touch frontend forms (2, 3) remain TS/TSX.

1. Build `EntityPicker` + `lookupRegistry` for top 8 entities (Client, Vendor, Item, Employee, User, Account, Warehouse, Bank). One PR. **— DONE** (Phase 2 foundation + Phase 3 expansion, see §15)
   - [src/lib/lookup-registry.ts](src/lib/lookup-registry.ts) — `EntityKey` union + `ENTITY_KEYS` (18 entities; top-8 fully covered: `client`, `vendor`, `item`, `employee`, `user`, `account`, `warehouse`, `bankAccount`)
   - [src/app/actions/crm-lookup.actions.ts](src/app/actions/crm-lookup.actions.ts) — tenant-scoped `lookupEntity(entity, params)` server action + `makeMongoLookup()` helper + concrete registry entries
   - [src/components/crm/entity-picker.tsx](src/components/crm/entity-picker.tsx) — `<EntityPicker>` + `<EntityPickerChip>` (debounce, abort, recents, infinite scroll, multi-select, quick-create)
2. Migrate Invoice / Quotation / SO / Bill / PO forms to the picker. One PR each module. **— DONE** (Phase 2, see §15)
   - [src/app/dashboard/crm/sales/invoices/new/page.tsx](src/app/dashboard/crm/sales/invoices/new/page.tsx) — `client` picker (PoC)
   - [src/app/dashboard/crm/sales/quotations/new/page.tsx](src/app/dashboard/crm/sales/quotations/new/page.tsx) — `client` + line-item `item` pickers
   - [src/app/dashboard/crm/sales/orders/new/page.tsx](src/app/dashboard/crm/sales/orders/new/page.tsx) — `client` + line-item `item` pickers
   - [src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx](src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx) — `vendor`, `warehouse`, line-item `item` pickers (PO)
   - [src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx](src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx) — `vendor` + optional billable `client` (Bill)
   - All preserve original submit shape via hidden `<input>` so server actions stayed untouched.
3. Migrate Lead / Deal / Task / Ticket / Employee forms. **— DONE (Lead, Deal, Employee)** — partial; Task/Ticket pending in next runs.
   - Employee — Phase 2: [src/components/wabasimplify/crm-employee-form.tsx](src/components/wabasimplify/crm-employee-form.tsx) — `reportingTo` (`employee`, self-excluded) + linked `bankAccount`.
   - Lead — 2026-05-06: [src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx](src/app/dashboard/crm/sales-crm/all-leads/new/page.tsx) — `assignedTo` migrated from `<ZoruSelect>` (single hard-coded "Me" option) to `<EntityPicker entity="user">`. Submit shape preserved via hidden `<input name="assignedTo">`. Pipeline/stage left on `SmartPipelineSelect` because they aren't in the canonical-8 picker set and `stage` requires name-not-id submit shape pinned to the loaded pipeline.
   - Deal — 2026-05-06: [src/components/wabasimplify/crm-create-deal-dialog.tsx](src/components/wabasimplify/crm-create-deal-dialog.tsx) — `accountId` migrated from `<ZoruSelect>` (driven by injected `accounts` prop, ~unbounded list) to `<EntityPicker entity="client">` (paginated/searchable). Submit shape preserved via hidden `<input name="accountId">`. State seeded from `defaultAccountId`, reset on submit-success. `contactId` left as-is — `contact` is not in `ENTITY_KEYS` yet (registry addition required, P1). Stage left as static `dealStages[]` select.
   - **NEXT sub-form →** Task form (entity refs: `assignedTo` user, related-to `client`/`vendor`/`deal`/`lead`).
   - Ticket form (next after Task) — entity refs: requester `client`, `assignedTo` user.
4. Add lineage rail to detail pages.
5. Ship Cmd-K palette (reuses registry).
6. Ship custom-fields `entity_ref` type.
7. Backfill: replace any remaining `<Select>` in CRM/HRM with `EntityPicker` via codemod-able grep — track in a checklist issue.

### 13.11 Acceptance criteria (per migrated form)

- No free-text input for any entity reference.
- Picker shows recent on focus, debounced search, infinite-scroll, hydrate-on-mount.
- Quick-create works for at least: Client, Vendor, Item, Tag, Account.
- Chip click navigates to detail; chip ⌘-click opens in side-sheet.
- Removing the value clears related dependent fields (e.g. clearing client clears address, currency, price-list, GSTIN — but only if user hasn't manually overridden).
- Server-side validation rejects unknown ids; hydration is server-trusted, not client.
- Lighthouse / CWV: picker first-paint < 50ms after focus; search round-trip < 300ms p95.

---

## 14 · Cross-feature automation surface

Once everything is linked through pickers + lineage, the following cross-module automations become trivial to wire (and should be supported in `Sales CRM → Automations`):

- New Invoice → if overdue 7d → send WhatsApp reminder + create Task for assignee.
- Lead stage = Won → create Client + create Deal-to-Quotation conversion + assign onboarding template.
- Employee added → create payroll record, asset assignment checklist, welcome kit ticket, calendar invite, Slack DM.
- Stock < reorder → create PO draft to default vendor, notify procurement.
- Bill received → if MSME 45-day rule applies → schedule reminder & flag in dashboard.
- Subscription failed payment → dunning ladder (email d1, SMS d3, WhatsApp d5, ticket d7, suspend d14).
- Ticket idle > SLA → escalate, page on-call, drop CSAT survey on resolution.
- Quotation accepted (e-sign) → create SO + send to warehouse + create Invoice draft.

Each rule becomes a row in the Automations table, all entity references via pickers; conditions and actions traverse the same lookup registry — no code change per rule.

---

## 15 · Execution log (what's already shipped)

This section is the **source of truth for what's done vs. pending** so a fresh session can pick up without re-discovering. Date-stamped in absolute dates. Read this first before touching code in `src/app/dashboard/crm/**` or `src/components/crm/**`.

### ✅ Phase 1 — Sidebar IA + cards-to-redirects (2026-05-06)

#### Sidebar rewrite

- `src/components/wabasimplify/crm-tab-layout.tsx` — `crmMenuItems` rewritten to mirror §11 IA (~264 lines changed). New top-level **Reports** group; **Sales CRM** sub-grouping introduced; **HR & Payroll** expanded from 7 → 14 sub-groups: Recruitment, People, Employee Mgmt, Attendance & Leave, Shifts & Time, Payroll Mgmt, Statutory, Performance & Growth, Learning, Docs & Assets, Travel & Expenses, Exit & Comp, Reports, Settings. Awards/Recognition links to `/dashboard/hrm/hr/awards`; Disciplinary Cases to `/dashboard/hrm/hr/disciplinary`.
- The active dashboard chrome on most routes is `src/components/zoruui/shell/zoru-home-shell.tsx` (mounted via `src/app/dashboard/layout.tsx`). `crm-tab-layout.tsx` itself is no longer on the active path but is still imported elsewhere — left alone.

#### Cards-to-redirect (9 module landing pages)

Each previously rendered `<CrmModuleOverview>` cards. All now `redirect()` server-side to the first concrete sub-route:

| Path | Redirects to |
|---|---|
| `src/app/dashboard/crm/sales/page.tsx` | `/dashboard/crm/sales/clients` |
| `src/app/dashboard/crm/purchases/page.tsx` | `/dashboard/crm/purchases/vendors` |
| `src/app/dashboard/crm/accounting/page.tsx` | `/dashboard/crm/accounting/charts` |
| `src/app/dashboard/crm/banking/page.tsx` | `/dashboard/crm/banking/all` |
| `src/app/dashboard/crm/sales-crm/page.tsx` | `/dashboard/crm/sales-crm/leads` |
| `src/app/dashboard/crm/hrm/page.tsx` | first concrete payroll route |
| `src/app/dashboard/crm/hrm/hr/page.tsx` | first concrete HR route |
| `src/app/dashboard/crm/workspace/page.tsx` | `/dashboard/crm` |
| `src/app/dashboard/crm/time-tracking/page.tsx` | `/dashboard/crm` |

#### What was kept (do not delete)

- `src/components/crm/crm-module-overview.tsx` — still imported by other callers.
- `src/components/crm/crm-page-header.tsx` — same.
- `src/app/dashboard/crm/inventory/page.tsx` — already redirected before this work.

### ✅ Phase 2 — EntityPicker foundation + 21 §12 skeleton routes + 7 form migrations + lineage + Cmd-K (2026-05-06)

#### Foundation files (import these directly, do not re-create)

| Path | Exports | Purpose |
|---|---|---|
| `src/lib/lookup-registry.ts` | `EntityKey`, `ENTITY_KEYS`, `LookupChip`, `LookupItem`, `LookupParams`, `LookupResult`, `EntityLookupConfig`, `LookupRegistry`, `LOOKUP_MAX_LIMIT` | Pure type/contract module — safe to import in client code. |
| `src/app/actions/crm-lookup.actions.ts` | `lookupEntity(entity, params)` server action; internal `registry: LookupRegistry` and `makeMongoLookup({ collection, searchableFields, toChip, defaultFilter? })` helper | Tenant-scoped (`userId`-filtered), paginated, supports `ids[]` hydration + free-text `$regex` search. |
| `src/components/crm/entity-picker.tsx` | `<EntityPicker>`, `<EntityPickerChip>` | 200ms debounce + AbortController, hydrate-on-mount, recents in `localStorage` keyed `entityPicker.recent.<entity>` (max 5), infinite scroll, multi-select, optional `+ Create new …` row, zoru-ui styled. |

#### 21 §12 skeleton routes (one `page.tsx` each, all from commit `189d4eabe`)

CRM-side (19):

| Path | §12 ref |
|---|---|
| `src/app/dashboard/crm/sales/subscriptions/page.tsx` | §12.1 |
| `src/app/dashboard/crm/sales/contracts/page.tsx` | §12.2 |
| `src/app/dashboard/crm/sales/coupons/page.tsx` | §12.7 |
| `src/app/dashboard/crm/sales/loyalty/page.tsx` | §12.7 |
| `src/app/dashboard/crm/sales/gift-cards/page.tsx` | §12.7 |
| `src/app/dashboard/crm/purchases/rfqs/page.tsx` | §12.3 |
| `src/app/dashboard/crm/inventory/grn/page.tsx` | §12.4 |
| `src/app/dashboard/crm/inventory/bom/page.tsx` | §12.5 |
| `src/app/dashboard/crm/budgets/page.tsx` | §12.14 (top-level — **not** under accounting/) |
| `src/app/dashboard/crm/petty-cash/page.tsx` | §12.15 (top-level — **not** under banking/) |
| `src/app/dashboard/crm/loans/page.tsx` | §12.16 (top-level — **not** under banking/) |
| `src/app/dashboard/crm/tickets/sla/page.tsx` | §12.8 |
| `src/app/dashboard/crm/tickets/knowledge-base/page.tsx` | §12.9 |
| `src/app/dashboard/crm/service-contracts/page.tsx` | §12.11 (top-level) |
| `src/app/dashboard/crm/bookings/page.tsx` | §12.12 (top-level) |
| `src/app/dashboard/crm/fixed-assets/page.tsx` | §12.13 (top-level) |
| `src/app/dashboard/crm/audit-log/page.tsx` | §12.21 (top-level) |
| `src/app/dashboard/crm/portal/page.tsx` | §12.10 (top-level) |
| `src/app/dashboard/crm/dashboards/page.tsx` | §12.24 (top-level) |

HRM-side (2):

| Path | §12 ref |
|---|---|
| `src/app/dashboard/hrm/hr/awards/page.tsx` | §12.28 |
| `src/app/dashboard/hrm/hr/disciplinary/page.tsx` | §12.28 |

> Each is a 21-line placeholder with the §12 subsection title and a "coming soon" body. **Replace, don't recreate**, when implementing the real feature.

#### Form migrations to `<EntityPicker>` (1 PoC + 6 forms = 7 total)

Submit shapes preserved on every form via hidden `<input>` so server actions stayed untouched. Legacy `Smart*Select` components left in place pending a codemod sweep (P0).

| Form path | Pickers wired |
|---|---|
| `src/app/dashboard/crm/sales/invoices/new/page.tsx` (PoC) | `client` |
| `src/app/dashboard/crm/sales/quotations/new/page.tsx` | `client`, line-item `item` |
| `src/app/dashboard/crm/sales/orders/new/page.tsx` | `client`, line-item `item` |
| `src/app/dashboard/crm/purchases/orders/new/new-order-form.tsx` | `vendor`, `warehouse`, line-item `item` |
| `src/app/dashboard/crm/purchases/expenses/new/new-expense-form.tsx` | `vendor`, optional billable `client` |
| `src/app/dashboard/crm/sales/receipts/new/page.tsx` | `client`, `bankAccount` |
| `src/components/wabasimplify/crm-employee-form.tsx` | reporting-to `employee` (self-excluded), linked `bankAccount` |

#### Lineage system (§13.5)

| Path | Exports / change |
|---|---|
| `src/lib/lineage.ts` | `appendLineage(prev, next)`, `buildLineageFromParent(parent, parentKind)` — pure helpers. |
| `src/components/crm/lineage-rail.tsx` | `<LineageRail>`, `kindToHref: Record<LineageKind, (id) => string>`, `SALES_CHAIN`, `PURCHASE_CHAIN`. Auto-detects chain from `current.kind`. |
| `src/lib/definitions.ts` | New `LineageKind` union (16 values): `lead`, `deal`, `quotation`, `proforma`, `salesOrder`, `deliveryChallan`, `invoice`, `paymentReceipt`, `creditNote`, `rfq`, `vendorBid`, `purchaseOrder`, `grn`, `bill`, `payout`, `debitNote`. New `LineageRef`. Optional `lineage?: LineageRef[]` field added to **13 doc types**: `Deal`, `Lead`, `CrmPurchaseOrder`, `CrmDebitNote`, `CrmExpense` (Bill), `CrmPayout`, `CrmInvoice`, `CrmQuotation`, `CrmProformaInvoice`, `CrmPaymentReceipt`, `CrmSalesOrder`, `CrmDeliveryChallan`, `CrmCreditNote`. |

Conversion paths wired so far:
- `convertInvoiceToCreditNote` propagates lineage end-to-end.
- `saveInvoice` accepts optional `fromKind` / `fromId` form fields to seed lineage on creation.
- `src/app/dashboard/crm/sales/invoices/[invoiceId]/page.tsx` — minimal detail page rendering `<LineageRail>` (template for other detail pages).

#### Cmd-K palette (§13.6)

| Path | Exports | Behaviour |
|---|---|---|
| `src/components/crm/command-palette.tsx` | `<CommandPaletteProvider>`, `useCommandPalette()` hook, internal `<CommandPalette>` | Provider owns open state + the global `Cmd/Ctrl+K` listener (skipped while typing in inputs). Empty state: 11 quick actions + recents (round-robin from `entityPicker.recent.<entity>` localStorage, capped at 8). Search: 8-way parallel `lookupEntity` fan-out, debounced + aborted, grouped by entity. |

Mounted in `src/app/dashboard/layout.tsx` as `<CommandPaletteProvider>{children}</CommandPaletteProvider>`. Open programmatically from any client component: `const { open } = useCommandPalette(); open();`.

### ✅ Phase 3 — Registry expansion + 3 persistence wirings + entity_ref custom-field type (2026-05-06)

#### Registry — 18 entities total (10 → 18)

`ENTITY_KEYS` in `src/lib/lookup-registry.ts` (alphabetical, `as const satisfies readonly EntityKey[]`) and implemented in `registry: LookupRegistry` in `src/app/actions/crm-lookup.actions.ts`.

| Entity key | Backing source | Implementation | Status |
|---|---|---|---|
| `account` | `crm_chart_of_accounts` | inline lookup | ✅ |
| `bankAccount` | `crm_payment_accounts` | `makeMongoLookup` | ✅ |
| `branch` | (collection TBD) | inline, returns `[]` | 🟡 TODO-empty — swap to `makeMongoLookup` once `crm_branches` exists |
| `category` | `crm_product_categories` | `makeMongoLookup` | ✅ |
| `client` | `crm_accounts` | `makeMongoLookup` | ✅ |
| `currency` | static (12 ISO codes) | inline | ✅ |
| `department` | `crm_departments` | `makeMongoLookup` | ✅ |
| `designation` | `crm_designations` (`$lookup` joined to departments) | inline aggregation | ✅ |
| `employee` | `crm_employees` | inline | ✅ |
| `item` | `crm_products` | `makeMongoLookup` | ✅ |
| `pipeline` | embedded `users.crmPipelines[]` | inline (in-memory filter) | ✅ |
| `project` | `crm_projects` | `makeMongoLookup` | ✅ |
| `stage` | embedded `users.crmPipelines[].stages` | inline; composite id `pipelineId:stageId` | ✅ |
| `tag` | (collection TBD) | inline, returns `[]` | 🟡 TODO-empty — swap to `makeMongoLookup` once `crm_tags` exists |
| `taxRate` | `crm_taxes` + GST fallback slabs | inline | ✅ |
| `user` | `users` | inline | ✅ |
| `vendor` | `crm_vendors` | `makeMongoLookup` | ✅ |
| `warehouse` | `crm_warehouses` | `makeMongoLookup` | ✅ |

Exhaustive `Record<EntityKey, …>` maps are kept in lock-step in `entity-picker.tsx` (labels) and `command-palette.tsx` (labels, hrefs, empty-results). Adding a new entity → update `EntityKey` union + `ENTITY_KEYS` + registry entry + both maps.

#### 3 persistence wirings (fields now actually save)

| Server action | Form field | Stored as | Schema field added |
|---|---|---|---|
| `savePurchaseOrder` (`src/app/actions/crm-purchase-orders.actions.ts:95`) | hidden `warehouseId` | `ObjectId` (`ObjectId.isValid` validated) | `CrmPurchaseOrder.warehouseId?: ObjectId` |
| `savePaymentReceipt` (`src/app/actions/crm-payment-receipts.actions.ts:58`) | hidden `bankAccountId` | `ObjectId` (validated) | `CrmPaymentReceipt.bankAccountId?: ObjectId` |
| `saveCrmEmployee` (`src/app/actions/crm-employees.actions.ts:238`) | hidden `ext_bank_account_id` | written into `crm_employee_details.bank_account_id` | `ExtendedDetail.bank_account_id?` |

All three are optional and backward-compatible. Employee edit form hydrates `bank_account_id`. PO and Receipt edit pages don't exist yet (see P0).

#### `entity_ref` custom-field type (§13.8)

| Path | Change |
|---|---|
| `src/lib/worksuite/meta-types.ts:55` | `WsCustomFieldType` union extended with `'entity_ref'`. `WsCustomField` got `targetEntity?: EntityKey` + `multi?: boolean`. |
| `src/app/dashboard/crm/settings/custom-fields/new/new-field-form.tsx` | Settings UI got "Linked record" option, conditional entity-Select + Single/Multi toggle, driven by `ENTITY_KEYS` from `@/lib/lookup-registry`. |
| `saveCustomField` server action | Coerces `multi` via `asBool`; scrubs `targetEntity` for non-ref types. |
| `src/components/crm/custom-field-input.tsx` (new) | Exports `<CustomFieldInput>` + `<CustomFieldDisplay>`. Handles every `WsCustomFieldType`; `entity_ref` renders `<EntityPicker>` (input) / `<EntityPickerChip>` (display). **No consumers yet** — see P1. |

### 📌 Open follow-ups (priority order — pick the top item without hunting)

#### P0 — high-impact, cheap

- ~~**Dead `getCrmEmployees()` call**~~ ✅ done 2026-05-06 — removed from `src/app/dashboard/hrm/payroll/employees/new/page.tsx` and `[employeeId]/edit/page.tsx`; `managers` prop dropped from `EmployeeForm` (the form now uses `<EntityPicker entity="employee">` for reporting-to). Action `getCrmEmployees` itself stays — still used by 25+ directory/payroll list pages.
- ~~**Proforma lineage**~~ ✅ done 2026-05-06 — `lineage?: LineageRef[]` added to `CrmProformaInvoice` in `src/lib/definitions.ts:3097`; the `proforma` kind now renders in `<LineageRail>`.
- ~~**PO edit page**~~ ✅ done 2026-05-06 — `src/app/dashboard/crm/purchases/orders/[orderId]/edit/page.tsx` shipped. `getPurchaseOrderById` added to `crm-purchase-orders.actions.ts`; `savePurchaseOrder` extended to UPDATE branch when hidden `orderId` is present (matchCount-checked, scoped by `userId`). `NewPurchaseOrderForm` now accepts optional `order?: WithId<CrmPurchaseOrder>`, hydrating `vendorId`, `warehouseId`, dates, currency, paymentTerms, notes, and lineItems. Listing page's "View" link swapped to "Edit" → reaches the new route.
- ~~**Receipt edit page**~~ ✅ done 2026-05-06 — `src/app/dashboard/crm/sales/receipts/[receiptId]/edit/page.tsx` (server) + `edit-receipt-form.tsx` (client). Light-edit only: `bankAccountId`, `notes`, `receiptDate` are editable. Payment records and invoice settlements are immutable — reverting them safely would require unwinding `paidAmount` mutations on linked invoices, which is out of scope. New `getPaymentReceiptById` + `updatePaymentReceipt` actions in `crm-payment-receipts.actions.ts`. Receipts listing got an Actions column with an Edit link.

#### P1 — wire the shipped foundation into more places

- **Custom-field display in entity edit forms**: render `<CustomFieldInput>` / `<CustomFieldDisplay>` (from `src/components/crm/custom-field-input.tsx`) in deal, account, ticket, employee edit forms. Foundation ready, no consumers yet — call `getCustomFieldsFor(entity_type)` + `applyCustomFieldsToEntity` from worksuite meta actions.
- **Build remaining doc types** so their lineage kinds light up: `CrmRfq`, `CrmVendorBid`, `CrmGrn`, `CrmBill` (currently the `bill` kind maps to `CrmExpense`).
- **Backfill `lineage` propagation** beyond `convertInvoiceToCreditNote` + `saveInvoice` manual create: quotation → invoice, salesOrder → deliveryChallan, salesOrder → invoice, PO → bill, PO → GRN, GRN → bill.

#### P2 — performance + DX

- **Mongo text indexes** on each registry entity's `searchableFields`. Today's `$regex` is fine at small scale; index for big tenants (§13.9).
- **Server-side recents (Redis)** to replace `localStorage entityPicker.recent.*`. Key by `<tenantId>:<entity>` LRU of 1000 items per §13.9.
- **Swap TODO-empty registry entries** to `makeMongoLookup` once `crm_branches` and `crm_tags` collections land.
- **Pipelines collection migration**: when pipelines move from embedded-on-user to a real collection, replace the in-memory filter in `pipeline` and `stage` registry entries with a Mongo aggregation; preserve composite stage id `pipelineId:stageId`.
- **Cmd-K trigger button**: the `ZoruHomeShell` header has a `⌘K` chip that's purely visual — wire it to `useCommandPalette().open()`. Today the palette is keyboard-only.

#### P3 — broader form migration

Migrate remaining forms to `<EntityPicker>` (search for older `Smart*Select` and native `<Select>` references first):
- Lead, Deal, Contact, Task, Ticket forms.
- Item form: `vendor[]`, `category`, `salesAccount`/`purchaseAccount`/`stockAccount`/`cogsAccount`, `hsn`, `taxRate`.
- Credit-note, Debit-note, Delivery-challan forms.
- Salary-structure form.
- Drop `SmartDepartmentSelect` / `SmartDesignationSelect` from the employee form now that the registry has both.
- Backfill saved views / segments / dashboards to use the lookup registry as their filter source.
- **Broader `Smart*Select` codemod**: 12+ form files still import legacy components from `src/components/crm/**/smart-*-select.tsx`. Not 1:1 with the registry — `smart-vendor-type-select`, `smart-industry-select`, `smart-unit-select`, `smart-brand-select`, `smart-location-select` have no registry entity yet (need a registry addition or stay as static dropdowns). The rest (`smart-client-select`, `smart-vendor-select`, `smart-product-select`, `smart-warehouse-select`, `smart-pipeline-select`, `smart-department-select`, `smart-designation-select`, `smart-account-group-select`, `smart-ledger-select`, `smart-category-select`) can be swapped for `<EntityPicker>` directly.

#### P4 — flesh out the §12 skeleton pages with real features

(Skeleton routes already exist; replace the placeholder `page.tsx`.)
- Subscriptions & recurring billing — cron + dunning ladder.
- Contracts & e-signature — Aadhaar e-sign + Digio/Razorpay integration.
- RFQ → Bid → PO conversion flow (lineage already mapped).
- GRN, BOM, manufacturing job cards.
- POS terminal + online store.
- Tickets/help-desk + SLA engine + KB.
- Bookings/appointments.
- Fixed assets + depreciation runs.
- Budgets & forecasting.
- Petty cash, loans/advances.
- Custom dashboards (BI builder).
- Customer / vendor / employee portals.
- Audit log surface.
- Awards & recognition, disciplinary cases (HRM).

---

> When picking up: read §15 first, then jump to the highest-priority P-tier with capacity. Each item is small enough to dispatch as a single agent with a tight prompt — file paths and exports are noted above so the prompt can stay self-contained.
