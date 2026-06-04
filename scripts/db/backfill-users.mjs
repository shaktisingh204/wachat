// Backfill Mongo users + plans into Postgres `sabnode_identity` (auth migration stage 1).
// Node >= 20 ESM. Idempotent (upserts keyed on the Mongo _id). Read-only with --dry-run.
// Run: node --env-file=.env scripts/db/backfill-users.mjs [--dry-run] [--batch=500]
import pg from 'pg';
import { MongoClient } from 'mongodb';

const { Pool } = pg;
const SCHEMA = 'sabnode_identity';
const dryRun = process.argv.includes('--dry-run');
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const BATCH = batchArg ? Math.max(1, Number(batchArg.split('=')[1])) : 500;

const pgUrl = process.env.SABNODE_PG_URL;
const mUri = process.env.MONGODB_URI;
const mDb = process.env.MONGODB_DB;
if (!pgUrl || !mUri || !mDb) {
  console.error('[backfill] need SABNODE_PG_URL, MONGODB_URI, MONGODB_DB'); process.exit(1);
}

const pool = new Pool({ connectionString: pgUrl });
const mongo = new MongoClient(mUri);

try {
  await mongo.connect();
  const db = mongo.db(mDb);

  // ── plans ──────────────────────────────────────────────
  const plans = await db.collection('plans').find({}).toArray();
  let planN = 0;
  for (const p of plans) {
    const id = String(p._id);
    if (!dryRun) {
      await pool.query(
        `INSERT INTO ${SCHEMA}.plans (id, legacy_mongo_id, name, data, updated_at)
           VALUES ($1, $1, $2, $3, now())
         ON CONFLICT (id) DO UPDATE
           SET name = EXCLUDED.name, data = EXCLUDED.data, updated_at = now()`,
        [id, String(p.name ?? 'Plan'), JSON.stringify(p)],
      );
    }
    planN++;
  }
  console.log(`[backfill] plans: ${planN}${dryRun ? ' (dry-run)' : ''}`);

  // ── users ──────────────────────────────────────────────
  const cursor = db.collection('users').find({});
  let userN = 0;
  let skipped = 0;
  let buf = [];
  const flush = async () => {
    for (const u of buf) {
      if (!u.email) { skipped++; continue; } // email is NOT NULL in PG
      const legacy = String(u._id);
      if (!dryRun) {
        await pool.query(
          `INSERT INTO ${SCHEMA}.users
             (legacy_mongo_id, email, name, picture, firebase_uid, plan_id, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (legacy_mongo_id) DO UPDATE SET
             email = EXCLUDED.email,
             name = EXCLUDED.name,
             picture = EXCLUDED.picture,
             firebase_uid = COALESCE(EXCLUDED.firebase_uid, ${SCHEMA}.users.firebase_uid),
             plan_id = COALESCE(EXCLUDED.plan_id, ${SCHEMA}.users.plan_id),
             updated_at = now()`,
          [
            legacy,
            u.email,
            u.name ?? null,
            u.image ?? u.picture ?? null,
            u.firebaseUid ?? u.firebase_uid ?? null,
            u.planId ? String(u.planId) : null,
          ],
        );
      }
      userN++;
    }
    buf = [];
  };
  for await (const u of cursor) {
    buf.push(u);
    if (buf.length >= BATCH) await flush();
    if (userN && userN % 1000 === 0) console.log(`[backfill] users: ${userN}…`);
  }
  await flush();
  console.log(`[backfill] users: ${userN} migrated, ${skipped} skipped (no email)${dryRun ? ' (dry-run)' : ''}`);

  if (!dryRun) {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${SCHEMA}.users`);
    console.log(`[backfill] PG users total: ${rows[0].n}`);
  }
} catch (err) {
  console.error('[backfill] FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await mongo.close().catch(() => {});
  await pool.end();
}
