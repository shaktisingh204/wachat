#!/usr/bin/env node
// scripts/sabflow-inventory-check.mjs
//
// Phase C.1.9 — SabFlow inventory drift gate.
//
// Fails CI when a PR touches the SabFlow node surface
// (`rust/crates/sabflow-nodes/**/*.rs` or `src/lib/sabflow/forge/**/*.ts`)
// without updating the corresponding inventory JSON in `docs/inventory/`.
//
// The inventory JSONs are the authoritative manifest of:
//   * Rust node stubs    -> docs/inventory/rust-stubs.json   (owned by C.1.1)
//   * Forge fallbacks    -> docs/inventory/forge-fallback-map.json (owned by C.1.2)
//
// Bypass: include `[skip-inventory]` in any commit message on the PR.
// This is reserved for emergency hotfixes — abuse will be caught at review.
//
// Usage (locally):
//   BASE_SHA=origin/main node scripts/sabflow-inventory-check.mjs
//
// In GitHub Actions the workflow injects $GITHUB_BASE_REF + $GITHUB_SHA
// and we resolve the merge-base against `origin/$GITHUB_BASE_REF`.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, relative } from "node:path";

const REPO_ROOT = resolve(process.cwd());

/** Watched globs (regex form, anchored from repo root). */
const RUST_NODES_RE = /^rust\/crates\/sabflow-nodes\/.*\.rs$/;
const FORGE_RE = /^src\/lib\/sabflow\/forge\/.*\.ts$/;

/** Required inventory manifests. */
const RUST_INVENTORY = "docs/inventory/rust-stubs.json";
const FORGE_INVENTORY = "docs/inventory/forge-fallback-map.json";

/** Bypass token — must appear verbatim in a commit message. */
const BYPASS_TOKEN = "[skip-inventory]";

function log(msg) {
  process.stdout.write(`[sabflow-inventory] ${msg}\n`);
}

function err(msg) {
  process.stderr.write(`[sabflow-inventory] ${msg}\n`);
}

/**
 * Determine the diff range. Prefers explicit env vars (so CI is deterministic),
 * falls back to `origin/main...HEAD` for local runs.
 */
function resolveDiffRange() {
  // GitHub Actions for pull_request events sets GITHUB_BASE_REF (e.g. "main").
  const baseRef = process.env.GITHUB_BASE_REF;
  const baseSha = process.env.BASE_SHA;
  const headSha = process.env.HEAD_SHA || process.env.GITHUB_SHA || "HEAD";

  if (baseSha) {
    return { base: baseSha, head: headSha };
  }
  if (baseRef) {
    // Ensure the remote ref is available — best effort, ignore failures so
    // a missing remote doesn't crash the check (the diff will still resolve
    // locally in most cases).
    try {
      execSync(`git fetch --no-tags --depth=50 origin ${baseRef}`, {
        stdio: "ignore",
      });
    } catch {
      /* noop */
    }
    return { base: `origin/${baseRef}`, head: headSha };
  }
  return { base: "origin/main", head: "HEAD" };
}

function listChangedFiles({ base, head }) {
  try {
    const out = execSync(`git diff --name-only ${base}...${head}`, {
      encoding: "utf8",
    });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch (e) {
    err(`failed to compute diff (${base}...${head}): ${e?.message ?? e}`);
    err(
      "If running locally, ensure the base ref is fetched (e.g. `git fetch origin main`).",
    );
    process.exit(2);
  }
}

function listCommitMessages({ base, head }) {
  try {
    const out = execSync(`git log --format=%B ${base}..${head}`, {
      encoding: "utf8",
    });
    return out;
  } catch {
    // Fall back to just the HEAD commit message.
    try {
      return execSync(`git log -1 --format=%B ${head}`, { encoding: "utf8" });
    } catch {
      return "";
    }
  }
}

function readPRBodyFromEvent() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !existsSync(eventPath)) return "";
  try {
    const payload = JSON.parse(readFileSync(eventPath, "utf8"));
    return payload?.pull_request?.body ?? "";
  } catch {
    return "";
  }
}

function isBypassed({ base, head }) {
  const haystacks = [
    listCommitMessages({ base, head }),
    readPRBodyFromEvent(),
  ];
  return haystacks.some((h) => typeof h === "string" && h.includes(BYPASS_TOKEN));
}

function main() {
  const range = resolveDiffRange();
  log(`diff range: ${range.base}...${range.head}`);

  const changed = listChangedFiles(range);
  if (changed.length === 0) {
    log("no changed files detected — nothing to check.");
    return;
  }
  log(`changed files: ${changed.length}`);

  const rustNodeTouches = changed.filter((f) => RUST_NODES_RE.test(f));
  const forgeTouches = changed.filter((f) => FORGE_RE.test(f));

  const rustInventoryTouched = changed.includes(RUST_INVENTORY);
  const forgeInventoryTouched = changed.includes(FORGE_INVENTORY);

  const failures = [];

  if (rustNodeTouches.length > 0 && !rustInventoryTouched) {
    failures.push(
      [
        `Rust SabFlow nodes changed (${rustNodeTouches.length} file(s)) but`,
        `  ${RUST_INVENTORY} was NOT updated.`,
        "",
        "  Changed Rust files (first 10):",
        ...rustNodeTouches.slice(0, 10).map((f) => `    - ${f}`),
        "",
        "  Fix: regenerate the Rust stub inventory (see C.1.1 prompt in",
        "  PLAN-sabflow-coverage.md) and commit `docs/inventory/rust-stubs.json`.",
      ].join("\n"),
    );
  }

  if (forgeTouches.length > 0 && !forgeInventoryTouched) {
    failures.push(
      [
        `Forge fallbacks changed (${forgeTouches.length} file(s)) but`,
        `  ${FORGE_INVENTORY} was NOT updated.`,
        "",
        "  Changed Forge files (first 10):",
        ...forgeTouches.slice(0, 10).map((f) => `    - ${f}`),
        "",
        "  Fix: regenerate the Forge fallback inventory (see C.1.2 prompt in",
        "  PLAN-sabflow-coverage.md) and commit",
        "  `docs/inventory/forge-fallback-map.json`.",
      ].join("\n"),
    );
  }

  if (failures.length === 0) {
    log("inventory contract satisfied — OK.");
    return;
  }

  if (isBypassed(range)) {
    log(
      `bypass token ${BYPASS_TOKEN} detected in commit message or PR body — ` +
        "skipping enforcement. This is for emergency hotfixes only and will be " +
        "reviewed.",
    );
    for (const f of failures) {
      log(`(suppressed) ${f}`);
    }
    return;
  }

  err("");
  err("inventory drift detected:");
  err("");
  for (const f of failures) {
    err(f);
    err("");
  }
  err(
    `Bypass (emergency only): include ${BYPASS_TOKEN} in any commit message on this PR.`,
  );
  err("See docs/inventory/README.md for the full contract.");
  process.exit(1);
}

main();
