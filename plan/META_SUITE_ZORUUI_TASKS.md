# Meta Suite → ZoruUI — 10-Phase Migration Plan

Recreate every Meta Suite page (`/dashboard/facebook/*`) from zero in the ZoruUI design system. The shell + dock + sidebar are inherited from `/dashboard/layout.tsx` (`ZoruHomeShell`) — Meta Suite gets no bespoke chrome.

**Total scope:** 55 pages + 3 layouts under `src/app/dashboard/facebook/`.

---

## Hard rules (apply to every phase)

1. **Shell:** the parent `/dashboard/layout.tsx` already wraps every Meta Suite page in `ZoruHomeShell`. Don't add a bespoke sidebar/topbar. Module navigation lives in-page (`ZoruPageHeader` actions, `ZoruBreadcrumb`).
2. **Tokens:** every page renders inside `.zoruui` scope. No `clay-*` classes, no rainbow accents — only `--zoru-*` tokens.
3. **Bold by default** — inherited; don't re-add `font-medium`/`font-semibold` overrides unless intentional (inputs).
4. **No tab UI** — for step flows use a numbered stepper, for binary toggles use segmented `ZoruButton`s, for sub-pages use distinct routes.
5. **No `@/components/clay`, no `@/components/ui/*`, no `@/components/wabasimplify` visual imports** in `/dashboard/facebook/*`. `RBACGuard` and other logic guards are OK. Build wachat-style replacements at `src/app/dashboard/facebook/_components/`.
6. **No `@/hooks/use-toast`** — use `useZoruToast` everywhere.
7. **No `react-icons`** — use `lucide-react` icons (zoru-native).
8. **Same data, same handlers, same server-action calls** — only the visual layer changes.
9. **Per-phase commit prefix:** `feat(meta-zoru): phase N — <area>`.

---

## Per-page checklist (applies to every page in phases 1–9)

For each page:

- [ ] Replace `@/components/clay` / `@/components/ui/*` / `@/components/wabasimplify` (visual) imports with `@/components/zoruui` or local `_components/`
- [ ] Wrap top of page in `ZoruPageHeader` (eyebrow + title + description + actions) and `ZoruBreadcrumb` (SabNode › Meta Suite › <section>)
- [ ] Replace primary content:
  - Tables → `ZoruDataTable` / `ZoruTable` / `ZoruTableWithDialog`
  - Card grids → `ZoruCard`
  - Stat cards → `ZoruStatCard` / `ZoruStatisticsCard1`
  - Charts → `ZoruChart` family + `ZORU_CHART_PALETTE` (greyscale only — differentiate series by stroke-dasharray, not hue)
  - Empty states → `ZoruEmptyState`
  - Skeletons → `ZoruSkeleton`
- [ ] Forms → `ZoruInput` / `ZoruTextarea` / `ZoruLabel` / `ZoruSelect` / `ZoruCheckbox` / `ZoruSwitch` / `ZoruRadioGroup` / `ZoruDatePicker`
- [ ] Dialogs/sheets/drawers → `ZoruDialog` / `ZoruAlertDialog` / `ZoruSheet` / `ZoruDrawer` / `ZoruPopover`
- [ ] Dropdowns → `ZoruDropdownMenu` family
- [ ] Toasts → `useZoruToast` / `zoruToast(...)`
- [ ] Badges / pills → `ZoruBadge`
- [ ] File uploads → `ZoruFileUploadCard`

---

## PHASE 0 — Layout + FAB (DONE inline)

- [x] `src/app/dashboard/facebook/layout.tsx` — replace `Button` from `@/components/ui/button` with `ZoruButton`, neutral shadow, position above the dock.

---

## PHASE 1 — Account, project & overview (7 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/page.tsx` | Meta Suite root — overview / project picker |
| `/dashboard/facebook/all-projects/page.tsx` | Connected projects list (or rename: `all/projects`) |
| `/dashboard/facebook/all/projects/page.tsx` | Same shape — verify which is the canonical entry |
| `/dashboard/facebook/setup/page.tsx` | Onboarding wizard (Connect Meta → Pick page → Link assets) — use a numbered stepper |
| `/dashboard/facebook/page-roles/page.tsx` | Page-roles management — table + role-edit dialog |
| `/dashboard/facebook/settings/page.tsx` | Page-level settings form |
| `/dashboard/facebook/agents/page.tsx` | Assigned agents — table + assign-agent dialog |

**Dialogs:** connect-meta, link-page, switch-project, edit-role, assign-agent, remove-agent-confirm.

---

## PHASE 2 — Posts & scheduled content (5 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/posts/page.tsx` | Master post list — `ZoruDataTable` with status badges, filter by page/type |
| `/dashboard/facebook/scheduled/page.tsx` | Scheduled queue — table + edit-schedule sheet + cancel-schedule alert |
| `/dashboard/facebook/create-post/page.tsx` | Composer — multi-section form, attach media, preview pane |
| `/dashboard/facebook/post-randomizer/page.tsx` | Auto-rotate post pool — list + add-to-pool form + activate switch |
| `/dashboard/facebook/calendar/page.tsx` | `ZoruFullscreenCalendar` of scheduled posts |

**Dialogs:** create-post-confirm, schedule-post, edit-schedule, cancel-schedule, delete-post-confirm, add-to-randomizer.

---

## PHASE 3 — Reels, stories, live (3 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/reels/page.tsx` | Reels grid (`ZoruCard` tiles) + upload dialog |
| `/dashboard/facebook/stories/page.tsx` | Stories grid + create-story dialog |
| `/dashboard/facebook/live-studio/page.tsx` | Live broadcast launcher — pre-broadcast checklist + start-stream button + active-stream panel |

**Dialogs:** upload-reel, create-story, start-live-confirm, stop-live-confirm.

---

## PHASE 4 — Engagement & moderation (6 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/messages/page.tsx` | Inbox-style conversation list + thread (similar shell to wachat chat) |
| `/dashboard/facebook/messenger-settings/page.tsx` | Messenger config form |
| `/dashboard/facebook/auto-reply/page.tsx` | Master switch + per-trigger accordion (mirror wachat auto-reply) |
| `/dashboard/facebook/moderation/page.tsx` | Comment queue — `ZoruDataTable` + bulk actions + approve/hide/ban dialogs |
| `/dashboard/facebook/visitor-posts/page.tsx` | Visitor-post moderation table + view-post sheet |
| `/dashboard/facebook/reviews/page.tsx` | Page reviews list + reply dialog + report-review alert |

**Dialogs:** approve-comment, hide-comment, ban-user-confirm, reply-review, report-review.

---

## PHASE 5 — Subscribers, audience, marketing (6 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/subscribers/page.tsx` | Subscriber list — `ZoruDataTable` with bulk actions |
| `/dashboard/facebook/audience/page.tsx` | Audience segments (mirror wachat segments) |
| `/dashboard/facebook/leads/page.tsx` | Lead-form submissions list + view-lead sheet + export-csv dialog |
| `/dashboard/facebook/broadcasts/page.tsx` | Messenger broadcast list + create-broadcast sheet |
| `/dashboard/facebook/bulk-create/page.tsx` | Bulk post-creator — CSV upload + preview + confirm-send dialog |
| `/dashboard/facebook/knowledge/page.tsx` | Knowledge base / FAQ manager — list + create/edit/delete dialogs |

**Dialogs:** add-subscriber, save-segment, export-leads, create-broadcast, confirm-bulk-send, create-faq, edit-faq, delete-faq-confirm.

---

## PHASE 6 — Commerce (catalog) (6 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/commerce/shop/page.tsx` | Shop overview — KPI stat-cards + recent orders table |
| `/dashboard/facebook/commerce/orders/page.tsx` | Orders table + per-order detail sheet + refund dialog |
| `/dashboard/facebook/commerce/products/page.tsx` | Product catalog list — grid of `ZoruCard` tiles |
| `/dashboard/facebook/commerce/products/[catalogId]/page.tsx` | Catalog detail — product table + create-product dialog |
| `/dashboard/facebook/commerce/collections/page.tsx` | Collections list + create-collection dialog |
| `/dashboard/facebook/commerce/analytics/page.tsx` | Stat-strip + greyscale charts + breakdown table |
| `/dashboard/facebook/commerce/api/page.tsx` | API config form + key rotation dialog |

**Dialogs:** create-product, edit-product, delete-product-confirm, create-collection, refund-order, rotate-api-key.

---

## PHASE 7 — Custom E-commerce (10 pages + 2 layouts)

| Page | Notes |
|---|---|
| `/dashboard/facebook/custom-ecommerce/layout.tsx` | Shell wrap (zoru-token only) |
| `/dashboard/facebook/custom-ecommerce/page.tsx` | Shop list + create-shop dialog |
| `/dashboard/facebook/custom-ecommerce/dashboard/page.tsx` | Account-level KPIs |
| `/dashboard/facebook/custom-ecommerce/appearance/page.tsx` | Theme picker — `ZoruColorPicker` + neutral preview |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/layout.tsx` | Shop scope wrap |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/page.tsx` | Shop overview |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/products/page.tsx` | Product catalog |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/orders/page.tsx` | Orders table |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/appearance/page.tsx` | Theme picker per shop |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/settings/page.tsx` | Shop config form |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder/page.tsx` | Page-builder shell |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder/page.tsx` | Conversational flow builder shell |
| `/dashboard/facebook/custom-ecommerce/manage/[shopId]/flow-builder/docs/page.tsx` | Docs / inline reference panel |

**Dialogs:** create-shop, edit-shop, delete-shop-confirm, save-theme, publish-shop-confirm.

---

## PHASE 8 — Insights & analytics (4 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/insights/page.tsx` | Account insights — KPI strip + greyscale chart + segment dropdown |
| `/dashboard/facebook/events/page.tsx` | Lifecycle events (Pixel / CAPI) — table + per-event sheet |
| `/dashboard/facebook/competitors/page.tsx` | Competitor tracking — list + add-competitor dialog + side-by-side compare |
| `/dashboard/facebook/kanban/page.tsx` | Workflow kanban (mirror wachat kanban — status dropdown, no DnD) |

**Dialogs:** export-insights, view-event-detail (sheet), add-competitor, remove-competitor-confirm.

---

## PHASE 9 — Tools, infra, roadmap (4 pages)

| Page | Notes |
|---|---|
| `/dashboard/facebook/flow-builder/page.tsx` | Visual flow editor shell — keep existing canvas/runtime, restyle chrome only |
| `/dashboard/facebook/flow-builder/docs/page.tsx` | Inline docs — `ZoruAccordion` sections |
| `/dashboard/facebook/webhooks/page.tsx` | Webhook endpoints + create / test / delete dialogs |
| `/dashboard/facebook/media/page.tsx` | Media library — use composed `ZoruFilesPage` |
| `/dashboard/facebook/pages/page.tsx` | Connected pages list (might overlap with Phase 1; verify) |
| `/dashboard/facebook/roadmap/page.tsx` | Roadmap — grid of `ZoruCard` tiles with status badges |

**Dialogs:** create-webhook, test-webhook, delete-webhook-confirm, upload-media (uses composed `ZoruFileUploadDialog`).

---

## PHASE 10 — Cleanup + verification

- [ ] **tsc gate:** `npx tsc --noEmit -p tsconfig.json | grep -v ".next/"` — zero errors
- [ ] **Audit:**
  - `grep -rl "@/components/clay" src/app/dashboard/facebook` — 0
  - `grep -rl "@/components/ui/" src/app/dashboard/facebook` — 0
  - `grep -rl "@/hooks/use-toast" src/app/dashboard/facebook` — 0
  - `grep -rl "react-icons" src/app/dashboard/facebook` — 0
  - `grep -rE 'clay-[a-z-]+' src/app/dashboard/facebook` — 0
  - `grep -rE "(bg|text|border)-(emerald|rose|amber|indigo|sky|teal|violet|pink|red|green|blue|purple|orange|fuchsia|cyan|lime|yellow)-[0-9]+" src/app/dashboard/facebook` — 0
  - `grep -rE "ZoruTabs|TabsProvider|TabsBar" src/app/dashboard/facebook` — 0
  - `grep -rE "font-(light|thin|extralight)" src/app/dashboard/facebook` — 0
- [ ] **Wabasimplify visual imports** in `/dashboard/facebook/*`:
  - `RBACGuard` and other auth/logic guards: OK
  - Visual composites: should all be replaced by local files under `src/app/dashboard/facebook/_components/`
- [ ] **Manual walk:** open each page in dev, screenshot, confirm:
  - Dock + sidebar inherited from `/dashboard`
  - "Meta Suite" entry in dock highlights when on `/dashboard/facebook/*`
  - No horizontal overflow at 1280px
  - Loading skeletons present
  - Empty states present
- [ ] Document any remaining `wabasimplify` follow-ups (large composites that need a separate batch)

**Final commit:** `chore(meta-zoru): phase 10 — cleanup & verification`

---

## Suggested execution order

If shipping vertical slices:

1. **Phase 0** (done inline) + **Phase 1** (account, the front door)
2. **Phase 2** + **Phase 3** (posts + reels, the publishing surface)
3. **Phase 4** (engagement)
4. **Phase 5** (subscribers + marketing)
5. **Phase 6** (commerce)
6. **Phase 7** (custom e-commerce — heaviest)
7. **Phase 8** + **Phase 9** in parallel (insights + tools)
8. **Phase 10** cleanup last

For maximum throughput: dispatch Phases 1–9 as 9 parallel agents simultaneously, then run Phase 10 verification once all complete.
