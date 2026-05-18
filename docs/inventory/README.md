# SabFlow inventory manifests

This directory holds the authoritative JSON manifests that describe the
SabFlow node surface. They exist so that humans, codegen tools, and CI can
all agree on *what nodes exist*, *what state they are in* (real / stub /
fallback), and *which side of the stack owns each one* (Rust executor vs
TypeScript Forge layer).

Phase C.1 of `PLAN-sabflow-coverage.md` introduces these inventories and
the CI gate that keeps them honest.

## Files

| File | Source of truth for | Owner sub-task |
| ---- | ------------------- | -------------- |
| `rust-stubs.json` | Every node implemented (or stubbed) under `rust/crates/sabflow-nodes/`. Tracks node id, kind, status (`real`, `stub`, `partial`), and notes. | **C.1.1** — Rust stub inventory |
| `forge-fallback-map.json` | Every Forge-layer block under `src/lib/sabflow/forge/` and the fallback strategy it uses when the Rust executor cannot run the node. | **C.1.2** — Forge fallback inventory |

Two further sub-tasks consume these manifests:

* **C.1.3** — Coverage report generator (renders both JSONs as the public
  SabFlow node coverage matrix).
* **C.1.4** — Parity tests (uses the manifests to assert Rust and Forge
  stay in lock-step).

## The CI gate (C.1.9)

The workflow at `.github/workflows/sabflow-inventory.yml` runs
`scripts/sabflow-inventory-check.mjs` on every PR that touches:

* `rust/crates/sabflow-nodes/**` — any Rust file
* `src/lib/sabflow/forge/**` — any TypeScript file
* `docs/inventory/**`
* the checker script itself or the workflow file

### Rules

1. If a PR changes any `rust/crates/sabflow-nodes/**/*.rs` file and does
   **not** change `docs/inventory/rust-stubs.json`, CI fails.
2. If a PR changes any `src/lib/sabflow/forge/**/*.ts` file and does
   **not** change `docs/inventory/forge-fallback-map.json`, CI fails.
3. Failures point at the C.1.1 / C.1.2 regeneration prompts in
   `PLAN-sabflow-coverage.md` — those are the canonical "how to refresh
   the inventory" sources.

### Why this is a required check

The inventory drives the coverage report and the parity tests. If it
drifts, our coverage numbers are a lie and parity testing silently skips
nodes. A drifted manifest is, in practice, indistinguishable from a
regression — so we fail the PR rather than let it land.

> Repo admin: after this workflow runs at least once on `main`, mark
> `sabflow-inventory / check` as a required status check in the branch
> protection settings for `main` (and any release branches).

## Bypass — `[skip-inventory]`

Sometimes a node file genuinely should not require an inventory update —
think doc-only changes inside a node file, or an emergency hotfix where
regenerating the inventory would block restoration of service.

To bypass the gate, include the literal token

```
[skip-inventory]
```

in **any commit message on the PR** (or in the PR body). The checker
scans:

* `git log --format=%B <base>..<head>` (all commit messages on the PR)
* the PR description (`$GITHUB_EVENT_PATH` → `pull_request.body`)

When the token is found the checker logs the suppressed failures and
exits 0.

### Bypass policy

The bypass is intentionally *not* easy to discover and *not* documented
in the PR template — it's a release-engineering escape hatch, not a
shortcut. Reviewers should:

1. Block any PR that uses `[skip-inventory]` without a comment in the PR
   description explaining why.
2. Open a follow-up issue to reconcile the inventory before the next
   release tag.

Repeated bypasses defeat the purpose of the gate — if you find yourself
reaching for it more than once a quarter, the underlying workflow needs
fixing, not the gate.

## Manifest schema

The manifests are intentionally tiny JSON documents to keep the diff
review cost low. Schemas live next to the regenerators:

* `rust-stubs.json` — schema documented in the C.1.1 prompt /
  generator script.
* `forge-fallback-map.json` — schema documented in the C.1.2 prompt /
  generator script.

Do not edit the manifests by hand for anything more than a one-line
status tweak — always prefer regenerating them so the schema stays
authoritative.
