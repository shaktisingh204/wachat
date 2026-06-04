/**
 * Data migration — rename the SabCRM "opportunities" object to "leads".
 *
 * The standard-object slug was renamed (schema.ts + Rust standard_objects.rs),
 * so existing records/config still tagged with the old `opportunities` slug
 * must be re-pointed to `leads` or they'd vanish from the renamed object's
 * routes/views. This sweep rewrites every `object` / `targetObject` slug
 * across the SabCRM Mongo collections.
 *
 * Idempotent: re-running it is a no-op once everything is on `leads`.
 *
 * Usage:
 *   MONGODB_URI=… MONGODB_DB=… node scripts/db/rename-opportunities-to-leads.mjs
 *   # add DRY_RUN=1 to preview counts without writing.
 */

import { MongoClient } from 'mongodb';

const OLD = 'opportunities';
const NEW = 'leads';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
const dryRun = process.env.DRY_RUN === '1';

if (!uri || !dbName) {
  console.error('[rename-leads] need MONGODB_URI and MONGODB_DB');
  process.exit(2);
}

/**
 * Collections + the slug-bearing fields to rewrite in each. `object` is the
 * record's owning object slug; `data.<rel>` relation values store target ids
 * (not slugs) so they need no change — only the metadata slug fields do.
 */
const TARGETS = [
  { coll: 'sabcrm_records', fields: ['object'] },
  { coll: 'sabcrm_pipelines', fields: ['object'] },
  { coll: 'sabcrm_views', fields: ['object'] },
  { coll: 'sabcrm_segments', fields: ['object'] },
  { coll: 'sabcrm_favorites', fields: ['object'] },
  { coll: 'sabcrm_page_layouts', fields: ['object'] },
  { coll: 'sabcrm_activities', fields: ['object', 'targetObject'] },
  { coll: 'sabcrm_objects', fields: ['slug'] },
];

const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  let total = 0;

  for (const { coll, fields } of TARGETS) {
    const c = db.collection(coll);
    for (const field of fields) {
      const filter = { [field]: OLD };
      const count = await c.countDocuments(filter);
      if (count === 0) continue;
      total += count;
      if (dryRun) {
        console.log(`[dry-run] ${coll}.${field}: ${count} doc(s) → "${NEW}"`);
        continue;
      }
      const res = await c.updateMany(filter, { $set: { [field]: NEW } });
      console.log(`[ok] ${coll}.${field}: ${res.modifiedCount} updated → "${NEW}"`);
    }
  }

  console.log(
    dryRun
      ? `[dry-run] ${total} doc(s) would be migrated. Re-run without DRY_RUN to apply.`
      : `[done] migration complete (${total} doc(s) touched).`,
  );
} catch (e) {
  console.error('[rename-leads] failed:', e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
