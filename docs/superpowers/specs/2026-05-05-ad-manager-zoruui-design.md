# Ad Manager → ZoruUI migration

Date: 2026-05-05
Status: approved (user said "ok and dispatch 20 agents")

## Goal

Migrate the entire `/dashboard/ad-manager/*` tree (1 root + 30 sub-pages) off Clay primitives and onto ZoruUI, mirroring the pattern used for `/dashboard/facebook`. No data-layer changes — server actions in `src/app/actions/ad-manager.actions.ts` stay byte-for-byte identical.

## Non-goals

- No new features.
- No schema changes.
- No edits to `ad-manager.actions.ts`, `meta.actions.ts`, or any other server action file.
- No edits to `src/components/wabasimplify/ad-manager/*` (Clay legacy modules) — those stay in place; they will be deleted in a follow-up once nothing references them.
- No re-design of Meta Suite IA. Same routes, same names, same hierarchy.

## Contract — every migrated page must follow this

### 1. Shell

Each migrated page renders inside the parent `/dashboard` `ZoruHomeShell` (no bespoke sidebar). Use the shared chrome helpers from `src/app/dashboard/ad-manager/_components/am-page-shell.tsx`:

- `<AmBreadcrumb page="…" parent={{ label, href }} />` — renders `SabNode › Ad Manager › <page>`.
- `<AmHeader title description actions />` — `ZoruPageHeader`.
- `<AmNoProject />` — canonical empty state.
- `<AmErrorAlert message />` — canonical error.

This file is created by the dispatcher (me) **before** agents run, so all agents can import from it.

### 2. Components — one-to-one swaps

| Clay (remove) | Zoru (use) |
|---|---|
| `ClayBreadcrumbs` | `AmBreadcrumb` |
| `ClayCard`, `ClayCardHeader`, `ClayCardContent`, `ClayCardTitle` | `ZoruCard`, `ZoruCardHeader`, `ZoruCardContent`, `ZoruCardTitle` |
| `ClayButton` | `ZoruButton` |
| `ClayInput` | `ZoruInput` |
| `ClayBadge` | `ZoruBadge` |
| `ClayTabs` (any usage) | distinct routes OR a segmented `ZoruButton` group — Zoru has **no** tab primitive |
| `ClayTable` / shadcn `Table` | `ZoruTable` |
| `ClayDialog` | `ZoruDialog` |
| `ClayDropdownMenu` | `ZoruDropdownMenu` |
| `ClaySelect` | `ZoruSelect` |
| `ClaySheet` | `ZoruSheet` |
| `ClayPopover` | `ZoruPopover` |
| `ClaySkeleton` | `ZoruSkeleton` |
| `ClayAlert` | `ZoruAlert` |
| `ClayTooltip` | `ZoruTooltip` |
| `ClayCheckbox` / `ClayRadio` / `ClaySwitch` | `Zoru*` equivalents |
| `react-icons/lu` (`Lu*`) | `lucide-react` (drop the `Lu` prefix) |

If a Clay component has no Zoru equivalent, fall back to `@/components/ui/*` (shadcn) — do **not** keep importing from `@/components/clay`.

### 3. Imports

All Zoru components must come from the barrel: `import { ZoruButton, ZoruCard, … } from "@/components/zoruui"`. Never import from a deep zoruui path.

### 4. Layout file

`src/app/dashboard/ad-manager/layout.tsx` is rewritten:
- Keeps the `AdManagerShellContext` (search / date / preset) — child pages depend on it via `useAdManagerShell()`.
- Replaces all `Clay*` components with `Zoru*`.
- Keeps the `whatsappAds` plan-feature gate, but renders the lock state with `ZoruCard` + `ZoruButton` instead of Clay.
- Replaces `LuLock` etc. with `lucide-react` equivalents.

### 5. `'use client'`

Pages that already had `'use client'` keep it. Pages that didn't, don't gain it. Don't change SSR/CSR boundary.

### 6. Server actions

Imports of server actions stay identical — same module paths, same function names. If a page calls `getCampaigns(...)`, the migrated page calls the same `getCampaigns(...)`.

### 7. No data behaviour changes

State machines, side effects, query patterns, error handling: byte-for-byte equivalent. Visual layer only.

## Chunk assignment (20 agents)

Each agent runs in parallel and owns the listed file(s). No two agents touch the same file. All agents may read but not modify the shared `am-page-shell.tsx` and `layout.tsx` (created up front).

| # | Files |
|---|---|
| 1 | `layout.tsx` + `page.tsx` (overview) |
| 2 | `ads/page.tsx` + `ad-previews/page.tsx` |
| 3 | `ad-sets/page.tsx` + `ad-sets/[id]/page.tsx` |
| 4 | `campaigns/page.tsx` + `campaigns/[id]/page.tsx` |
| 5 | `create/page.tsx` (wizard) |
| 6 | `ad-accounts/page.tsx` + `ai-lab/page.tsx` |
| 7 | `audiences/page.tsx` + `customer-lists/page.tsx` |
| 8 | `automated-rules/page.tsx` + `split-tests/page.tsx` |
| 9 | `billing/page.tsx` + `settings/page.tsx` |
| 10 | `budget-optimizer/page.tsx` + `bulk-editor/page.tsx` |
| 11 | `calendar/page.tsx` + `compare/page.tsx` |
| 12 | `capi/page.tsx` + `pixels/page.tsx` |
| 13 | `catalogs/page.tsx` + `creative-library/page.tsx` |
| 14 | `conversion-funnel/page.tsx` + `insights/page.tsx` |
| 15 | `custom-conversions/page.tsx` + `lead-forms/page.tsx` |
| 16 | `events-manager/page.tsx` |
| 17 | `reports/page.tsx` |
| 18 | Wizard internals: `src/components/wabasimplify/ad-manager/create-wizard/ad-previews.tsx` (rewrite to Zoru — used by `create/page.tsx`). Other Clay imports in this dir stay legacy. |
| 19 | Sidebar wiring: ensure `src/components/admin-panel/sidebar/app-sidebar.tsx` `'ad-manager'` entry still works; if it pulls from Clay context, switch to plain Zoru icon lookup. Don't change navigation IA. |
| 20 | Verification: run `pnpm typecheck` (or `npx tsc --noEmit`); grep for stale `from '@/components/clay'` and `react-icons/lu` inside `src/app/dashboard/ad-manager/`; report findings — do not edit anything yourself. |

## Risks

1. **Clay → Zoru API mismatch.** Zoru components were largely modelled on shadcn, but variants, prop names, and slot conventions may differ. Agents will need to read both source files when in doubt; fall back to shadcn if Zoru lacks a needed primitive. Mark with `// TODO(zoru): missing primitive` and keep moving.
2. **Serialised state machines.** Several pages (`create`, `bulk-editor`, `automated-rules`) hold large reducers. Agents must NOT touch reducer logic — only visual layer.
3. **Tab usage.** Zoru has no tab primitive (intentional — see `zoru-shell.tsx` comment). Pages using Clay tabs must convert to either segmented `ZoruButton` group or split into routes. Agent 5 (create wizard) is the most likely to hit this.
4. **Sidebar coupling.** `useAdManager()` context exists at `@/context/ad-manager-context` and is used by both layout and sidebar. Don't delete it.

## Verification gate

Migration is "complete" when:
- Agent 20 reports zero stale `clay` imports under `src/app/dashboard/ad-manager/`.
- Agent 20 reports zero `react-icons/lu` imports under `src/app/dashboard/ad-manager/`.
- `tsc --noEmit` passes.
