# De-zoru migration — autonomous overnight run

GOAL (user, 2026-06-06, asleep — keep working non-stop): delete
`src/components/sabcrm/20ui/zoru/` AND `src/components/sabcrm/20ui/compat.ts`.
Every file imports CLEAN names from `@/components/sabcrm/20ui`. No legacy, no zoru.

## Hard rules (learned from the fire this session)
- NEVER bulk-sed thousands of files blind. Pilot on ONE module, verify, then scale.
- Bulk edits crash the Turbopack dev server -> kill `next dev` + `rm -rf .next/cache` around big changes.
- `tsc --noEmit` baseline is ~113k errors (clay/e2e/mongo casts/missing rust-clients) — NOT a green/red gate.
  The ONLY class that breaks the bundler is missing-export/missing-module against the design system
  (TS2305/TS2307 vs `@/components/sabcrm/20ui`). Verify THAT class == 0, not total tsc.
- Commit only if the user asks (they have not). Work in the tree; rely on git diff to recover.
- API-DIFFERENT components are NOT safe blind renames — handle per-file/Wave 2:
  ZoruNotificationPopover, ZoruUserDropdown (20ui has its own, different API), ZoruToaster (provider-free).
- zoruSonnerToast uses `.loading()` which 20ui `toast` lacks — add `.loading` before converting those 31 files.

## Baseline scope (measured 2026-06-06)
- 3641 files import `/compat`
- 2593 files use `Zoru*` identifiers
- 945 files use `useZoruToast`  -> useToast
- 321 files import `/zoru` directly
- unique zoru-only components (need absorb into 20ui, no clean equiv): shell family
  (ZoruHomeShell/AppRail/AppSidebar), file-manager (ZoruFile*), ZoruSonner/zoruSonnerToast,
  ZORU_CHART_PALETTE, ZoruProvider, zoruBadgeVariants, ZoruDynamicSelector, ZoruCalendarLume,
  WaterLoader, SabNodeSidebar.

## Fixes already shipped this session (firefight, before the de-zoru)
- Rebuilt `20ui/toast.tsx`: standalone `toast()` (sonner-style, variant->tone). 33 zoruToast files -> toast.
- 15 dead `@/components/zoruui` importers -> compat; rankings-table -> clean barrel.
- compat gap-fills added: CardContent->CardBody, zoruSonnerToast/ZORU_CHART_PALETTE/ZoruProvider/
  zoruBadgeVariants/ZoruDynamicSelector/SabnodeWaterLoader/SabNodeSidebar (resolves 169 files).
- 16 dashboard pages rebuilt off shadcn `@/components/ui` -> 20ui (the original workflow).

## Waves
- [ ] WAVE 1: deterministic codemod — files using ONLY safe aliases: `Zoru*`->clean, `useZoruToast`->useToast,
      import `/compat`->`@/components/sabcrm/20ui`. Pilot on src/components/email, verify, scale by module dir.
- [ ] WAVE 2: absorb unique zoru-only components into 20ui (relocate + clean names + fold CSS), per-file API-different.
- [ ] WAVE 3: delete `zoru/` + `compat.ts` + zoru-legacy.css once importers==0; final verify.

## Verification harness
- fast: scripts/check-20ui-imports (validate every 20ui named import against barrel exports) — build this.
- deep: NODE_OPTIONS=--max-old-space-size=16384 npx tsc --noEmit > /tmp/sabnode-tsc.log 2>&1 ; grep TS2305/2307 vs 20ui.
