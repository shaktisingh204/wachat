# sabnode-rust

Rust backend for SabNode. Phase 0 of the Server-Actions → Rust migration.

See `../docs/RUST_BACKEND_MIGRATION_PLAN.md` for the full plan and
`docs/DEPLOYMENT.md` for deployment.

## Crates

| Crate                  | Purpose                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `sabnode-api`          | Axum HTTP binary. Wires every domain crate's router.        |
| `sabnode-common`       | `ApiError`, `Settings`, tracing init.                       |
| `sabnode-auth`         | HS256 JWT verification + `AuthUser` extractor + RBAC.       |
| `sabnode-db`           | MongoDB + Redis (fred) client wrappers.                     |
| `sabnode-observability`| `tracing` + OpenTelemetry OTLP bootstrap.                   |
| `sabnode-users`        | First reference domain. Exposes `GET /v1/me`.               |

## Quick start

```bash
cp .env.example .env          # fill in MONGODB_URI, REDIS_URL, RUST_JWT_SECRET
cargo run -p sabnode-api      # starts on :8080
curl http://localhost:8080/health
```

## Auth

Next.js mints a 15-minute HS256 JWT via `src/lib/jwt-for-rust.ts` and sends it
as `Authorization: Bearer <token>`. Rust verifies it with the same
`RUST_JWT_SECRET`. Algorithm and claim shape are documented in
`crates/auth/src/claims.rs`.

## Adding a new domain crate

1. `cargo new --lib crates/<name>` (name it `sabnode-<name>`).
2. Depend on `sabnode-common`, `sabnode-auth`, `sabnode-db` as needed.
3. Expose `pub fn router<S>() -> axum::Router<S>` that is generic over state
   with `FromRef` bounds for any handles you need.
4. Add `"crates/<name>"` to the workspace `members` array above.
5. Mount in `crates/api/src/router.rs` under `/v1`.
