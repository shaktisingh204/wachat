# ZoruUI — 10-Step Build Plan

A new UI system named **zoruui**: pure black-and-white light palette, all components rebuilt from scratch (sourced from `componts.txt` prompts), parallel to existing `src/components/ui/` so nothing breaks while it's adopted.

**Two hard constraints from the user:**
- ✅ **Reuse the existing dock** at `src/components/ui/dock.tsx` (do NOT rewrite, do NOT restyle beyond CSS variables it already consumes).
- 🚫 **Remove the multi-tab layout** — the new dashboard shell must NOT include `TabsProvider` / `TabsBar` from `src/components/tabs/`. URL-synced tabs are gone in zoruui.

**Conventions:**
- Directory: `src/components/zoruui/`
- Token file: `src/styles/zoruui.css` (namespaced `--zoru-*`, scoped under `.zoruui` class on `<html>` or layout root)
- Demo route: `src/app/zoruui/page.tsx` (gallery of every primitive)
- Naming: every export prefixed `Zoru` (e.g. `ZoruButton`, `ZoruDialog`)
- Palette: pure white background, zinc-900 ink, black primary, zinc neutrals only — no indigo / amber / coral / cream

---

## STEP 1 — Foundation & tokens

**Files to create:**
- `src/styles/zoruui.css` — tokens, scoped under `.zoruui`
- `src/components/zoruui/index.ts` — barrel export
- `src/components/zoruui/lib/cn.ts` — `cn` re-export bound to zoru class boundary
- `src/components/zoruui/lib/zoru-provider.tsx` — wraps children in `.zoruui` scope class + sonner mount
- `src/app/zoruui/layout.tsx` — demo route layout that wires `zoruui.css`
- `src/app/zoruui/page.tsx` — empty placeholder (filled in step 10)

**Token contract (CSS vars under `.zoruui`):**
- `--zoru-bg` (white) · `--zoru-ink` (zinc-900) · `--zoru-ink-muted` (zinc-500) · `--zoru-line` (zinc-200) · `--zoru-line-strong` (zinc-300) · `--zoru-surface` (zinc-50) · `--zoru-surface-2` (zinc-100) · `--zoru-primary` (black) · `--zoru-on-primary` (white) · `--zoru-danger` (red-600) · `--zoru-success` (emerald-600) · `--zoru-warning` (amber-600 — info-state only, never decorative) · `--zoru-ring` (black at 30% alpha) · `--zoru-radius` (10px) · shadows `--zoru-shadow-sm/md/lg`

**Other:**
- Tailwind: extend `tailwind.config.ts` with a `zoru` color group bound to the CSS vars (no theme rewrite of existing tokens).
- Verify `src/components/ui/dock.tsx` reads only generic shadcn vars; if it does, the zoru scope class will recolor it automatically.

---

## STEP 2 — Atoms (form & text primitives)

Source sections in `componts.txt`: `--button--`, `--toggle switch--`, `-- radio group --`, `-- for select convert all of them to dropdown--`.

**Components (file → exports):**
- `zoruui/button.tsx` → `ZoruButton`, `zoruButtonVariants` (variants: `default | secondary | ghost | outline | link | destructive`; sizes: `sm | md | lg | icon`)
- `zoruui/input.tsx` → `ZoruInput`
- `zoruui/textarea.tsx` → `ZoruTextarea`
- `zoruui/label.tsx` → `ZoruLabel`
- `zoruui/checkbox.tsx` → `ZoruCheckbox`
- `zoruui/radio-group.tsx` → `ZoruRadioGroup`, `ZoruRadioGroupItem` (3D variant from componts.txt baked in)
- `zoruui/switch.tsx` → `ZoruSwitch`, `ZoruBouncyToggle`
- `zoruui/select.tsx` → `ZoruSelect` family (rebuilt as a dropdown-menu per componts.txt section)
- `zoruui/separator.tsx` → `ZoruSeparator`
- `zoruui/skeleton.tsx` → `ZoruSkeleton`
- `zoruui/avatar.tsx` → `ZoruAvatar`, `ZoruAvatarImage`, `ZoruAvatarFallback`
- `zoruui/badge.tsx` → `ZoruBadge` (variants: `default | secondary | outline | ghost | success | danger | warning`)
- `zoruui/kbd.tsx` → `ZoruKbd`
- `zoruui/progress.tsx` → `ZoruProgress`
- `zoruui/tooltip.tsx` → `ZoruTooltip` family

**Acceptance:** every atom renders correctly under `.zoruui` scope using only neutral palette; Tab focus shows `--zoru-ring`.

---

## STEP 3 — Overlays, feedback & menus

Source sections: `--Announcements --` (hero pill), `--toast--`, `--dropdown--`.

**Components:**
- `zoruui/dialog.tsx` → `ZoruDialog`, `ZoruDialogTrigger`, `ZoruDialogContent`, `ZoruDialogHeader`, `ZoruDialogFooter`, `ZoruDialogTitle`, `ZoruDialogDescription`, `ZoruDialogClose`
- `zoruui/alert-dialog.tsx` → `ZoruAlertDialog` family (confirm/destructive)
- `zoruui/sheet.tsx` → `ZoruSheet` family (left/right/top/bottom)
- `zoruui/drawer.tsx` → `ZoruDrawer` family
- `zoruui/popover.tsx` → `ZoruPopover` family
- `zoruui/dropdown-menu.tsx` → `ZoruDropdownMenu` family (with submenu, checkbox, radio items, shortcut)
- `zoruui/menubar.tsx` → `ZoruMenubar` family
- `zoruui/command.tsx` → `ZoruCommand` family (CMDK-style search palette)
- `zoruui/context-menu.tsx` → `ZoruContextMenu` family
- `zoruui/hover-card.tsx` → `ZoruHoverCard` family
- `zoruui/toast.tsx` → `ZoruToast`, `ZoruToaster`, `useZoruToast()`
- `zoruui/sonner.tsx` → `ZoruSonner` (themed wrapper)
- `zoruui/alert.tsx` → `ZoruAlert` (info/success/warning/destructive)
- `zoruui/hero-pill.tsx` → `ZoruHeroPill`, `ZoruStarIcon`

**Acceptance:** open/close, focus trap, scroll lock, ESC close, overlay backdrop all work; dialog matches componts.txt "border and card view behavior".

---

## STEP 4 — Layout, navigation & shell (no multi-tabs)

Source sections: `--Accordion --`, `-- for tabs (modifie this )--`.

**Components:**
- `zoruui/card.tsx` → `ZoruCard`, `ZoruCardHeader`, `ZoruCardTitle`, `ZoruCardDescription`, `ZoruCardContent`, `ZoruCardFooter` (borderless / minimal-line variants per componts.txt)
- `zoruui/page-header.tsx` → `ZoruPageHeader`, `ZoruPageTitle`, `ZoruPageDescription`, `ZoruPageActions`
- `zoruui/breadcrumb.tsx` → `ZoruBreadcrumb` family
- `zoruui/tabs.tsx` → `ZoruTabs`, `ZoruTabsList`, `ZoruTabsTrigger`, `ZoruTabsContent` (the in-page UI primitive — NOT URL-synced)
- `zoruui/accordion.tsx` → `ZoruAccordion` family + `ZoruAccordion03` variant
- `zoruui/collapsible.tsx` → `ZoruCollapsible` family
- `zoruui/scroll-area.tsx` → `ZoruScrollArea`, `ZoruScrollBar`
- `zoruui/resizable.tsx` → `ZoruResizablePanel` family
- `zoruui/empty-state.tsx` → `ZoruEmptyState`
- `zoruui/limelight-nav.tsx` → `ZoruLimelightNav`

**Shell pieces:**
- `zoruui/shell/zoru-app-rail.tsx` — left vertical app rail (port of `admin-panel/sidebar/app-rail.tsx`, recolored)
- `zoruui/shell/zoru-app-sidebar.tsx` — module sidebar
- `zoruui/shell/zoru-header.tsx` — top header (search, notifications, user)
- `zoruui/shell/zoru-dock.tsx` — **thin re-export of existing `@/components/ui/dock.tsx`** (do not rewrite)
- `zoruui/shell/zoru-shell.tsx` — composes rail + sidebar + header + dock + `<main>`. **No `TabsProvider`. No `TabsBar`. No imports from `src/components/tabs/`.**

**Acceptance:** new shell mounts at a sample route; dock renders identically to current; multi-tab strip is absent; `grep -r "@/components/tabs" src/components/zoruui` returns zero matches.

---

## STEP 5 — Data display & inputs (heavy)

Source sections: `--full screen collender--`, `--date select calendar --`, `--file upload card --`, `--files card collection--`, `-- tables ui --`, `--file upload for this a create a module named files and create it same like this--`.

**Components:**
- `zoruui/table.tsx` → `ZoruTable`, `ZoruTableHeader`, `ZoruTableBody`, `ZoruTableRow`, `ZoruTableCell`, `ZoruTableHead`, `ZoruTableCaption`
- `zoruui/data-table.tsx` → `ZoruDataTable<T>` (tanstack-table wrapper: sorting, pagination, column visibility, row selection, density toggle)
- `zoruui/table-with-dialog.tsx` → `ZoruTableWithDialog` (per componts.txt pattern — row click opens detail dialog)
- `zoruui/calendar.tsx` → `ZoruCalendar` (single + range)
- `zoruui/calendar-lume.tsx` → `ZoruCalendarLume`
- `zoruui/fullscreen-calendar.tsx` → `ZoruFullscreenCalendar`
- `zoruui/date-picker.tsx` → `ZoruDatePicker`, `ZoruDateRangePicker`
- `zoruui/file-upload-card.tsx` → `ZoruFileUploadCard` (drag-drop, progress, error)
- `zoruui/file-card-collections.tsx` → `ZoruFileCardCollections` (grid + list view)
- `zoruui/files-module/` — full files module per componts.txt:
  - `files-page.tsx` (composed view)
  - `file-grid.tsx`, `file-list.tsx`, `file-toolbar.tsx`, `file-preview-dialog.tsx`, `file-rename-dialog.tsx`, `file-delete-dialog.tsx`, `file-share-dialog.tsx`, `file-upload-dialog.tsx`
- `zoruui/chart.tsx` → `ZoruChart` family (recharts wrapper, neutral palette only)
- `zoruui/stat-card.tsx` → `ZoruStatCard`
- `zoruui/statistics-card-1.tsx` → `ZoruStatisticsCard1`
- `zoruui/carousel.tsx` → `ZoruCarousel` family
- `zoruui/color-picker.tsx` → `ZoruColorPicker`

**Acceptance:** every data primitive renders sortable mock data; all 8 file-module dialogs open from toolbar/row actions; charts use only `--zoru-*` colors.

---

## STEP 6 — Marketing & landing primitives

Source sections: `--testimonial --`, `-- trusted --`, `--call-to-action--`, `--search--` (action-search-bar).

**Components:**
- `zoruui/call-to-action.tsx` → `ZoruCallToAction`
- `zoruui/testimonials-columns.tsx` → `ZoruTestimonialsColumns`
- `zoruui/logos3.tsx` → `ZoruLogos3` (trusted-by strip)
- `zoruui/action-search-bar.tsx` → `ZoruActionSearchBar`
- `zoruui/joblisting-component.tsx` → `ZoruJobListing`
- `zoruui/pricing-card.tsx` → `ZoruPricingCard`, `ZoruPricingTier`
- `zoruui/feature-grid.tsx` → `ZoruFeatureGrid`, `ZoruFeatureCard`
- `zoruui/sabnode-water-loader.tsx` → `ZoruWaterLoader` (recolored to neutral)
- `zoruui/user-dropdown.tsx` → `ZoruUserDropdown`

**Acceptance:** all marketing primitives composable on the demo page in step 10; zero non-neutral hues (visual diff against tokens).

---

## STEP 7 — Public-site pages (port to zoruui shell)

For each: replace `@/components/ui/*` imports with `@/components/zoruui/*`, wrap layout in `.zoruui` scope, verify visually.

**Pages (each one is a task):**
- `src/app/page.tsx` — root landing
- `src/app/home/page.tsx` + `home/layout.tsx`
- `src/app/about-us/page.tsx`
- `src/app/blog/page.tsx`
- `src/app/careers/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/portfolio/page.tsx` (+ subroutes)
- `src/app/pricing/page.tsx`
- `src/app/privacy-policy/page.tsx`
- `src/app/terms-and-conditions/page.tsx`
- `src/app/login/page.tsx`
- `src/app/signup/page.tsx`
- `src/app/forgot-password/page.tsx`
- `src/app/onboarding/page.tsx` + `onboarding/layout.tsx`
- `src/app/admin-login/page.tsx`
- `src/app/pending-approval/page.tsx`
- `src/app/invite/page.tsx`
- `src/app/setup/page.tsx`
- `src/app/status/page.tsx`
- `src/app/api/docs/page.tsx`
- `src/app/clay-showcase/page.tsx` → DEPRECATE / redirect to `/zoruui`
- `src/app/[shortCode]/page.tsx`, `src/app/_domain/[host]/page.tsx`, `src/app/p/*` (8 pages), `src/app/s/page.tsx`, `src/app/web/*` (2 pages), `src/app/embed/*`, `src/app/builder/page.tsx`, `src/app/builder/[id]/page.tsx`, `src/app/flow/page.tsx`

**Acceptance:** every public page renders in zoru shell; auth pages keep their existing post-submit logic; no `clay-*` class references remain.

---

## STEP 8 — Admin shell + admin pages

Replace `src/components/admin-panel/layout/admin-layout.tsx` chrome with the zoru shell (rail + sidebar + header). Keep server-side auth guard.

**Shell tasks:**
- New `src/components/admin-panel/zoru-admin-layout.tsx` (header + rail + sidebar; no tabs strip; reuses dock if admin uses one)
- Port `admin-panel/sidebar/app-rail.tsx` → recolored under zoru tokens
- Port `admin-panel/sidebar/app-sidebar.tsx` → zoru styling
- Port `admin-panel/sidebar/all-apps-popover.tsx` → uses `ZoruPopover` + `ZoruCommand`
- Port `admin-panel/header/admin-header.tsx` → uses `ZoruInput`, `ZoruDropdownMenu`, `ZoruAvatar`

**Admin pages (11):**
- `src/app/admin/dashboard/page.tsx` — overview cards, charts, recent activity table
- `src/app/admin/dashboard/audit/page.tsx` — audit log table, filter sheet, detail dialog
- `src/app/admin/dashboard/broadcast-log/page.tsx` — table + status filters + retry dialog
- `src/app/admin/dashboard/flow-logs/page.tsx` — table + run-detail drawer
- `src/app/admin/dashboard/plans/page.tsx` — plan list cards, create-plan dialog, delete-confirm dialog
- `src/app/admin/dashboard/plans/[planId]/page.tsx` — plan editor form, feature toggles, save bar
- `src/app/admin/dashboard/system/page.tsx` — system health stat-cards, queue tables, restart-confirm dialog
- `src/app/admin/dashboard/template-library/page.tsx` — grid of templates + search + category filter
- `src/app/admin/dashboard/template-library/create/page.tsx` — multi-step form + preview pane
- `src/app/admin/dashboard/users/page.tsx` — users data-table, user-detail sheet, suspend-user alert-dialog, impersonate-confirm dialog
- `src/app/admin/dashboard/whatsapp-projects/page.tsx` — projects table + create dialog + detail drawer

**Acceptance:** admin login → admin dashboard renders fully in zoru; auth gate intact; all dialogs/sheets open and use `Zoru*` primitives.

---

## STEP 9 — Dashboard shell + Wachat / SabFlow / messaging modules

**Shell:** new `src/components/dashboard/zoru-dashboard-shell.tsx` based on `clay/sabnode-dashboard-shell.tsx` **MINUS** `TabsProvider` + `TabsBar` (constraint). Mount at `src/app/dashboard/layout.tsx`.

**Modules in scope (each module = one task batch — port every page-level file inside it):**

### 9a. Wachat / WhatsApp module — top-level dashboard pages (~40)
broadcasts, broadcast-templates, scheduled-messages, message-templates-library, message-tags, message-statistics, message-analytics, media-library, interactive-messages, greeting-messages, saved-replies, quick-reply-categories, contacts, contact-groups, contact-import-history, contact-merge, contact-notes, contact-timeline, conversation-search, conversation-summary, conversation-kanban, conversation-filters, customer-satisfaction, response-time-tracker, opt-out, numbers, phone-number-settings, notifications, notification-preferences, delivery-reports, credit-usage, link-tracking, qr-codes, whatsapp-link-generator, webhooks, webhook-logs, two-line, template-builder, template-analytics, team-performance, plans, profile, overview, health, home, information, post-generator, billing
- **Per-page elements:** page-header, filter bar, primary table OR card grid, create dialog, edit dialog, delete alert-dialog, row-detail sheet/drawer

### 9b. SabFlow module — `/dashboard/sabflow/*` (12 pages) + `/dashboard/flow-builder/*` (3) + `/dashboard/flows/*` (3) + flow-builder canvas chrome (palette, settings panel, run dialog)

### 9c. Messaging adjacent — `/dashboard/email/*` (8), `/dashboard/sms/*` (7), `/dashboard/telegram/*` (20), `/dashboard/instagram/*` (12), `/dashboard/facebook/*` (55), `/dashboard/sabchat/*` (10), `/dashboard/chat/*` (2), `/dashboard/calls/*` (3)

### 9d. Ad-Manager — `/dashboard/ad-manager/*` (30 pages: campaigns, ad-sets, ads, ad-accounts, ad-previews, audiences, automated-rules, billing, budget-optimizer, bulk-editor, calendar, capi, catalogs, compare, conversion-funnel, create, creative-library, custom-conversions, customer-lists, events-manager, insights, lead-forms, pixels, reports, settings, split-tests, ai-lab, …)

**Per-page checklist (applies to every page above):**
- Page header (`ZoruPageHeader`)
- Primary content (table / data-table / card grid / chart / form)
- Filter / search bar
- Empty state
- Create dialog
- Edit dialog (or full-page editor)
- Delete confirm alert-dialog
- Bulk-action menu (`ZoruDropdownMenu`)
- Row detail sheet OR drawer

**Acceptance:** each module dashboard page navigable from rail/sidebar; no `clay-*` styling, no tab strip; create/edit/delete dialog round-trip works on at least one entity per module.

---

## STEP 10 — CRM + SEO + HRM + global dialog sweep + verify

### 10a. CRM — `/dashboard/crm/*` (~277 pages)
Sub-modules with their own layouts: accounting, sales, sales-crm, purchases, inventory, banking, time-tracking, workspace, team, hr-payroll, settings, analytics
- Reuse the per-page checklist from step 9; each sub-module gets its own zoru sidebar section.

### 10b. SEO — `/dashboard/seo/*` (~135 pages including `/seo/[projectId]/*`)
Project list, project detail, audits, keywords, backlinks, rank-tracker, content tools, schema-builder, smart-location-select, month-picker — all rebuilt in zoru.

### 10c. HRM — `/dashboard/hrm/*` (~133 pages, with `hr/` and `payroll/` sub-layouts)
Employees, attendance, leave, payroll runs, payslips, departments, designations, holidays, settings — per-page checklist.

### 10d. Long-tail dashboard pages
url-shortener, qr-code-maker, whatsapp-pay, whatsapp-ads, whatsapp-link-generator, website-builder, marketplace, n8n, integrations, team, settings, user/settings, notifications, notification-preferences, billing, agent-availability, analytics, overview, home, profile, plans

### 10e. Shop module — `/shop/*` + `/shop/[slug]/*` + `/shop/[slug]/account/*` (~20 pages)
Storefront, product list, product detail, cart, checkout, order-confirm, account dashboard

### 10f. Global dialog sweep
Audit `grep -rl "Dialog\|AlertDialog\|Sheet\|Drawer" src/app src/components` (current count: **299 files**). For each file outside `zoruui/`:
- Replace `@/components/ui/dialog` → `@/components/zoruui/dialog` (and same for alert-dialog, sheet, drawer, popover, dropdown-menu, command, toast)
- Verify open/close/focus-trap behavior unchanged

### 10g. Demo gallery + verification
- Fill `src/app/zoruui/page.tsx` with a section per primitive (atoms, overlays, layout, data, marketing) — every component visible on one page
- Run dev server, walk: `/`, `/login`, `/admin/dashboard`, `/dashboard`, `/dashboard/crm`, `/dashboard/seo`, `/dashboard/hrm`, `/dashboard/sabflow`, `/zoruui`
- Verify: no `clay-*` classes in DOM, no `TabsBar` rendered, dock visible where expected, palette is strictly neutral (devtools color audit)
- Delete `src/components/clay/sabnode-dashboard-shell.tsx` and `src/components/tabs/` ONLY after all pages migrated and confirmed by user

**Acceptance:** every route renders in zoruui; tab strip gone; dock intact; demo page is the canonical reference.

---

## Cross-cutting notes

- **Do not edit `src/components/ui/*`.** zoruui is parallel; old files stay until step 10g cleanup.
- **Do not touch `src/components/ui/dock.tsx`.** Re-export only.
- **No `'use client'` on shell/layout files** unless interactivity requires it (Server Components by default per Next.js 16 App Router conventions in this repo).
- **Forms:** keep existing `react-hook-form` + `zod` wiring. zoru only restyles inputs.
- **Charts:** swap palette in chart config; do not rewrite chart logic.
- **Auth flows:** zero behavior changes — visual only.
- **Per-step git discipline:** one commit per step with prefix `feat(zoruui): step N — <summary>`.
