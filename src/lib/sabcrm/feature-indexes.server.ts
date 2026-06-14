import 'server-only';

/**
 * SabCRM — production index bootstrap for the beyond-CRUD feature collections.
 *
 * Every collection added by the SabCRM feature waves is project-scoped and read
 * on a hot path (notifications bell, record comments, the CRM inbox, webhook
 * retries, attribution, the per-project config lookups). This module creates the
 * matching MongoDB indexes so those reads stay indexed at scale.
 *
 * Idempotent + best-effort: `createIndex` is a no-op when the index already
 * exists, and every call is individually try/caught so a single failure can
 * never abort the rest (or the caller). Invoked from the daily
 * `/api/cron/sabcrm-forecast-snapshots` tick (see that route).
 *
 * Hot-path compound indexes use the EXACT query shapes the server modules issue;
 * every other feature collection gets at least a `{ projectId: 1 }` index since
 * they are all tenant-scoped.
 */

import { type Db, type IndexSpecification, type CreateIndexesOptions } from 'mongodb';

/** Precise compound indexes for the high-traffic feature collections. */
const HOT_PATH_INDEXES: Array<{
  coll: string;
  index: IndexSpecification;
  options?: CreateIndexesOptions;
}> = [
  // Notification bell: list/unread are scoped to the inbox owner.
  { coll: 'sabcrm_notifications', index: { projectId: 1, userId: 1, createdAt: -1 } },
  { coll: 'sabcrm_notifications', index: { projectId: 1, userId: 1, read: 1 } },
  // Record comments: listed per (project, object, record), oldest-first.
  { coll: 'sabcrm_comments', index: { projectId: 1, object: 1, recordId: 1, createdAt: 1 } },
  // Marketing attribution touches: aggregated per record.
  { coll: 'sabcrm_touches', index: { projectId: 1, object: 1, recordId: 1 } },
  // Signed-webhook delivery ledger: the retry cron scans due rows by status.
  { coll: 'sabcrm_webhook_deliveries', index: { status: 1, nextRetryAt: 1 } },
  { coll: 'sabcrm_webhook_deliveries', index: { projectId: 1, createdAt: -1 } },
  // BCC dropbox: inbound capture resolves the project by opaque token.
  { coll: 'sabcrm_email_dropbox', index: { token: 1 } },
  // GDPR: consents + erasures are looked up by subject within a project.
  { coll: 'sabcrm_consents', index: { projectId: 1, subjectEmail: 1 } },
  { coll: 'sabcrm_gdpr_erasures', index: { projectId: 1, subjectEmail: 1 } },
];

/**
 * Every other feature collection is tenant-scoped — a plain `{ projectId: 1 }`
 * index covers its list/get path. (Collections that already self-create richer
 * indexes — sabcrm_api_logs, sabcrm_api_ratelimit, sabcrm_cadence_enrollments,
 * sabcrm_forecast_snapshots, sabcrm_embeddings — are intentionally omitted.)
 */
const PROJECT_SCOPED_COLLECTIONS: readonly string[] = [
  'sabcrm_winloss_config',
  'sabcrm_lookup_fields',
  'sabcrm_field_dependencies',
  'sabcrm_value_sets',
  'sabcrm_record_types',
  'sabcrm_autocapture_config',
  'sabcrm_cadences',
  'sabcrm_contests',
  'sabcrm_sharing_rules',
  'sabcrm_access_enforcement',
  'sabcrm_access_flags',
  'sabcrm_territories',
  'sabcrm_territory_settings',
  'sabcrm_fls_policies',
  'sabcrm_fls_settings',
  'sabcrm_email_dropbox',
  'sabcrm_email_events',
  'sabcrm_booking_links',
];

/**
 * Create (idempotently) every SabCRM feature index. Best-effort: returns the
 * count created/ensured; never throws. Safe to call repeatedly (e.g. daily).
 */
export async function ensureSabcrmFeatureIndexes(
  db: Db,
): Promise<{ ensured: number; failed: number }> {
  let ensured = 0;
  let failed = 0;

  for (const { coll, index, options } of HOT_PATH_INDEXES) {
    try {
      await db.collection(coll).createIndex(index, { background: true, ...options });
      ensured += 1;
    } catch {
      failed += 1;
    }
  }

  for (const coll of PROJECT_SCOPED_COLLECTIONS) {
    try {
      await db.collection(coll).createIndex({ projectId: 1 }, { background: true });
      ensured += 1;
    } catch {
      failed += 1;
    }
  }

  return { ensured, failed };
}
