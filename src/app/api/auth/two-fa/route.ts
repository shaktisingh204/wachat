/**
 * Completes a login that was paused at the 2FA challenge.
 *
 * Flow:
 *   1. /api/auth/session verifies the Firebase ID token. If the user
 *      has `twoFactorEnabled === true`, it returns `{ requires2fa: true }`
 *      and sets a 5-minute `session_pending_2fa` cookie carrying the userId.
 *   2. The client posts the 6-digit code (or a backup code) here.
 *   3. On success we verify the code, mint the real session cookie, and
 *      delete the pending cookie.
 */
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { verifyJwt, createSessionToken } from '@/lib/auth';
import { sessionCookieOptions } from '@/lib/cookies';
import { verifyTwoFactorChallenge } from '@/app/actions/two-fa.actions';
import type { SessionPayload, User, WithId } from '@/lib/definitions';
// C4 flags + C2 PG user store for the staged Mongo→Postgres auth migration.
// Defaults (mongo) keep the post-2FA session mint byte-identical to today.
import { authPgRead } from '@/lib/identity/auth-flags';
import { pgUserStore } from '@/lib/identity/pg-stores';

const SESSION_DURATION_S = 7 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const pending = request.cookies.get('session_pending_2fa')?.value;
    if (!pending) {
      return new Response('No pending 2FA challenge.', { status: 401 });
    }
    const decoded = await verifyJwt(pending);
    const userId = (decoded as any)?.userId as string | undefined;
    if (!userId || !ObjectId.isValid(userId)) {
      return new Response('Invalid pending session.', { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { code?: string };
    const code = (body.code ?? '').toString().trim();
    if (!code) return new Response('Code required.', { status: 400 });

    const result = await verifyTwoFactorChallenge(userId, code);

    const reqIp = request.headers.get('x-forwarded-for') || request.ip || 'Unknown';
    const reqUserAgent = request.headers.get('user-agent') || 'Unknown';
    const now = new Date();
    const { db } = await connectToDatabase();
    await db.collection('login_attempts').insertOne({
        userId: new ObjectId(userId),
        ip: reqIp,
        userAgent: reqUserAgent,
        status: result.ok ? 'success' : 'failed',
        createdAt: now
    });

    if (!result.ok) {
      return new Response(result.error ?? 'Invalid code.', { status: 401 });
    }

    // Load fresh user, mint the real session.
    // In strict 'pg' mode the user is sourced from Postgres (the profile JSONB
    // rebuilds the legacy Mongo shape via getFullByMongoId); any miss/error
    // falls back to the Mongo read so login can never be locked out. In every
    // other mode behaviour is byte-identical to the prior Mongo-only lookup.
    let user: WithId<User> | null = null;
    if (authPgRead() === 'pg') {
      try {
        const pgRow = await pgUserStore.getFullByMongoId(userId);
        const profile = (pgRow?.profile ?? null) as Record<string, any> | null;
        if (profile) {
          // Rebuild the legacy doc: profile carries _id as a string; restore the
          // ObjectId so the rest of the flow (session payload) is unchanged.
          user = {
            ...(profile as any),
            _id: new ObjectId(userId),
            email: profile.email ?? pgRow!.email,
          } as WithId<User>;
        }
      } catch (pgErr) {
        console.error('[API_TWO_FA] Postgres user read failed, falling back to Mongo:', pgErr);
      }
    }
    if (!user) {
      user = (await db
        .collection('users')
        .findOne({ _id: new ObjectId(userId) })) as WithId<User> | null;
    }
    if (!user) return new Response('User not found.', { status: 404 });

    const sessionPayload: Omit<SessionPayload, 'jti' | 'exp'> = ({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      isApproved: (user as any).isApproved || false,
    } as any);
    const token = await createSessionToken(sessionPayload as any);

    const resp = NextResponse.json({ success: true, user });
    resp.cookies.set('session', token, sessionCookieOptions(SESSION_DURATION_S));
    // Clear the pending cookie.
    resp.cookies.set('session_pending_2fa', '', {
      ...sessionCookieOptions(0),
      maxAge: 0,
    });
    return resp;
  } catch (err) {
    console.error('[API_TWO_FA] failed:', err);
    return new Response('Server error', { status: 500 });
  }
}
