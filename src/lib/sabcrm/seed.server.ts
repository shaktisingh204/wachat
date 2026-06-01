import "server-only";

/**
 * SabCRM — project seeding (server-only).
 *
 * This module exposes two entry-points:
 *
 *   1. {@link ensureProjectSeeded} — idempotent, per-request seed call.
 *      Run once on the first `/sabcrm` page load for a project. Guarantees
 *      indexes and standard-object overlay rows exist before any CRM query
 *      runs.  Safe to call concurrently: both underlying functions are
 *      idempotent (upsert / `$setOnInsert` / once-per-process index guard).
 *
 *   2. {@link backfillAllProjects} — script-style export. Iterates every
 *      project in the `projects` collection and seeds each one. Designed for
 *      one-off admin runs (e.g. `npx ts-node --project tsconfig.node.json
 *      -e "require('./src/lib/sabcrm/seed.server').backfillAllProjects()"`)
 *      or a Vercel Cron / admin API route.  Never throws on a per-project
 *      failure — logs and continues.
 *
 * Design constraints (mirrors the rest of the SabCRM server layer):
 *   - All reads and writes are scoped by `projectId` (tenant isolation).
 *   - No user context is required — seeding is a system operation.
 *   - Zero side-effects beyond the `sabcrm_objects` collection and Mongo
 *     index DDL; no records, views, activities or notifications are touched.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { ensureSabcrmIndexes } from "./db";
import { ensureStandardObjects } from "./objects.server";

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolve every distinct project id in the `projects` collection.
 * Used only by the backfill script; normal per-request paths receive an
 * explicit `projectId` from the session/gate pipeline.
 */
async function getAllProjectIds(): Promise<string[]> {
  const { db } = await connectToDatabase();
  const ids = await db
    .collection("projects")
    .distinct("_id") as Array<{ toHexString(): string } | string>;

  return ids.map((id) =>
    typeof id === "string" ? id : id.toHexString(),
  );
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Result returned by {@link ensureProjectSeeded} so callers can log or
 * surface diagnostic information without needing to catch exceptions.
 */
export interface SeedResult {
  /** Whether the seed completed without errors. */
  ok: boolean;
  /** Project that was seeded. */
  projectId: string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** Error message when `ok` is false. */
  error?: string;
}

/**
 * Idempotently seed a single project.
 *
 * Runs in the following order so the schema is consistent before any query:
 *   1. {@link ensureSabcrmIndexes} — creates all Mongo indexes (once per
 *      process; subsequent calls are no-ops due to the module-level guard).
 *   2. {@link ensureStandardObjects} — upserts the six standard-object overlay
 *      rows for the project (`$setOnInsert` — never clobbers custom fields).
 *
 * Calling this on every first `/sabcrm` load is safe and cheap: both
 * operations are idempotent, the index guard exits immediately after the
 * first call, and the standard-object upserts skip documents that already
 * exist.
 *
 * @throws Never — all errors are caught and returned as `{ ok: false, error }`.
 */
export async function ensureProjectSeeded(
  projectId: string,
): Promise<SeedResult> {
  if (!projectId || typeof projectId !== "string") {
    return {
      ok: false,
      projectId: projectId ?? "",
      durationMs: 0,
      error: "projectId is required.",
    };
  }

  const start = Date.now();

  try {
    // Step 1: indexes (idempotent, once-per-process).
    await ensureSabcrmIndexes();

    // Step 2: standard-object overlay rows (idempotent upserts).
    await ensureStandardObjects(projectId);

    return {
      ok: true,
      projectId,
      durationMs: Date.now() - start,
    };
  } catch (e) {
    return {
      ok: false,
      projectId,
      durationMs: Date.now() - start,
      error: e instanceof Error ? e.message : "Unexpected error during seed.",
    };
  }
}

/**
 * Summary produced by {@link backfillAllProjects}.
 */
export interface BackfillSummary {
  /** Total projects discovered. */
  total: number;
  /** Projects seeded successfully. */
  succeeded: number;
  /** Projects that failed to seed. */
  failed: number;
  /** Per-project results (succeeded and failed). */
  results: SeedResult[];
  /** Total wall-clock duration in milliseconds. */
  durationMs: number;
}

/**
 * Script-style one-off backfill: seed every project in the `projects`
 * collection in parallel (batched to avoid overwhelming Mongo).
 *
 * Each project is seeded independently via {@link ensureProjectSeeded};
 * a failure on one project never aborts the rest. Results are collected
 * and returned in a {@link BackfillSummary}.
 *
 * Usage example (from a Vercel Cron handler or a one-off admin script):
 *
 * ```ts
 * import { backfillAllProjects } from '@/lib/sabcrm/seed.server';
 *
 * const summary = await backfillAllProjects();
 * console.log(`Seeded ${summary.succeeded}/${summary.total} projects`);
 * if (summary.failed > 0) {
 *   console.error('Failed projects:', summary.results.filter(r => !r.ok));
 * }
 * ```
 *
 * @param opts.batchSize  Max concurrent seeds per batch (default 10). Tune
 *                        downward if you hit Mongo connection-pool pressure.
 * @throws Never — errors are captured per-project and surfaced in the summary.
 */
export async function backfillAllProjects(
  opts: { batchSize?: number } = {},
): Promise<BackfillSummary> {
  const batchSize = Math.max(1, opts.batchSize ?? 10);
  const overallStart = Date.now();

  let projectIds: string[];
  try {
    projectIds = await getAllProjectIds();
  } catch (e) {
    // If we cannot even enumerate projects, return a hard failure.
    const error = e instanceof Error ? e.message : "Failed to list projects.";
    console.error("[sabcrm:seed] backfillAllProjects: failed to list projects:", error);
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      results: [],
      durationMs: Date.now() - overallStart,
    };
  }

  const results: SeedResult[] = [];

  // Process in batches to cap concurrency.
  for (let i = 0; i < projectIds.length; i += batchSize) {
    const batch = projectIds.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((id) => ensureProjectSeeded(id)),
    );
    results.push(...batchResults);

    // Log per-batch progress for long runs.
    const doneCount = Math.min(i + batchSize, projectIds.length);
    console.log(
      `[sabcrm:seed] backfillAllProjects: ${doneCount}/${projectIds.length} projects processed`,
    );
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (failed > 0) {
    const failedIds = results
      .filter((r) => !r.ok)
      .map((r) => `${r.projectId}: ${r.error ?? "unknown"}`)
      .join("\n  ");
    console.error(`[sabcrm:seed] backfillAllProjects: ${failed} project(s) failed:\n  ${failedIds}`);
  }

  return {
    total: projectIds.length,
    succeeded,
    failed,
    results,
    durationMs: Date.now() - overallStart,
  };
}
