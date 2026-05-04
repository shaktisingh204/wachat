# sabnode-api

Phase 0 HTTP API binary for the SabNode Rust backend.

This crate is intentionally minimal — it owns the process lifecycle, the
top-level Axum router, and the health/readiness probes. Feature routes
live in sibling crates and plug into the `/v1` mount point in
`src/router.rs` once the workspace is wired up.

## Run locally

The crate participates in the `rust/` workspace (assembled by the
orchestrator). From the workspace root:

```bash
cargo run -p sabnode-api
```

By default the server binds `0.0.0.0:8080`. Override via env vars
(see below) or by dropping a `config.toml` next to the binary.

## Endpoints

| Method | Path     | Purpose                                                  |
| ------ | -------- | -------------------------------------------------------- |
| GET    | `/health`| Liveness probe — always 200 once the process is up.      |
| GET    | `/ready` | Readiness probe — 200 once startup completes, 503 before.|
| *      | `/v1/*`  | Reserved for feature routers (mounted by other crates).  |

All error responses follow the shared envelope:

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
```

## Environment variables

Configuration is loaded by `sabnode-common` via figment in this order
(later overrides earlier): built-in defaults → `config.toml` (if present)
→ environment variables prefixed with `SABNODE_`.

| Variable             | Default | Description                             |
| -------------------- | ------- | --------------------------------------- |
| `SABNODE_PORT`       | `8080`  | TCP port the HTTP server binds to.      |
| `SABNODE_ENV`        | `dev`   | `dev` (pretty logs) or `staging`/`prod` (JSON logs). |
| `SABNODE_LOG_LEVEL`  | `info`  | Default log level when `RUST_LOG` is unset. |
| `RUST_LOG`           | (unset) | Standard `tracing-subscriber` filter; overrides `SABNODE_LOG_LEVEL`. |

A `.env` file in the working directory is auto-loaded on startup
(best-effort — missing file is not fatal).

## Graceful shutdown

The server installs SIGINT and SIGTERM handlers and drains in-flight
requests before exiting.
