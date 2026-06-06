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
- [x] WAVE 1 (Pass A): `Zoru*`->clean names in compat-importing files. 2258 files. (commit "Pass A")
- [x] WAVE 1b: bridged ALL /zoru-only names through compat; redirected 290 /zoru consumers -> compat.
      Consumer /zoru COMPONENT imports == 0 (only zoru-legacy.css side-imports + compat bridge remain).
- [x] compat gap-bridge complete -> fast checker `node .20ui-dezoru/check-imports.js` == 0 missing. APP BUILDS.
- [x] WAVE 1c (Pass B): swapped 3657 barrel-safe files /compat -> clean @/components/sabcrm/20ui.
      compat importers 3953 -> 298. clean-barrel importers ~3923. checker still 0. (commit "Pass B")
- [ ] WAVE 2 — clear the 298 remaining /compat files:
    SAFE RENAMES first (same component, just clean name; then they Pass-B to barrel):
      - CardContent -> CardBody  (137 files)  [clean rename, collision-guarded]
      - zoruSonnerToast -> toast (35) + zoruToast -> toast (9)  [ADD `toast.loading` first; sonner-style .loading used]
    ABSORB unique legacy components into 20ui (relocate impl + clean name + keep CSS), then drop compat bridge:
      - chart: ZoruChart(40, recharts namespace) + ZORU_CHART_PALETTE(41)
      - file-manager: ZoruFileUploadCard/FilesPage/FileEntity/FileInput/FileCardCollections (-> @/components/sabfiles per policy)
      - shell: ZoruHomeShell(5)/ZoruAppSidebar(8)/ZoruHeader(7)/ZoruShell/ZORU_APPS/applyTheme/useHtmlDark/AppThemeToggle
      - ZoruRadioGroupItem(50) -> 20ui radio item (check choice.tsx API)
      - ZoruAccordion03*(10), ZoruStatisticsCard1(8), ZoruProvider(10), ZoruToaster(9, provider-free),
        ZoruBouncyToggle/LimelightNav/StarIcon(7 each), ZoruDynamicSelector(2)
      - SHOWCASE /app/zoruui/* (~8 files, Pass A collision-skipped: ZoruCalendar/ZoruEmptyState collide) -> rename or delete demos
- [ ] WAVE 3: when 298 -> 0, delete compat.ts + zoru/ folder + fold zoru-legacy.css into 20ui (rename). Final tsc.

## Current metrics (update each wave)
- DONE since: Badge/Button/Alert variant-compat; chart cluster -> Recharts namespace + CHART_PALETTE;
  RadioGroupItem=Radio (FIXED split-context radios); CardContent->CardBody; toast unification.
- tsc total errors 113151 -> 111118 (-2033, net IMPROVEMENT).
- REMAINING compat importers: **53** (9 = legacy /app/zoruui showcase; ~44 = file-manager ZoruFile* (13+11),
  ZoruProvider(10), ZoruAccordion03*(10), ZoruToaster(9), ZoruStatisticsCard1(8), ZoruAppSidebar/shell(8)).
  ALL render-sensitive -> finish with visual checks (radio/chart already safe-done).
- checker missing-export: 0 (APP BUILDS) | compat importers: **53** (was 4221) | clean-barrel: ~4030
- Pass A2 + Pass B2 done: CardContent->CardBody, zoruToast/zoruSonnerToast->toast(+toast.loading),
  Badge/Button/Alert accept legacy `variant` props (map to tones) -> ~480 prop regressions fixed.
- tsc baseline ~113151; rose to 114062 after /zoru->20ui swap (legacy->20ui prop diffs, NON-build-breaking),
  then component-variant backcompat fixes pull it back down (tsc4 measuring).
- branch: dezoru-20ui-migration (checkpoint commits). main untouched.

## REMAINING TAIL — the 128 compat files (Wave 2/3, render-sensitive — do with visual checks)
Each needs a clean 20ui home before compat + /zoru can be deleted. Recommended SAFE approach:
RELOCATE the impl out of zoru/ into 20ui proper (or sabfiles) with a clean name, KEEP its CSS
(rename zoru-legacy.css -> a 20ui css), update barrel + compat alias, then rename consumers. Moving
the exact impl preserves behavior (no blind rewrite). Clusters by #files:
- ZoruRadioGroupItem (50)  -> 20ui radio item (check choice.tsx Radio API; add RadioGroupItem). RENDER-RISK: radio selection.
- ZoruChart (40) + ZORU_CHART_PALETTE (41) -> add clean `Chart` (recharts namespace) + `CHART_PALETTE` to 20ui chart. LOW render risk (data/colors).
- file-manager: ZoruFileUploadCard(13)/ZoruFilesPage(11)/ZoruFileEntity/ZoruFileInput/ZoruFileCardCollections -> @/components/sabfiles (policy). Relocate.
- ZoruProvider(10), ZoruToaster(9) -> 20ui provider/Toaster (provider-free diff for Toaster).
- ZoruAccordion03*(10) -> 20ui Accordion (verify API) or relocate as Accordion variant.
- ZoruStatisticsCard1(8) -> 20ui StatCard (verify) or relocate.
- shell: ZoruAppSidebar(8)/ZoruHomeShell/ZoruHeader/ZoruShell/ZORU_APPS/applyTheme/useHtmlDark/AppThemeToggle -> 20ui shell. HARD.
- SHOWCASE /app/zoruui/* (~8 files) collision-skipped (import both ZoruCalendar & Calendar etc.).
  These demo the OLD zoru components -> simplest: DELETE or rewrite the showcase. Low stakes.
- 1 real-app collision: src/app/sabwa/inbox/_components/left-pane.tsx (ZoruEmptyState <-> EmptyState) -> dedup by hand.

## ===== PHASE 2 (user 2026-06-06): EVERY module/page -> PURE 20ui =====
User directive: remove legacy+zoruui FULLY, then migrate EVERY module/page EXCEPT crm, hrm, wachat
(already done) so every frontend file uses ONLY 20ui — no raw HTML primitives, no inline styles,
nothing but 20ui. Parallel agents, non-stop, BREAKAGE TOLERANCE ON.

STATUS of "remove zoruui fully": compat.ts DELETED; /zoru path GONE (-> 20ui/legacy/); 0 Zoru* names,
0 compat, 0 /zoru in consumers. REMAINING legacy bits (removed as modules migrate, then deleted):
  - src/components/sabcrm/20ui/legacy/ (shell SabHomeShell x5 layouts, file-manager x12, widgets) + legacy-public.ts
  - zoru-legacy.css (18 imports) + the `.zoruui` scope class (378 files)
  Final deletion AFTER modules migrated: rebuild the 5 dashboard layouts on 20ui shell (SabHomeShell ->
  20ui HomeShell wiring), migrate file-manager -> @/components/sabfiles, then delete legacy/ + legacy-public.ts
  + zoru-legacy.css + drop .zoruui.

MIGRATION WORKFLOW (reusable): `module-to-pure-20ui`
  scriptPath: .../987f8268-.../workflows/scripts/module-to-pure-20ui-wf_a1088dab-205.js
  Launch per module: Workflow({scriptPath, args:{module:"src/app/dashboard/<name>"}})
  Per file: list -> rewrite (pure 20ui, 4 skills, breakage-ok) -> verify+fix. Disjoint files => run several
  modules CONCURRENTLY. Validate quality on first completions, then chain the rest.

RATE-LIMIT LESSON: parallel agents hit HTTP 429 ("Server is temporarily limiting requests") at
~48-96 concurrent (6 workflows x16, or 3 x16). DO NOT run unthrottled. Working approach:
THROTTLED workflow `module-20ui-throttled` (chunk=4, REWRITE-ONLY, peak ~4 agents/workflow);
run ~3 concurrently (peak ~12). Per-module throttled copies: /tmp/mod20ui/t_<module>.js
(sed of the base throttled script). sabsign proved it (24/24, 1.7M tokens, no 429).

DONE + COMMITTED (pure-20ui): url-shortener (36), sabsign (24). [sabvault/sabsprints already clean.]
RUNNING (throttled x3): ad-manager, finance, email.
LOOP: on each completion -> validate (node .20ui-dezoru/check-imports.js == 0; residual grep
EXCLUDING legit: <input type=hidden>, runtime style={{color}}, @/components/zoruui-domain) ->
commit module -> launch next t_<module>.js, hold ~3 concurrent.
QUEUE (t_*.js staged): sabsense sabchat sabmonitor sabshop sabconnect sabworkerly platform api
marketing team sabbigin sabpractice sabcreator settings user sabcheckout sabflow sabmeet sabtables
sabwebinar facebook telegram sabdesk sabbi seo + non-dashboard (sabwa sabsms portal admin app auth onboarding).

MODULES TO MIGRATE (dashboard, exclude crm + hrm + hrm-advanced + wachat; ~ file counts):
  seo 268, sabdesk 114, facebook 96, sabbi 90, telegram 88, ad-manager 55, sabflow 49, user 48,
  settings 48, sabcheckout 48, sabsense 45, finance 43, url-shortener 41*, sabchat 36, sabmonitor 34,
  sabshop 30, sabconnect 28, email 28, sabworkerly 26, sabsign 25, platform 22, api 22, sabsprints 21*,
  marketing 20, team 17, sabbigin 17, sabpractice 16, sabcreator 16, sabvault 15*, + the long tail.
NON-dashboard top-level to also do: src/app/sabwa, sabsms, portal, admin, app, auth, onboarding, etc.
(* = in flight)

## Wave 3 final deletion gate (when 128 -> 0)
- delete src/components/sabcrm/20ui/compat.ts (+ its Zoru* aliases)
- delete src/components/sabcrm/20ui/zoru/ folder
- rename/fold src/components/sabcrm/20ui/zoru-legacy.css into 20ui (drop "zoru" from name); it still styles
  relocated legacy components, so KEEP the rules, just rename the file + its 18 layout import sites.
- final: node check-imports.js == 0 AND a render smoke test of a few migrated routes.

## Codemods (reusable)
- .20ui-dezoru/codemod-passA.js <dir>  — Zoru*->clean for compat imports (collision-guarded)
- .20ui-dezoru/codemod-passB.js <dir>  — /compat -> barrel when all names barrel-safe
- .20ui-dezoru/check-imports.js         — fast missing-export checker (run after every change)
- /tmp/dezoru-map.txt                    — ZoruName => cleanName map (from compat aliases)

## Verification harness
- fast: scripts/check-20ui-imports (validate every 20ui named import against barrel exports) — build this.
- deep: NODE_OPTIONS=--max-old-space-size=16384 npx tsc --noEmit > /tmp/sabnode-tsc.log 2>&1 ; grep TS2305/2307 vs 20ui.
