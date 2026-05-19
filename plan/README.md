# Plan — SabNode CRM + HRM
**Created:** 2026-05-19

This folder contains the complete, step-by-step master plan for the CRM and HRM product lines in SabNode.

---

## Documents in this folder

| File | What's inside |
|---|---|
| [CRM_HRM_MASTER_PLAN.md](CRM_HRM_MASTER_PLAN.md) | Full ecosystem overview — all modules, phases, infrastructure, releases |
| [WHAT_IS_DONE.md](WHAT_IS_DONE.md) | Exhaustive checklist of every completed feature and milestone |
| [WHAT_REMAINS.md](WHAT_REMAINS.md) | Every open gap, stub, and planned feature by priority |
| [NEW_FEATURES.md](NEW_FEATURES.md) | Detailed new feature specs across 10 categories (AI, Sales, HR, Finance, etc.) |
| [STEP_BY_STEP_EXECUTION.md](STEP_BY_STEP_EXECUTION.md) | 48 granular steps organized into 10 sprints for immediate execution |
| [ECOSYSTEM_VISION.md](ECOSYSTEM_VISION.md) | 3-year platform vision, competitor positioning, technology rationale |
| [SABFLOW_PARITY_PLAN.md](SABFLOW_PARITY_PLAN.md) | SabFlow ↔ n8n/Typebot parity plan (pre-existing) |

---

## Quick orientation

### Where we are right now (2026-05-19)
- **96 Rust crates** built and cargo-check-clean
- **14 action files** wired to Rust via `USE_RUST_CRM` flag (7 this sprint)
- **0 CrmPageHeader usages** remaining (full EntityShell migration done)
- **0 ZoruSelect usages** remaining (full EnumFormField migration done)
- **200+ SabFlow templates** seeded in marketplace
- All CRM + HRM modules exist and are navigable — quality varies by module

### Highest priority right now
1. Wire 10 more Rust crates (Tier-1: contacts, deals, tasks, employees, products, tickets, vouchers, payslips, attendance, invoices)
2. Implement 19 stub pages that render but have no real data
3. Build the 5 financial report pages (trial balance, income statement, balance sheet, cash flow, day book)

### What will take longest
- AI features (Phase 3: 3–6 months out)
- Mobile app (Phase 5: 9–12 months out)
- Third-party integrations (Phase 4: 6–9 months out)
- SOC 2 certification (Year 3)

---

## How to use this plan

1. **Daily standups:** Reference WHAT_REMAINS.md P1-A/P1-B for the current sprint
2. **Sprint planning:** Pick 1 sprint from STEP_BY_STEP_EXECUTION.md, assign steps to devs/agents
3. **New feature requests:** Add to NEW_FEATURES.md under the appropriate category, then copy to WHAT_REMAINS.md at the right priority
4. **Completed work:** Mark checkbox in WHAT_IS_DONE.md, remove from WHAT_REMAINS.md
5. **Architecture questions:** See CRM_HRM_MASTER_PLAN.md §11 (Rust BFF) or ECOSYSTEM_VISION.md

---

## Rust crate naming convention

```
crm-{module-name}        → CRUD for that entity
crm-{module}-types       → shared types used by multiple crates (no handlers)
hrm-{module}-types       → HRM-specific shared types
```

## File naming convention

```
src/app/actions/crm-{module}.actions.ts    → server actions (TS + USE_RUST_CRM guard)
src/app/dashboard/crm/{module}/page.tsx    → module list page
src/app/dashboard/crm/{module}/[id]/page.tsx  → detail page
src/app/dashboard/crm/{module}/_components/  → module-specific components
```
