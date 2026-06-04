import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import type { SessionPayload, AdminSessionPayload } from './definitions';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { cookies } from 'next/headers';
// C4 flags + C2 revocation store for the staged Mongo→Postgres auth read path.
// All PG access is gated on these flags; defaults (off/mongo) preserve today's behaviour.
import { shouldReadPg, pgReadAllowsFallback, authPgRead } from './identity/auth-flags';
import { pgRevocationStore } from './identity/pg-stores';

// Resolve the Firebase Admin service account from either env var:
//   FIREBASE_SERVICE_ACCOUNT       — inline JSON blob
//   FIREBASE_ADMIN_SDK_CONFIG      — inline JSON blob OR absolute path to a JSON file
// File path is detected by a leading "/" — the JSON itself always starts with "{".
//
// The `readFileSync(raw, ...)` below uses a runtime-resolved path. Without
// the turbopackIgnore comment, Turbopack's NFT tracer treats `raw` as a
// dynamic pattern and conservatively traces ~26k project files as runtime
// dependencies of every route that imports this module (auth.ts is imported
// by basically every API route / page), which exploded the build's
// page-data-collection phase past available RAM.
function loadFirebaseServiceAccount(): Record<string, any> {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_SDK_CONFIG || '';
    if (!raw) return {};
    if (raw.startsWith('/')) {
        try {
            return JSON.parse(readFileSync(/*turbopackIgnore: true*/ raw, 'utf8'));
        } catch (e) {
            console.error(`[AUTH_LIB] Failed to read Firebase service account file at ${raw}:`, e);
            return {};
        }
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error('[AUTH_LIB] Failed to parse Firebase service account JSON from env:', e);
        return {};
    }
}

// Lazy-load: previously this ran at module init, so every route's worker
// process paid the file-read cost during build's page-data-collection.
let _serviceAccount: Record<string, any> | undefined;
function getServiceAccount(): Record<string, any> {
    if (_serviceAccount === undefined) {
        _serviceAccount = loadFirebaseServiceAccount();
    }
    return _serviceAccount;
}

const SALT_ROUNDS = 10;
const FIREBASE_APP_NAME = 'sabnode-admin-app'; // Named app

/**
 * Thrown when the Firebase Admin SDK cannot be initialized because its
 * service-account credentials are missing or malformed. This is a SERVER
 * misconfiguration — distinct from a user presenting a bad/expired token —
 * so callers can surface a 503 instead of falsely blaming the user's token
 * with a 401 "Invalid or expired token".
 */
export class FirebaseConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FirebaseConfigError';
    }
}

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

function initializeFirebaseAdmin() {
    try {
        return admin.app(FIREBASE_APP_NAME);
    } catch (err) {
        console.log(`[AUTH_LIB] Initializing Firebase Admin SDK with name: ${FIREBASE_APP_NAME}`);

        const serviceAccount = getServiceAccount();
        let parsedServiceAccount;
        try {
            if (typeof serviceAccount === 'string') {
                parsedServiceAccount = JSON.parse(serviceAccount);
            } else {
                parsedServiceAccount = serviceAccount;
            }
        } catch (e) {
            console.error("[AUTH_LIB] FATAL: Could not parse Firebase service account JSON.");
            throw new FirebaseConfigError("Invalid Firebase service account configuration.");
        }

        // `loadFirebaseServiceAccount` returns `{}` when the env var is unset or
        // points at a missing/unreadable file. `cert({})` would throw a cryptic
        // error that gets swallowed and reported to users as "Invalid or expired
        // token". Detect the empty/incomplete credential up front and raise a
        // clear, distinctly-typed config error instead.
        if (!parsedServiceAccount || !parsedServiceAccount.project_id || !parsedServiceAccount.private_key) {
            const source = process.env.FIREBASE_SERVICE_ACCOUNT
                ? 'FIREBASE_SERVICE_ACCOUNT'
                : (process.env.FIREBASE_ADMIN_SDK_CONFIG ? `FIREBASE_ADMIN_SDK_CONFIG (${process.env.FIREBASE_ADMIN_SDK_CONFIG})` : '(neither env var set)');
            console.error(
                `[AUTH_LIB] FATAL: Firebase service account is missing or incomplete. ` +
                `Source: ${source}. Set FIREBASE_SERVICE_ACCOUNT to the inline JSON, or ` +
                `FIREBASE_ADMIN_SDK_CONFIG to a readable path of the service-account JSON for project "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown'}".`
            );
            throw new FirebaseConfigError('Firebase Admin credentials are not configured on the server.');
        }

        if (parsedServiceAccount.private_key) {
            parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, '\n');
        }

        return admin.initializeApp({
            credential: admin.credential.cert(parsedServiceAccount),
        }, FIREBASE_APP_NAME);
    }
}

export async function hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}

async function isTokenRevoked(jti: string): Promise<boolean> {
    // C4-gated Postgres read path. Default (AUTH_PG_READ unset → 'mongo') skips
    // this block entirely, so behaviour is byte-identical to today.
    if (shouldReadPg()) {
        try {
            const revoked = await pgRevocationStore.isJtiRevoked(jti);
            // 'pg' mode is authoritative — return the PG answer (incl. a `false`
            // miss) without ever consulting Mongo.
            if (authPgRead() === 'pg') return revoked;
            // 'pg-fallback': a positive PG hit is conclusive (token is revoked).
            // A PG miss (`false`) is NOT conclusive — fall through to Mongo so a
            // token revoked only in Mongo (mid-migration) is still rejected.
            if (revoked) return true;
        } catch (error) {
            console.error("Error checking PG for revoked token:", error);
            // In 'pg' (no-fallback) mode we cannot reach Mongo; mirror the
            // existing fail-open posture (signature already verified) and
            // treat the token as not-revoked rather than locking everyone out.
            if (!pgReadAllowsFallback()) return false;
            // 'pg-fallback': fall through to the Mongo logic below.
        }
    }
    try {
        const { db } = await connectToDatabase();
        const revokedToken = await db.collection('revoked_tokens').findOne({ jti });
        return !!revokedToken;
    } catch (error) {
        console.error("Error checking for revoked token:", error);
        // Fail-open: a transient DB error should not log every admin out.
        // The JWT signature is still verified, so this is safe.
        return false;
    }
}

/**
 * Returns true if the given token was issued before the user's
 * `sessionRevokedBefore` timestamp — used by "sign out everywhere"
 * to invalidate every active session at once without tracking
 * individual jtis per user.
 */
async function isTokenRevokedForUser(
    userId: string,
    issuedAtSeconds: number | undefined,
): Promise<boolean> {
    if (!issuedAtSeconds || !userId) return false;
    // C4-gated Postgres read path. Default ('mongo') skips this block, so
    // behaviour is byte-identical to today.
    if (shouldReadPg()) {
        try {
            // Same sentinel rule as Mongo: revoked iff the token was issued
            // before the user's sentinel. C2's isRevokedForUser implements
            // `revoked_before > issuedAt` === `issuedAt < revoked_before`,
            // matching the `tokenIssuedMs < revokedBefore` comparison below.
            const issuedAt = new Date(issuedAtSeconds * 1000);
            const revoked = await pgRevocationStore.isRevokedForUser(userId, issuedAt);
            // 'pg' mode is authoritative — return PG's answer without Mongo.
            // 'pg-fallback': a positive hit is conclusive; a `false` (no/older
            // sentinel) is NOT, so fall through to Mongo in case the sentinel
            // only exists in Mongo mid-migration.
            if (authPgRead() === 'pg') return revoked;
            if (revoked) return true;
        } catch (error) {
            console.error('Error checking PG user-wide token revocation:', error);
            // No Mongo reachable in 'pg' mode — mirror the existing fail-open
            // (return false) rather than locking the user out.
            if (!pgReadAllowsFallback()) return false;
            // 'pg-fallback': fall through to Mongo below.
        }
    }
    try {
        const { db } = await connectToDatabase();
        const sentinel = await db
            .collection('revoked_tokens')
            .findOne({ userId, kind: 'user-wide' });
        if (!sentinel?.revokedBefore) return false;
        const tokenIssuedMs = issuedAtSeconds * 1000;
        return tokenIssuedMs < new Date(sentinel.revokedBefore).getTime();
    } catch (error) {
        console.error('Error checking user-wide token revocation:', error);
        return false;
    }
}

export async function verifyFirebaseIdToken(token: string): Promise<any | null> {
    console.log('[AUTH_LIB] Verifying Firebase ID token on server...');
    // Initialize separately so a server-side credential misconfiguration
    // (FirebaseConfigError) propagates to the caller as a 503, rather than
    // being conflated with a genuinely invalid/expired user token (null → 401).
    const firebaseAdmin = initializeFirebaseAdmin();
    try {
        const decodedToken = await firebaseAdmin.auth().verifyIdToken(token, true); // Set checkRevoked to true
        console.log('[AUTH_LIB] Firebase ID token verified successfully.');
        return decodedToken;
    } catch (error: any) {
        console.error('[AUTH_LIB] Error verifying Firebase ID token:', error.code, error.message);
        return null;
    }
}

export async function verifyJwt(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (!payload.jti || !payload.userId || !payload.email) {
            console.error('Custom JWT payload missing required fields');
            return null;
        }

        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked session token: ${payload.jti}`);
            return null;
        }

        if (
            await isTokenRevokedForUser(
                String(payload.userId),
                typeof payload.iat === 'number' ? payload.iat : undefined,
            )
        ) {
            console.warn(`Token rejected by user-wide revoke for ${payload.userId}`);
            return null;
        }

        return payload as SessionPayload;
    } catch (error) {
        console.error("Custom JWT verification failed on server:", error);
        return null;
    }
}

export async function verifyAdminJwt(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, getJwtSecretKey());

        if (payload.role !== 'admin' || !payload.jti || !payload.exp) {
            return null;
        }

        if (await isTokenRevoked(payload.jti)) {
            console.warn(`Attempted to use a revoked admin token: ${payload.jti}`);
            return null;
        }

        return payload as AdminSessionPayload;
    } catch (error) {
        // This will catch expired tokens and other verification errors from jose
        console.error("Admin JWT verification failed on server:", error);
        return null;
    }
}

export async function createSessionToken(payload: Omit<SessionPayload, 'expires' | 'jti'>): Promise<string> {
    const jti = nanoid();
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(getJwtSecretKey());
}

export async function createAdminSessionToken(): Promise<string> {
    const jti = nanoid();
    return new SignJWT({ role: 'admin', loggedInAt: Date.now() })
        .setProtectedHeader({ alg: 'HS256' })
        .setJti(jti)
        .setIssuedAt()
        .setExpirationTime('1d')
        .sign(getJwtSecretKey());
}

// This function is for server components/actions ONLY
export async function getDecodedSession(sessionCookie: string) {
    console.log('[AUTH_LIB] getDecodedSession called.');
    if (!sessionCookie) {
        console.log('[AUTH_LIB] No session cookie provided to getDecodedSession.');
        return null;
    };

    try {
        console.log('[AUTH_LIB] Attempting to verify custom session token...');
        const payload = await verifyJwt(sessionCookie);
        console.log(`[AUTH_LIB] Token successfully decoded for user ID: ${payload?.userId}`);
        return payload;
    } catch (e: any) {
        console.error('[AUTH_LIB] Failed to decode session:', e.code, e.message);
        return null;
    }
}
