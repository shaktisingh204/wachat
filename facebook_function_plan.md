# Facebook Module — Stub Migration Plan

Audit and migration plan for `redirect()`-only stub pages under
[src/app/dashboard/facebook](src/app/dashboard/facebook). Each step ships ONE
real page + Rust crate per scheduled run.

## §1 — Audit (2026-05-06)

| # | Stub page | Lines | Redirects to | Decision | Notes |
|---|-----------|-------|--------------|----------|-------|
| 1 | [ads/page.tsx](src/app/dashboard/facebook/ads/page.tsx) | 5 | `/dashboard/ad-manager` | **NEEDS IMPL** | FB Marketing API Ads Manager belongs under the Facebook namespace; cross-product redirect hides Page-scoped ad management |
| 2 | [albums/page.tsx](src/app/dashboard/facebook/albums/page.tsx) | 5 | `/dashboard/facebook/media` | **NEEDS IMPL** | Page photo albums are a distinct Graph API concept (`/{page-id}/albums`) — separate from generic media library |
| 3 | [catalog/page.tsx](src/app/dashboard/facebook/catalog/page.tsx) | 5 | `/dashboard/facebook/commerce/products` | **NEEDS IMPL** | FB Commerce Catalog (Marketing/Catalog API) manages product feeds & item batches — different surface than the products tab |
| 4 | [commerce/page.tsx](src/app/dashboard/facebook/commerce/page.tsx) | 5 | `/dashboard/facebook/commerce/products` | **ALIAS** | Commerce hub uses `/products` as the default tab; this is the common index→first-tab redirect pattern. SKIP. |
| 5 | [custom-ecommerce/settings/page.tsx](src/app/dashboard/facebook/custom-ecommerce/settings/page.tsx) | 5 | `/dashboard/facebook/custom-ecommerce` | **NEEDS IMPL** | Settings for the SabNode-internal custom storefront (currency, payment, shipping, branding) — own page, not the storefront builder |

Legend: `NEEDS IMPL` = real implementation pending. `ALIAS` = intentional, leave as-is.

## §2 — Migration Steps

> Order: simpler Graph API surfaces first → complex Marketing API last → internal store settings.

### Step 1 — Albums **NEXT →**

- **Route:** `src/app/dashboard/facebook/albums/page.tsx`
- **Rust crate:** `rust/crates/wachat-facebook-albums`
- **Server actions:** `src/app/actions/wachat-facebook-albums.ts`
- **Mongo collections:** `wachatFacebookAlbums` (cache of album metadata: id, page_id, name, count, cover_photo, created_time, privacy, type, link)
- **Graph API endpoints:**
  - `GET /{page-id}/albums?fields=id,name,count,cover_photo{source},created_time,privacy,type,link`
  - `POST /{page-id}/albums` — create album (`name`, `message`, `privacy`)
  - `GET /{album-id}/photos?fields=id,source,images,name,created_time`
  - `POST /{album-id}/photos` — upload photo to album (`url` or multipart)
  - `DELETE /{album-id}` — delete album
- **UI:** ZoruCard grid of albums (cover thumbnail, name, photo count), create-album button → ZoruDialog form, click album → photos drawer with upload.
- **Plan-gating / credits:** uses `requirePlanFeature('facebook_pages')` and `consumeCredit('facebook_albums_sync', 1)` per sync.

### Step 2 — Catalog

- **Route:** `src/app/dashboard/facebook/catalog/page.tsx`
- **Rust crate:** `rust/crates/wachat-facebook-catalog`
- **Server actions:** `src/app/actions/wachat-facebook-catalog.ts`
- **Mongo collections:** `wachatFacebookCatalogs`, `wachatFacebookCatalogProducts`, `wachatFacebookProductFeeds`
- **Graph API endpoints (Marketing/Catalog):**
  - `GET /{business-id}/owned_product_catalogs`
  - `GET /{catalog-id}?fields=id,name,vertical,product_count,feed_count`
  - `GET /{catalog-id}/products?fields=id,name,price,availability,inventory,image_url`
  - `POST /{catalog-id}/products` — single item upsert
  - `POST /{catalog-id}/batch` — batch product update (recommended)
  - `GET /{catalog-id}/product_feeds`
- **UI:** catalog selector (dropdown), tabs `Catalogs / Items / Feeds / Diagnostics`, ZoruCard tiles, push-batch action with progress.
- **Note:** distinct from `commerce/products` which manages on-page Shop products. Catalog is feed-driven for Ads/Marketplace.

### Step 3 — Ads (Facebook namespace)

- **Route:** `src/app/dashboard/facebook/ads/page.tsx`
- **Rust crate:** `rust/crates/wachat-facebook-ads`
- **Server actions:** `src/app/actions/wachat-facebook-ads.ts`
- **Mongo collections:** `wachatFacebookAdAccounts`, `wachatFacebookAdCampaigns`, `wachatFacebookAdSets`, `wachatFacebookAdCreatives`, `wachatFacebookAdInsights`
- **Graph API endpoints (Marketing API v23.0):**
  - `GET /me/adaccounts`
  - `GET /act_{ad-account-id}/campaigns?fields=id,name,objective,status,daily_budget,lifetime_budget`
  - `GET /act_{ad-account-id}/adsets`
  - `GET /act_{ad-account-id}/ads?fields=id,name,status,creative,effective_status`
  - `GET /act_{ad-account-id}/insights?level=ad&fields=spend,impressions,clicks,ctr,cpm,reach,actions`
  - `POST /act_{ad-account-id}/campaigns` — create campaign
  - `POST /{campaign-id}` — pause / resume (`status=PAUSED|ACTIVE`)
- **UI:** ad-account picker, KPI strip (spend / impressions / clicks / CTR), campaign table with row-level pause/resume, drill-down to ad-sets and ads.
- **Note:** keep `/dashboard/ad-manager` as-is; this page is the Page-scoped Marketing API view — link the cross-app generic manager from a "Switch to global ad manager →" CTA.

### Step 4 — Custom-ecommerce settings

- **Route:** `src/app/dashboard/facebook/custom-ecommerce/settings/page.tsx`
- **Rust crate:** *none* — reuse existing `wachat-facebook-content` or extend the custom-ecommerce module with a `settings` handler set (no new crate; this is internal-store configuration, not Graph API). If existing crate cannot host it, add a `wachat-facebook-store-settings` crate as a fallback.
- **Server actions:** `src/app/actions/wachat-facebook-custom-ecommerce-settings.ts`
- **Mongo collections:** `wachatCustomEcommerceStoreSettings` (currency, default tax %, shipping zones, payment provider keys (encrypted), branding: logo SabFile id, hero SabFile id, theme, checkout copy, abandoned-cart timing).
- **UI:** ZoruCard sections — Branding (uses `<SabFilePickerButton>` for logo/hero per [SabFiles policy](CLAUDE.md)), Payments, Shipping, Tax, Checkout, Notifications. Save bar pinned to bottom.

## §3 — Acceptance Criteria

For each step to be marked **— DONE**:

1. New Rust crate compiles: `cargo check -p wachat-facebook-<feature>` exits 0.
2. Crate is registered in [rust/Cargo.toml](rust/Cargo.toml) workspace `members` and routed into the BFF the same way other `wachat-facebook-*` crates are wired.
3. `npx tsc --noEmit` reports no NEW errors. Baseline allowed errors: `chat-client.tsx`, `zoru-chat-client.tsx`, `regenerate-oauth-dialog.tsx`, `auth.ts`, `wachat-ads-accounts.ts`.
4. Stub `redirect(...)` is replaced with a real client UI that:
   - Uses `ZoruCard` / `ZoruButton` / `ZoruBadge` primitives.
   - Calls server actions in `src/app/actions/` (no inline `fetch` to Graph API from the client).
   - Respects [SabFiles policy](CLAUDE.md) — any file inputs come from `<SabFilePickerButton>` / `<SabFileUrlInput>`, never a free-text URL paste.
   - Plan-gated via existing `requirePlanFeature` plumbing and credit-metered via `consumeCredit` where appropriate.
5. Types added under [src/lib/rust-client/](src/lib/rust-client) matching the new BFF endpoints.
6. Plan §2 entry updated with `**— DONE**` plus a bullet list of files added/modified (markdown links). `**NEXT →**` marker advances to the next un-done step.

---

*First-run audit complete. No code changes shipped this run — implementation begins next run with Step 1 (Albums).*
