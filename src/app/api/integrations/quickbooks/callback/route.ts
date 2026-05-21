/**
 * GET /api/integrations/quickbooks/callback?code=…&state=…&realmId=…
 *
 * Intuit redirects the browser here at the end of the OAuth dance.
 * Steps:
 *   1. Verify the `state` matches the cookie set by `/connect`
 *   2. Recover the tenant id from the state (`<userId>.<nonce>`)
 *   3. POST to the token endpoint to swap `code` → tokens
 *   4. Persist `access_token`, `refresh_token`, `expires_at`,
 *      `realmId`, and flip `connected: true`
 *   5. 302 back to the settings page
 */
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import {
  decryptClientSecret,
  exchangeCodeForTokens,
  resolveRedirectUri,
} from '@/lib/integrations/quickbooks/auth';
import {
  appendSyncLog,
  getSettings,
  upsertSettings,
} from '@/lib/integrations/quickbooks/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const STATE_COOKIE = 'qbo_oauth_state';
const SETTINGS_PAGE = '/dashboard/crm/settings/integrations/quickbooks';

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function redirectWithError(code: string): NextResponse {
  return NextResponse.redirect(new URL(`${SETTINGS_PAGE}?error=${code}`, appUrl()));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = req.nextUrl;
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const realmId = url.searchParams.get('realmId');
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      console.warn('[qbo/callback] Intuit returned error:', errorParam);
      return redirectWithError('oauth_denied');
    }
    if (!code || !state || !realmId) {
      console.warn('[qbo/callback] missing required query params');
      return redirectWithError('missing_params');
    }

    const jar = await cookies();
    const cookieState = jar.get(STATE_COOKIE)?.value;
    if (!cookieState || cookieState !== state) {
      console.warn('[qbo/callback] state mismatch');
      return redirectWithError('state_mismatch');
    }
    // One-time use — clear the cookie ASAP.
    jar.delete(STATE_COOKIE);

    // state shape: `<userId>.<nonce>`
    const [userIdRaw] = state.split('.');
    if (!userIdRaw || !ObjectId.isValid(userIdRaw)) {
      console.warn('[qbo/callback] bad userId in state');
      return redirectWithError('bad_state');
    }
    const userId = new ObjectId(userIdRaw);

    const setting = await getSettings(userId);
    if (!setting?.client_id || !setting.client_secret_enc) {
      console.warn('[qbo/callback] credentials missing at callback time');
      return redirectWithError('missing_credentials');
    }
    const clientSecret = decryptClientSecret(setting);
    if (!clientSecret) {
      return redirectWithError('decrypt_failed');
    }

    const redirectUri = await resolveRedirectUri();
    const tokens = await exchangeCodeForTokens({
      code,
      redirectUri,
      clientId: setting.client_id,
      clientSecret,
    });

    const now = Date.now();
    await upsertSettings(userId, {
      realmId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: now + tokens.expires_in * 1000,
      refresh_token_expires_at:
        now + tokens.x_refresh_token_expires_in * 1000,
      connected: true,
      connectedAt: new Date(),
    });

    await appendSyncLog(userId, {
      action: 'oauth',
      entity: 'connection',
      status: 'success',
      quickbooksId: realmId,
    });

    console.info('[qbo/callback] tenant', String(userId), 'connected realm', realmId);
    return NextResponse.redirect(new URL(`${SETTINGS_PAGE}?connected=1`, appUrl()));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[qbo/callback] unexpected error:', msg);
    return redirectWithError('callback_failed');
  }
}
