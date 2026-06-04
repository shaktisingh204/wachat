// Reconcile Mongo users vs Postgres sabnode_identity.users (auth migration stage 4).
// Read-only. Exits 0 if drift is within threshold (gate before flipping reads to PG),
// 1 if drift exceeds it, 2 on a runtime failure.
// Run: node --env-file=.env scripts/db/reconcile-users.mjs
import pg from 'pg';
import { MongoClient } from 'mongodb';

const { Pool } = pg;
const SCHEMA = 'sabnode_identity';
const THRESHOLD = Number(process.env.RECONCILE_DRIFT_THRESHOLD ?? 0.01);

const pgUrl = process.env.SABNODE_PG_URL;
const mUri = process.env.MONGODB_URI;
const mDb = process.env.MONGODB_DB;
if (!pgUrl || !mUri || !mDb) {
  console.error('[reconcile] need SABNODE_PG_URL, MONGODB_URI, MONGODB_DB'); process.exit(2);
}

const pool = new Pool({ connectionString: pgUrl });
const mongo = new MongoClient(mUri);

const norm = (v) => (v == null ? '' : String(v).trim());

try {
  await mongo.connect();
  const db = mongo.db(mDb);

  const mongoUsers = await db
    .collection('users')
    .find({}, { projection: { _id: 1, email: 1, name: 1 } })
    .toArray();
  const mongoTotal = mongoUsers.length;

  const { rows: pgRows } = await pool.query(
    `SELECT legacy_mongo_id, email, name FROM ${SCHEMA}.users WHERE legacy_mongo_id IS NOT NULL`,
  );
  const pgById = new Map(pgRows.map((r) => [r.legacy_mongo_id, r]));

  let missing = 0;
  let drift = 0;
  const missingSample = [];
  const driftSample = [];
  for (const u of mongoUsers) {
    const id = String(u._id);
    const pgRow = pgById.get(id);
    if (!pgRow) {
      missing++;
      if (missingSample.length < 10) missingSample.push(id);
      continue;
    }
    const emailDrift = norm(u.email).toLowerCase() !== norm(pgRow.email).toLowerCase();
    const nameDrift = norm(u.name) !== norm(pgRow.name);
    if (emailDrift || nameDrift) {
      drift++;
      if (driftSample.length < 10) driftSample.push(id);
    }
  }

  const driftRatio = mongoTotal === 0 ? 0 : (missing + drift) / mongoTotal;
  const summary = {
    mongoTotal,
    pgTotal: pgRows.length,
    missingInPg: missing,
    fieldDrift: drift,
    driftRatio: Number(driftRatio.toFixed(4)),
    threshold: THRESHOLD,
    ok: driftRatio <= THRESHOLD,
    missingSample,
    driftSample,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
} catch (err) {
  console.error('[reconcile] FAILED:', err.message);
  process.exitCode = 2;
} finally {
  await mongo.close().catch(() => {});
  await pool.end();
}
