# ADR — SabFlow Executor Rust Stack (Track B Phase 1, sub-task #5)

**Status:** Proposed
**Date:** 2026-05-18
**Owner:** Track B Phase 1
**Phase branch:** `phase/b-1-foundation`
**Related:**
- `PLAN-sabflow-crdt-collab.md` — Track B Phase 1 §5
- `docs/adr/sabflow-executor-rust-bench.md` — methodology + adoption rule
- `benches/sabflow-executor/rust/Cargo.toml` — reference implementation
- Sibling #6 (crate layout, `rust/crates/sabflow-executor/`)
- Sibling #7 (Node ↔ Rust IPC choice — **forward-ref**)

> Scope: pick the Rust async runtime and HTTP framework used by the SabFlow
> executor **iff** the Track B Phase 1 bench (§ADR `sabflow-executor-rust-bench`)
> clears the >=30% rule. This ADR does not edit any `Cargo.toml` — sibling #6
> owns the workspace dependency block. Crate scaffolding is gated on bench
> verdict per the parent ADR §5.

---

## 1. Context

The existing `rust/` workspace (~210 crates across Wachat, Telegram, CRM,
SabFlow surfaces) is uniformly built on **tokio 1 + axum 0.8** with
`tower`/`tower-http` middleware and the `tracing` 0.1 ecosystem
(`tracing-subscriber`, `tracing-opentelemetry` 0.28, `opentelemetry` 0.27).
`sabflow-engine`, `sabflow-engine-runtime`, and the umbrella `sabnode-api`
binary all use this stack. `serde 1` / `serde_json 1` / `anyhow 1` /
`thiserror 2` are the de-facto baseline.

The standalone bench candidate at `benches/sabflow-executor/rust/` uses
`tokio 1` + `axum 0.7` deliberately as a leaf-isolated crate (its
`[workspace]` table makes it its own root — see ADR `sabflow-executor-rust-bench`
§7). If the bench wins, the executor crate joins the main workspace and must
align with the workspace's `axum 0.8` pin.

## 2. Options

| Option | Pros | Cons |
|---|---|---|
| **tokio + axum** | Matches all ~210 sibling crates verbatim; sibling middleware (`tower-http` trace/cors/request-id/timeout) drops in; bench candidate already runs this shape | None within the workspace's existing constraints |
| **tokio + tonic (gRPC)** | Strongly-typed contracts (`.proto`), HTTP/2 streaming for long-running executions, codegen for Node ↔ Rust IPC | Adds `protoc` toolchain + `prost`/`tonic-build` to CI; no other workspace crate uses it; only justified if sibling #7 picks gRPC for IPC |
| **tokio + raw hyper** | Lowest overhead, no framework allocations | Re-implements routing, extractors, error mapping, and tower integration that axum already provides; loses ecosystem leverage |
| **smol / async-std** | — | Splits the runtime: every shared workspace crate is tokio-bound; bridging would force `tokio-compat` shims. Rejected. |

## 3. Decision rubric

| Factor | Weight | tokio+axum | tokio+tonic | tokio+hyper |
|---|---|---|---|---|
| Ecosystem maturity | high | ✅ | ✅ | ✅ |
| Codegen overhead (build time / CI) | high | none | `protoc` + build script | none |
| IPC compatibility (forward-ref sibling #7) | high | ✅ HTTP/JSON, NDJSON-over-HTTP, SSE | ✅ only if #7 picks gRPC | ✅ but DIY |
| Familiarity (matches workspace) | high | ✅ axum 0.8 everywhere | ❌ no precedent | ❌ no precedent |
| Observability (`tracing` integration) | med | `tower-http::trace` works out of the box; `tracing-opentelemetry` 0.28 already wired in `sabnode-observability` | needs `tonic`-specific tracing layer | DIY |
| Error ergonomics | med | axum `IntoResponse` + `thiserror 2` is the workspace pattern | tonic `Status` codes are clean but new vocabulary | DIY |

## 4. Decision

**tokio + axum is the default.** Re-open this ADR only if sibling #7 selects
gRPC for the Node ↔ Rust IPC; in that case the executor still uses tokio,
adds tonic alongside axum on a separate port (axum keeps the health/metrics
surface), and this ADR appends an amendment.

## 5. Versions (declare-only — sibling #6 applies)

Pin in `rust/Cargo.toml` `[workspace.dependencies]`. Do **not** pin patch
versions; let Cargo resolve the latest compatible minor.

- `tokio = { version = "1", features = ["macros", "rt-multi-thread", "net", "signal", "sync", "time"] }` — tokio 1.x is the LTS line; the workspace already standardizes on `version = "1"` with feature unions per crate.
- `axum = { version = "0.8", default-features = false, features = ["json", "http1", "tokio", "macros", "query"] }` — matches `sabflow-engine`'s current feature set; `http1` only (HTTP/2 unnecessary for loopback IPC and would add `hyper`'s `http2` feature cost). Crates needing extras (multipart, ws) layer features on at the crate level.
- `tower = "0.5"`, `tower-http = { version = "0.6", features = ["trace", "cors", "request-id", "util", "timeout"] }` — already pinned in `sabnode-api`; reused verbatim.
- `tracing = "0.1"`, `tracing-subscriber = { version = "0.3", features = ["env-filter", "json", "fmt"] }` — workspace standard; OTLP export comes via the existing `sabnode-observability` crate, so the executor crate **does not** redeclare `opentelemetry*` deps.
- `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"` — workspace standard.
- `anyhow = "1"` for binary boundaries, `thiserror = "2"` for library error types — workspace standard.

## 6. Workspace-level dep strategy (spec for sibling #6)

- Add the deps above to `rust/Cargo.toml` `[workspace.dependencies]` (only the ones not already present; tokio/axum/serde/tracing/etc. are likely already there from earlier phases).
- The new `crates/sabflow-executor/*` crates consume them via `tokio.workspace = true` style; no per-crate version drift.
- The standalone bench at `benches/sabflow-executor/rust/` stays out of the workspace and keeps its `axum 0.7` pin (per `sabflow-executor-rust-bench` §7 — isolation is intentional). It is **not** re-aligned to `axum 0.8` until/unless someone re-runs the bench against 0.8 and confirms the verdict still holds; that re-bench is a separate ticket.

## 7. Out of scope

- The IPC wire format (HTTP/JSON vs gRPC vs stdin/stdout NDJSON) — sibling #7.
- Crate split inside `rust/crates/sabflow-executor/` (`core`, `nodes`, `queue`, `expression`) — sibling #6.
- Whether the executor is adopted at all — gated on `sabflow-executor-rust-bench` §5 (>=30% sustained win).

## 8. Summary (<=200 words)

The SabFlow executor adopts **tokio 1 + axum 0.8** as its async runtime and
HTTP framework, mirroring the ~210-crate `rust/` workspace verbatim
(`sabflow-engine`, `sabflow-engine-runtime`, and `sabnode-api` are already on
this stack). Alternatives — `tonic`, raw `hyper`, `smol`/`async-std` — are
rejected for this phase: they either fragment the runtime, add a `protoc`
toolchain dependency the rest of the workspace doesn't carry, or re-implement
what axum + tower-http already provide. Observability rides on the existing
`sabnode-observability` crate (`tracing` 0.1 + `tracing-opentelemetry` 0.28 +
OTLP), so the executor declares no OTel deps directly. Errors follow the
workspace pattern: `thiserror 2` for library error enums, `anyhow 1` at
binary boundaries, with axum `IntoResponse` mapping the boundary. Versions
declared at `[workspace.dependencies]` level (sibling #6 applies the edit;
this ADR specifies only). The bench candidate at
`benches/sabflow-executor/rust/` stays on its isolated `axum 0.7` pin per
the bench ADR's isolation rule. Revisit to add `tonic` **only** if sibling
#7 selects gRPC for Node ↔ Rust IPC — at which point an amendment lands here
and tonic runs alongside axum on a separate port.
