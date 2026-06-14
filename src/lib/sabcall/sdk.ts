/**
 * SabCall public REST SDK — isomorphic (browser + Node + edge), zero deps.
 *
 * Talks to the SabCall public API at `<baseUrl>/api/v1/sabcall/*`, authenticated
 * with a SabNode API key (`Authorization: Bearer <apiKey>`). No `server-only`
 * import on purpose — this module is safe to import from client components,
 * route handlers, scripts, or third-party apps.
 *
 * @example
 * import { createSabCallClient } from '@/lib/sabcall/sdk';
 * const client = createSabCallClient({ baseUrl: 'https://app.sabnode.com', apiKey: 'sk_live_…' });
 * const { channelId } = await client.placeCall(projectId, '+15551234567');
 */

export interface SabCallClientOptions {
  /** Base origin of the SabNode app, e.g. `https://app.sabnode.com` (no trailing path needed). */
  baseUrl: string;
  /** SabNode API key with `calls:read` / `calls:write` scopes. Sent as a Bearer token. */
  apiKey: string;
}

export interface PlaceCallResult {
  channelId: string;
}

export interface ListCallsResult {
  calls: unknown[];
}

export interface ListContactsResult {
  contacts: unknown[];
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  company?: string;
  vip?: boolean;
}

export interface CreateContactResult {
  id: string;
}

export class SabCallClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(opts: SabCallClientOptions) {
    // Trim a trailing slash so `${baseUrl}/api/...` never doubles up.
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.apiKey = opts.apiKey;
  }

  /**
   * Internal fetch helper: attaches Bearer auth + JSON headers and throws on
   * any non-2xx response, surfacing the HTTP status and response body text.
   */
  private async request<T>(
    path: string,
    init?: { method?: string; body?: unknown; query?: Record<string, string | number | undefined> },
  ): Promise<T> {
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${this.apiKey}`);
    headers.set('Accept', 'application/json');

    let url = `${this.baseUrl}${path}`;
    if (init?.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(init.query)) {
        if (value === undefined) continue;
        params.set(key, String(value));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const requestInit: RequestInit = {
      method: init?.method ?? 'GET',
      headers,
      cache: 'no-store',
    };
    if (init?.body !== undefined) {
      headers.set('Content-Type', 'application/json');
      requestInit.body = JSON.stringify(init.body);
    }

    const res = await fetch(url, requestInit);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`SabCall API ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  /**
   * Place an outbound call.
   * `POST /api/v1/sabcall/calls`
   */
  placeCall(projectId: string, to: string, callerId?: string): Promise<PlaceCallResult> {
    return this.request<PlaceCallResult>('/api/v1/sabcall/calls', {
      method: 'POST',
      body: { projectId, to, ...(callerId !== undefined ? { callerId } : {}) },
    });
  }

  /**
   * List recent calls for a project.
   * `GET /api/v1/sabcall/calls`
   */
  listCalls(projectId: string, opts?: { limit?: number }): Promise<ListCallsResult> {
    return this.request<ListCallsResult>('/api/v1/sabcall/calls', {
      query: { projectId, limit: opts?.limit },
    });
  }

  /**
   * Search / list contacts for a project.
   * `GET /api/v1/sabcall/contacts`
   */
  listContacts(
    projectId: string,
    opts?: { q?: string; limit?: number },
  ): Promise<ListContactsResult> {
    return this.request<ListContactsResult>('/api/v1/sabcall/contacts', {
      query: { projectId, q: opts?.q, limit: opts?.limit },
    });
  }

  /**
   * Create a contact.
   * `POST /api/v1/sabcall/contacts`
   */
  createContact(projectId: string, input: CreateContactInput): Promise<CreateContactResult> {
    return this.request<CreateContactResult>('/api/v1/sabcall/contacts', {
      method: 'POST',
      body: { projectId, ...input },
    });
  }
}

/** Convenience factory mirroring the rest of the SabNode SDK conventions. */
export function createSabCallClient(opts: SabCallClientOptions): SabCallClient {
  return new SabCallClient(opts);
}
