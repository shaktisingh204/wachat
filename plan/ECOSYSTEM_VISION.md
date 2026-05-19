# SabNode Ecosystem Vision
**Last updated:** 2026-05-19

The full 3-year ecosystem vision — how CRM + HRM fits into the larger SabNode platform.

---

## The SabNode Platform Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SabNode Platform                           │
│                                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │   CRM   │  │   HRM   │  │  Wachat │  │SabFlow  │  │  SEO    │ │
│  │ (Sales, │  │(People, │  │(WhatsApp│  │(Workflow│  │(URL,QR, │ │
│  │ Finance,│  │Payroll, │  │ Business│  │Automation│  │SabChat) │ │
│  │ Inventory│  │ Recruit)│  │   API)  │  │  Engine)│  │         │ │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘ │
│       │            │            │             │             │       │
│  ┌────▼────────────▼────────────▼─────────────▼─────────────▼───┐ │
│  │                    SabFlow Automation Bus                      │ │
│  │   (CRM events → Workflows → Actions → Back to CRM)           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Rust BFF (Axum) — 170+ crates                  │   │
│  │  Fast API layer: auth, RBAC, MongoDB, Redis, R2              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
│  │  MongoDB Atlas│  │   Redis      │  │   Cloudflare R2        │   │
│  │  (primary DB) │  │  (cache/pub) │  │   (SabFiles storage)   │   │
│  └──────────────┘  └──────────────┘  └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Year 1: Foundation (In Progress)

**Theme: "Everything works, nothing is missing"**

### Q1–Q2 (Done ✅)
- 96+ Rust CRM crates with full CRUD
- All UI pages migrated to ZoruUI
- CRM + HRM modules functionally complete (sales, purchases, inventory, accounting, HR, payroll, projects, tickets)
- SabFlow with 200+ marketplace templates
- Wachat WhatsApp Business fully operational
- Telegram multi-feature suite live

### Q3 (Phase 2)
- Financial reporting engine (trial balance, P&L, balance sheet, cash flow)
- Inventory completions (transfers, batch, valuation)
- Payroll completions (loans, NEFT, investment declaration)
- Gantt chart, POS offline, recruitment enhancements
- 40 remaining Rust crate TS wiring

### Q4 (Phase 3 start)
- AI sales assistant (deal scoring, email drafts)
- Custom report builder
- Automation rules engine
- Customer portal (basic)
- Razorpay integration

---

## Year 2: Differentiation

**Theme: "Better than any Indian SaaS alternative"**

### Target: Beat these competitors module-by-module

| Competitor | Category | SabNode Advantage |
|---|---|---|
| Zoho CRM | Sales CRM | AI scoring + SabWa WhatsApp native |
| Tally | Accounting | Cloud-native, API-first, real-time |
| greytHR | Payroll | Integrated with CRM (not siloed) |
| Darwinbox | HRM | More affordable, WhatsApp-native HR chatbot |
| Keka | HR + Payroll | Full CRM+HRM in one platform |
| Shopify | E-commerce | Full ERP backend, not just storefront |
| Freshdesk | Ticketing | Native CRM+WhatsApp+Ticket in one |

### Q1 — AI Layer
- Claude-powered deal scoring and email generation
- Resume parsing and candidate scoring
- Demand forecasting for inventory
- Attrition risk model

### Q2 — Integrations Hub
- Tally export (statutory compliance)
- Razorpay + Stripe payment collection
- LinkedIn + Naukri recruitment
- Gmail + Google Calendar sync
- Shopify + WooCommerce order sync

### Q3 — Mobile App
- React Native (Sales + HR + Expense)
- Geo-fenced attendance
- Offline-first architecture

### Q4 — Platform Features
- Standalone HRM product line
- Employee self-service portal
- Customer + Vendor portals
- Developer API v2 + SDK

---

## Year 3: Scale

**Theme: "Enterprise-grade, globally deployable"**

### Platform
- Multi-region deployment (US, EU, UAE, Singapore via Vercel regions)
- Data residency controls per tenant
- SOC 2 Type II certification
- ISO 27001 compliance

### Enterprise Features
- SSO (SAML 2.0, Azure AD, Google Workspace)
- Advanced RBAC (field-level, record-level, time-bound permissions)
- Audit log with SIEM integration (Splunk, Datadog)
- Custom domain per tenant with white-label
- Dedicated database cluster option

### AI / Intelligence
- Fully trained industry-specific models (manufacturing, retail, services)
- Predictive analytics platform (customer LTV, vendor risk, employee flight risk)
- Automated financial close (auto-match transactions, suggest journal entries)
- Contract intelligence (clause comparison, risk flagging)

### Ecosystem
- App marketplace with 50+ third-party extensions
- Partner portal (channel partners, implementation partners)
- SabNode Certified Partner program
- Annual SabNode developer conference

---

## Module Dependency Map

Understanding which modules depend on which:

```
Employees ←─────────────────────────────────────────────┐
    │                                                    │
    ├→ Departments / Designations / Compensation Bands  │
    ├→ Attendance → Leave → Shifts                       │
    ├→ Salary Structure → Payroll Runs → Payslips        │
    │      └→ PF/ESI, TDS, PT, Form 16                  │
    ├→ Appraisals ← OKRs ← Goals ← KPIs                │
    ├→ Training → Certifications                         │
    └→ Exits (Full & Final ← Payroll)                   │
                                                         │
Contacts → Deals → Quotations → Orders → Invoices ──────┤
    │           │         └→ Delivery Challans            │
    │           └→ Activities / Tasks                     │
    │                                                     │
Vendors → RFQs → Vendor Bids → Purchase Orders → GRN ──→ Inventory
    │                                    │
    └→ Expenses → Payouts → Debit Notes  │
                                         │
Products → BOM → Production Orders ──────┘
    │
    └→ POS → Store → E-commerce Orders
```

---

## Data Flow Architecture

### Sales Flow
```
Lead → Contact → Deal → Quotation → Order → Invoice → Payment
                  │                    │
                  └→ Proposal          └→ Delivery Challan
                                       └→ Credit Note (on return)
```

### Purchase Flow
```
Purchase Requisition → RFQ → Vendor Bid → Purchase Order
    └→ GRN (received) → Inventory Update → Vendor Invoice → Payout
         └→ Rejected stock → MRN → Debit Note to vendor
```

### HR Flow
```
Job Posting → Candidate → Interview → Offer → Employee
                                               │
                   ┌───────────────────────────┤
                   │                           │
              Attendance ← Shift            Salary Structure
                   │                           │
              Leave Balance              Payroll Run → Payslip
                   │                           │
              Timesheet → Project        TDS / PF / PT
                                               │
                                         Form 16 / IT Filing
```

### Finance Flow
```
Invoices + Bills + Expenses + Payroll
    │
    ↓
Journal Vouchers (auto + manual)
    │
    ├→ Day Book (chronological)
    ├→ Trial Balance (account balances)
    ├→ Income Statement (P&L)
    ├→ Balance Sheet (snapshot)
    └→ Cash Flow Statement
```

---

## Technology Choices — Rationale

| Choice | Alternatives Considered | Why SabNode's Choice |
|---|---|---|
| Next.js App Router | Remix, SvelteKit, Nuxt | Team familiarity + Vercel native + RSC for server actions |
| Rust BFF (Axum) | Node.js BFF, GraphQL | 10× throughput, type safety, zero-overhead MongoDB |
| MongoDB Atlas | PostgreSQL, Supabase | Flexible schema for CRM (custom fields), document model fits lineage |
| ZoruUI | shadcn/ui, Chakra, MUI | Bespoke design system — consistent across all 50+ modules |
| Vercel Fluid Compute | AWS Lambda, Railway, Render | Zero DevOps, edge-close, native Next.js + Rust support |
| Cloudflare R2 | AWS S3, GCS | No egress fees, edge caching, SabFiles abstraction layer |
| Firebase Auth | Clerk, Auth0, NextAuth | Cost (generous free tier), Google SSO built-in, mobile SDK |
| SabFlow (custom) | n8n, Make, Zapier | Full control, WhatsApp-native triggers, embedded in product |
| SabWa (Baileys) | Official Cloud API, 360Dialog | Personal WhatsApp (no API cost), BSP API for business accounts |

---

## Success Metrics

### Year 1 KPIs
- 0 TypeScript compile errors
- 0 Rust cargo check errors (maintained)
- All 96 Rust crates dual-impl wired (USE_RUST_CRM ready)
- Page load < 2s (Largest Contentful Paint) for all list pages
- 100% RBAC coverage on all mutating endpoints

### Year 2 KPIs
- Response time P95 < 200ms for all Rust-routed endpoints
- Test coverage > 80% (TypeScript) + > 70% (Rust)
- Zero P0 bugs in production for 3 consecutive months
- 10 third-party integrations live
- Mobile app released (iOS + Android)

### Year 3 KPIs
- SOC 2 Type II certified
- 99.9% uptime SLA for enterprise tier
- < 5 minute payroll run for 1000 employees
- AI features reduce manual data entry by 40%
- Developer API with 20+ external integrations published

---

*This document is the ecosystem vision layer. For sprint-level tasks, see WHAT_REMAINS.md. For completed work, see WHAT_IS_DONE.md. For the master plan, see CRM_HRM_MASTER_PLAN.md.*
