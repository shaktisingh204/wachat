import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyFirebaseIdToken, createSessionToken, FirebaseConfigError } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { checkRequires2fa } from '@/app/actions/two-fa.actions';
import type { User, WithId, SessionPayload } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
// C4 flags + C2 PG user store for the staged Mongo→Postgres auth migration.
// Defaults (off/mongo) keep this byte-identical to today.
import {
    shouldWritePg,
    shouldWriteMongo,
    shouldReadPg,
    authPgRead,
} from '@/lib/identity/auth-flags';
import { pgUserStore } from '@/lib/identity/pg-stores';
// Inline parameterized PG access for the default-plan read + login_attempts write.
import { pgQuery } from '@/lib/postgres';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function POST(request: NextRequest) {
    console.log('[API_SESSION] POST /api/auth/session hit.');
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.error('[API_SESSION] Unauthorized: Missing Authorization header.');
        return new Response('Unauthorized: Missing token.', { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    console.log('[API_SESSION] Received Firebase ID token.');
    
    try {
        const decodedToken = await verifyFirebaseIdToken(idToken);
        if (!decodedToken) {
            console.error('[API_SESSION] Firebase token verification failed.');
            throw new Error("Invalid or expired token.");
        }
        console.log(`[API_SESSION] Firebase token verified for UID: ${decodedToken.uid}`);

        const { db } = await connectToDatabase();
        
        const now = new Date();
        const requestBody = await request.json().catch(() => ({}));
        const name = requestBody.name || decodedToken.name || decodedToken.email;
        const location = requestBody.location; // GeoJSON object
        console.log(`[API_SESSION] Upserting user: ${decodedToken.email}`);
        
        // Default plan resolution. Under the read flag we source the default
        // plan from sabnode_identity.plans (the plan doc lives in the `data`
        // jsonb). Any miss/error falls back to the Mongo read so signup is never
        // blocked — except in strict 'pg' mode where PG is authoritative.
        let defaultPlan: any = null;
        if (shouldReadPg()) {
            try {
                const { rows } = await pgQuery<{ data: any }>(
                    `SELECT data FROM sabnode_identity.plans WHERE data->>'isDefault' = 'true' LIMIT 1`,
                );
                defaultPlan = rows[0]?.data ?? null;
            } catch (pgErr) {
                console.error('[API_SESSION] Postgres default-plan read failed, falling back to Mongo:', pgErr);
            }
        }
        // Mongo fallback on a PG miss/error, unless strict 'pg' is authoritative.
        if (!defaultPlan && authPgRead() !== 'pg') {
            defaultPlan = await db.collection('plans').findOne({ isDefault: true });
        }

        const setOnInsertData: any = {
            name,
            email: decodedToken.email,
            authProvider: decodedToken.firebase.sign_in_provider,
            createdAt: now,
            isApproved: false,
            // New signups enter the onboarding wizard at the profile step.
            // `handleWabaOnboarding`, `handleMetaConnection`, and
            // `completeOnboarding` advance/complete this state.
            onboarding: {
                status: 'profile',
                startedAt: now,
            },
        };

        if (defaultPlan) {
            setOnInsertData.planId = defaultPlan._id;
            setOnInsertData.credits = defaultPlan.signupCredits || 0;
        }
        
        const setData: any = {
            lastLogin: now,
        };
        if(location) {
            setData.location = location;
        }

        // Mongo upsert remains the source of truth for the resolved user
        // document the rest of this flow depends on (id, 2FA, session token).
        // Only skipped when pg-only is configured (!shouldWriteMongo()); since
        // pg-only requires the read path to source the user from Postgres
        // (Lane A), we still need a user doc here, so we re-read it from Mongo
        // even under pg-only to avoid breaking the live login flow.
        let user: WithId<User> | null = null;

        // Mongo write/upsert remains the source of new-user creation on signup
        // (and refreshes lastLogin). Skipped only under pg-only writes.
        if (shouldWriteMongo()) {
            const updateResult = await db.collection('users').findOneAndUpdate(
                { email: decodedToken.email },
                {
                    $setOnInsert: setOnInsertData,
                    $set: setData,
                },
                { upsert: true, returnDocument: 'after' }
            );

            if (!updateResult) {
                 throw new Error('Could not find or create user profile after login.');
            }

            user = updateResult as WithId<User>;
        }

        // Strict 'pg' read: resolve the user from Postgres (identity cols +
        // profile jsonb) and rebuild the legacy Mongo doc the flow needs. This
        // overrides any Mongo-resolved doc above so PG is authoritative; a
        // miss/error here intentionally leaves `user` for the Mongo fallback
        // below — never lock out.
        if (authPgRead() === 'pg') {
            try {
                const byEmail = await pgUserStore.findByEmail(decodedToken.email!);
                if (byEmail?.legacy_mongo_id) {
                    const pgRow = await pgUserStore.getFullByMongoId(byEmail.legacy_mongo_id);
                    const profile = (pgRow?.profile ?? null) as Record<string, any> | null;
                    if (profile && pgRow?.legacy_mongo_id && ObjectId.isValid(pgRow.legacy_mongo_id)) {
                        // profile carries _id as a string; restore the ObjectId so
                        // the rest of the flow (2FA check, session payload) is unchanged.
                        user = {
                            ...(profile as any),
                            _id: new ObjectId(pgRow.legacy_mongo_id),
                            email: profile.email ?? pgRow.email,
                        } as WithId<User>;
                    }
                }
            } catch (pgErr) {
                console.error('[API_SESSION] Postgres user read failed, falling back to Mongo:', pgErr);
            }
        }

        // Fallback: if we still have no user (pg-only write with no PG read, or a
        // strict-pg miss/error), read the existing user from Mongo so the
        // (Mongo-built) login flow can proceed safely and login never locks out.
        if (!user) {
            const existing = await db.collection('users').findOne({ email: decodedToken.email });
            if (!existing) {
                throw new Error('Could not find user profile after login.');
            }
            user = existing as WithId<User>;
        }

        console.log('[API_SESSION] User upserted successfully.');

        // Dual-write the user into Postgres (best-effort, never fatal).
        // Gated on shouldWritePg(); legacy mongo _id is the stable upsert key.
        if (shouldWritePg()) {
            try {
                // Build the profile JSONB from the full user doc minus secrets,
                // so the Postgres `profile` column stays current on every login
                // and the PG read path can rebuild the legacy Mongo shape.
                // We strip auth/2FA secrets — those live in mfa_methods (Lane W),
                // never in the plaintext profile blob.
                const profile: Record<string, any> = { ...(user as any) };
                profile._id = user._id.toString(); // serialize ObjectId stably
                delete profile.password;
                delete profile.twoFactorSecret;
                delete profile.twoFactorBackupCodes;
                delete profile.twoFactorEmailCode;
                delete profile.twoFactorChallengeCode;
                delete profile.twoFactorPendingSecret;
                delete profile.twoFactorPendingBackupCodes;

                await pgUserStore.upsertByMongoId({
                    legacyMongoId: user._id.toString(),
                    email: user.email,
                    name: (user as any).name ?? null,
                    picture: (user as any).image ?? (user as any).picture ?? null,
                    planId: (user as any).planId != null ? String((user as any).planId) : null,
                    firebaseUid: decodedToken.uid ?? null,
                    // Pass the sanitized full doc so PG profile tracks Mongo on login.
                    profile,
                });
            } catch (pgErr) {
                console.error('[API_SESSION] Postgres user upsert failed (non-fatal):', pgErr);
            }
        }

        // If the user has 2FA enabled, return `requires2fa` instead of
        // issuing the session cookie. The client-side login form then
        // prompts for the 6-digit code and posts to /api/auth/two-fa,
        // which completes the session.
        const challenge = await checkRequires2fa(user._id.toString());

        const reqIp = request.headers.get('x-forwarded-for') || request.ip || 'Unknown';
        const reqUserAgent = request.headers.get('user-agent') || 'Unknown';
        const attemptStatus = challenge.requires2fa ? 'pending_2fa' : 'success';
        // Mongo login_attempts stays unless pg-only writes are configured.
        if (shouldWriteMongo()) {
            await db.collection('login_attempts').insertOne({
                userId: user._id,
                ip: reqIp,
                userAgent: reqUserAgent,
                status: attemptStatus,
                createdAt: now
            });
        }
        // Best-effort dual-write to sabnode_identity.login_attempts (never fatal).
        if (shouldWritePg()) {
            try {
                await pgQuery(
                    `INSERT INTO sabnode_identity.login_attempts (email, user_id, ip, outcome, reason)
                       VALUES ($1, $2, $3, $4, $5)`,
                    [user.email, user._id.toString(), reqIp, attemptStatus, null],
                );
            } catch (pgErr) {
                console.error('[API_SESSION] Postgres login_attempts write failed (non-fatal):', pgErr);
            }
        }

        if (challenge.requires2fa) {
            // Short-lived "pending" cookie so the next request can identify
            // *which* user is in the challenge step without re-running the
            // Firebase verify. httpOnly + sameSite + tied to the userId.
            const pendingPayload: Omit<SessionPayload, 'jti' | 'exp'> = ({
                userId: user._id.toString(),
                email: user.email,
                name: user.name,
                isApproved: (user as any).isApproved || false,
                pending2fa: true,
            } as any);
            const pendingToken = await createSessionToken(pendingPayload as any);
            const resp = NextResponse.json({
                requires2fa: true,
                method: challenge.method,
                userId: user._id.toString(),
            });
            // 5-minute pending cookie — enough to enter the code but
            // short enough to limit replay.
            resp.cookies.set('session_pending_2fa', pendingToken, {
                ...sessionCookieOptions(300),
                maxAge: 300,
            });
            return resp;
        }

        // Create a custom session token for our app
        const sessionPayload: Omit<SessionPayload, 'jti' | 'exp'> = ({
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
            isApproved: (user as any).isApproved || false,
        } as any);
        const customSessionToken = await createSessionToken(sessionPayload as any);
        console.log('[API_SESSION] Custom session token created.');

        const response = NextResponse.json({ success: true, user: user });

        console.log('[API_SESSION] Setting session cookie.');
        response.cookies.set('session', customSessionToken, sessionCookieOptions(SESSION_DURATION / 1000));

        console.log('[API_SESSION] Session successfully created.');
        return response;
    } catch (error: any) {
        // A server-side credential misconfiguration is NOT the user's fault —
        // don't blame their token with a 401. Surface a 503 so the client shows
        // "service unavailable" and the real cause is unambiguous in the logs.
        if (error instanceof FirebaseConfigError) {
            console.error('[API_SESSION] Firebase Admin is misconfigured on the server:', error.message);
            return new Response(
                'Authentication is temporarily unavailable. Please try again later.',
                { status: 503 },
            );
        }
        console.error('[API_SESSION] Session creation failed:', error);
        return new Response(`Authentication error: ${error.message}`, { status: 401 });
    }
}
