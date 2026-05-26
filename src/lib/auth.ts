import bcrypt from 'bcryptjs';
import { connectToDatabase } from './mongodb';
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import type { SessionPayload, AdminSessionPayload } from './definitions';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { cookies } from 'next/headers';

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
            throw new Error("Invalid Firebase service account configuration.");
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
    try {
        const firebaseAdmin = initializeFirebaseAdmin();
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
