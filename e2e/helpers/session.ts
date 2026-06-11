/**
 * E2E session fixture — mints the app's `session` cookie for a seeded
 * test user so Playwright specs and API integration tests can hit
 * cookie-authenticated routes without driving the login UI.
 *
 * ── Why we REPLICATE the JWT instead of importing '@/lib/auth' ──────────
 * `src/lib/auth.ts` (where `createSessionToken` lives) imports
 * `./mongodb` — which starts with `import 'server-only'` — and
 * `next/headers`. Both crash the moment the module is evaluated outside
 * a Next.js server runtime (tsx, Playwright's loader). So we re-implement
 * the signing minimally but EXACTLY:
 *
 *   createSessionToken (src/lib/auth.ts:284):
 *     new SignJWT({ userId, email, name?, picture? })
 *       .setProtectedHeader({ alg: 'HS256' })
 *       .setJti(nanoid()).setIssuedAt().setExpirationTime('7d')
 *       .sign(TextEncoder().encode(process.env.JWT_SECRET))
 *
 *   verifyJwt (src/lib/auth.ts:232) requires: valid HS256 signature with
 *   JWT_SECRET, payload.jti + payload.userId + payload.email present, jti
 *   not in the `revoked_tokens` collection (a fresh random jti never is),
 *   and `iat` newer than any user-wide revoke sentinel (a fresh user has
 *   none).
 *
 * The cookie attributes mirror `sessionCookieOptions` in
 * `src/lib/cookies.ts`: httpOnly, sameSite=lax, path=/, secure=false for
 * local http (COOKIE_SECURE unset + NEXT_PUBLIC_APP_URL not https).
 */

import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { MongoClient, ObjectId, type Db } from 'mongodb';
import { SignJWT } from 'jose';
import dotenv from 'dotenv';

/* ── Constants ──────────────────────────────────────────────────────── */

/**
 * Deterministic ObjectId for the e2e user. Fixed (instead of random) so a
 * previously minted cookie keeps resolving to the same Mongo user across
 * runs — and so a cookie minted during a Mongo-unreachable flake (see
 * README) still works against a DB seeded by an earlier run.
 */
export const TEST_USER_ID = 'e2e5abf10000000000000001';
export const TEST_USER_EMAIL = 'e2e-sabflow@test.local';
export const TEST_USER_NAME = 'E2E SabFlow';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3002';

/* ── Env loading ────────────────────────────────────────────────────── */

let envLoaded = false;

/** Repo root = where package.json lives (npm scripts run from there). */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

/**
 * Load `.env` the way Next.js (@next/env) does: within a file the LAST
 * occurrence of a duplicate key wins (this repo's .env defines JWT_SECRET
 * twice — line 4 and line 59 — and the running server sees the later one).
 * Already-set process.env vars are never overridden.
 */
export function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  for (const file of ['.env', '.env.local']) {
    const p = path.join(repoRoot(), file);
    if (!existsSync(p)) continue;
    const parsed = dotenv.parse(readFileSync(p)); // last duplicate wins
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

function requireEnv(key: string): string {
  loadEnv();
  const v = process.env[key];
  if (!v) throw new Error(`[e2e/session] ${key} is not set (checked process.env and .env)`);
  return v;
}

/* ── Mongo ──────────────────────────────────────────────────────────── */

/**
 * Direct-driver Mongo connection (NOT '@/lib/mongodb' — server-only).
 *
 * Short serverSelection timeout: on this Mac, freshly spawned node/tsx
 * processes occasionally get EADDRNOTAVAIL connecting to localhost Mongo
 * (macOS local-network permission) even while the Next dev server connects
 * fine. Callers should catch and skip with a clear message.
 */
export async function connectMongo(
  timeoutMs = 3000,
): Promise<{ client: MongoClient; db: Db }> {
  loadEnv();
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB ?? 'app1';
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs,
  });
  await client.connect();
  // Force an actual round-trip so unreachability fails HERE, not later.
  const db = client.db(dbName);
  await db.command({ ping: 1 });
  return { client, db };
}

/* ── Test user ──────────────────────────────────────────────────────── */

export interface TestUser {
  _id: string;
  email: string;
  name: string;
}

/**
 * Upsert the e2e user. Shape matches what the session resolution path
 * needs (src/app/actions/user.actions.ts getSessionFromMongo: lookup by
 * `_id = ObjectId(jwt.userId)`, password projected away) and what the
 * /dashboard + /wachat layouts gate on (`onboarding.status === 'complete'`
 * — anything else redirects to /onboarding).
 */
export async function ensureTestUser(db?: Db): Promise<TestUser> {
  let owned: MongoClient | null = null;
  let database = db;
  if (!database) {
    const conn = await connectMongo();
    owned = conn.client;
    database = conn.db;
  }
  try {
    const now = new Date();
    await database.collection('users').updateOne(
      { _id: new ObjectId(TEST_USER_ID) },
      {
        $set: {
          email: TEST_USER_EMAIL,
          name: TEST_USER_NAME,
          onboarding: { status: 'complete' },
          updatedAt: now,
          __e2e: true,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );
    return { _id: TEST_USER_ID, email: TEST_USER_EMAIL, name: TEST_USER_NAME };
  } finally {
    if (owned) await owned.close();
  }
}

/* ── JWT + cookie minting ───────────────────────────────────────────── */

/** Mint the session JWT exactly like createSessionToken (src/lib/auth.ts). */
export async function mintSessionToken(
  user: Pick<TestUser, '_id' | 'email' | 'name'> = {
    _id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: TEST_USER_NAME,
  },
): Promise<string> {
  const secret = new TextEncoder().encode(requireEnv('JWT_SECRET'));
  return new SignJWT({ userId: user._id, email: user.email, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

/** Playwright storageState-compatible cookie record. */
export interface SessionCookie {
  name: 'session';
  value: string;
  domain: string;
  path: '/';
  expires: number;
  httpOnly: true;
  secure: boolean;
  sameSite: 'Lax';
}

/**
 * Mint the cookie record for storageState / context.addCookies().
 * Attributes mirror sessionCookieOptions (src/lib/cookies.ts) for local
 * dev: httpOnly, sameSite=lax, path=/, secure=false (no COOKIE_SECURE,
 * NEXT_PUBLIC_APP_URL is not https locally).
 */
export async function mintSessionCookie(
  user?: Pick<TestUser, '_id' | 'email' | 'name'>,
): Promise<SessionCookie> {
  const value = await mintSessionToken(user);
  return {
    name: 'session',
    value,
    domain: new URL(BASE_URL).hostname, // 'localhost'
    path: '/',
    expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  };
}

/** `Cookie:` header value for plain fetch()-based API tests. */
export function sessionCookieHeader(token: string): string {
  return `session=${token}`;
}
