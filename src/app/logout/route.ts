import { type NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/lib/mongodb';
// C4 flags + C2 revocation store for the staged Mongo→Postgres auth migration.
// Defaults (off) keep this byte-identical to today.
import { shouldWritePg, shouldWriteMongo } from '@/lib/identity/auth-flags';
import { pgRevocationStore } from '@/lib/identity/pg-stores';

function getJwtSecretKey(): Uint8Array {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }
    return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
    const sessionToken = request.cookies.get('session')?.value;

    if (sessionToken) {
        try {
            const { payload } = await jwtVerify(sessionToken, getJwtSecretKey());
            // If the token has a "jti" (JWT ID), add it to a denylist.
            if (payload.jti && payload.exp) {
                const expiresAt = new Date(payload.exp * 1000); // exp is in seconds
                // Mongo revocation remains the default; skipped only under pg-only.
                if (shouldWriteMongo()) {
                    const { db } = await connectToDatabase();
                    await db.collection('revoked_tokens').insertOne({
                        jti: payload.jti,
                        expiresAt,
                    });
                }
                // Dual-write the jti revocation into Postgres (best-effort, never fatal).
                if (shouldWritePg()) {
                    try {
                        await pgRevocationStore.revokeJti(String(payload.jti), {
                            // Our session tokens carry userId as a custom claim
                            // (see createSessionToken / verifyJwt in src/lib/auth.ts),
                            // not as JWT `sub`. Pass it through when present.
                            userId:
                                typeof (payload as any).userId === 'string'
                                    ? (payload as any).userId
                                    : undefined,
                            expiresAt,
                        });
                    } catch (pgErr) {
                        console.error('[LOGOUT] Postgres jti revocation failed (non-fatal):', pgErr);
                    }
                }
                console.log(`[LOGOUT] Revoked user token JTI: ${payload.jti}`);
            }
        } catch (error) {
            // This catches expired tokens, invalid signatures etc.
            // We can just proceed with logout.
            console.warn('[LOGOUT] Error revoking user token (it may be expired/invalid):', error);
        }
    }

    // Redirect to the login page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.url;
    // Ensure we construct the URL relative to the base if absolute URL isn't available from request.url in some environments
    const loginUrl = new URL('/login', request.url);

    const response = NextResponse.redirect(loginUrl);

    // Clear the session cookie regardless of whether token revocation worked.
    response.cookies.set({
        name: 'session',
        value: '',
        path: '/',
        expires: new Date(0),
    });

    return response;
}
