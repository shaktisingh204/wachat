'use server';

/**
 * WaChat 2026 Meta-capability server actions — the UI-facing layer for the new
 * Phase-0D Rust crates (MM Lite marketing, carousels, BSUID identity,
 * interactive CTA/location, Calling call-log).
 *
 * These call the Rust endpoints directly via `rustFetchAsUser` (the WaChat UI
 * path), NOT the public `/api/v1` api-platform routes (which are API-key auth
 * for external partners). Tenancy: the Rust crates check
 * `user.tenant_id == project.user_id`, so we pass the signed-in user's id as
 * the tenant. Every action is async + returns `{ ok, data | error }`.
 */

import { getCachedSession } from '@/lib/server-cache';
import { rustFetchAsUser } from '@/lib/api-platform/rust-as-user';

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function tenantId(): Promise<string> {
  const session = await getCachedSession();
  const id = session?.user?._id;
  if (!id) throw new Error('Not authenticated');
  return String(id);
}

async function call<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ActionResult<T>> {
  try {
    const tid = await tenantId();
    const data = await rustFetchAsUser<T>(tid, path, {
      method: init?.method ?? 'GET',
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Request failed' };
  }
}

/* ── MM Lite / Marketing ──────────────────────────────────────────────── */

export interface MarketingSendInput {
  phoneNumberId: string;
  to: string;
  templateName: string;
  language: string;
  components?: unknown;
  ttlSeconds?: number;
  trackingId?: string;
  aiOptimized?: boolean;
}

export async function sendMarketingTemplate(projectId: string, input: MarketingSendInput) {
  return call<{ messageId: string | null; campaignId: string }>(
    `/v1/wachat/marketing/projects/${projectId}/send`,
    { method: 'POST', body: input },
  );
}

export async function listMarketingCampaigns(projectId: string) {
  return call<{ campaigns: unknown[] }>(`/v1/wachat/marketing/projects/${projectId}/campaigns`);
}

/* ── Carousels ────────────────────────────────────────────────────────── */

export async function createCarouselTemplate(
  projectId: string,
  input: { name: string; language: string; category: string; components: unknown },
) {
  return call<{ templateId: string | null }>(
    `/v1/wachat/carousel/projects/${projectId}/templates`,
    { method: 'POST', body: input },
  );
}

export async function sendCarousel(
  projectId: string,
  input: { phoneNumberId: string; to: string; templateName: string; language: string; components: unknown },
) {
  return call<{ messageId: string | null; carouselId: string }>(
    `/v1/wachat/carousel/projects/${projectId}/send`,
    { method: 'POST', body: input },
  );
}

export async function listSentCarousels(projectId: string) {
  return call<{ carousels: unknown[] }>(`/v1/wachat/carousel/projects/${projectId}/sent`);
}

/* ── BSUID identity ───────────────────────────────────────────────────── */

export async function resolveBsuidContact(
  projectId: string,
  input: { bsuid?: string; phone?: string; name?: string },
) {
  return call<{ contact: unknown; created: boolean }>(
    `/v1/wachat/identity/projects/${projectId}/resolve`,
    { method: 'POST', body: input },
  );
}

/* ── Interactive (CTA-URL / location / passthrough) ───────────────────── */

export async function sendCtaUrl(
  projectId: string,
  input: {
    phoneNumberId: string;
    to: string;
    bodyText: string;
    displayText: string;
    url: string;
    headerText?: string;
    footerText?: string;
  },
) {
  return call<{ messageId: string | null }>(
    `/v1/wachat/interactive/projects/${projectId}/cta-url`,
    { method: 'POST', body: input },
  );
}

export async function sendLocationRequest(
  projectId: string,
  input: { phoneNumberId: string; to: string; bodyText: string },
) {
  return call<{ messageId: string | null }>(
    `/v1/wachat/interactive/projects/${projectId}/location-request`,
    { method: 'POST', body: input },
  );
}

export async function sendInteractive(
  projectId: string,
  input: { phoneNumberId: string; to: string; interactive: unknown },
) {
  return call<{ messageId: string | null }>(
    `/v1/wachat/interactive/projects/${projectId}/send`,
    { method: 'POST', body: input },
  );
}

/* ── Calling call-log ─────────────────────────────────────────────────── */

export async function listCallEvents(projectId: string) {
  return call<{ calls: unknown[] }>(`/v1/wachat/webhook-calls/projects/${projectId}/calls`);
}
