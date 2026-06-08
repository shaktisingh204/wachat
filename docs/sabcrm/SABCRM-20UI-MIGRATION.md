# SabCRM → 20ui migration (retire `.sabcrm-twenty` / `.st-*`)

**Goal:** move all of SabCRM off its bespoke "Twenty" design layer (scope class
`.sabcrm-twenty` + `.st-*` component primitives) onto the **20ui** design system
(real components from `@/components/sabcrm/20ui`, scoped under the `20ui` class —
CSS selector `.\32 0ui`, alias `.ui20`). End state: `.sabcrm-twenty` no longer
exists anywhere.

> Discovery produced by the `sabcrm-20ui-migration-discovery` workflow
> (10 agents, 7 surface buckets + the 20ui library). Numbers below are from that
> run plus hand-verification.

## Scale (be honest)

This is a **multi-week program**, not a one-shot.

- **~50–55 SabCRM TSX surfaces** actually use `.st-*` primitives (20 `/sabcrm`
  routes + 31 `/dashboard/settings/crm` routes + key components), backed by
  ~20 page-local `.css` files and the shared `components/sabcrm/twenty/` kit.
- **316 distinct `.st-*` class primitives** in use; ~25,500 lines of Twenty CSS.
- Mapping tiers: **175 generic-swap** (mechanical → a 20ui component),
  **37 bespoke-rebuild** (real engineering), **2 unmapped** (`st-rdt`, `st-fe`
  — internal namespaces, resolve to layout), 3 token-keep.
- The long pole is the **record engine** (~14k LOC across 5 god-files:
  `[objectSlug]/page.tsx` 4476, `record-detail-tw.tsx` 4084, `view-bar.tsx`
  2081, `record-detail-tabs.tsx` 1489, `twenty-field.tsx` 996).
- Estimate: **~8–12 engineer-weeks** solo; ~5–7 parallelized.

> NB: `--st-*` (e.g. `var(--st-text)`, `--st-space-2`) are **20ui design
> tokens** — they STAY. Only the dotted `.st-*` **class** primitives migrate.

## The proven recipe (per page)

Demonstrated end-to-end on **`settings/crm/notifications/page.tsx`** (Phase 1):

1. **Swap shared primitives → 20ui components.** e.g. `st-settings__intro`
   `<p>` → `<PageDescription>` inside `<PageHeaderHeading>`. Use the mapping
   table (generic-swap tier) for `st-card`→`Card`, `st-btn`→`Button`,
   `st-chip`→`Badge`, `st-input`→`Input`, `st-field`→`Field`, `st-empty`→
   `EmptyState`, `st-table`→`Table`, `st-page-header`→`PageHeader`, etc.
2. **Replace trivial layout wrappers** (`st-page`, `st-settings`, `st-section`)
   with page-local classes (`stn-page`, `stn-settings`) defined in the page's
   own CSS, OR 20ui layout utilities — so the page stops referencing the shared
   `.st-*` layout classes.
3. **Re-scope the page-local CSS** off `.sabcrm-twenty` onto the 20ui root:
   `.sabcrm-twenty .foo` → `:is(.\32 0ui, .ui20) .foo`. Dark rules
   `.sabcrm-twenty.st-theme-dark .foo` → `:is(.\32 0ui, .ui20).dark .foo`
   (the CRM settings shell stamps `20ui` + `dark` together on its root).
4. **Verify:** page has zero `sabcrm-twenty` and zero shared `.st-*` primitive
   classNames; its CSS parses; it typechecks; it renders correctly under the
   `20ui` scope alone (no `.sabcrm-twenty` dependence).

The shared `.st-*` rules are NOT deleted mid-migration (other pages still use
them). They are removed in the **final cleanup** once no page references them.

## Phase plan

| # | Phase | Risk | Scope |
|---|-------|------|-------|
| 0 | **Token/scope safety net** | low | Re-home `--st-danger/--st-success/--st-warning/--st-knob` + the `.sabcrm-twenty.st-theme-dark` dark palette OFF the `.sabcrm-twenty` scope root onto the 20ui token layer; decouple the dark toggle from the `.st-theme-dark` class name (it's read/written in `use-crm-prefs.ts`, `crm-settings-shell.tsx`, `twenty-app-frame.tsx`, `twenty-command-menu.tsx`). Do FIRST — removing `.sabcrm-twenty` later shifts these otherwise. |
| 1 | **Settings leaves** (prove recipe) | low | `notifications` ✅ done, `templates`, `profile`, `tags`, `usage` — layout-wrapper swaps. |
| 2 | **Generic core pages** | low | `error`/`loading` shells, `getting-started`, `activity`, `notes`, `search`, `my-work`, `reports` (+ builder). lists→List, grids→Card, skeleton→Skeleton, empties→EmptyState. |
| 3 | **Spatial pages + chart library** | medium | `calendar`, `map`, `dashboard` (+widgets/charts), `charts/funnel-chart`, `twenty-charts`, `tasks` kanban. Migrate the shared chart component once; preserve drag-drop + dark-mode chart legibility. |
| 4 | **Settings feature sheets** (inventory undercounted these) | medium | `roles` (39 hits), `security` (36), `webhooks` (31), `pipelines` (30), `page-layouts` (17, `stpl-*`), `segments` (12), `playground` (10), `automations/*`. |
| 5 | **Shared `twenty/` kit** (god-node, 39 importers) | high | Migrate internals **in place behind the existing exported API** (`TwentyFieldValue`, `StSelect`, `StPortalPopover`, `TwentyChip`, app-frame/outer-shell) — do NOT delete or all 39 consumers break. `StPortalPopover`/`StSelect` must land before Phase 6. |
| 6 | **Record engine** (long pole) | high | `[objectSlug]/page.tsx`, `view-bar.tsx`, `record-detail-tw.tsx` + `[recordId]`, `record-detail-tabs.tsx`, `merge`/`duplicates`/`trash`/`pagination`/`bulk-bar`/`tag-manager`. Virtualized grid, inline edit, recursive filter builder, merge wizard — decompose into 20ui sub-components incrementally behind flags; preserve windowing/edit/merge logic. |
| 7 | **Final cleanup** | medium | Once no surface references `.st-*`/`.sabcrm-twenty`: delete the dead `.sabcrm-twenty` selectors + Twenty CSS, strip `.sabcrm-twenty` from shells + `shell.css`, remove the `.ui20` transition hedge. |

## Top risks

1. **Scope-root token shift** — `.sabcrm-twenty` overrides `--st-danger/-success/-warning` + a dark palette. (Verified: base values DO exist at `:root`, so removal degrades to a different shade, not null — but Phase 0 should re-home the intended values.)
2. **Dark theme coupled to the class name** — `st-theme-dark` toggled by string in 4 files + read via `document.querySelector('.sabcrm-twenty')` in the command menu. Update all of them together.
3. **`twenty/` kit is a god-node** — 39 importers. Shim internals, keep the public API.
4. **Record-engine data-grid** — windowing/virtualization, inline edit, recursive filter tree, popover sort/group. A wholesale swap regresses scroll perf + focus. Decompose incrementally.
5. **Portal/popover foundation** — `StPortalPopover`/`st-select` power every filter/sort/tag/merge popover. Validate 20ui `Popover` covers the fixed-position/portal cases before Phase 6.
6. **Bespoke charts** duplicated across `twenty-charts` / `funnel-chart` / `dashboard-charts` — migrate the shared component once; keep ARIA labels + dark-mode legibility.

## Status

- ✅ **Phase 1 vertical — `settings/crm/notifications`**: migrated (`st-settings__intro`→`PageDescription`, `st-page`/`st-settings`→page-local `stn-*`, `notifications.css` re-scoped to `:is(.\32 0ui, .ui20)`, dark rule → `.dark`). Zero `.sabcrm-twenty`, zero shared `.st-*`; parses + typechecks clean. **This is the canonical recipe template.**
- ▶ Next: Phase 0 (token safety net) + finish Phase 1 leaves, then Phase 2 generic pages as a batched workflow.
