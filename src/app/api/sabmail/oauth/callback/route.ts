/**
 * SabMail OAuth callback — finish the Gmail/Outlook connect flow.
 *
 * Verifies the signed state, exchanges the code for tokens, resolves the
 * connected mailbox address, encrypts ONLY the refresh token onto a
 * `sabmail_accounts` doc (the shape the provider adapters consume), best-effort
 * arms push (Gmail watch / Graph subscription), marks the project's connection
 * setup step, and redirects back to the accounts page.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS, ensureSabmailIndexes } from '@/lib/sabmail/db/collections';
import { encryptMailboxCreds, hasMailboxCredsKey } from '@/lib/sabmail/credentials';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  verifySabmailOAuthState,
  resolveSabmailOAuthConfig,
  getSabmailOAuthProvider,
  getSabmailProviderSpec,
  parseMsTenantFromIdToken,
  fetchConnectedEmail,
} from '@/lib/sabmail/oauth';
import { registerPushForAccount } from '@/lib/sabmail/push-registration';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function done(path: string, params: Record<string, string>): NextResponse {
  // Never redirect off-origin (no open redirect via a tampered/odd returnTo).
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/sabmail/accounts';
  const url = new URL(safe, appBase());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const providerError = sp.get('error');
  const code = sp.get('code');
  const stateRaw = sp.get('state');

  if (!stateRaw) return done('/sabmail/accounts', { error: 'oauth-missing-state' });
  const state = await verifySabmailOAuthState(stateRaw);
  if (!state) return done('/sabmail/accounts', { error: 'oauth-bad-state' });

  const { provider, workspaceId, returnTo } = state;
  if (providerError) return done(returnTo, { error: `oauth-denied`, provider });
  if (!code) return done(returnTo, { error: 'oauth-no-code', provider });

  // Bind the flow to the session's currently-selected workspace — a state minted
  // for workspace A can't be redeemed in a session that has since picked B.
  const activeWorkspace = await getSabmailWorkspaceId();
  if (!activeWorkspace || activeWorkspace !== workspaceId) {
    return done(returnTo, { error: 'oauth-workspace-mismatch', provider });
  }

  // Can't persist a refresh token without a creds key — fail BEFORE burning the
  // one-time code (degrade-safe when the key lands in env later).
  if (!hasMailboxCredsKey()) {
    return done(returnTo, { error: 'oauth-creds-key-missing', provider });
  }

  const config = resolveSabmailOAuthConfig(provider);
  const oauthProvider = getSabmailOAuthProvider(provider);
  if (!config || !oauthProvider) return done(returnTo, { error: 'oauth-not-configured', provider });

  // 1) code → tokens
  let refreshToken: string | undefined;
  let accessToken: string | undefined;
  let scope: string | undefined;
  let tenantId: string | undefined;
  try {
    const tokens = await oauthProvider.exchangeCode({ code, config });
    refreshToken = tokens.refreshToken;
    accessToken = tokens.accessToken;
    scope = tokens.scope;
    if (provider === 'outlook') tenantId = parseMsTenantFromIdToken(tokens.idToken);
  } catch {
    return done(returnTo, { error: 'oauth-exchange-failed', provider });
  }
  if (!refreshToken) {
    // Re-consent needed (Google only returns a refresh token on first consent /
    // forced consent; revoke+reconnect to recover).
    return done(returnTo, { error: 'oauth-no-refresh-token', provider });
  }

  // 2) which mailbox did they connect?
  const email = accessToken ? await fetchConnectedEmail(provider, accessToken) : null;
  if (!email) return done(returnTo, { error: 'oauth-email-lookup-failed', provider });

  // 3) best-effort arm push (never blocks the connect)
  let pushFields: Record<string, unknown> = {};
  try {
    const push = await registerPushForAccount(provider, refreshToken, { tenantId });
    pushFields = push.fields;
    if (push.ok) pushFields.pushRenewedAt = new Date();
  } catch {
    /* push is best-effort */
  }

  // 4) persist — encrypt ONLY the refresh token (the shape adapters consume);
  // wrap so a bad key / Mongo hiccup degrades to a redirect, never a 500.
  try {
    const credentialsCipher = encryptMailboxCreds(workspaceId, { refreshToken });
    const now = new Date();
    const { db } = await connectToDatabase();
    await ensureSabmailIndexes();
    await db.collection(SABMAIL_COLLECTIONS.accounts).updateOne(
      { workspaceId, email },
      {
        $set: {
          workspaceId,
          email,
          provider,
          status: 'active',
          credentialsCipher,
          oauthScopes: scope ?? getSabmailProviderSpec(provider).scopes.join(' '),
          lastError: null,
          updatedAt: now,
          ...(tenantId ? { tenantId } : {}),
          ...pushFields,
        },
        // Switching an existing mailbox to OAuth clears IMAP-only fields.
        $unset: { imap: '', smtp: '' },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    if (ObjectId.isValid(workspaceId)) {
      await db
        .collection('projects')
        .updateOne(
          { _id: new ObjectId(workspaceId) },
          { $set: { 'sabmail.setupSteps.connection': true } },
        );
    }
  } catch (err) {
    // E11000 (race) means the matching doc already exists → treat as success.
    const msg = err instanceof Error ? err.message : String(err);
    if (!/E11000|duplicate key/i.test(msg)) {
      return done(returnTo, { error: 'oauth-save-failed', provider });
    }
  }

  try {
    revalidatePath('/sabmail/accounts');
  } catch {
    /* revalidate is best-effort in a route handler */
  }

  // Don't leak the address in the redirect URL — flag only; the page reads the
  // connected mailbox from the accounts list.
  return done(returnTo, { connected: '1', provider });
}
