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
    if (!result.ok) {
      return new Response(result.error ?? 'Invalid code.', { status: 401 });
    }

    // Load fresh user, mint the real session.
    const { db } = await connectToDatabase();
    const user = (await db
      .collection('users')
      .findOne({ _id: new ObjectId(userId) })) as WithId<User> | null;
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
