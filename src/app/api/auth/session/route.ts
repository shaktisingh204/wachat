import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyFirebaseIdToken, createSessionToken, FirebaseConfigError } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { checkRequires2fa } from '@/app/actions/two-fa.actions';
import type { User, WithId, SessionPayload } from '@/lib/definitions';
import { ObjectId } from 'mongodb';
// C4 flags + C2 PG user store for the staged Mongo→Postgres auth migration.
// Defaults (off/mongo) keep this byte-identical to today.
import { shouldWritePg, shouldWriteMongo } from '@/lib/identity/auth-flags';
import { pgUserStore } from '@/lib/identity/pg-stores';

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
        
        const defaultPlan = await db.collection('plans').findOne({ isDefault: true });

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
        let user: WithId<User>;
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
        } else {
            // pg-only: skip the Mongo write, but resolve the existing user doc
            // so the rest of the (Mongo-built) login flow can proceed safely.
            const existing = await db.collection('users').findOne({ email: decodedToken.email });
            if (!existing) {
                throw new Error('Could not find user profile after login (pg-only).');
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
        await db.collection('login_attempts').insertOne({
            userId: user._id,
            ip: reqIp,
            userAgent: reqUserAgent,
            status: challenge.requires2fa ? 'pending_2fa' : 'success',
            createdAt: now
        });

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
