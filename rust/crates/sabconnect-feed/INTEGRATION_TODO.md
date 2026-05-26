# SabConnect — Integration TODOs

Six new crates were added under `rust/crates/`:

- `sabconnect-feed`
- `sabconnect-groups`
- `sabconnect-manuals`
- `sabconnect-reactions`
- `sabconnect-comments`
- `sabconnect-custom-apps`

Each crate already contains `Cargo.toml`, `src/{lib.rs, types.rs, dto.rs, handlers.rs, router.rs}`, follows the canonical pattern from `crm-announcements`, and exposes `router::router<S>()`.

## What the integrator must wire (NOT done here — per AGENT_RULES.md):

1. **`rust/Cargo.toml`** — add the six paths to `[workspace] members`:
   ```toml
   "crates/sabconnect-feed",
   "crates/sabconnect-groups",
   "crates/sabconnect-manuals",
   "crates/sabconnect-reactions",
   "crates/sabconnect-comments",
   "crates/sabconnect-custom-apps",
   ```

2. **`rust/crates/api/Cargo.toml`** — add path dependencies:
   ```toml
   sabconnect-feed = { path = "../sabconnect-feed" }
   sabconnect-groups = { path = "../sabconnect-groups" }
   sabconnect-manuals = { path = "../sabconnect-manuals" }
   sabconnect-reactions = { path = "../sabconnect-reactions" }
   sabconnect-comments = { path = "../sabconnect-comments" }
   sabconnect-custom-apps = { path = "../sabconnect-custom-apps" }
   ```

3. **`rust/crates/api/src/router.rs`** — build and mount each router (mirrors how `crm_announcements` is wired):
   ```rust
   let sabconnect_feed_router = sabconnect_feed::router::<AppState>();
   let sabconnect_groups_router = sabconnect_groups::router::<AppState>();
   let sabconnect_manuals_router = sabconnect_manuals::router::<AppState>();
   let sabconnect_reactions_router = sabconnect_reactions::router::<AppState>();
   let sabconnect_comments_router = sabconnect_comments::router::<AppState>();
   let sabconnect_custom_apps_router = sabconnect_custom_apps::router::<AppState>();
   // …
   .nest("/v1/sabconnect/feed", sabconnect_feed_router)
   .nest("/v1/sabconnect/groups", sabconnect_groups_router)
   .nest("/v1/sabconnect/manuals", sabconnect_manuals_router)
   .nest("/v1/sabconnect/reactions", sabconnect_reactions_router)
   .nest("/v1/sabconnect/comments", sabconnect_comments_router)
   .nest("/v1/sabconnect/custom-apps", sabconnect_custom_apps_router)
   ```

4. **Sidebar / nav (Next.js side)** — add an `/dashboard/sabconnect/feed` entry to the platform shell. Intentionally not done here to keep the change isolated to the new module.

5. **RBAC keys** — register `sabconnect_feed`, `sabconnect_group`, `sabconnect_manual`, `sabconnect_custom_app` permission keys via the standard RBAC bootstrap if gated permissions are needed beyond `userId` ownership. Current handlers scope by `userId` only.
