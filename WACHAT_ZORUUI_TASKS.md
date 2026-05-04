# WaChat → ZoruUI — 10-Phase Migration Plan

Recreate every WaChat page in the ZoruUI design system. **The sidebar and dock are shared from `/dashboard`** — i.e. every `/wachat/*` page renders inside `ZoruHomeShell`, picking up the same `ZoruAppSidebar` groups (Workspace + Shortcuts) and the same bottom-anchored `ZoruDock` that the home page uses. No bespoke wachat chrome.

**Total scope:** 75 pages (64 top-level + 10 nested + 1 root) across 64 directories under `src/app/wachat/`. No URL changes — every route stays where it is post-move.

---

## Hard rules (apply to every phase)

1. **Shell:** wrap `/wachat/layout.tsx` in `ZoruHomeShell`. No `SabNodeDashboardShell`, no Clay chrome, no per-module sidebar.
2. **Tokens:** every page renders inside `.zoruui` scope. No `clay-*` classes, no rainbow accents (`bg-emerald-50`, `text-rose-600`, etc.) — only `--zoru-*` tokens.
3. **Bold by default** — inherited from the scope; don't re-add `font-medium`/`font-semibold` overrides unless dropping below 600 is intentional (e.g. inputs).
4. **No multi-tab strip** — `TabsProvider`/`TabsBar` from `src/components/tabs/` stays out.
5. **Same data, same handlers** — no behavioral changes to server actions / forms / state. Only visual swap.
6. **Per-page commit prefix:** `feat(wachat-zoru): phase N — <page>`.

---

## Per-page checklist (applies to every page in phases 1–9)

For each page:

- [ ] Replace `import * from '@/components/clay'` / `'@/components/ui/*'` → `'@/components/zoruui'`
- [ ] Wrap top of page in `ZoruPageHeader` (eyebrow / title / description / actions)
- [ ] Add `ZoruBreadcrumb` above the page title (SabNode › WaChat › <section>)
- [ ] Replace primary content:
  - Tables → `ZoruDataTable` (sortable / filterable) or `ZoruTable` (static) or `ZoruTableWithDialog` (row → detail)
  - Card grid → `ZoruCard` with `variant="default" | "soft" | "elevated"`
  - Stat cards → `ZoruStatCard` / `ZoruStatisticsCard1`
  - Charts → `ZoruChart` family + `ZORU_CHART_PALETTE` (greyscale only)
  - Empty cells → `ZoruEmptyState`
- [ ] Replace forms with `ZoruInput` / `ZoruTextarea` / `ZoruLabel` / `ZoruSelect` / `ZoruCheckbox` / `ZoruSwitch` / `ZoruRadioGroup`
- [ ] Replace dialogs / sheets / drawers / popovers with `ZoruDialog` / `ZoruAlertDialog` / `ZoruSheet` / `ZoruDrawer` / `ZoruPopover`
- [ ] Replace dropdown menus with `ZoruDropdownMenu` family
- [ ] Replace toasts: `useZoruToast` / `zoruToast(...)` (or `ZoruSonner` if the page already uses sonner)
- [ ] Replace badges / pills with `ZoruBadge`
- [ ] Page render check in browser: scrollable, no horizontal overflow, dock visible, sidebar active item highlighted

---

## PHASE 0 — Shell migration (one commit, unblocks every other phase)

**Files:**
- `src/app/wachat/layout.tsx` — swap `SabNodeDashboardShell` for `ZoruHomeShell`. Same session/onboarding gate and props as `src/app/dashboard/layout.tsx`. Only difference is the `<ZoruHomeShell>` instance ships an `activeApp="wachat"` hint via the existing `isActive` lambdas (already correct — `WaChat` dock entry lights up when `pathname === "/wachat"` or `pathname.startsWith("/wachat/")`).
- Update the `WaChat` dock entry in `src/components/zoruui/shell/zoru-home-shell.tsx` so `isActive: (p) => p === "/wachat" || p.startsWith("/wachat/")` instead of strict equality.
- Verify the Workspace sidebar group still makes sense for wachat pages (it's account-level: Home / What's new / Notifications). Keep as-is — module nav lives in-page, not in the sidebar.

**Acceptance:** `/wachat`, `/wachat/contacts`, `/wachat/broadcasts` all render the dashboard sidebar + dock; no flicker; no `clay-*` classes in DOM root above `<main>`; dock highlights "WaChat".

---

## PHASE 1 — Overview + inbox workspace (12 pages)

The conversational core — chat workspace + conversation views + agent operations.

| Page | Purpose | Key UI to swap |
|---|---|---|
| `/wachat/page.tsx` | Wachat overview / project picker | Hero, stat-card grid, recent activity list |
| `/wachat/chat` | Live chat workspace | 3-pane layout (conversations list / thread / contact panel), composer, attachments |
| `/wachat/chat/kanban` | Conversations as a kanban board | `ZoruScrollArea` + draggable `ZoruCard` columns |
| `/wachat/chat-export` | Export chat history | Form + date range picker + export-confirm dialog |
| `/wachat/chat-labels` | Manage conversation labels | Label list table + create/edit dialog + color picker (neutral) |
| `/wachat/chat-ratings` | Customer rating stream | `ZoruDataTable` + filter sheet + rating histogram chart |
| `/wachat/chat-transfer` | Manual conversation reassignment | Filterable list + transfer dialog with `ZoruSelect` agent picker |
| `/wachat/conversation-filters` | Saved filters | Filter cards + create-filter sheet with `ZoruRadioCard` operator picker |
| `/wachat/conversation-kanban` | Kanban view of conversations by status | Same kanban primitives as chat/kanban |
| `/wachat/conversation-search` | Full-text search across conversations | `ZoruActionSearchBar` + result `ZoruCard` list + open-conversation drawer |
| `/wachat/conversation-summary` | AI-generated conversation summaries | Conversation list + summary detail panel |
| `/wachat/assignments` | Conversation assignment rules | `ZoruDataTable` + create-rule dialog |
| `/wachat/agent-availability` | Online/offline / capacity per agent | Avatar + status `ZoruSwitch` rows, schedule grid |

**Dialogs to land in this phase (~8):** export-chat, label-create, label-delete, transfer-conversation, save-filter, create-assignment-rule, set-agent-status, agent-schedule-edit.

---

## PHASE 2 — Contacts module (8 pages)

Everything contact-record oriented.

| Page | Purpose | Key UI to swap |
|---|---|---|
| `/wachat/contacts` | Master contacts list | `ZoruDataTable` + bulk-action menu + import/export buttons + create-contact dialog |
| `/wachat/contact-groups` | Group / segment management | Group cards + create/edit dialog + member count chips (`ZoruBadge`) |
| `/wachat/contact-blacklist` | Blacklisted contacts | Table + add-to-blacklist dialog + remove confirm `ZoruAlertDialog` |
| `/wachat/blocked-contacts` | Hard-blocked numbers | Same shape as blacklist |
| `/wachat/contact-import-history` | Past import jobs | Job table + view-results sheet + retry-job dialog |
| `/wachat/contact-merge` | Merge duplicates | Side-by-side compare panels + confirm-merge alert dialog |
| `/wachat/contact-notes` | Per-contact notes feed | Contact picker + note thread + new-note form |
| `/wachat/contact-timeline` | Activity timeline | Filterable timeline (`ZoruScrollArea`) + filter sheet |

**Dialogs (~7):** create-contact, edit-contact, import-contacts, export-contacts, blacklist-add, blacklist-remove-confirm, merge-confirm.

---

## PHASE 3 — Broadcasts & campaigns (10 pages)

Outbound campaigns and bulk send.

| Page | Purpose | Key UI to swap |
|---|---|---|
| `/wachat/broadcasts` | Campaign list | `ZoruDataTable` with status badges, filter sheet, create button |
| `/wachat/broadcasts/[broadcastId]` | Campaign detail / report | `ZoruPageHeader` + KPI stat-grid + delivery chart + recipients table + retry-failed dialog |
| `/wachat/broadcast-history` | Sent broadcasts log | Table + replay-broadcast dialog |
| `/wachat/broadcast-scheduler` | Schedule a campaign | Multi-step form (template → audience → schedule → review), `ZoruDatePicker` + `ZoruCalendarLume` |
| `/wachat/broadcast-segments` | Saved audience segments | Segment cards + create/edit sheet (criteria builder) |
| `/wachat/bulk` | Bulk send root (CSV) | File upload (`ZoruFileUploadCard`) + preview table + confirm-send dialog |
| `/wachat/bulk-messaging` | Bulk text message dispatcher | Composer + recipient picker + send dialog |
| `/wachat/bulk/template` | Bulk send via template | Template picker + variable mapper + send dialog |
| `/wachat/campaign-ab-test` | A/B variant configurator | Two-card variant grid + assign-traffic slider + start-test dialog |
| `/wachat/scheduled-messages` | Per-message schedule queue | Table + edit-schedule sheet + cancel-schedule alert |

**Dialogs (~10):** create-broadcast, retry-failed, replay-broadcast, save-segment, edit-segment, confirm-bulk-send, ab-start, ab-stop-confirm, edit-schedule, cancel-schedule.

---

## PHASE 4 — Templates (6 pages)

WhatsApp template lifecycle.

| Page | Purpose | Key UI to swap |
|---|---|---|
| `/wachat/templates` | Template list | `ZoruDataTable` + status filter + new-template button |
| `/wachat/templates/create` | Template builder form | Multi-section form + live `ZoruCard` preview (right pane) + submit-for-review confirm dialog |
| `/wachat/templates/library` | Template library (premade) | Grid of `ZoruCard` template tiles + filter chips + clone-to-account dialog |
| `/wachat/message-templates-library` | Internal template archive | Same shape as library |
| `/wachat/template-analytics` | Per-template engagement | KPI grid + engagement chart + per-variant row table |
| `/wachat/template-builder` | Visual builder (alt entry) | Same form as templates/create — share components |

**Dialogs (~5):** save-template, submit-review, clone-template, delete-template, restore-template.

---

## PHASE 5 — Quick replies, messages & tags (7 pages)

Pre-canned content + tagging.

| Page | UI |
|---|---|
| `/wachat/canned-messages` | Table + create-canned dialog + edit-canned dialog |
| `/wachat/saved-replies` | Same shape as canned |
| `/wachat/quick-reply-categories` | Category list + create/edit/delete dialogs |
| `/wachat/greeting-messages` | Form (one per project) + activate `ZoruSwitch` |
| `/wachat/away-messages` | Form + schedule grid + activate switch |
| `/wachat/interactive-messages` | Builder form + preview card + send-test dialog |
| `/wachat/message-tags` | Tag manager — list + create/edit dialogs + color picker (neutral palette only) |

**Dialogs (~7):** create-canned, edit-canned, create-category, edit-category, delete-category, send-test-message, edit-tag.

---

## PHASE 6 — Automation (4 pages)

Auto-reply rules + chatbot.

| Page | UI |
|---|---|
| `/wachat/auto-reply` | Master switch + `ZoruAccordion` per rule type + edit dialogs |
| `/wachat/auto-reply-rules` | Rule list (drag-reorder) + create-rule sheet + delete confirm |
| `/wachat/automation` | Conversational AI overview, model picker, training-data manager |
| `/wachat/chatbot` | Bot config — flow picker + fallback responses + test-chat panel |

**Dialogs (~5):** create-rule, edit-rule, delete-rule-confirm, train-chatbot, reset-chatbot-confirm.

---

## PHASE 7 — Operations & settings (8 pages)

Numbers, webhooks, business hours, opt-out, media.

| Page | UI |
|---|---|
| `/wachat/numbers` | Connected numbers table + add-number dialog (multi-step) + verify-number dialog + remove-number alert |
| `/wachat/phone-number-settings` | Per-number settings form + display-name change dialog |
| `/wachat/two-line` | Two-line concept overview + activate dialog |
| `/wachat/business-hours` | Weekly schedule grid + holiday list + edit-holiday dialog |
| `/wachat/webhooks` | Endpoint list + create-endpoint dialog + test-webhook dialog + delete confirm |
| `/wachat/webhook-logs` | `ZoruDataTable` of deliveries + view-payload sheet + retry-delivery dialog |
| `/wachat/opt-out` | Opt-out keyword config form + per-keyword stats |
| `/wachat/media-library` | `ZoruFilesPage` (composed) — upload, preview, rename, delete, share dialogs already shipped in zoruui step 5 |

**Dialogs (~10):** add-number, verify-number, remove-number-confirm, edit-display-name, activate-two-line, edit-holiday, create-webhook, test-webhook, delete-webhook-confirm, retry-delivery.

---

## PHASE 8 — Analytics & reports (6 pages)

| Page | UI |
|---|---|
| `/wachat/message-analytics` | KPI strip + line chart (`ZoruChart`) + breakdown table |
| `/wachat/message-statistics` | Aggregate stat-card grid + segment filter |
| `/wachat/delivery-reports` | `ZoruDataTable` + per-row delivery detail dialog + export-csv dialog |
| `/wachat/response-time-tracker` | Stat strip + agent leaderboard table + per-agent drill-in sheet |
| `/wachat/customer-satisfaction` | CSAT score card + rating histogram + recent low-rating drawer |
| `/wachat/team-performance` | Team leaderboard + agent stat tiles + time-range dropdown |

**Dialogs (~3):** export-csv, view-delivery-detail (sheet), agent-drill-in (sheet).

---

## PHASE 9 — Add-on tools (12 pages)

| Page | UI |
|---|---|
| `/wachat/calls` | Call inbox + start-call dialog + active-call drawer |
| `/wachat/calls/settings` | Calling preferences form |
| `/wachat/calls/logs` | Call log `ZoruDataTable` + per-call detail sheet (transcript, recording) |
| `/wachat/whatsapp-pay` | Payment overview + transactions table + refund-confirm alert dialog |
| `/wachat/whatsapp-pay/settings` | Merchant config form + verify-account dialog |
| `/wachat/whatsapp-ads` | Click-to-WhatsApp ad manager — campaign list + create dialog |
| `/wachat/whatsapp-ads/setup` | Onboarding wizard (multi-step form) |
| `/wachat/whatsapp-ads/roadmap` | Static roadmap layout — `ZoruCard` grid |
| `/wachat/whatsapp-link-generator` | Form + generated `ZoruInput` (read-only) + copy button + QR preview |
| `/wachat/link-tracking` | Tracked links table + view-clicks dialog + delete confirm |
| `/wachat/qr-codes` | QR list grid + generate-qr dialog + download dialog |
| `/wachat/post-generator` | Form + AI preview card + publish dialog |

**Dialogs (~10):** start-call, refund-confirm, verify-merchant, create-ad-campaign, ad-setup-step (×N), copy-link-confirm, generate-qr, download-qr, regenerate-qr-confirm, publish-post.

---

## PHASE 10 — Cleanup + verification

- [ ] **Audit:** `grep -rn "@/components/clay\|clay-\|TabsProvider\|TabsBar\|SabNodeDashboardShell" src/app/wachat src/components/wabasimplify` — should be zero in wachat code paths
- [ ] **Dialog import sweep across `src/app/wachat`:** every `Dialog`/`Sheet`/`Drawer`/`Popover`/`DropdownMenu` import resolves to `@/components/zoruui/*`
- [ ] **Palette audit:** `grep -rE "bg-(emerald|rose|amber|indigo|sky|teal|violet|pink)-[0-9]+" src/app/wachat` — should be zero (status uses `bg-zoru-success/danger/warning/info` only)
- [ ] **Bold sweep:** `grep -rn "font-light\|font-thin\|font-extralight" src/app/wachat` — should be zero
- [ ] **Manual walk:** open every page in dev, take a screenshot grid, confirm:
  - Sidebar is the **same** Workspace + Shortcuts groups as `/dashboard`
  - Dock is the **same** at the bottom on every wachat page
  - "WaChat" entry highlighted in dock when on `/wachat/*`
  - No horizontal overflow at 1280px viewport
  - Loading skeletons render before data arrives
- [ ] **Type-check:** `npx tsc --noEmit -p tsconfig.json` passes
- [ ] **Delete dead code:** any `wachatMenuItems` array in `src/config/dashboard-config.ts` is no longer needed since wachat uses the home sidebar — flag for removal

**Final commit:** `chore(wachat-zoru): phase 10 — cleanup & verification`

---

## Cross-cutting notes

- **Reusable patterns to extract along the way:** if 3+ pages need the same composite (e.g. "table-with-filter-sheet-and-row-detail-drawer"), promote it to `src/components/wachat-zoru/` rather than duplicating. Keep each promotion under 150 lines.
- **Skeletons:** every page should render a `ZoruSkeleton` grid for the data-fetching state, matching the final layout shape.
- **Empty states:** every list/table needs `ZoruEmptyState` for zero-rows.
- **Permissions:** existing RBAC checks at the route level stay; only the visual layer changes.
- **Server actions:** untouched.
- **Dialogs are owned by the page** — don't lift them into a global registry. Each page renders its own dialog state.

---

## Suggested order

If you want to ship vertical slices that feel useful end-to-end:

1. **Phase 0 + Phase 1 (shell + inbox)** — the chat workspace is the most-used surface; feels right ASAP.
2. **Phase 3 + Phase 4 (broadcasts + templates)** — the second-most-used flow.
3. **Phase 2 (contacts)** — supports phases 3/4.
4. **Phases 5/6/7/8** — settings, automation, analytics in parallel; pick by team capacity.
5. **Phase 9 (add-on tools)** — lower traffic, last.
6. **Phase 10** — cleanup once everything else is shipped.
