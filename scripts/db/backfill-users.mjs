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

// Fields that must NEVER land in PG `users.profile` (secrets / credentials).
// 2FA lives embedded in the Mongo user doc (twoFactorSecret, backup codes, …),
// see src/app/actions/two-fa.actions.ts; those are migrated into mfa_methods
// separately and stripped here so the profile blob carries no secrets.
const SENSITIVE_USER_FIELDS = [
  'password',
  'passwordHash',
  'salt',
  'mfa',
  'mfaSecret',
  'totpSecret',
  'twoFactorSecret',
  'twoFactorEmailCode',
  'twoFactorEmailCodeExpiresAt',
  'twoFactorBackupCodes',
  'tokens',
  'token',
  'refreshToken',
  'accessToken',
  'apiKey',
  'apiKeys',
  'resetPasswordToken',
  'resetPasswordExpires',
  'verificationToken',
];

// Build the profile blob: full Mongo user doc minus secrets. `_id` is stringified
// so the JSON is portable; everything else (preferences, plan refs, flags) stays.
function buildProfile(u) {
  const out = {};
  for (const [k, v] of Object.entries(u)) {
    if (SENSITIVE_USER_FIELDS.includes(k)) continue;
    out[k] = k === '_id' ? String(v) : v;
  }
  return out;
}

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

  // Detect an optional standalone mfa_methods Mongo collection (some deployments
  // may externalize 2FA methods). If absent, we fall back to the embedded
  // twoFactor* fields on the user doc and skip the collection scan gracefully.
  const collNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name);
  const hasMfaCollection = collNames.includes('mfa_methods');

  // ── users ──────────────────────────────────────────────
  const cursor = db.collection('users').find({});
  let userN = 0;
  let skipped = 0;
  let mfaN = 0;
  let buf = [];

  // Synthesize an mfa_methods row from the embedded TOTP secret on a user doc,
  // if 2FA-via-totp is configured. Email-based 2FA carries no durable secret to
  // migrate. Idempotent: id is derived from the legacy user id.
  const backfillEmbeddedMfa = async (u, legacy) => {
    if (!u.twoFactorSecret || u.twoFactorMethod !== 'totp') return;
    if (!dryRun) {
      await pool.query(
        `INSERT INTO ${SCHEMA}.mfa_methods (id, user_id, kind, secret, label, data, created_at)
           VALUES ($1, $2, 'totp', $3, $4, $5, now())
         ON CONFLICT (id) DO UPDATE SET
           secret = EXCLUDED.secret,
           label = EXCLUDED.label,
           data = EXCLUDED.data`,
        [
          `${legacy}:totp`,
          legacy,
          String(u.twoFactorSecret),
          u.name ?? u.email ?? null,
          // backupCodes count only — never the codes/secret themselves in data.
          JSON.stringify({
            method: 'totp',
            backupCodesRemaining: Array.isArray(u.twoFactorBackupCodes)
              ? u.twoFactorBackupCodes.length
              : 0,
          }),
        ],
      );
    }
    mfaN++;
  };

  const flush = async () => {
    for (const u of buf) {
      if (!u.email) { skipped++; continue; } // email is NOT NULL in PG
      const legacy = String(u._id);
      if (!dryRun) {
        await pool.query(
          `INSERT INTO ${SCHEMA}.users
             (legacy_mongo_id, email, name, picture, firebase_uid, plan_id, profile, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, now())
           ON CONFLICT (legacy_mongo_id) DO UPDATE SET
             email = EXCLUDED.email,
             name = EXCLUDED.name,
             picture = EXCLUDED.picture,
             firebase_uid = COALESCE(EXCLUDED.firebase_uid, ${SCHEMA}.users.firebase_uid),
             plan_id = COALESCE(EXCLUDED.plan_id, ${SCHEMA}.users.plan_id),
             profile = COALESCE(EXCLUDED.profile, ${SCHEMA}.users.profile),
             updated_at = now()`,
          [
            legacy,
            u.email,
            u.name ?? null,
            u.image ?? u.picture ?? null,
            u.firebaseUid ?? u.firebase_uid ?? null,
            u.planId ? String(u.planId) : null,
            JSON.stringify(buildProfile(u)),
          ],
        );
      }
      userN++;
      // Embedded-on-user MFA (the common case in this codebase).
      await backfillEmbeddedMfa(u, legacy);
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

  // ── mfa_methods (standalone collection, if any) ────────
  // Only runs when a dedicated mfa_methods Mongo collection exists; otherwise the
  // embedded twoFactor* path above already covered it.
  if (hasMfaCollection) {
    const mcursor = db.collection('mfa_methods').find({});
    for await (const m of mcursor) {
      const id = String(m.id ?? m._id);
      const userId = m.userId ? String(m.userId) : null;
      if (!userId) continue; // user_id is NOT NULL in PG
      if (!dryRun) {
        await pool.query(
          `INSERT INTO ${SCHEMA}.mfa_methods (id, user_id, kind, secret, label, data, created_at, last_used_at)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, now()), $8)
           ON CONFLICT (id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             kind = EXCLUDED.kind,
             secret = EXCLUDED.secret,
             label = EXCLUDED.label,
             data = EXCLUDED.data,
             last_used_at = COALESCE(EXCLUDED.last_used_at, ${SCHEMA}.mfa_methods.last_used_at)`,
          [
            id,
            userId,
            m.kind ?? null,
            m.secret ?? null,
            m.label ?? null,
            // Keep the method-specific payload (counters, hashed recovery codes)
            // verbatim; this collection is the authoritative MFA store when present.
            JSON.stringify(m),
            m.createdAt ? new Date(m.createdAt).toISOString() : null,
            m.lastUsedAt ? new Date(m.lastUsedAt).toISOString() : null,
          ],
        );
      }
      mfaN++;
    }
  }
  console.log(`[backfill] mfa_methods: ${mfaN}${hasMfaCollection ? '' : ' (embedded only — no mfa_methods collection)'}${dryRun ? ' (dry-run)' : ''}`);

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
