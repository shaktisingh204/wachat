# SabWa → ZoruUI Migration

Mirrors the WaChat / Meta Suite migration plans. Every `/sabwa/*` page
moves to ZoruUI primitives; the bespoke `SabWaSubRail` is removed and
replaced by `ZoruHomeShell` (same chrome as `/dashboard` and `/wachat`).

## Status

| Phase | Area | State |
|-------|------|-------|
| 0 | Shell migration (`SabwaShell` + `ZORU_APPS` entry + sidebar config) | ✅ done |
| 1 | `/sabwa` (All Projects landing with 3-step flow pill) | ✅ done |
| 2 | `/sabwa/overview` (moved from `/sabwa`) | ⏳ pending — uses `/ui/*`, needs per-component swap |
| 3 | `/sabwa/connect` (5-step stepper + segmented QR/Phone picker) | ✅ done |
| 4 | `/sabwa/devices` | ⏳ pending |
| 5 | `/sabwa/inbox`, `/sabwa/chats` | ⏳ pending |
| 6 | `/sabwa/groups/*` | ⏳ pending |
| 7 | `/sabwa/broadcasts`, `/sabwa/bulk` | ⏳ pending |
| 8 | `/sabwa/scheduler/*` | ⏳ pending |
| 9 | `/sabwa/contacts`, `/sabwa/templates`, `/sabwa/quick-replies` | ⏳ pending |
| 10 | `/sabwa/auto-reply`, `/sabwa/flows`, `/sabwa/ai` | ⏳ pending |
| 11 | `/sabwa/media`, `/sabwa/status`, `/sabwa/calls`, `/sabwa/labels`, `/sabwa/starred` | ⏳ pending |
| 12 | `/sabwa/analytics`, `/sabwa/export`, `/sabwa/audit` | ⏳ pending |
| 13 | `/sabwa/webhooks`, `/sabwa/api-keys`, `/sabwa/settings` | ⏳ pending |

## Hard rules (apply to every phase)

1. **Shell:** every `/sabwa/*` page already renders inside `SabwaShell`
   (which wraps `ZoruHomeShell`). Don't add a bespoke sidebar/topbar.
   Module navigation lives in the sidebar groups; page-level actions
   live in `ZoruPageHeader` actions / `ZoruBreadcrumb`.
2. **Tokens:** every page renders inside `.zoruui` scope. No `clay-*`
   classes, no rainbow accents — only `--zoru-*` tokens.
3. **No tab UI** — for step flows use the numbered stepper (see
   `/sabwa/connect` `FlowStepper`), for binary toggles use segmented
   `ZoruButton`s, for sub-pages use distinct routes.
4. **No `@/components/clay`, no `@/components/ui/*` visual imports**
   in `/sabwa/*`. `RBACGuard` and other logic guards are OK. Build
   sabwa-local replacements at `src/app/sabwa/_components/`.
5. **No `@/hooks/use-toast`** — use `useZoruToast` everywhere.
6. **Same data, same handlers, same server-action calls** — only the
   visual layer changes.
7. **Per-phase commit prefix:** `feat(sabwa-zoru): phase N — <area>`.

## Per-page checklist

- [ ] Replace `@/components/ui/*` imports with `@/components/zoruui/*`
- [ ] Add `ZoruBreadcrumb` (SabNode › SabWa › <section>)
- [ ] Wrap top of page in `ZoruPageHeader` (eyebrow + title + description + actions)
- [ ] Replace primary content:
  - Tables → `ZoruDataTable` / `ZoruTable` / `ZoruTableWithDialog`
  - Card grids → `ZoruCard`
  - Stat cards → `ZoruStatCard` / `ZoruStatisticsCard1`
  - Charts → `ZoruChart` family + `ZORU_CHART_PALETTE` (greyscale)
  - Empty states → `ZoruEmptyState`
  - Skeletons → `ZoruSkeleton`
- [ ] Forms → `ZoruInput` / `ZoruTextarea` / `ZoruLabel` / `ZoruSelect`
      / `ZoruCheckbox` / `ZoruSwitch` / `ZoruRadioGroup`
- [ ] Dialogs/sheets/drawers → `ZoruDialog` / `ZoruAlertDialog`
      / `ZoruSheet` / `ZoruDrawer`
- [ ] Toasts → `useZoruToast`
- [ ] Page renders inside the sidebar shell; dock shows SabWa as active.

## Clear flow (delivered)

```
/sabwa                ─►  Pick or create a project (3-step flow pill)
   │
   └── click "Continue to connect" (only enabled once a project is selected)
                                      │
                                      ▼
/sabwa/connect       ─►  5-step linker stepper
                          1. Generate code (QR or 8-char pair code)
                          2. Open WhatsApp on your phone
                          3. Settings → Linked Devices
                          4. Scan QR / enter code
                          5. Done — redirect to /sabwa/inbox
```
