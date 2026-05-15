# SabWa → ZoruUI Migration

Every `/sabwa/*` page is now on ZoruUI primitives. The bespoke
`SabWaSubRail` has been replaced by `ZoruHomeShell` (same chrome as
`/dashboard` and `/wachat`).

## Status — All phases complete (2026-05-15)

| Phase | Area | State |
|-------|------|-------|
| 0 | Shell migration (`SabwaShell` + `ZORU_APPS` entry + sidebar config) | ✅ done |
| 1 | `/sabwa` (All Projects landing with 3-step flow pill) | ✅ done |
| 2 | `/sabwa/overview` (zoruui tokens, breadcrumb, neutral palette) | ✅ done |
| 3 | `/sabwa/connect` (5-step stepper + segmented QR/Phone picker) | ✅ done |
| 4 | `/sabwa/devices` (segmented grid/table switch) | ✅ done |
| 5 | `/sabwa/inbox`, `/sabwa/chats` (composer, chat list row, conversation header, contact panel) | ✅ done |
| 6 | `/sabwa/groups/*` (all groups + categories + per-group manager) | ✅ done |
| 7 | `/sabwa/broadcasts`, `/sabwa/bulk` (4-step wizard on FlowStepper) | ✅ done |
| 8 | `/sabwa/scheduler/*` (calendar + queue) | ✅ done |
| 9 | `/sabwa/contacts`, `/sabwa/templates`, `/sabwa/quick-replies` | ✅ done |
| 10 | `/sabwa/auto-reply`, `/sabwa/flows`, `/sabwa/ai` | ✅ done |
| 11 | `/sabwa/media`, `/sabwa/status`, `/sabwa/calls`, `/sabwa/labels`, `/sabwa/starred` | ✅ done |
| 12 | `/sabwa/analytics`, `/sabwa/export`, `/sabwa/audit` (charts on `ZORU_CHART_PALETTE`) | ✅ done |
| 13 | `/sabwa/webhooks`, `/sabwa/api-keys`, `/sabwa/settings` | ✅ done |

## Known leftovers (intentional)

- `Slider` (`@/components/ui/slider`) — kept in `/sabwa/bulk` for the send-rate & jitter controls. No `ZoruSlider` is exported from `@/components/zoruui/index.ts`. Single explicit shadcn import; flagged inline.
- `SabFilePickerButton` — left as-is wherever it appears (per the SabFiles policy in `CLAUDE.md` — file inputs must source from the SabFiles picker, never from a free-text URL).
- `_components/empty-state.tsx` and `_components/status-badge.tsx` — shared local SabWa subcomponents, not shadcn — left untouched, render correctly inside the ZoruUI scope.

## Hard rules (apply going forward)

1. **Shell:** every `/sabwa/*` page renders inside `SabwaShell` (which wraps `ZoruHomeShell`). Don't add bespoke chrome. Module nav lives in the sidebar groups; page actions live in `ZoruPageHeader` / `ZoruBreadcrumb`.
2. **Tokens:** every page renders inside `.zoruui` scope. No `clay-*` classes, no rainbow accents — only `--zoru-*` tokens.
3. **No tab UI** — step flows use a numbered stepper, binary/N-way toggles use segmented `ZoruButton`s.
4. **No `@/components/clay`, no `@/components/ui/*` visual imports** in `/sabwa/*` (logic-only guards like `RBACGuard` are OK). Slider is the only documented exception until a `ZoruSlider` ships.
5. **No `@/hooks/use-toast`** — use `useZoruToast` everywhere.
6. **Same data, same handlers, same server-action calls** — visual layer only.

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
