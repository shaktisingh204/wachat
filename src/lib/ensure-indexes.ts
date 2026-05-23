'server-only';
import type { Db } from 'mongodb';

/**
 * Ensures critical HRM portal indexes exist without blocking any request.
 *
 * Called once per process from connectToDatabase(). The `indexed` flag
 * prevents redundant createIndex calls on subsequent invocations while
 * the module is cached in memory (standard Next.js / Node.js behaviour).
 *
 * All createIndex calls are fire-and-forget: failures are swallowed so
 * that a cold-start or a MongoDB hiccup never surfaces as a 500 to the
 * client. The full index bootstrap (all collections) lives in
 * scripts/create-indexes.ts and should be run once on each new deployment.
 */

let indexed = false;

export async function ensureIndexes(db: Db): Promise<void> {
  if (indexed) return;
  indexed = true;

  // Fire-and-forget — never block the request
  Promise.allSettled([
    db.collection('crm_audit_log').createIndex(
      { userId: 1, createdAt: -1 },
      { background: true },
    ),
    db.collection('crm_audit_log').createIndex(
      { userId: 1, entityKind: 1, createdAt: -1 },
      { background: true },
    ),
    db.collection('crm_audit_log').createIndex(
      { userId: 1, actorId: 1, createdAt: -1 },
      { background: true },
    ),
    db.collection('crm_employees').createIndex(
      { userId: 1, reportingManagerId: 1 },
      { background: true },
    ),
    db.collection('crm_tasks').createIndex(
      { userId: 1, assignedTo: 1, status: 1 },
      { background: true },
    ),
    db.collection('hrm_roadmaps').createIndex(
      { userId: 1, createdBy: 1 },
      { background: true },
    ),
    db.collection('hrm_task_reports').createIndex(
      { userId: 1, assignerId: 1 },
      { background: true },
    ),
  ]).catch(() => {
    /* non-fatal: index creation failures are surfaced by create-indexes.ts */
  });
}
