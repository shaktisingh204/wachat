import 'server-only';

/**
 * Client for the SabCall voice engine (`services/sabcall-engine`, an Asterisk
 * ARI control plane). The engine exposes a small HTTP surface for outbound
 * origination, hangup, and per-tenant pjsip config. Gated by `SABCALL_ENABLED`
 * on the engine side; here we just point at it via env and forward the bearer.
 *
 * Mirrors the SabSMS/SabMail engine-client convention.
 */

const ENGINE_URL =
  process.env.SABCALL_ENGINE_URL ?? 'http://localhost:4005';
const ENGINE_TOKEN = process.env.SABCALL_ENGINE_TOKEN ?? '';

export const sabcallEngineEnabled = (): boolean =>
  (process.env.SABCALL_ENABLED ?? 'false').toLowerCase() === 'true';

async function engineFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (ENGINE_TOKEN) headers.set('Authorization', `Bearer ${ENGINE_TOKEN}`);
  const res = await fetch(`${ENGINE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SabCall engine ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface OriginateInput {
  /** SabCall project (tenant) id. */
  tenant: string;
  /** Destination number or full ARI endpoint. */
  to: string;
  callerId?: string;
}

export const sabcallEngine = {
  health: () => engineFetch<{ status: string; enabled: boolean; app: string }>('/health'),

  originate: (input: OriginateInput) =>
    engineFetch<{ channelId: string }>('/v1/originate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  hangup: (channelId: string) =>
    engineFetch<{ hungUp: boolean }>(
      `/v1/channels/${encodeURIComponent(channelId)}/hangup`,
      { method: 'POST' },
    ),

  /** List all live channels (the agent console). */
  listChannels: () => engineFetch<unknown[]>('/v1/channels'),

  hold: (channelId: string, held: boolean) =>
    engineFetch<{ held: boolean }>(
      `/v1/channels/${encodeURIComponent(channelId)}/hold`,
      { method: held ? 'POST' : 'DELETE' },
    ),

  mute: (channelId: string, muted: boolean, direction: 'in' | 'out' | 'both' = 'both') =>
    engineFetch<{ muted: boolean }>(
      `/v1/channels/${encodeURIComponent(channelId)}/mute?direction=${direction}`,
      { method: muted ? 'POST' : 'DELETE' },
    ),

  transfer: (channelId: string, endpoint: string) =>
    engineFetch<{ transferred: boolean }>(
      `/v1/channels/${encodeURIComponent(channelId)}/transfer`,
      { method: 'POST', body: JSON.stringify({ endpoint }) },
    ),

  /** Supervisor coaching: mode = monitor (listen) | whisper (to agent) | barge (both). */
  snoop: (channelId: string, mode: 'monitor' | 'whisper' | 'barge') =>
    engineFetch<{ id?: string }>(
      `/v1/channels/${encodeURIComponent(channelId)}/snoop`,
      { method: 'POST', body: JSON.stringify({ mode }) },
    ),

  record: (channelId: string, name?: string, maxSeconds?: number) =>
    engineFetch<{ name?: string }>(
      `/v1/channels/${encodeURIComponent(channelId)}/record`,
      { method: 'POST', body: JSON.stringify({ name, maxSeconds }) },
    ),

  /** Rendered pjsip.conf text for a tenant's trunks + credentials. */
  pjsipConf: async (tenant: string): Promise<string> => {
    const headers = new Headers();
    if (ENGINE_TOKEN) headers.set('Authorization', `Bearer ${ENGINE_TOKEN}`);
    const res = await fetch(
      `${ENGINE_URL}/v1/tenants/${encodeURIComponent(tenant)}/pjsip.conf`,
      { headers, cache: 'no-store' },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SabCall engine ${res.status}: ${text || res.statusText}`);
    }
    return res.text();
  },
};
