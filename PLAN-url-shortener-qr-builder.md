# Plan: URL Shortener & QR Code Builder — Maximum Features

**Date:** 2026-05-19  
**Scope:** Full feature expansion for both modules — analytics depth, UX completeness, advanced QR customization, enterprise controls  
**Priority ordering:** P0 = ship first (highest value, least invasive), P3 = power features

---

## Baseline (Already Shipped)

| Area | Status |
|------|--------|
| CRUD short URLs + QR codes | ✅ Done |
| Click analytics (count, referrer, IP, UA) | ✅ Done |
| Custom domain (add / verify / delete) | ✅ Done |
| Dynamic QR ↔ short URL linking | ✅ Done |
| Tag organization | ✅ Done |
| Bulk import CSV/XLSX for URLs | ✅ Done |
| Download PNG/SVG with logo | ✅ Done |
| RBAC scopes (urls:read/write, qr:read/write) | ✅ Done |
| Lock / archive / restore lifecycle | ✅ Done |
| API endpoints (comments, notes, audit log) | ✅ API only |
| Export / import endpoints | ✅ API only |

---

## Phase 1 — Analytics & Insights (P0)

### 1.1 Geo-Location Tracking

**What:** Capture country, region, city per click/scan using IP geolocation.

**Tasks:**
- [ ] Add `geo: { country, region, city, lat, lng }` to `analytics` array in the `ShortUrl` and `QrCode` Rust structs
- [ ] In the Rust redirect handler, call `maxmind` or `ip-api` to resolve IP → geo at write time (async, non-blocking)
- [ ] Add `GEOIP_DB_PATH` env var pointing to MaxMind GeoLite2 `.mmdb` file
- [ ] Expose geo breakdown in `/api/v1/url-shortener/links/[linkId]/analytics/geo` and `/api/v1/qr-codes/[qrCodeId]/analytics/geo`
- [ ] Build `<GeoHeatmap>` component (react-simple-maps + choropleth shading) on the `[id]` detail page
- [ ] Build `<TopCountriesTable>` — top 10 countries by clicks, with flag icons

**Files to touch:**
- `rust/crates/sabflow-executor/` — geo lookup at click ingestion
- `src/app/dashboard/url-shortener/[id]/page.tsx` — add geo section
- `src/components/wabasimplify/` — new `geo-heatmap.tsx`

---

### 1.2 Device & Browser Breakdown

**What:** Parse User-Agent into OS, browser, device type for each click.

**Tasks:**
- [ ] In Rust click handler, parse `user-agent` header via `ua-parser` crate → `{ os, browser, deviceType: 'desktop'|'mobile'|'tablet' }`
- [ ] Store as `device: { os, browser, deviceType }` on each analytics entry
- [ ] Add `/analytics/devices` endpoint returning aggregated breakdown
- [ ] Build `<DeviceBreakdownChart>` — donut chart (recharts) split by device type
- [ ] Build `<BrowserTable>` — top browsers with share %

---

### 1.3 Click Timeline Chart

**What:** Time-series chart of clicks per day/hour on the detail page.

**Tasks:**
- [ ] Add `/analytics/timeline?granularity=hour|day|week` endpoint that buckets analytics timestamps
- [ ] Build `<ClickTimelineChart>` using `recharts` `<AreaChart>` with a granularity toggle
- [ ] Add "last 7 days / 30 days / all time" filter to the detail page header

---

### 1.4 Referrer Intelligence

**What:** Group and display top referring domains with click share.

**Tasks:**
- [ ] On analytics write: extract `hostname` from referrer header → store as `referrerDomain`
- [ ] Add `/analytics/referrers` endpoint grouping by `referrerDomain`
- [ ] Build `<ReferrerTable>` — top 20 referrers with counts, percentages, favicons

---

### 1.5 Analytics Summary Cards

**What:** Replace raw click count on list pages with richer at-a-glance stats.

**Tasks:**
- [ ] Add `totalClicks`, `uniqueClicks` (distinct IPs), `clicksToday`, `topCountry` to list query response
- [ ] Update `<ShortUrlCard>` and `<QrCodeCard>` to show these four stats inline

---

## Phase 2 — Link Controls & Safety (P0)

### 2.1 Branded / Custom Slug

**What:** Let users choose their own short code instead of auto-generated one.

**Tasks:**
- [ ] Add `customSlug?: string` to `CreateShortUrlBody`
- [ ] In Rust: validate slug format `[a-zA-Z0-9_-]{3,50}`, check uniqueness per domain
- [ ] Show "Custom back-half" input in the create dialog (optional field, shows availability check on blur)
- [ ] Add reserved words blocklist (admin, api, s, dashboard, etc.)

**Files:**
- `src/lib/rust-client/url-shortener.ts` — extend `CreateShortUrlBody`
- `src/app/actions/url-shortener.actions.ts` — pass slug through
- Create dialog component — add optional `CustomSlugInput` field

---

### 2.2 Expiry Controls (UI + Advanced)

**What:** The `expiresAt` field exists in DB but has no UI. Expose it fully.

**Tasks:**
- [ ] Add date-time picker for expiry in create + edit dialogs
- [ ] Add `clickLimit?: number` field — deactivate after N clicks
- [ ] Show expiry badge on card ("Expires in 3 days", "Expired", "∞")
- [ ] Add "Expiry" column to sortable list table
- [ ] In Rust redirect: return 410 Gone when expired or click-limit reached
- [ ] Build `<ExpiredLinkPage>` at `/expired` — branded expiry landing page

---

### 2.3 Password Protection

**What:** Optionally require a password before redirecting.

**Tasks:**
- [ ] Add `passwordHash?: string` to `ShortUrl` document
- [ ] In create dialog: optional "Protect with password" toggle + input
- [ ] Rust redirect: if `passwordHash` set, redirect to `/verify/[shortCode]` instead
- [ ] Build `/verify/[shortCode]` page — password input form, submits to server action → verifies hash → sets session cookie → redirects
- [ ] `verifyLinkPassword()` server action

---

### 2.4 Link Health Monitor

**What:** Periodically check if destination URLs are alive.

**Tasks:**
- [ ] Add `healthStatus: 'ok' | 'dead' | 'redirect_loop' | 'unknown'` + `healthCheckedAt` to `ShortUrl`
- [ ] Vercel Cron job (`/api/cron/url-health`) — runs every 6h, HEAD-checks each active URL, updates status
- [ ] Register cron in `vercel.json`: `{ "path": "/api/cron/url-health", "schedule": "0 */6 * * *" }`
- [ ] Show health badge on list page (green dot / red dot / grey dot)
- [ ] Alert banner on detail page if destination is dead

---

### 2.5 UTM Parameter Builder

**What:** Auto-append UTM params without editing the destination URL manually.

**Tasks:**
- [ ] Add `utmParams?: { source, medium, campaign, term, content }` to `ShortUrl`
- [ ] In create dialog: collapsible "UTM Parameters" section with 5 inputs
- [ ] Rust redirect: if `utmParams` present, append query string before redirecting
- [ ] Show reconstructed final URL preview as user fills in UTM fields

---

### 2.6 Retargeting Pixel Integration

**What:** Fire a tracking pixel on redirect for ad retargeting.

**Tasks:**
- [ ] Add `pixelIds?: { facebook?: string, google?: string, tiktok?: string }` to `ShortUrl`
- [ ] Add "Retargeting Pixels" section in create/edit dialog
- [ ] Build `/r/[shortCode]` intermediate page — renders 1×1 img pixel tags, fires JS pixel SDK, then JS `window.location` redirect after 200ms
- [ ] Document that this requires JS-enabled browser (add fallback `<noscript>` meta-refresh)

---

## Phase 3 — Collaboration & Workflow (P1)

### 3.1 Comments, Notes & Attachments UI

**What:** API endpoints exist; build the UI.

**Tasks:**
- [ ] Build `<CommentsPanel>` — threaded comments with @mentions, markdown support
- [ ] Build `<NotesPanel>` — private sticky note per link
- [ ] Build `<AttachmentsPanel>` — file picker via `<SabFilePickerButton>` (no raw URL inputs)
- [ ] Attach all three to a side-drawer on the URL Shortener `[id]` detail page and QR code detail modal
- [ ] Build `<AuditLogTimeline>` — read-only event stream (created, edited, archived, clicked-limit-reached, etc.)

---

### 3.2 Link-in-Bio Landing Page Builder

**What:** One permanent link (`/bio/[username]`) pointing to a branded multi-link page.

**Tasks:**
- [ ] New DB collection `BioPage`: `{ userId, slug, title, bio, avatarUrl, links: [{ label, shortUrlId, order }], theme }`
- [ ] Build `/bio/[slug]` public page — renders avatar, bio, list of CTA buttons
- [ ] Build `<BioPageBuilder>` at `/dashboard/url-shortener/bio` — drag-and-drop reorder, theme picker, live preview
- [ ] Integrate `SabFilePickerButton` for avatar upload (no URL paste)
- [ ] Link analytics roll up per bio page (total link clicks on bio page today)

---

### 3.3 Link Collections / Folders

**What:** Group related links into named folders.

**Tasks:**
- [ ] Add `Collection` model: `{ userId, name, color, linkIds[] }`
- [ ] Add collection sidebar in `/dashboard/url-shortener` — tree nav by collection
- [ ] Drag-to-collection from the list view
- [ ] Bulk-move to collection from multi-select toolbar

---

### 3.4 Webhook Notifications

**What:** Fire webhooks on specific link events.

**Tasks:**
- [ ] Add `Webhook` model: `{ userId, url, secret, events: ('click' | 'first_click' | 'expired' | 'dead')[] }`
- [ ] Build Webhook manager page at `/dashboard/url-shortener/settings/webhooks`
- [ ] Rust click handler: after analytics write, queue webhook delivery (HTTP POST, HMAC-SHA256 signature)
- [ ] Retry queue: up to 5 attempts with exponential backoff
- [ ] Webhook delivery log UI (last 50 deliveries with status codes)

---

### 3.5 A/B Split Redirect

**What:** Route traffic to multiple destinations by percentage.

**Tasks:**
- [ ] Add `splitTargets?: { url: string, weight: number }[]` to `ShortUrl` (weights must sum to 100)
- [ ] Rust redirect: weighted random selection among targets
- [ ] UI: "Split Test" toggle in create/edit dialog — add/remove targets with sliders
- [ ] Analytics: track which variant received the click → per-variant click counts on detail page

---

## Phase 4 — QR Code Visual Upgrades (P1)

### 4.1 QR Pattern & Corner Styles

**What:** Replace plain square QR with style variants.

**Tasks:**
- [ ] Evaluate `qr-code-styling` (npm) vs `qrcode.react` for pattern support
- [ ] Add `style: { dotType: 'square'|'dots'|'rounded'|'classy'|'classy-rounded'|'extra-rounded', cornerSquareType, cornerDotType }` to `QrCode.config`
- [ ] Add style picker section in `<QrCodeGenerator>` with visual swatches
- [ ] Update `downloadQrCode()` in `qr-utils.ts` to use new library if switched

---

### 4.2 Gradient Colors

**What:** Support linear/radial gradient for QR dot color.

**Tasks:**
- [ ] Add `gradient?: { type: 'linear'|'radial', colorStart, colorEnd, rotation? }` to `QrCode.config`
- [ ] Replace single color picker with "Solid / Gradient" toggle in UI
- [ ] Gradient preview in real-time QR render

---

### 4.3 Image Frames & Call-to-Action

**What:** Add a branded frame around the QR with custom text (e.g., "SCAN ME", "Download App").

**Tasks:**
- [ ] Add `frame?: { template: 'simple'|'rounded'|'banner', text: string, textColor, bgColor }` to `QrCode.config`
- [ ] Build frame compositor in `downloadQrCode()` — canvas-based: draw frame background → QR → overlay text
- [ ] Add frame template picker with live preview in `<QrCodeGenerator>`

---

### 4.4 Additional Data Types

**What:** Expand from 6 to 11 content types.

**Tasks:**
- [ ] **vCard / Contact**: fields (firstName, lastName, phone, email, org, url, address) → vCard 3.0 string
- [ ] **Calendar Event (iCal)**: fields (title, startDate, endDate, location, description) → VEVENT format
- [ ] **Geo Location**: lat/lng or address → `geo:{lat},{lng}` or Google Maps URL
- [ ] **App Download**: smart link — iOS App Store URL + Android Play Store URL, auto-detect device on landing page `/app/[shortCode]`
- [ ] **Social Profile**: pre-filled templates for Instagram, LinkedIn, Twitter/X, TikTok, YouTube
- [ ] Add tab + form fields for each in `<QrCodeGenerator>`
- [ ] Extend `QR_FIELD_LIMITS` in `qr-utils.ts`
- [ ] Add `dataType` variants to `QrCodeCreateBody` type

---

### 4.5 Export Formats

**What:** Download as PNG, SVG, PDF, WebP (already PNG/SVG — add PDF + WebP).

**Tasks:**
- [ ] PDF: use `jspdf` — embed SVG/canvas into single-page PDF at print resolution (300 DPI equivalent)
- [ ] WebP: canvas `.toBlob('image/webp')` — add to `downloadQrCode()` format options
- [ ] Update download button in `<QrCodeGenerator>` to a dropdown with format selection

---

### 4.6 Brand Kit

**What:** Save default colors, logo, and style as a reusable brand preset.

**Tasks:**
- [ ] Add `QrBrandKit` model: `{ userId, name, color, bgColor, logoDataUri, style }`
- [ ] Build `<BrandKitManager>` at `/dashboard/qr-code-maker/settings/brand-kit`
- [ ] "Apply Brand Kit" dropdown in `<QrCodeGenerator>` — one-click fill all style fields
- [ ] "Save as Brand Kit" button after customizing

---

## Phase 5 — QR Analytics (P1)

### 5.1 Scan Analytics for Dynamic QR

**What:** Dynamic QR codes redirect through short URLs — all click analytics already exist. Expose them on the QR detail view.

**Tasks:**
- [ ] In `getQrCodes()` / `getQrCodeById()`, join short URL analytics when `isDynamic: true`
- [ ] Build `<QrScanAnalyticsModal>` or expand detail panel — same charts as URL shortener (timeline, geo, device)
- [ ] Show "Total Scans" + "Unique Scans" on QR list cards

---

### 5.2 Scan Notifications

**What:** Email or webhook alert on first scan or every N scans.

**Tasks:**
- [ ] Add `scanNotifications?: { onFirstScan?: boolean, everyNScans?: number, email?: string, webhookUrl?: string }` to `QrCode`
- [ ] Trigger notification from Rust click handler when condition met
- [ ] UI: notification settings section in QR edit modal
- [ ] Email template via existing SabNode email system

---

## Phase 6 — Bulk & Automation (P2)

### 6.1 Bulk QR Generation from Spreadsheet

**What:** Upload CSV/XLSX with columns → generate hundreds of QR codes at once.

**Tasks:**
- [ ] Define CSV schema: `name, dataType, data, isDynamic, tags`
- [ ] Build `<BulkQrImportDialog>` (similar to `bulk-url-import-dialog.tsx`)
- [ ] Preview table before generation — show first 5 rows
- [ ] Progress modal during generation (uses bulk create endpoint)
- [ ] Post-import: download all QR codes as ZIP (PNG files)

---

### 6.2 QR Code Campaigns

**What:** Group multiple QR codes under a campaign for unified analytics reporting.

**Tasks:**
- [ ] Add `Campaign` model: `{ userId, name, qrCodeIds[], startDate, endDate }`
- [ ] Build campaign manager at `/dashboard/qr-code-maker/campaigns`
- [ ] Campaign analytics page: aggregate scans across all QR codes in campaign by day/geo/device
- [ ] Export campaign report as CSV

---

### 6.3 Scheduled Link Activation

**What:** Set a future datetime for a link to go live automatically.

**Tasks:**
- [ ] Add `activateAt?: Date` to `ShortUrl`
- [ ] Vercel Cron `/api/cron/link-scheduler` — runs every 15min, activates links where `activateAt <= now && status = 'scheduled'`
- [ ] Add status `'scheduled'` alongside existing `active/inactive/archived`
- [ ] UI: "Schedule activation" datetime picker in create/edit dialog

---

### 6.4 API Key + Programmatic Access

**What:** Let power users generate QR codes and short URLs via REST API with an API key.

**Tasks:**
- [ ] API key already exists via platform RBAC — ensure `qr:write` and `urls:write` scopes are documented
- [ ] Build interactive API reference page at `/dashboard/url-shortener/api-docs` (Swagger UI / Redoc embedded)
- [ ] Code examples tab: cURL, JavaScript, Python
- [ ] Add API key copy widget with rotate/revoke controls

---

## Phase 7 — Enterprise & Advanced (P2–P3)

### 7.1 Vanity Domain CNAME Self-Service

**What:** Full walk-through for users to connect their own domain (e.g., `go.mycompany.com`) without contacting support.

**Tasks:**
- [ ] Current flow: add domain → shows TXT record → verify. Improve it:
- [ ] Step 1: Detect if user wants apex or subdomain → show CNAME vs A record instructions
- [ ] Step 2: Live DNS polling (check every 10s for up to 5min) with progress indicator
- [ ] Step 3: Auto-provision SSL (Vercel handles via `vercel.json` domain config or Vercel API)
- [ ] Improve `settings/page.tsx` into a proper stepper wizard component

---

### 7.2 Deep Links (Mobile App Routing)

**What:** Route a short URL to the native app on iOS/Android, fallback to web.

**Tasks:**
- [ ] Add `deepLink?: { ios: string, android: string, fallbackUrl: string }` to `ShortUrl`
- [ ] Build `/dl/[shortCode]` smart redirect page — detects platform via UA, fires appropriate scheme/universal link
- [ ] UI: "Mobile App Deep Link" section in advanced create/edit drawer

---

### 7.3 QR Code Versioning

**What:** Track change history for dynamic QR codes (URL changed over time).

**Tasks:**
- [ ] Add `history: { url, changedAt, changedBy }[]` to `ShortUrl` (already partially tracked via analytics)
- [ ] Build `<LinkHistoryDrawer>` — timeline of destination URL changes
- [ ] "Rollback to version" action (sets `originalUrl` back to a past value)

---

### 7.4 Workspace Sharing / Multi-Seat

**What:** Share a link or QR code with team members with view or edit permission.

**Tasks:**
- [ ] Uses existing `shares` sub-resource on API (already modeled)
- [ ] Build `<SharePermissionsModal>` — invite by email, choose View/Edit role
- [ ] Shared items appear in recipient's dashboard under "Shared with me" folder
- [ ] Activity feed shows who edited what and when

---

### 7.5 Conversion Goals & Tracking

**What:** Mark a URL as a conversion destination and track goal completions.

**Tasks:**
- [ ] Add `conversionGoal?: { name: string, value?: number }` to `ShortUrl`
- [ ] Expose `/api/v1/url-shortener/links/[linkId]/conversions` endpoint (POST to record a conversion)
- [ ] Build Conversions section on detail page — conversion rate = conversions / clicks × 100%
- [ ] Integration: fire conversion webhook when a downstream page calls back

---

## UI / UX Improvements (All Phases)

### List Page Enhancements

- [ ] Redesign list as hybrid card/table view with toggle
- [ ] Add "Quick Stats" row under each card: clicks today / this week / all time
- [ ] Multi-select toolbar with bulk: archive, delete, add-tag, move-to-collection, export
- [ ] Persist sort/filter/view preference in localStorage
- [ ] Infinite scroll option alongside pagination

### Create / Edit Dialog Improvements

- [ ] Convert single dialog to multi-step wizard for advanced options (Basic → Analytics → Advanced → Review)
- [ ] "Duplicate" action from ⋯ menu — pre-fills create dialog with existing values
- [ ] Live redirect preview — iframe or screenshot thumbnail of destination URL
- [ ] Share button — copies formatted short URL to clipboard with one click

### Detail Page

- [ ] Summary hero: total clicks, unique clicks, clicks today, conversion rate — big number cards
- [ ] Tabbed layout: Overview / Analytics / Settings / Activity
- [ ] "Edit" inline for title, tags, expiry without opening a modal
- [ ] QR code widget inline on URL detail page (always shown for dynamic URLs)

---

## Technical / Infrastructure Work

### Rust Backend Changes

| Change | Reason |
|--------|--------|
| Add `geo` to analytics struct | Phase 1.1 |
| Add `device` to analytics struct | Phase 1.2 |
| Add `referrerDomain` to analytics struct | Phase 1.4 |
| Add `customSlug` to create endpoint | Phase 2.1 |
| Add `clickLimit` to `ShortUrl` | Phase 2.2 |
| Add `passwordHash` to `ShortUrl` | Phase 2.3 |
| Add `utmParams` to `ShortUrl` | Phase 2.5 |
| Add `pixelIds` to `ShortUrl` | Phase 2.6 |
| Add `splitTargets` to `ShortUrl` | Phase 3.5 |
| Add `activateAt` to `ShortUrl` | Phase 6.3 |
| Add `deepLink` to `ShortUrl` | Phase 7.2 |
| Add `QrCode.config.style` fields | Phase 4.1–4.3 |
| Add `QrCode.frame` config | Phase 4.3 |
| Extend `QrCode.dataType` enum | Phase 4.4 |

### Vercel Cron Jobs to Register

```json
// vercel.json additions
{
  "crons": [
    { "path": "/api/cron/url-health",       "schedule": "0 */6 * * *" },
    { "path": "/api/cron/link-scheduler",   "schedule": "*/15 * * * *" },
    { "path": "/api/cron/qr-scan-notify",   "schedule": "*/5 * * * *" }
  ]
}
```

### New npm Packages

| Package | Purpose |
|---------|---------|
| `qr-code-styling` | Advanced QR patterns, corner styles, gradients |
| `jspdf` | PDF export for QR codes |
| `react-simple-maps` | Geo heatmap |
| `recharts` (already likely present) | Analytics charts |
| `ua-parser-js` (Rust: `ua-parser`) | Device/browser parsing |
| `jszip` | ZIP download for bulk QR export |

### New Environment Variables

```bash
# .env.example additions
GEOIP_DB_PATH=               # Path to MaxMind GeoLite2-City.mmdb
GEOIP_PROVIDER=maxmind       # 'maxmind' or 'ip-api' (free fallback)
URL_HEALTH_CHECK_CONCURRENCY=20
```

---

## Delivery Order

| Batch | Items | Effort |
|-------|-------|--------|
| **Batch A** | 1.1 Geo, 1.2 Device, 1.3 Timeline, 1.4 Referrers, 1.5 Summary cards | 5 days |
| **Batch B** | 2.1 Custom slug, 2.2 Expiry UI, 2.5 UTM builder, 4.5 Export formats | 3 days |
| **Batch C** | 4.1 QR patterns, 4.2 Gradients, 4.3 Frames, 4.4 New data types | 4 days |
| **Batch D** | 2.3 Password protection, 2.4 Health monitor, 3.4 Webhooks, 5.2 Scan notifs | 4 days |
| **Batch E** | 3.1 Comments/Notes/Attachments UI, 3.3 Folders, 4.6 Brand Kit, 5.1 QR scan analytics | 3 days |
| **Batch F** | 3.2 Link-in-bio, 2.6 Retargeting pixels, 3.5 A/B split, 6.1 Bulk QR CSV | 5 days |
| **Batch G** | 6.2 Campaigns, 6.3 Scheduled activation, 7.1 CNAME wizard, 7.3 Versioning | 4 days |
| **Batch H** | 7.2 Deep links, 7.4 Workspace sharing, 7.5 Conversion goals, API docs | 4 days |

**Total estimate: ~32 developer-days**

---

## Out of Scope

- Server-side link cloaking / URL proxy (security risk, abuse potential)
- Built-in URL analytics for external embed widgets (third-party JS snippet)
- OCR / QR decoder tool (scan a QR code image to read its content) — defer to SEO tools section
