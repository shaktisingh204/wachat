# Facebook Module — Stub Migration Plan

Audit and migration plan for `redirect()`-only stub pages under
[src/app/dashboard/facebook](src/app/dashboard/facebook). Each step ships ONE
real page + Rust crate per scheduled run.

## §1 — Audit (re-checked 2026-05-07)

The original audit (2026-05-06) flagged five `redirect()` stubs. Re-checking
against the current tree shows every page on that list has since been
migrated to a real client UI in earlier scheduled-task runs (the line counts
column makes this obvious — none are 5-line redirects anymore). The plan is
kept for historical context; today's run is bookkeeping that closes out the
remaining "NEXT →" markers against shipped work.

| # | Page | Now | Backed by | Status |
|---|------|-----|-----------|--------|
| 1 | [albums/page.tsx](src/app/dashboard/facebook/albums/page.tsx) | 263 lines, real UI | `wachat-facebook-content` GET `/projects/{id}/albums` + `/albums/{id}/photos` via [facebook-albums.actions.ts](src/app/actions/facebook-albums.actions.ts) | **— DONE** (shipped earlier) |
| 2 | [catalog/page.tsx](src/app/dashboard/facebook/catalog/page.tsx) | 217 lines, real UI | `meta-suite` `getCatalogs` server action; types in [src/lib/rust-client/meta-suite](src/lib/rust-client/meta-suite.ts) | **— DONE** (shipped earlier) |
| 3 | [ads/page.tsx](src/app/dashboard/facebook/ads/page.tsx) | 186 lines, real UI | Tile-based quick-jump hub linking into `/dashboard/ad-manager` (the heavy ads workspace) | **— DONE** (shipped earlier) |
| 4 | [custom-ecommerce/settings/page.tsx](src/app/dashboard/facebook/custom-ecommerce/settings/page.tsx) | 136 lines, real UI | Lists shops via `getEcommShops`; per-shop settings form lives at `[shopId]/settings` | **— DONE** (shipped earlier) |
| 5 | [commerce/page.tsx](src/app/dashboard/facebook/commerce/page.tsx) | 202 lines, real UI | `meta-suite` `getCatalogs` for live counts; tile hub into commerce sub-pages | **ALIAS → DONE** (originally marked alias; shipped as a real hub instead) |

Legend: `DONE` = real implementation in tree. `ALIAS → DONE` = was originally
flagged as a redirect-only alias, but a hub page was shipped anyway.

## §2 — Migration Steps

> Order: simpler Graph API surfaces first → complex Marketing API last → internal store settings.

### Step 1 — Albums **— DONE**

Already implemented in tree:

- [src/app/dashboard/facebook/albums/page.tsx](src/app/dashboard/facebook/albums/page.tsx) — full client UI: ZoruCard list, expandable photo grid, refresh button.
- [src/app/actions/facebook-albums.actions.ts](src/app/actions/facebook-albums.actions.ts) — `getFacebookAlbumsAction`, `getFacebookAlbumPhotosAction`.
- Backend routes (in existing crate, **not** a new `wachat-facebook-albums`):
  - `GET /v1/facebook/content/projects/{project_id}/albums` — `wachat_facebook_content::handlers::get_page_albums`
  - `POST /v1/facebook/content/projects/{project_id}/albums` — `wachat_facebook_content::handlers::create_photo_album`
  - `GET /v1/facebook/content/projects/{project_id}/albums/{album_id}/photos` — `wachat_facebook_content::handlers::get_album_photos`
- Note: the original plan called for a dedicated `wachat-facebook-albums` crate, but the implementation reused the already-existing `wachat-facebook-content` crate which already had the `/albums` surface wired. No new crate needed.
- Out-of-scope (not yet implemented, low-priority): `DELETE /{album-id}`, direct photo upload from the albums page (Page → Media → Upload covers the upload path).

### Step 2 — Catalog **— DONE**

Already implemented in tree:

- [src/app/dashboard/facebook/catalog/page.tsx](src/app/dashboard/facebook/catalog/page.tsx) — Meta Business catalogs index with sync action and per-row links into `/dashboard/facebook/commerce/products/[catalogId]`.
- [src/app/actions/catalog.actions.ts](src/app/actions/catalog.actions.ts) — `getCatalogs`, `syncCatalogs`.
- [src/lib/rust-client/meta-suite.ts](src/lib/rust-client/meta-suite.ts) — `MetaSuiteCatalog` types.
- Backend: `meta-suite` Rust crate `/catalogs` endpoints (already mounted at `/v1/meta/suite`).
- Note: the original plan called for a separate `wachat-facebook-catalog` crate, but `meta-suite` already covers Meta Business owned-catalog enumeration; building a duplicate crate would have produced churn without functional gain. Catalog feed/batch endpoints (the deeper Marketing/Catalog API surface) remain a future enhancement and would justify a dedicated crate if added.

### Step 3 — Ads (Facebook namespace) **— DONE**

Already implemented in tree:

- [src/app/dashboard/facebook/ads/page.tsx](src/app/dashboard/facebook/ads/page.tsx) — quick-jump hub of tiles linking into `/dashboard/ad-manager`'s heavy workspaces (Campaigns, Ad Sets, Ads, Audiences, Pixels, Reports, etc.) so Meta Suite operators don't context-switch.
- Note: the page deliberately did **not** clone the full ad-manager surface inside the Facebook namespace. The originally-planned `wachat-facebook-ads` crate was not built; the existing [ad_manager](rust/crates/ad-manager) crate already serves the cross-product `/dashboard/ad-manager` workspace, and a duplicate Facebook-scoped crate would have split functionality without reducing complexity. If a Page-scoped Marketing API surface is ever needed (separate from cross-product ad-manager), revisit and add `wachat-facebook-ads` then.

### Step 4 — Custom-ecommerce settings **— DONE**

Already implemented in tree:

- [src/app/dashboard/facebook/custom-ecommerce/settings/page.tsx](src/app/dashboard/facebook/custom-ecommerce/settings/page.tsx) — workspace-level shop list landing.
- Per-shop heavy settings form lives under `[shopId]/settings/` (branding via SabFiles, payments, shipping, tax, checkout, notifications).
- [src/app/actions/custom-ecommerce.actions.ts](src/app/actions/custom-ecommerce.actions.ts) — `getEcommShops`, etc.
- Note: this is internal store configuration, **not** a Graph API surface, so no Rust crate is required and none was built — server actions write directly to Mongo.

## §3 — Acceptance Criteria

For each step to be marked **— DONE**:

1. Stub `redirect(...)` is replaced with a real client UI using `ZoruCard` / `ZoruButton` / `ZoruBadge` primitives. ✅ (all four)
2. Server actions in `src/app/actions/` (no inline `fetch` to Graph API from the client). ✅
3. Types under [src/lib/rust-client/](src/lib/rust-client) where the page calls a Rust crate. ✅ (catalog page uses `meta-suite` types; albums page uses `wachat-facebook-content`'s loose JSON shape, which is the codebase convention for Graph API pass-throughs)
4. Where a Rust crate is required, it compiles via `cargo check -p <crate>` and is registered in [rust/Cargo.toml](rust/Cargo.toml) workspace `members` and routed into the BFF. ✅ — though this plan's "new crate per step" assumption proved unnecessary in 3 of 4 cases because the relevant surface was already in `wachat-facebook-content` / `meta-suite` / `ad-manager`.
5. SabFiles policy respected — file inputs come from `<SabFilePickerButton>` / `<SabFileUrlInput>`, never a free-text URL paste. ✅ (custom-ecommerce settings uses SabFiles for branding assets)
6. Plan §2 entry updated with `**— DONE**` plus a bullet list of files added/modified (markdown links).

---

*All five originally-flagged stubs are migrated.* No outstanding `**NEXT →**`
markers remain. Future Facebook-namespace work (Marketing API per-page Ads
surface, deep Catalog feed management, dedicated album CRUD) can be opened
as a fresh plan with new audit when needed.
