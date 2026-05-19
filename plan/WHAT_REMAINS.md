# What Remains — SabNode CRM + HRM
**Last updated:** 2026-05-19

Every open item, stub, gap, and planned feature. Grouped by priority tier.

---

## PRIORITY 1 — Complete Immediately (This Sprint)

### P1-A: Dual-Impl Wiring (40 Rust crates have no TS wire)

The `USE_RUST_CRM` flag pattern must be added to these action files.
Each needs: `if (process.env.USE_RUST_CRM === 'true') { return rustClient.call(...) }` guard.

**Tier 1 — Wire first (highest traffic):**
- [ ] `crm-contacts.actions.ts` → crm-contacts crate
- [ ] `crm-deals.actions.ts` → crm-deals crate
- [ ] `crm-tasks.actions.ts` → crm-tasks crate
- [ ] `crm-employees.actions.ts` → crm-employees crate
- [ ] `crm-products.actions.ts` → crm-products crate
- [ ] `crm-payslips.actions.ts` → crm-payslips crate
- [ ] `crm-tickets.actions.ts` → crm-tickets crate
- [ ] `crm-attendance.actions.ts` → crm-attendance crate
- [ ] `crm-vouchers.actions.ts` → crm-vouchers crate
- [ ] `crm-invoices.actions.ts` → crm-sales-types crate

**Tier 2 — Wire next:**
- [ ] `crm-quotations.actions.ts`
- [ ] `crm-proposals.actions.ts`
- [ ] `crm-subscriptions.actions.ts`
- [ ] `crm-contracts.actions.ts`
- [ ] `crm-salary-structures.actions.ts`
- [ ] `crm-assets.actions.ts`
- [ ] `crm-candidates.actions.ts`
- [ ] `crm-expense-claims.actions.ts`
- [ ] `crm-budgets.actions.ts`
- [ ] `crm-credit-notes.actions.ts`

**Tier 3 — Complete the sweep:**
(Remaining 69 crates — wire in module-completion sprints)

### P1-B: Stub Pages — Need Real Implementation

| Page | What's needed |
|---|---|
| `/crm/analytics` | Charts, KPI tiles, funnel, cohort analysis |
| `/crm/integrations` | OAuth flows, webhook config per integration |
| `/crm/loans` | Loan creation, EMI schedule, deduction tracking |
| `/crm/store` | E-commerce storefront product catalog, order sync |
| `/inventory/stock-transfers` | Transfer document → auto stock adjustment |
| `/inventory/batch-expiry` | Batch list with expiry countdown, FIFO/FEFO policy |
| `/inventory/stock-value` | WAC calculation, per-SKU valuation report |
| `/inventory/all-transactions` | Full ledger: every stock movement |
| `/inventory/party-transactions` | Vendor/customer-wise stock summary |
| `/inventory/pnl` | Inventory profit & loss by category/SKU |
| `/accounting/day-book` | Chronological voucher journal with running balance |
| `/accounting/trial-balance` | Debit/credit column balance per account |
| `/accounting/income-statement` | Revenue − Expenses P&L statement |
| `/accounting/balance-sheet` | Assets = Liabilities + Equity snapshot |
| `/accounting/cash-flow` | Operating + investing + financing cash flows |
| `/accounting/pnl` | Accounting P&L view |
| `/sales/loyalty` | Points earn/burn, tier management |
| `/sales/promotions` | Discount rule builder |
| `/projects/gantt` | Interactive Gantt chart with dependencies |

---

## PRIORITY 2 — Phase 2 Features (Next 8 Weeks)

### Financial Reports Engine
- [ ] MongoDB aggregation: Trial Balance
- [ ] MongoDB aggregation: Income Statement (date-range filter)
- [ ] MongoDB aggregation: Balance Sheet (snapshot date)
- [ ] MongoDB aggregation: Cash Flow (direct method)
- [ ] PDF export for all 4 statements (`@react-pdf/renderer`)
- [ ] Comparison period toggle (this month vs last month, this year vs last year)
- [ ] Rust handler endpoints with 60s Vercel CDN cache

### Inventory Completions
- [ ] Stock transfer: create document → debit source → credit destination warehouse
- [ ] Negative stock prevention (configurable per warehouse, error on submit)
- [ ] FIFO/FEFO batch expiry policy engine
- [ ] Expiry alerts: 30 / 15 / 7 days before (Vercel Cron daily)
- [ ] Weighted Average Cost valuation report
- [ ] Low-stock threshold alert (email + webhook to SabFlow)
- [ ] Full stock audit trail (every adjustment actor + reason + timestamp)

### Payroll Completions
- [ ] Loan deductions (flat interest / reducing balance, linked to employee salary)
- [ ] Salary revision history (before/after amounts, effective date, approver)
- [ ] NEFT payment file export (HDFC, SBI, ICICI formats)
- [ ] Investment declaration form (80C, 80D, HRA) with auto TDS recalculation
- [ ] Full & Final Settlement calculator
- [ ] Arrears calculation when revision is mid-month

### Leave Completions
- [ ] Carry-forward rules (per leave type, cap, annual reset job)
- [ ] Leave encashment at Full & Final
- [ ] Comp-off credit when overtime approved
- [ ] Leave calendar: team view (who is out which days)
- [ ] Auto-deduct leave on zero-attendance day (configurable)
- [ ] Leave balance CSV/Excel export

### Timesheet Approval Workflow
- [ ] Manager approval (approve / reject with comment)
- [ ] Daily reminder notification at 9 PM (Vercel Cron)
- [ ] Billable vs non-billable tagging per time entry
- [ ] Project budget burn: hours × rate vs budget

### Recruitment Enhancement
- [ ] Background check integration (Authbridge API)
- [ ] Candidate scoring rubric (weighted criteria)
- [ ] Interview feedback form with structured scoring
- [ ] Offer letter PDF with e-sign placeholder field
- [ ] Candidate public status page (application tracking)

### Sales Completions
- [ ] Loyalty: points rules (earn X per ₹Y spent), burn rules (redeem Z points = ₹A off)
- [ ] Loyalty: tier logic (Silver/Gold/Platinum thresholds)
- [ ] Promotions: SKU discount, category %, BOGO, minimum cart value rule
- [ ] Sales commission calculator (% of invoice value, milestone-based)
- [ ] Sales rep leaderboard (month/quarter/year)
- [ ] Overdue invoice reminder automation (Day 1 / 7 / 15 / 30 after due)
- [ ] Credit limit enforcement on sales orders (block or warn)

### POS Completions
- [ ] Barcode scan → add to cart (camera + USB scanner input)
- [ ] Cash drawer open command (ESC/POS via Web Serial API)
- [ ] Thermal receipt print (80mm)
- [ ] Split payment (cash + card + wallet)
- [ ] Return / refund flow linked to original invoice
- [ ] Daily cash closing report (total sales, cash in hand, discrepancy)
- [ ] Offline POS mode (IndexedDB queue → sync on reconnect)

### Projects Gantt
- [ ] Gantt chart component (frappe-gantt or @dhtmlx/gantt)
- [ ] Drag-to-resize task duration
- [ ] Dependency arrows (Finish-to-Start, Start-to-Start)
- [ ] Critical path highlighting
- [ ] Milestone diamond markers
- [ ] Export as PNG / PDF

### Grievance & Disciplinary
- [ ] Grievance ticket creation by employee
- [ ] HR review + resolution recording
- [ ] Show-cause notice template auto-generation
- [ ] Warning letter generation
- [ ] Disciplinary action history timeline on employee profile
- [ ] Appeal workflow (employee → HR → Director)

---

## PRIORITY 3 — Phase 3 AI & Advanced (Months 3–6)

### AI Sales Assistant
- [ ] Deal scoring model (probability-to-close)
- [ ] Next-best-action recommendations per deal
- [ ] Email draft generation (Claude Haiku using contact/deal context)
- [ ] Meeting summary auto-generation from call transcript
- [ ] Churn prediction for subscriptions
- [ ] Revenue forecast (ML on historical data)

### AI HR Assistant
- [ ] Resume PDF parser (extract skills, education, experience)
- [ ] Job description generator from role inputs
- [ ] Attrition risk model (tenure + engagement + pay parity)
- [ ] Candidate-to-JD auto-matching
- [ ] Performance review draft generation from KPI data
- [ ] Salary benchmarking vs. market surveys

### Intelligent Inventory
- [ ] Demand forecasting (ARIMA on 12-month sales history)
- [ ] Auto-reorder trigger (stock < reorder point → create draft PO)
- [ ] Supplier lead-time analysis
- [ ] Slow-moving SKU identification (> 90 days no movement)
- [ ] Stockout risk heatmap

### Automation Rules Engine
- [ ] Trigger types: document state change, field value change, time-based
- [ ] Action types: send email, create task, send webhook, update field, send notification
- [ ] Condition builder: AND/OR groups
- [ ] 50 pre-built automation templates
- [ ] Rate-limit guardrails (10 actions/minute per tenant)
- [ ] Automation run log (success/failure, actor, timestamp)

### Custom Report Builder
- [ ] Column selector (any field from any module)
- [ ] Grouping + aggregation (SUM, COUNT, AVG, MIN, MAX)
- [ ] Cross-module joins
- [ ] Scheduled email delivery (Vercel Cron)
- [ ] Chart type picker (bar, line, pie, funnel, scatter)
- [ ] Export to CSV / Excel / PDF

### Advanced Analytics Dashboard
- [ ] CRM KPIs: pipeline value, win rate, avg deal size, sales cycle days
- [ ] HR KPIs: headcount, attrition rate, avg tenure, open positions
- [ ] Payroll KPIs: total cost, per-department cost, YoY growth
- [ ] Inventory KPIs: stock turnover, fill rate, days of supply
- [ ] Time-series with drill-down
- [ ] Cohort analysis (customer retention)
- [ ] Recruitment funnel visualization
- [ ] Attendance heat-map calendar

### Document Intelligence
- [ ] Invoice OCR → auto-populate PO fields
- [ ] Contract clause extraction (dates, amounts, parties)
- [ ] Expense receipt auto-categorization from image
- [ ] Vector search across all documents (MongoDB Atlas Vector Search)
- [ ] Document expiry tracker with alerts

---

## PRIORITY 4 — Phase 4 Ecosystem (Months 6–9)

### Standalone HRM Namespace
- [ ] `/hrm` route namespace separate from `/crm/hr`
- [ ] HRM-specific sidebar + branding
- [ ] Plan gating: HRM as standalone subscription
- [ ] Cross-link CRM employee ↔ HRM profile (shared document)

### Employee Self-Service Portal
- [ ] Portal at `/portal/hrm` with employee JWT auth
- [ ] View payslips + Form 16
- [ ] Apply for leave, check balance
- [ ] Submit expense with receipt
- [ ] View attendance + correction request
- [ ] View appraisal feedback
- [ ] Download HR documents

### Customer Portal
- [ ] `/portal/crm/[token]` public portal
- [ ] View + approve quotations online
- [ ] View + pay invoices (Razorpay)
- [ ] Download delivery documents
- [ ] Raise support tickets
- [ ] Track order status
- [ ] White-label branding per company

### Vendor Portal
- [ ] `/portal/vendor/[token]`
- [ ] View + respond to RFQs
- [ ] Submit bids
- [ ] View purchase orders
- [ ] Upload delivery notes + invoices
- [ ] Track payment status

### Third-Party Integrations
- [ ] Razorpay: payment links on invoices + auto-reconcile
- [ ] Stripe: subscription billing
- [ ] PayU: Indian payment gateway
- [ ] Tally XML export (invoices, bills, vouchers)
- [ ] Zoho Books bidirectional sync
- [ ] QuickBooks Online OAuth sync
- [ ] Slack notifications (deal won, ticket opened)
- [ ] Gmail email sync (associate emails to contacts/deals)
- [ ] Google Calendar interview scheduling
- [ ] LinkedIn candidate import
- [ ] Naukri.com job posting + application import
- [ ] Shopify order sync → CRM sales orders
- [ ] WooCommerce product catalog + order sync
- [ ] Essl/ZKTeco biometric device sync

### Developer API Platform
- [ ] OpenAPI spec auto-generated from Rust handlers
- [ ] Personal access token management
- [ ] OAuth 2.0 authorization flow
- [ ] Webhook subscriptions per event
- [ ] API usage dashboard
- [ ] TypeScript + Python SDK generation

---

## PRIORITY 5 — Phase 5 Mobile (Months 9–12)

- [ ] React Native / Expo mobile app (Sales + HR + Expense)
- [ ] PWA with offline support + background sync
- [ ] Geo-fenced clock-in with selfie capture
- [ ] Push notifications (Expo Push + Web Push)

---

## Technical Debt & Cleanup

### Rust Layer
- [ ] Add `tracing` structured logging to all 96 CRM crate handlers
- [ ] Add OpenTelemetry spans on MongoDB queries
- [ ] `cargo audit` — address any security advisories
- [ ] `cargo clippy --all-targets -- -D warnings` — enforce in CI

### TypeScript Layer
- [ ] `tsc --noEmit` — fix any remaining type errors
- [ ] `eslint --max-warnings 0` — enforce in CI
- [ ] Remove all direct `mongoose` imports replaced by Rust clients
- [ ] Audit all `any` types — replace with proper types

### Database
- [ ] Add compound indexes on top-10 hot queries
- [ ] Verify `tenantId` filter on every collection's list queries
- [ ] Add TTL index on audit log (auto-expire after 2 years)

### Security
- [ ] RBAC: audit every Rust handler for `check_permission()` call
- [ ] RBAC: field-level permission for salary, PAN, Aadhaar fields
- [ ] Dependency scan: `npm audit --audit-level=high` zero tolerance
- [ ] CSP headers via Vercel middleware
- [ ] Rate limiting on `/api/*` (100 req/min per IP via Edge Middleware)

### Testing
- [ ] Jest coverage > 80% on all `src/lib/crm/` utilities
- [ ] Rust `cargo test` for all `dto.rs` round-trip tests
- [ ] Playwright E2E for 4 golden paths (sales, purchase, HR, payroll)
- [ ] Load test: 100 concurrent users on invoice list (k6)

### CI/CD
- [ ] GitHub Actions: `cargo check + clippy + test` on every PR
- [ ] GitHub Actions: `tsc + eslint + jest` on every PR
- [ ] Bundle size tracking (alert on > 50KB growth)
- [ ] Rust binary size tracking (alert on > 10MB growth)
- [ ] Renovate bot for automated dependency updates

---

## New Rust Crates to Build

| Crate | Module | Priority |
|---|---|---|
| crm-stock-transfers | Inventory | P2 |
| crm-batch-expiry | Inventory | P2 |
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
| crm-ai-insights | AI | P3 |
| crm-automation-rules | Automation | P3 |
| crm-report-builder | Reports | P3 |
