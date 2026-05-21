/**
 * GET /api/integrations/quickbooks/connect
 *
 * Starts the QuickBooks OAuth 2.0 (Authorization Code) flow. Reads the
 * tenant's saved `client_id` + `redirect_uri` from
 * `crm_quickbooks_settings`, generates a CSRF state, stores it in a
 * short-lived httpOnly cookie, and 302s the browser to Intuit.
 */
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/app/actions/user.actions';
import {
  buildAuthorizeUrl,
  resolveRedirectUri,
  QUICKBOOKS_SCOPE,
} from '@/lib/integrations/quickbooks/auth';
import { getSettings } from '@/lib/integrations/quickbooks/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'qbo_oauth_state';
const STATE_TTL_SECONDS = 600; // 10 minutes

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session?.user?._id) {
      console.warn('[qbo/connect] no session');
      return NextResponse.redirect(
        new URL(
          '/login?error=qbo_no_session',
          process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        ),
      );
    }
    const userId = String(session.user._id);
    if (!ObjectId.isValid(userId)) {
      console.warn('[qbo/connect] invalid session user id');
      return NextResponse.json(
        { error: 'Invalid session user' },
        { status: 400 },
      );
    }

    const setting = await getSettings(new ObjectId(userId));
    if (!setting?.client_id) {
      console.warn('[qbo/connect] missing client_id for tenant', userId);
      return NextResponse.redirect(
        new URL(
          '/dashboard/crm/settings/integrations/quickbooks?error=missing_credentials',
          process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        ),
      );
    }

    const redirectUri = await resolveRedirectUri();
    // CSRF state encodes the tenant so the callback can recover the user
    // even if the cookie was eaten by a strict third-party policy.
    const nonce = randomBytes(16).toString('hex');
    const state = `${userId}.${nonce}`;

    const url = buildAuthorizeUrl({
      clientId: setting.client_id,
      redirectUri,
      state,
      scope: QUICKBOOKS_SCOPE,
    });

    const jar = await cookies();
    jar.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: STATE_TTL_SECONDS,
    });

    console.info('[qbo/connect] redirecting tenant', userId, 'to Intuit');
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[qbo/connect] unexpected error:', msg);
    return NextResponse.redirect(
      new URL(
        '/dashboard/crm/settings/integrations/quickbooks?error=connect_failed',
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      ),
    );
  }
}
