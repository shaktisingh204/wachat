# Step-by-Step Execution Plan — CRM + HRM
**Last updated:** 2026-05-19

Granular, ordered task list. Every step is actionable by a single developer or agent.

---

## SPRINT 1 (Week 1–2): Dual-Impl Tier-1 Wiring

### Step 1: Wire crm-contacts (highest read volume)
1. Open `src/app/actions/crm-contacts.actions.ts`
2. Import `crmContactsApi` from `@/lib/rust-client/crm-contacts`
3. Add `useRustCrm()` helper (same pattern as crm-warehouses.actions.ts)
4. Wrap `getContacts(query)` → `crmContactsApi.list(query)`
5. Wrap `getContactById(id)` → `crmContactsApi.get(id)`
6. Wrap `saveContact(data)` → `crmContactsApi.create(data)` or `crmContactsApi.update(id, data)`
7. Wrap `deleteContact(id)` → `crmContactsApi.delete(id)`
8. Test: `USE_RUST_CRM=true npm run dev` → open `/crm/sales/contacts`, verify list loads
9. Test: create a new contact, verify it appears in list
10. Test: `USE_RUST_CRM=false` → verify Mongo fallback works identically

### Step 2: Wire crm-deals
*(Same pattern as Step 1 for crm-deals.actions.ts)*
- Functions: `getDeals`, `getDealById`, `saveDeal`, `deleteDeal`, `updateDealStage`

### Step 3: Wire crm-tasks
*(Same pattern)*
- Functions: `getTasks`, `getTaskById`, `saveTask`, `deleteTask`, `updateTaskStatus`, `reorderTasks`

### Step 4: Wire crm-employees
*(Same pattern)*
- Functions: `getEmployees`, `getEmployeeById`, `saveEmployee`, `deleteEmployee`, `updateEmployeeStatus`

### Step 5: Wire crm-products
*(Same pattern)*
- Functions: `getProducts`, `getProductById`, `saveProduct`, `deleteProduct`

### Step 6: Wire crm-tickets
*(Same pattern)*
- Functions: `getTickets`, `getTicketById`, `saveTicket`, `deleteTicket`, `updateTicketStatus`, `assignTicket`

### Step 7: Wire crm-vouchers
*(Same pattern)*
- Functions: `getVouchers`, `getVoucherById`, `saveVoucher`, `deleteVoucher`, `postVoucher`

### Step 8: Wire crm-payslips
*(Same pattern)*
- Functions: `getPayslips`, `getPayslipById`, `generatePayslip`, `deletePayslip`

### Step 9: Wire crm-attendance
*(Same pattern)*
- Functions: `getAttendance`, `getAttendanceById`, `saveAttendance`, `bulkSaveAttendance`, `deleteAttendance`

### Step 10: Wire remaining Tier-2 (10 files)
Wire in batch: quotations, proposals, subscriptions, contracts, salary-structures, assets, candidates, expense-claims, budgets, credit-notes

---

## SPRINT 2 (Week 3–4): Financial Reports Engine

### Step 11: Trial Balance Aggregation
1. Create `src/lib/crm/accounting/trial-balance.ts`
2. Write MongoDB aggregation:
   ```
   $group by accountId → SUM(debit), SUM(credit)
   $lookup account name from chart-of-accounts
   $project: accountId, accountName, accountCode, debitTotal, creditTotal, balance
   ```
3. Add date-range filter parameter (as-of date)
4. Create Rust handler in `crm-vouchers/src/reports.rs` → expose `GET /v1/crm/reports/trial-balance`
5. Build UI at `/accounting/trial-balance`:
   - Date picker (default: today)
   - Table: Account Code | Account Name | Debit | Credit | Balance
   - Footer: total debit = total credit (validation)
   - Export to PDF button

### Step 12: Income Statement
1. Aggregation: sum revenue accounts vs. expense accounts for date range
2. Build P&L structure: Gross Revenue → Gross Profit → Operating Profit → Net Profit
3. Comparison period: show this period vs. last period side by side
4. UI: collapsible account group rows with amounts
5. PDF export with company logo (from company profile)

### Step 13: Balance Sheet
1. Aggregation: snapshot all asset, liability, equity account balances as of date
2. Validate: Assets = Liabilities + Equity (show discrepancy if any)
3. Hierarchical display: current assets → fixed assets → current liabilities → long-term liabilities → equity
4. Comparison: balance sheet at two dates

### Step 14: Cash Flow Statement
1. Direct method: operating receipts (sales invoices paid) − operating payments (bills paid, payroll)
2. Investing: asset purchases − asset disposals
3. Financing: loan receipts − loan repayments
4. Net change: opening cash + net change = closing cash (reconcile to bank balance)

### Step 15: Day Book
1. List all vouchers chronologically for date range
2. Show: date, voucher no, type, debit account, credit account, amount, narration
3. Running balance per account when single account is filtered
4. Export to Excel (multi-sheet: one per voucher type)

---

## SPRINT 3 (Week 5–6): Inventory Completions

### Step 16: Stock Transfer Module
1. Create `src/app/dashboard/crm/inventory/stock-transfers/page.tsx` (full implementation, not stub)
2. Create `rust/crates/crm-stock-transfers/` with full CRUD
3. Transfer document: from-warehouse, to-warehouse, items (product, qty, batch), status (draft → in-transit → received)
4. On status → `received`: auto-create negative stock adjustment on source, positive on destination
5. Transit inventory (in-flight stock visible in reports but not available)
6. Transfer history per product

### Step 17: Batch & Expiry
1. Create `src/app/dashboard/crm/inventory/batch-expiry/page.tsx`
2. List all batches with: product, warehouse, batch no, qty, expiry date, days-to-expiry
3. Colour coding: red < 7 days, amber < 30 days, green > 30 days
4. FIFO / FEFO policy toggle per product category (use oldest/soonest-expiry first on sales)
5. Vercel Cron: daily job → scan batches expiring in 30/15/7 days → send alert email + webhook

### Step 18: Stock Valuation
1. WAC calculation: (opening value + receipts value) / (opening qty + received qty)
2. Per-SKU valuation report: qty on hand, WAC cost, total value
3. By warehouse breakdown
4. Valuation date picker
5. Slow-moving analysis: items with 0 movement > 90 days

### Step 19: Low-Stock Alerts
1. Per-product: set `reorder_point` and `reorder_qty` in product settings
2. Vercel Cron (daily): query items below reorder point
3. Email notification to purchase manager with list of items
4. SabFlow webhook: send payload → workflow can auto-create draft PO
5. Dashboard widget: "Items Below Reorder Point" count with drill-down

---

## SPRINT 4 (Week 7–8): Payroll & Leave Completions

### Step 20: Loan Deduction System
1. Create loan records per employee: amount, interest rate, tenure, start date
2. EMI calculator: flat interest or reducing balance
3. Monthly: auto-include EMI deduction in payroll run
4. Loan statement: disbursement + repayment history, outstanding balance
5. Preclosure: settle outstanding in Full & Final

### Step 21: Investment Declaration
1. Per-employee form: 80C (LIC, PPF, ELSS), 80D (health insurance), HRA (rent receipts)
2. Deadline reminder email (Vercel Cron: Jan 15)
3. Auto-recalculate TDS liability when declaration submitted
4. IT projection report: estimated tax for the year with current declarations
5. Proof submission: employee uploads documents (SabFiles)

### Step 22: NEFT Payment File Export
1. HDFC format: fixed-width text file per salary payment
2. SBI format: CSV with specific column order
3. ICICI format: pipe-delimited
4. Generate after payroll run finalized
5. Download button on payroll run detail page

### Step 23: Leave Carry-Forward
1. Per leave type: configure carry-forward rule (none / limited / unlimited)
2. Configure carry-forward cap (e.g., max 10 CL can carry forward)
3. Vercel Cron: run on Jan 1 → apply carry-forward → update all employee balances
4. Audit trail: carry-forward transaction per employee with before/after balances
5. Encashment: calculate payout for excess leaves during Full & Final

### Step 24: Leave Calendar (Team View)
1. Monthly calendar grid: columns = days, rows = employees in department
2. Colour-coded: CL (blue), SL (orange), PL (green), holiday (grey)
3. Filter by department / team
4. Export to iCal / Google Calendar
5. Clash detection: alert when < X% of team available on a day

---

## SPRINT 5 (Week 9–10): Sales Completions & POS

### Step 25: Loyalty Program
1. Create loyalty program config in settings: points-per-rupee earn rate, redemption rate
2. Tier definitions: Silver (0–10K pts), Gold (10K–50K pts), Platinum (50K+)
3. On invoice payment: auto-credit points to customer
4. On sales order: show available points, allow redemption as discount
5. Points expiry: configure expiry policy (e.g., unused points expire after 1 year)
6. Loyalty dashboard: total points issued, redeemed, outstanding liability

### Step 26: Promotions Engine
1. Promotion types: % discount on SKU, flat discount on order, BOGO, minimum cart value
2. Validity: date range, usage limit (per promo + per customer)
3. Stacking rules: can multiple promos apply together?
4. Auto-apply on quotation / order creation if customer qualifies
5. Promo performance report: usage count, discount given, revenue impact

### Step 27: POS Offline Mode
1. Service worker caches POS page shell + product catalogue
2. Offline: sales recorded in IndexedDB (product, qty, price, timestamp)
3. Connection restoration: sync offline transactions to MongoDB
4. Conflict resolution: if same product sold from two registers, take last-write
5. Offline indicator: prominent banner when working offline
6. Sync status: "5 transactions pending sync" counter

### Step 28: Sales Commission
1. Commission rule per rep or per product category: % of invoice amount
2. Milestone-based: bonus when quarterly target is hit
3. Commission register: per rep, per invoice, per period
4. Commission payout: auto-create payroll entry for commission amount
5. Commission dashboard: earned vs. paid, pending vs. approved

---

## SPRINT 6 (Week 11–12): Projects & Gantt

### Step 29: Gantt Chart
1. Fetch all tasks for a project with start_date, due_date, dependencies
2. Render using `frappe-gantt` (MIT license, lightweight)
3. Task bar: coloured by status (green=done, blue=in-progress, grey=not started)
4. Critical path: highlight in red (longest path to project end)
5. Drag task bar: update start_date + due_date in MongoDB via server action
6. Dependency arrow: drag from one task's end to another's start
7. Milestone: task with 0 duration renders as diamond
8. Zoom: Day / Week / Month / Quarter view
9. Export: `html2canvas` → PNG, `jsPDF` → PDF

### Step 30: Project Budget Tracking
1. Per-project: set budget (hours and/or currency amount)
2. Time logs: hours × billing rate = billable amount
3. Expenses: direct project expenses linked via expense claim
4. Budget burn chart: planned vs. actual spend over time
5. Overspend alert: email to project manager when > 80% consumed

---

## SPRINT 7 (Week 13–14): AI Features Phase 1

### Step 31: Deal Scoring (Rule-Based v1)
1. Score factors: days since last activity, stage age, email engagement, calls made
2. Score model (weighted): each factor mapped to 0–100 score
3. Composite score: weighted average
4. Score thresholds: Hot (>70), Warm (40–70), Cold (<40)
5. Score badge on deal card (🔥 Hot / 🌡️ Warm / ❄️ Cold)
6. Weekly digest: "Your 5 coldest deals need attention"

### Step 32: Email Draft Generation
1. "Draft email" button on contact/deal detail page
2. Context sent to Claude Haiku: contact name, company, deal stage, last interaction, outstanding invoice amount
3. Claude returns: subject line + email body
4. Display in editable rich-text editor
5. User edits and sends (via Gmail integration or copies to clipboard)
6. Credit metering: 1 AI credit per draft generation

### Step 33: Resume Parsing
1. "Parse Resume" button on candidate detail page
2. User uploads PDF via SabFilePickerButton
3. Backend: extract text from PDF → send to Claude Haiku with structured extraction prompt
4. Structured output: name, email, phone, education[], experience[], skills[], total_years
5. Auto-populate candidate form fields
6. Confidence score per field

---

## SPRINT 8 (Week 15–16): Automation Rules Engine

### Step 34: Automation Builder UI
1. Create `/crm/automations/new` page
2. Trigger selector: module (Deal, Invoice, Employee, Ticket) + event (Created, Updated, Status Changed)
3. Condition builder: field comparator rows (AND/OR)
4. Action builder: action type selector + action config
5. Save automation rule
6. Activate/deactivate toggle
7. Run history: log of every trigger firing with success/failure

### Step 35: Automation Runtime
1. Rust crate `crm-automation-rules` for rule storage
2. SabFlow node: "CRM Trigger" listens for MongoDB change stream events
3. Filter events against rule conditions in-process (no external call)
4. Execute actions: email (via transactional email service), task creation, field update, webhook call
5. Rate limit: max 10 action executions per tenant per minute
6. Dead letter queue: failed actions retry 3× with exponential backoff

### Step 36: 50 Pre-Built Automation Templates
1. Sales: "Email 3 days after quotation sent if no response"
2. Sales: "Create follow-up task when deal goes cold (no activity 5 days)"
3. Sales: "Notify manager when deal value > ₹10L"
4. Finance: "Send payment reminder 7 days before invoice due"
5. Finance: "Send overdue notice 1 day after due date"
6. HR: "Send welcome email when new employee created"
7. HR: "Assign onboarding checklist task on employee join date"
8. HR: "Alert HR when probation ends in 7 days"
9. Payroll: "Notify employee when payslip generated"
10. Tickets: "Escalate ticket to manager when SLA breached"
*(+ 40 more covering inventory, procurement, recruitment)*

---

## SPRINT 9 (Week 17–18): Portal Layer

### Step 37: Customer Portal
1. Route: `/portal/crm/[token]` (no auth, token-scoped access)
2. Token generation: on customer/contact record, generate time-limited signed token
3. Portal home: outstanding invoices, recent orders, ticket status
4. Invoice detail: view line items, pay now (Razorpay payment link)
5. Quotation: view + accept/reject with digital timestamp
6. Raise ticket: simple form → creates ticket in CRM
7. White-label: show company logo and colors (from company profile settings)

### Step 38: Vendor Portal
1. Route: `/portal/vendor/[token]`
2. Home: open RFQs, purchase orders, payment status
3. RFQ response: vendor submits bid directly in portal
4. PO acknowledgement: vendor confirms + uploads delivery schedule
5. Invoice upload: vendor submits invoice via SabFiles → triggers bill in CRM

### Step 39: Employee Self-Service Portal
1. Route: `/portal/hrm` (employee JWT auth, separate from admin)
2. My Payslips: list + PDF download
3. Leave: check balance, apply for leave, track application status
4. Attendance: view monthly calendar, raise correction request
5. Claims: submit expense with receipt (SabFilePickerButton)
6. Documents: download offer letter, appointment letter, Form 16

---

## SPRINT 10 (Week 19–20): Integrations

### Step 40: Razorpay Integration
1. Add Razorpay API key to env vars (via Vercel dashboard)
2. Invoice detail page: "Send Payment Link" button
3. Backend: Razorpay order creation → returns payment link
4. WhatsApp: send payment link via SabWa to customer's WhatsApp
5. Webhook: `razorpay.payment.captured` → auto-mark invoice as paid → reconcile
6. Webhook endpoint: `/api/webhooks/razorpay` with signature verification

### Step 41: Tally Export
1. Voucher export: select date range → generate Tally XML (TallyPrime format)
2. Sales invoice → Sales Voucher XML
3. Purchase bill → Purchase Voucher XML
4. Journal entries → Journal Voucher XML
5. Download as `.xml` file
6. Tally import guide: step-by-step instructions in modal

### Step 42: Gmail OAuth Integration
1. User connects Gmail: OAuth flow → store refresh token encrypted in MongoDB
2. Background sync: Vercel Cron (every 15 min) → fetch new emails → match to contacts by `from` address
3. Matched emails: appear in contact/deal activity feed
4. Compose from CRM: open compose in Gmail, pre-fill To/Subject
5. Unlink: revoke OAuth token and delete stored credentials

---

## ONGOING: Observability Hardening (Throughout All Sprints)

### Step 43: Rust Tracing
1. Add `tracing = "0.1"` to every CRM crate's `Cargo.toml`
2. Add `#[tracing::instrument]` to every handler function
3. Log fields: `user_id`, `operation`, `collection`, `duration_ms`, `status_code`
4. Wire to Vercel log drain (JSON structured output)

### Step 44: MongoDB Query Monitoring
1. Enable Atlas Performance Advisor
2. Identify top-10 slow queries (P95 > 100ms)
3. Add compound indexes for each identified slow query
4. Re-test after index: verify P95 < 50ms

### Step 45: Error Budget
1. Define SLO: 99.5% success rate per endpoint
2. Track error rate in Vercel Analytics (or custom Datadog metric)
3. Alert when error rate > 0.5% for any 5-minute window
4. Post-incident review template for every P0 incident

---

## ONGOING: Testing (Throughout All Sprints)

### Step 46: Rust Unit Tests
For every `dto.rs` file, add:
```rust
#[test]
fn create_input_round_trips_camel_case() { ... }
#[test]
fn update_input_is_empty_detects_all_unset() { ... }
#[test]
fn list_query_defaults_are_none() { ... }
```

### Step 47: TypeScript Tests
For every server action file, add Jest tests:
```typescript
describe('crm-contacts.actions', () => {
  it('getContacts returns paginated list', async () => { ... })
  it('saveContact creates record', async () => { ... })
  it('deleteContact removes record', async () => { ... })
})
```

### Step 48: Playwright E2E
1. `tests/e2e/sales-flow.spec.ts`: Create contact → Create deal → Create quotation → Send to customer → Mark accepted → Create invoice → Mark paid
2. `tests/e2e/purchase-flow.spec.ts`: Create vendor → Create PO → Create GRN → Update stock
3. `tests/e2e/hr-flow.spec.ts`: Create employee → Set salary → Run payroll → Generate payslip
4. `tests/e2e/recruitment-flow.spec.ts`: Create job → Create candidate → Schedule interview → Create offer

---

*Each step above is independently assignable to one developer or one AI agent. Steps within a sprint are loosely ordered; complete in sequence within a sprint but sprints can overlap where there are no dependencies.*
