import 'server-only';

/**
 * Push registration for connected mailboxes — Gmail `users.watch` (Pub/Sub) and
 * Microsoft Graph change subscriptions. Both are armed on OAuth connect and
 * re-armed by the renewal cron (`/api/cron/sabmail-watch-renewal`).
 *
 * Fully env-gated + best-effort: a missing Pub/Sub topic, unreachable
 * notification URL, or unconfigured OAuth all return `{ ok:false, skipped }`
 * without throwing, so connecting a mailbox never fails just because push
 * isn't wired on this environment yet (push needs a PUBLIC app URL + topic).
 */

import { randomBytes } from 'crypto';
import { google } from 'googleapis';

import { resolveSabmailOAuthConfig, type SabmailOAuthProvider } from './oauth';

export interface PushResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  /** Gmail: the historyId to seed `syncCursor`. */
  historyId?: string;
  /** Graph: the created/renewed subscription id + expiry + per-sub clientState secret. */
  subscriptionId?: string;
  expiry?: string;
  clientState?: string;
}

/** Graph caps message subscriptions at ~4230 min; renew with a safety margin. */
const GRAPH_TTL_MIN = 4230 - 30;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function graphExpiry(): string {
  return new Date(Date.now() + GRAPH_TTL_MIN * 60_000).toISOString();
}

export async function registerGmailWatch(refreshToken: string): Promise<PushResult> {
  const topic = process.env.SABMAIL_GMAIL_PUBSUB_TOPIC;
  if (!topic) return { ok: false, skipped: true, error: 'SABMAIL_GMAIL_PUBSUB_TOPIC not set' };
  const config = resolveSabmailOAuthConfig('gmail');
  if (!config) return { ok: false, skipped: true, error: 'Gmail OAuth not configured' };
  try {
    const oauth2 = new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
    oauth2.setCredentials({ refresh_token: refreshToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2 });
    const res = await gmail.users.watch({
      userId: 'me',
      requestBody: { topicName: topic, labelIds: ['INBOX'], labelFilterBehavior: 'include' },
    });
    return { ok: true, historyId: res.data.historyId ?? undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Authority used to mint Graph tokens — MUST match the runtime adapter
 * (providers/graph.ts) so single-tenant Azure apps refresh in BOTH paths.
 */
function graphAuthority(tenantId?: string): string {
  const env = process.env.SABMAIL_MS_AUTHORITY;
  if (env) return env.replace(/\/$/, '');
  return `https://login.microsoftonline.com/${tenantId || 'common'}`;
}

/** Mint a Graph access token directly against the account's tenant (not /common-by-default). */
async function graphAccessToken(refreshToken: string, tenantId?: string): Promise<string | null> {
  const config = resolveSabmailOAuthConfig('outlook');
  if (!config) return null;
  try {
    const res = await fetch(`${graphAuthority(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'https://graph.microsoft.com/.default',
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string };
    return body.access_token ?? null;
  } catch {
    return null;
  }
}

export async function registerGraphSubscription(
  refreshToken: string,
  tenantId?: string,
): Promise<PushResult> {
  const config = resolveSabmailOAuthConfig('outlook');
  if (!config) return { ok: false, skipped: true, error: 'Outlook OAuth not configured' };
  const token = await graphAccessToken(refreshToken, tenantId);
  if (!token) return { ok: false, error: 'Could not mint a Graph access token' };
  const expiry = graphExpiry();
  const clientState = randomBytes(24).toString('hex');
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'created',
        notificationUrl: `${appUrl()}/api/push/outlook`,
        resource: "/me/mailFolders('inbox')/messages",
        expirationDateTime: expiry,
        clientState,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: `Graph subscription ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    const body = (await res.json()) as { id?: string; expirationDateTime?: string };
    return { ok: true, subscriptionId: body.id, expiry: body.expirationDateTime ?? expiry, clientState };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function renewGraphSubscription(
  refreshToken: string,
  subscriptionId: string,
  tenantId?: string,
): Promise<PushResult> {
  const token = await graphAccessToken(refreshToken, tenantId);
  if (!token) return { ok: false, error: 'Could not mint a Graph access token' };
  const expiry = graphExpiry();
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationDateTime: expiry }),
      },
    );
    // Gone (expired/deleted) → recreate from scratch (new clientState).
    if (res.status === 404) return registerGraphSubscription(refreshToken, tenantId);
    if (!res.ok) return { ok: false, error: `Graph renew ${res.status}` };
    // Trust the SERVER's clamped expiry, not our locally-computed one.
    const body = (await res.json().catch(() => ({}))) as { expirationDateTime?: string };
    return { ok: true, subscriptionId, expiry: body.expirationDateTime ?? expiry };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Arm push for a freshly-connected account. Returns the doc fields to persist
 * (syncCursor for Gmail; graphSubscriptionId/expiry for Outlook). Never throws.
 */
export async function registerPushForAccount(
  provider: SabmailOAuthProvider,
  refreshToken: string,
  opts?: { tenantId?: string },
): Promise<{
  ok: boolean;
  skipped?: boolean;
  error?: string;
  fields: Partial<{
    syncCursor: string;
    graphSubscriptionId: string;
    graphSubscriptionExpiry: string;
    graphSubscriptionSecret: string;
  }>;
}> {
  if (provider === 'gmail') {
    const r = await registerGmailWatch(refreshToken);
    return {
      ok: r.ok,
      skipped: r.skipped,
      error: r.error,
      fields: r.historyId ? { syncCursor: r.historyId } : {},
    };
  }
  const r = await registerGraphSubscription(refreshToken, opts?.tenantId);
  return {
    ok: r.ok,
    skipped: r.skipped,
    error: r.error,
    fields:
      r.subscriptionId && r.expiry
        ? {
            graphSubscriptionId: r.subscriptionId,
            graphSubscriptionExpiry: r.expiry,
            ...(r.clientState ? { graphSubscriptionSecret: r.clientState } : {}),
          }
        : {},
  };
}
