# WaChat — new Rust crate creation recipe (hand-verified)

Authoritative build spec for creating a NEW `/rust` crate that backs a WaChat feature.
Patterns verified against `rust/crates/wachat-contacts` on 2026-06-06. Workspace: axum 0.8,
mongodb 3, bson 2, edition 2024. Shared crates: `sabnode-common` (errors), `sabnode-auth`
(JWT extractor), `sabnode-db` (Mongo handle + helpers).

## Golden rule for parallel builds (avoid collisions)

A crate-authoring agent creates ONLY its own `rust/crates/<name>/**` files (no collisions).
It must NOT edit the 4 shared files. Instead it **reports** the exact snippets for them.
A single integrator then applies all registrations in one pass and runs `cargo check`.

The 4 shared files (edited centrally):
1. `rust/Cargo.toml` — add `"crates/<name>",` to `[workspace].members`.
2. `rust/crates/api/Cargo.toml` — add `<name> = { path = "../<name>" }` under `[dependencies]`.
3. `rust/crates/api/src/state.rs` — add a derive-from-mongo `FromRef` impl (NO new AppState field,
   NO change to `AppState::new`), mirroring the §17 sabcatalyst block at the bottom of the file:
   ```rust
   impl axum::extract::FromRef<AppState> for <crate_ident>::<XxxState> {
       fn from_ref(s: &AppState) -> Self { <crate_ident>::<XxxState>::new(s.mongo.clone()) }
   }
   ```
   (fully-qualify the path so no `use` line is needed). This works because the crate's State is a
   thin `{ mongo: MongoHandle }` wrapper — so it requires no extra handles.
4. `rust/crates/api/src/router.rs` — add `.nest("/v1/wachat/<x>", <crate_ident>::router::<AppState>())`
   in the wachat mount block (around lines 580-595). Mount LITERAL prefixes; keep `/v1/wachat` (send)
   LAST since it is the catch-all nest.

`<crate_ident>` = crate name with dashes→underscores (e.g. `wachat-ab-testing` → `wachat_ab_testing`).

## Crate file layout

```
rust/crates/<name>/
  Cargo.toml
  src/lib.rs        # pub fn router::<S>() -> Router<S>
  src/state.rs      # XxxState { mongo: MongoHandle }
  src/dto.rs        # serde request/response structs
  src/handlers.rs   # axum handlers
```

### Cargo.toml (copy from wachat-contacts, rename)
```toml
[package]
name = "wachat-<feature>"
version = "0.1.0"
edition = "2024"
description = "Axum router for the wachat <feature> HTTP surface (/v1/wachat/<x>/*)."
license = "UNLICENSED"
publish = false

[lib]
name = "wachat_<feature>"
path = "src/lib.rs"

[dependencies]
axum = { version = "0.8", default-features = false, features = ["json", "http1", "tokio", "macros", "query"] }
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
bson = { version = "2", features = ["chrono-0_4"] }
chrono = { version = "0.4", default-features = false, features = ["clock", "serde"] }
mongodb = "3"
futures = "0.3"
tracing = "0.1"
anyhow = "1"
utoipa = { version = "5", features = ["axum_extras", "chrono"] }
sabnode-common = { path = "../common" }
sabnode-auth = { path = "../auth" }
sabnode-db = { path = "../db" }

[lints]
workspace = true
```
> NOTE: a leaf crate's Cargo.toml has NO `[workspace]` table (it inherits the root workspace).

### state.rs
```rust
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct Wachat<Feature>State { pub mongo: MongoHandle }
impl Wachat<Feature>State {
    pub fn new(mongo: MongoHandle) -> Self { Self { mongo } }
}
```

### lib.rs
```rust
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{get, post, patch, delete}};
use sabnode_auth::AuthConfig;
pub use state::Wachat<Feature>State;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    Wachat<Feature>State: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_x).post(handlers::create_x))
        .route("/{id}", patch(handlers::update_x).delete(handlers::delete_x))
}
```

## Handler / data-layer cheat-sheet (from wachat-contacts/handlers.rs)

- Extractors (order: extractors that read state/auth first, body LAST):
  `user: AuthUser, State(st): State<XxxState>, Query(q): Query<...>` and for writes `Json(body): Json<...>`.
- `use sabnode_auth::AuthUser;` → `user.user_id` is the caller's hex ObjectId string.
- `use sabnode_common::{ApiError, Result};` → return `Result<Json<T>>`. Variants seen:
  `ApiError::Validation(String)`, `Unauthorized(String)`, `Forbidden(String)`, `NotFound(String)`,
  `Conflict(String)`, `Internal(anyhow::Error)`. Build internal errors as
  `ApiError::Internal(anyhow::Error::new(e).context("coll.op"))`.
- `use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};`
  - `oid_from_str(hex) -> Result<ObjectId>` (maps bad hex to a proper ApiError).
  - `document_to_clean_json(doc) -> Value` to serialize a Mongo doc for the client (ObjectId→hex, dates→ISO).
- Mongo: `st.mongo.collection::<Document>("wa_<name>")`; `.find_one(doc!{..})`, `.insert_one(doc)`,
  `.update_one(filter, doc!{"$set": {..}})`, `.delete_one`, cursor `.try_collect().await` (futures::TryStreamExt).
- Timestamps: `let now = bson::DateTime::from_chrono(chrono::Utc::now());`
- DTOs: `#[derive(Deserialize, ToSchema)] #[serde(rename_all = "camelCase")]` for bodies/queries;
  `#[derive(Serialize, ToSchema)]` for responses. Generic `SuccessResponse { success: bool }`.
- **Multi-tenancy is mandatory**: scope EVERY query by the caller. Reuse the owner-or-agent guard
  pattern (`load_project_with_membership`) for project-scoped data; otherwise filter by
  `userId: ObjectId::parse_str(&user.user_id)?`. Never return another tenant's rows.
- Collection naming: `wa_<feature>` (e.g. `wa_ab_tests`). Reuse existing collection names where the
  feature already has data (see inventory).

## Verify (scoped — do NOT build the whole 684-crate workspace) — PROVEN TIMINGS
```
cd rust && cargo check -p wachat-<feature>     # ~2.5s warm (single crate)
cd rust && cargo check -p sabnode-api          # ~8s warm incremental (FULL router/state wiring)
```
- The api binary's package name is **`sabnode-api`** (NOT `api`).
- A crate is only checkable once it is a **workspace member** in `rust/Cargo.toml`. Pre-register the
  member (and a compiling skeleton) BEFORE fanning out authors, so every parallel `cargo check`
  can parse the workspace (a member path with no valid Cargo.toml breaks ALL workspace cargo commands).
- The **derive-from-mongo `FromRef`** trick is CONFIRMED working: append to `state.rs` after the §17
  sabcatalyst block, no `AppState` field, no `AppState::new` change:
  ```rust
  impl FromRef<AppState> for wachat_<feature>::Wachat<Feature>State {
      fn from_ref(s: &AppState) -> Self { wachat_<feature>::Wachat<Feature>State::new(s.mongo.clone()) }
  }
  ```
- Reference implementation that compiles green: `rust/crates/wachat-number-routing` (built 2026-06-06).

## Next.js side (the rest of the vertical)

1. **api-manifest** — add an `EndpointSpec[]` to a module in `tools/api-manifest/modules/`
   (e.g. extend `wachat-extras.ts` or add `wachat-<feature>.ts` and register it in
   `tools/api-manifest/index.ts`). Use `delegate: { kind: 'rust-fwd', path: '/v1/wachat/<x>/...', method }`,
   set `scope`/`tier`, `requestBody`/`queryParams`, `responses: { '2xx', ...auth }`. Then run
   `npm run api:gen` to emit `src/app/api/v1/wachat/<x>/route.ts` (DO NOT hand-write these).
2. **rust-client** — add `src/lib/rust-client/wachat-<feature>.ts` exporting a `wachat<Feature>Api`
   object whose methods call `rustFetch('/v1/wachat/<x>/...')`; register it in
   `src/lib/rust-client/index.ts`. (Mirror an existing module like `wachat-calling.ts`.)
3. **server action** — add/extend `src/app/actions/*.actions.ts` (`'use server'`) that calls
   `rustClient.wachat<Feature>.*`, validates input, `revalidatePath('/wachat/<route>')`.
4. **page** — wire `src/app/wachat/<route>/page.tsx` to the server action; remove mock state; add
   loading/empty/error UX with `@/components/sabcrm/20ui` inside `<WachatPage>`.

Auth: the Rust `AuthUser` extractor verifies an HS256 JWT (`RUST_JWT_SECRET`); the generated proxy
mints it (cookie session via `rustFetch`, or `rustFetchAsUser(userId)` for API-key routes). No extra
auth code is needed in the crate beyond taking the `AuthUser` extractor.
