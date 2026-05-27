'use server';

/**
 * Server actions for the developer-platform dashboard pages.
 *
 * Every action proxies through the Rust BFF so RBAC + tenancy are
 * enforced server-side. Plain-text secrets (API key, PAT token, OAuth
 * client secret, webhook secret) are returned to the caller exactly
 * once — the dashboard surfaces them inline and the user is expected
 * to copy/store them immediately.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { rustClient, RustApiError } from '@/lib/rust-client';
import { rustFetch } from '@/lib/rust-client/fetcher';

type Ok<T> = { success: true } & T;
type Err = { success: false; error: string };

function failed(error: unknown, fallback: string): Err {
  if (error instanceof RustApiError) {
    return { success: false, error: error.message || fallback };
  }
  if (error instanceof Error) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

async function requireSession(): Promise<{ ok: true } | Err> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Authentication required.' };
  return { ok: true };
}

/* ── API keys ──────────────────────────────────────────────────────────── */

export async function listDeveloperKeys(): Promise<Ok<{ keys: unknown[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const keys = await rustClient.wachatApiKeysAdmin.list();
    return { success: true, keys };
  } catch (e) {
    return failed(e, 'Failed to list API keys.');
  }
}

export async function createDeveloperKey(
  name: string,
  scopes?: string[],
): Promise<Ok<{ apiKey?: string; keyId?: string }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustClient.wachatApiKeysAdmin.generate({ name, scopes });
    revalidatePath('/dashboard/api/keys');
    return { success: true, apiKey: res.apiKey, keyId: res.keyId };
  } catch (e) {
    return failed(e, 'Failed to generate API key.');
  }
}

export async function revokeDeveloperKey(keyId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustClient.wachatApiKeysAdmin.revoke(keyId);
    if (!res.success) return { success: false, error: res.error || 'Revoke failed.' };
    revalidatePath('/dashboard/api/keys');
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to revoke API key.');
  }
}

/* ── Personal Access Tokens ─────────────────────────────────────────────── */

export async function listPersonalTokens(): Promise<Ok<{ tokens: unknown[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const tokens = await rustClient.developerPersonalTokens.list();
    return { success: true, tokens };
  } catch (e) {
    return failed(e, 'Failed to list personal access tokens.');
  }
}

export async function createPersonalToken(
  name: string,
  scopes?: string[],
  expiresAt?: string,
): Promise<Ok<{ token?: string; tokenId?: string }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustClient.developerPersonalTokens.generate({ name, scopes, expiresAt });
    revalidatePath('/dashboard/api/personal-tokens');
    return { success: true, token: res.token, tokenId: res.tokenId };
  } catch (e) {
    return failed(e, 'Failed to generate PAT.');
  }
}

export async function revokePersonalToken(tokenId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustClient.developerPersonalTokens.revoke(tokenId);
    if (!res.success) return { success: false, error: res.error || 'Revoke failed.' };
    revalidatePath('/dashboard/api/personal-tokens');
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to revoke PAT.');
  }
}

/* ── OAuth apps ─────────────────────────────────────────────────────────── */

interface OAuthAppRow {
  _id: string;
  name: string;
  description?: string;
  clientId: string;
  redirectUris: string[];
  scopes: string[];
  createdAt: string;
}

export async function listOAuthApps(): Promise<Ok<{ apps: OAuthAppRow[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustFetch<{ data: OAuthAppRow[] }>('/v1/oauth/apps');
    return { success: true, apps: res.data ?? [] };
  } catch (e) {
    return failed(e, 'Failed to list OAuth apps.');
  }
}

export async function registerOAuthApp(input: {
  name: string;
  redirectUris: string[];
  scopes: string[];
  description?: string;
}): Promise<Ok<{ app: OAuthAppRow; clientSecret: string }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustFetch<{ app: OAuthAppRow; clientSecret: string }>('/v1/oauth/apps', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    revalidatePath('/dashboard/api/apps');
    return { success: true, app: res.app, clientSecret: res.clientSecret };
  } catch (e) {
    return failed(e, 'Failed to register OAuth app.');
  }
}

export async function deleteOAuthApp(appId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    await rustFetch(`/v1/oauth/apps/${encodeURIComponent(appId)}`, { method: 'DELETE' });
    revalidatePath('/dashboard/api/apps');
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to delete OAuth app.');
  }
}

/* ── Webhooks ──────────────────────────────────────────────────────────── */

interface WebhookSubscription {
  _id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused' | 'failed';
  description?: string;
  createdAt: string;
  lastDeliveryAt?: string;
  consecutiveFailures: number;
}

interface WebhookDelivery {
  _id: string;
  subscriptionId: string;
  event: string;
  status: 'pending' | 'success' | 'failed';
  attempts: number;
  responseStatus?: number | null;
  lastError?: string | null;
  createdAt: string;
  finishedAt?: string;
  nextAttemptAt?: string;
}

export async function listWebhookSubscriptions(): Promise<
  Ok<{ subs: WebhookSubscription[] }> | Err
> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustFetch<{ data: WebhookSubscription[] }>(
      '/v1/developer-webhooks/subscriptions',
    );
    return { success: true, subs: res.data ?? [] };
  } catch (e) {
    return failed(e, 'Failed to list webhook subscriptions.');
  }
}

export async function createWebhookSubscription(input: {
  url: string;
  events: string[];
  description?: string;
}): Promise<Ok<{ sub: WebhookSubscription; secret: string }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const res = await rustFetch<{ subscription: WebhookSubscription; secret: string }>(
      '/v1/developer-webhooks/subscriptions',
      { method: 'POST', body: JSON.stringify(input) },
    );
    revalidatePath('/dashboard/api/webhooks');
    return { success: true, sub: res.subscription, secret: res.secret };
  } catch (e) {
    return failed(e, 'Failed to create webhook subscription.');
  }
}

export async function deleteWebhookSubscription(subId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    await rustFetch(`/v1/developer-webhooks/subscriptions/${encodeURIComponent(subId)}`, {
      method: 'DELETE',
    });
    revalidatePath('/dashboard/api/webhooks');
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to delete webhook subscription.');
  }
}

export async function testWebhookSubscription(subId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    await rustFetch(`/v1/developer-webhooks/subscriptions/${encodeURIComponent(subId)}/test`, {
      method: 'POST',
    });
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to enqueue test delivery.');
  }
}

export async function listWebhookDeliveries(
  subId?: string,
  limit = 50,
): Promise<Ok<{ deliveries: WebhookDelivery[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const qs = new URLSearchParams();
    if (subId) qs.set('subscriptionId', subId);
    qs.set('limit', String(limit));
    const res = await rustFetch<{ data: WebhookDelivery[] }>(
      `/v1/developer-webhooks/deliveries?${qs.toString()}`,
    );
    return { success: true, deliveries: res.data ?? [] };
  } catch (e) {
    return failed(e, 'Failed to list webhook deliveries.');
  }
}

export async function retryWebhookDelivery(deliveryId: string): Promise<Ok<{}> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    await rustFetch(`/v1/developer-webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`, {
      method: 'POST',
    });
    revalidatePath('/dashboard/api/webhooks');
    return { success: true };
  } catch (e) {
    return failed(e, 'Failed to retry webhook delivery.');
  }
}

/* ── Usage analytics ───────────────────────────────────────────────────── */

interface UsageSummary {
  from: string;
  to: string;
  totalRequests: number;
  errorRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

interface UsageTopRow {
  path: string;
  method: string;
  count: number;
  errorCount: number;
  avgLatencyMs: number;
}

interface UsageByKeyRow {
  keyId: string;
  kind: string;
  env: string;
  count: number;
  errorCount: number;
  lastUsedAt?: string;
}

interface UsageLogRow {
  _id: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  keyId: string;
  kind: string;
  env: string;
  requestId?: string;
  errorType?: string;
  userAgent?: string;
  ts: string;
}

export async function getUsageSummary(opts?: {
  from?: string;
  to?: string;
}): Promise<Ok<UsageSummary> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    const path = `/v1/usage/summary${qs.toString() ? '?' + qs : ''}`;
    const res = await rustFetch<UsageSummary>(path);
    return { success: true, ...res };
  } catch (e) {
    return failed(e, 'Failed to load usage summary.');
  }
}

export async function getUsageTop(opts?: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Ok<{ rows: UsageTopRow[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const path = `/v1/usage/top${qs.toString() ? '?' + qs : ''}`;
    const res = await rustFetch<{ data: UsageTopRow[] }>(path);
    return { success: true, rows: res.data ?? [] };
  } catch (e) {
    return failed(e, 'Failed to load top endpoints.');
  }
}

export async function getUsageByKey(opts?: {
  from?: string;
  to?: string;
}): Promise<Ok<{ rows: UsageByKeyRow[] }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    const path = `/v1/usage/by-key${qs.toString() ? '?' + qs : ''}`;
    const res = await rustFetch<{ data: UsageByKeyRow[] }>(path);
    return { success: true, rows: res.data ?? [] };
  } catch (e) {
    return failed(e, 'Failed to load per-key usage.');
  }
}

export async function getUsageLogs(opts?: {
  from?: string;
  to?: string;
  keyId?: string;
  path?: string;
  minStatus?: number;
  cursor?: string;
  limit?: number;
}): Promise<Ok<{ rows: UsageLogRow[]; nextCursor: string | null }> | Err> {
  const auth = await requireSession();
  if ('error' in auth) return auth;
  try {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set('from', opts.from);
    if (opts?.to) qs.set('to', opts.to);
    if (opts?.keyId) qs.set('keyId', opts.keyId);
    if (opts?.path) qs.set('path', opts.path);
    if (opts?.minStatus != null) qs.set('minStatus', String(opts.minStatus));
    if (opts?.cursor) qs.set('cursor', opts.cursor);
    if (opts?.limit) qs.set('limit', String(opts.limit));
    const path = `/v1/usage/logs${qs.toString() ? '?' + qs : ''}`;
    const res = await rustFetch<{ data: UsageLogRow[]; nextCursor: string | null }>(path);
    return { success: true, rows: res.data ?? [], nextCursor: res.nextCursor ?? null };
  } catch (e) {
    return failed(e, 'Failed to load logs.');
  }
}
