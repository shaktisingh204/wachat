import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { verifyFirebaseIdToken, createSessionToken } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { checkRequires2fa } from '@/app/actions/two-fa.actions';
import type { User, WithId, SessionPayload } from '@/lib/definitions';
import { ObjectId } from 'mongodb';

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
        
        const user = updateResult as WithId<User>;

        console.log('[API_SESSION] User upserted successfully.');

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
        console.error('[API_SESSION] Session creation failed:', error);
        return new Response(`Authentication error: ${error.message}`, { status: 401 });
    }
}
