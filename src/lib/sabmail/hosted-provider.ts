import 'server-only';

/**
 * Stalwart Mail Server — management (admin) API client.
 *
 * Thin, typed wrapper around `fetch()` for Stalwart Mail Server's MANAGEMENT
 * REST API. Stalwart is the MTA/IMAP/JMAP server we run as an EXTERNAL SIDECAR
 * (not the Rust SabMail engine in `services/sabmail-engine/`). This client is
 * what SabMail uses to PROVISION and MANAGE hosted mailboxes on our own domain
 * (create/suspend/delete principals, set passwords, manage aliases + domains).
 *
 * Mirrors `src/lib/sabmail/engine-client.ts` exactly: an env-gated fetch
 * wrapper with a dedicated error class, request timeout, Bearer header auth,
 * and an `isStalwartEnabled()` guard so callers degrade gracefully when the
 * server isn't configured (every method throws a clear {@link StalwartError}).
 *
 *   - `STALWART_ADMIN_URL`     base URL of the management API
 *                              (e.g. `http://127.0.0.1:8085`).
 *   - `STALWART_ADMIN_TOKEN`   admin token, sent as `Authorization: Bearer …`.
 *   - `STALWART_DEFAULT_DOMAIN` default domain hosted mailboxes belong to;
 *                              used to derive `addDomain`/alias defaults.
 *
 * `isStalwartEnabled()` requires BOTH the URL and the token. When disabled,
 * every method throws {@link StalwartError} (status 503) so the calling code
 * can short-circuit and fall back / report a clear "hosted mail not
 * configured" state — exactly like {@link SabmailEngineError} in the engine
 * client.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STALWART MANAGEMENT API — VERSION NOTE
 *
 * Stalwart (v0.7+) models every mail entity as a "principal". A principal has
 * a `type` (`'individual'` for a mailbox, `'group'` for an alias / mailing
 * list / forwarding target, `'domain'` for a hosted domain), a unique `name`
 * (we use the full email address as the name), one or more `emails`, optional
 * `secrets` (passwords / app passwords), `description`, `quota`, and a
 * `disabled` flag (we use it to model suspension).
 *
 * The CRUD endpoints used here target Stalwart's principal management surface:
 *
 *   POST   {base}/api/principal            create a principal
 *   GET    {base}/api/principal/{name}     fetch a principal
 *   PATCH  {base}/api/principal/{name}     mutate fields (RFC-6902-style ops)
 *   DELETE {base}/api/principal/{name}     delete a principal
 *
 * These paths track Stalwart's documented management API and may need a
 * ONE-LINE tweak per Stalwart version (the base prefix, the patch op shape, or
 * the principal field names). They are isolated in {@link STALWART_PATHS} and
 * the small request builders below so a version bump is a localized edit. See
 * the Stalwart docs: management API → "Principals".
 *
 * This module never imports the server or any server SDK — it is pure `fetch`,
 * so it compiles and loads with the Stalwart sidecar entirely absent.
 */

function getStalwartBaseUrl(): string {
  return (process.env.STALWART_ADMIN_URL ?? '').replace(/\/+$/, '');
}

function getStalwartToken(): string {
  return process.env.STALWART_ADMIN_TOKEN ?? '';
}

export function getStalwartDefaultDomain(): string {
  return (process.env.STALWART_DEFAULT_DOMAIN ?? '').trim().toLowerCase();
}

/** Enabled only when BOTH the management URL and the admin token are present. */
export function isStalwartEnabled(): boolean {
  return getStalwartBaseUrl().length > 0 && getStalwartToken().length > 0;
}

export class StalwartError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: unknown;

  constructor(message: string, status: number, path: string, body: unknown) {
    super(message);
    this.name = 'StalwartError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export interface StalwartFetchInit extends Omit<RequestInit, 'body' | 'headers'> {
  json?: unknown;
  body?: BodyInit;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

async function stalwartFetch<T = unknown>(
  path: string,
  init: StalwartFetchInit = {},
): Promise<T> {
  if (!isStalwartEnabled()) {
    throw new StalwartError(
      'Stalwart management API is disabled (STALWART_ADMIN_URL / STALWART_ADMIN_TOKEN not set)',
      503,
      path,
      null,
    );
  }

  const url = `${getStalwartBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${getStalwartToken()}`,
    ...(init.headers ?? {}),
  };

  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  const controller = new AbortController();
  const timeoutMs = init.timeoutMs ?? 15_000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new StalwartError(
        `Stalwart management request timed out after ${timeoutMs}ms`,
        0,
        path,
        null,
      );
    }
    throw new StalwartError(
      err instanceof Error ? err.message : 'Stalwart management fetch failed',
      0,
      path,
      null,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    let message = `Stalwart management ${res.status} ${res.statusText}`;
    // Tolerate Stalwart's response shapes defensively: it may return
    // `{ error: "…" }`, `{ details: "…" }`, or `{ message: "…" }`.
    if (isJson && payload && typeof payload === 'object') {
      const rec = payload as Record<string, unknown>;
      const candidate =
        (typeof rec.error === 'string' && rec.error) ||
        (typeof rec.details === 'string' && rec.details) ||
        (typeof rec.message === 'string' && rec.message) ||
        '';
      if (candidate) message = candidate;
    }
    throw new StalwartError(message, res.status, path, payload);
  }

  return payload as T;
}

/**
 * Endpoint paths for Stalwart's management API. Isolated here so a per-version
 * tweak is a single-line change (see the VERSION NOTE at the top of the file).
 */
const STALWART_PATHS = {
  principal: '/api/principal',
  principalByName: (name: string) => `/api/principal/${encodeURIComponent(name)}`,
} as const;

/** A Stalwart principal type. `individual` = mailbox, `group` = alias/list. */
export type StalwartPrincipalType = 'individual' | 'group' | 'domain';

/** Minimal shape of a principal as returned by the management API. */
export interface StalwartPrincipal {
  type?: StalwartPrincipalType;
  name?: string;
  emails?: string[];
  description?: string;
  quota?: number;
  disabled?: boolean;
  members?: string[];
  [key: string]: unknown;
}

export interface CreateMailboxInput {
  /** Full email address — also used as the principal `name`. */
  email: string;
  /** Initial password (stored in Stalwart `secrets`). */
  password: string;
  /** Optional display name → principal `description`. */
  displayName?: string;
  /** Optional mailbox quota in bytes → principal `quota`. */
  quotaBytes?: number;
}

export interface CreateAliasInput {
  /** The alias address (also the `group` principal `name`). */
  alias: string;
  /** Addresses the alias forwards/expands to (`members`). */
  destinations: string[];
}

/**
 * Build a JSON-Patch-style mutation body for Stalwart's PATCH endpoint.
 * Stalwart v0.7+ accepts an array of `{ action, field, value }` ops on a
 * principal. The exact `action` verbs (`set` / `addItem` / `removeItem`) are
 * the part most likely to shift between versions — keep this builder the
 * single edit point.
 */
function patchOps(
  ops: Array<{ action: 'set' | 'addItem' | 'removeItem'; field: string; value?: unknown }>,
): Array<{ action: string; field: string; value?: unknown }> {
  return ops;
}

/**
 * Public Stalwart admin surface. Every method goes through {@link stalwartFetch}
 * and therefore throws {@link StalwartError} (status 503) when the server is
 * not configured, so callers degrade gracefully.
 */
export const stalwartAdmin = {
  /**
   * Provision a hosted mailbox as an `individual` principal.
   *
   * POST {base}/api/principal with:
   *   { type:'individual', name:email, secrets:[password], emails:[email],
   *     description:displayName?, quota:quotaBytes? }
   */
  async createMailbox(input: CreateMailboxInput): Promise<{ ok: true }> {
    const principal: StalwartPrincipal & { secrets: string[] } = {
      type: 'individual',
      name: input.email,
      secrets: [input.password],
      emails: [input.email],
    };
    if (input.displayName) principal.description = input.displayName;
    if (typeof input.quotaBytes === 'number') principal.quota = input.quotaBytes;

    await stalwartFetch(STALWART_PATHS.principal, {
      method: 'POST',
      json: principal,
    });
    return { ok: true };
  },

  /** Fetch a principal by email/name. Returns null on 404. */
  async getMailbox(email: string): Promise<StalwartPrincipal | null> {
    try {
      return await stalwartFetch<StalwartPrincipal>(
        STALWART_PATHS.principalByName(email),
        { method: 'GET' },
      );
    } catch (err) {
      if (err instanceof StalwartError && err.status === 404) return null;
      throw err;
    }
  },

  /** Reset a mailbox password by replacing the principal's `secrets`. */
  async setPassword(email: string, password: string): Promise<{ ok: true }> {
    await stalwartFetch(STALWART_PATHS.principalByName(email), {
      method: 'PATCH',
      json: patchOps([{ action: 'set', field: 'secrets', value: [password] }]),
    });
    return { ok: true };
  },

  /**
   * Suspend or re-activate a mailbox. Suspension flips the principal's
   * `disabled` flag (Stalwart blocks auth + delivery for disabled principals).
   */
  async setStatus(email: string, status: 'active' | 'suspended'): Promise<{ ok: true }> {
    await stalwartFetch(STALWART_PATHS.principalByName(email), {
      method: 'PATCH',
      json: patchOps([
        { action: 'set', field: 'disabled', value: status === 'suspended' },
      ]),
    });
    return { ok: true };
  },

  /** Permanently delete a mailbox principal. */
  async deleteMailbox(email: string): Promise<{ ok: true }> {
    await stalwartFetch(STALWART_PATHS.principalByName(email), {
      method: 'DELETE',
    });
    return { ok: true };
  },

  /**
   * Create a forwarding alias as a `group` principal whose `members` are the
   * destination addresses. Mail to `alias` expands to `destinations`.
   *
   * POST {base}/api/principal with:
   *   { type:'group', name:alias, emails:[alias], members:[...destinations] }
   */
  async createAlias(input: CreateAliasInput): Promise<{ ok: true }> {
    const principal: StalwartPrincipal = {
      type: 'group',
      name: input.alias,
      emails: [input.alias],
      members: input.destinations,
    };
    await stalwartFetch(STALWART_PATHS.principal, {
      method: 'POST',
      json: principal,
    });
    return { ok: true };
  },

  /**
   * Register a hosted domain as a `domain` principal so Stalwart will accept
   * mail for it. DNS/DKIM still has to be configured out-of-band; see
   * {@link verifyDomainOnServer} to read back the server's view of the domain.
   */
  async addDomain(domain: string): Promise<{ ok: true }> {
    const principal: StalwartPrincipal = {
      type: 'domain',
      name: domain.trim().toLowerCase(),
    };
    await stalwartFetch(STALWART_PATHS.principal, {
      method: 'POST',
      json: principal,
    });
    return { ok: true };
  },

  /**
   * Check whether the server already knows about a domain (i.e. a `domain`
   * principal exists for it). Returns `{ exists, principal }`. This is the
   * server-side half of domain verification; DNS-record verification is done
   * elsewhere. Defensively tolerates Stalwart returning the principal directly
   * or wrapped — we only need the existence signal here.
   */
  async verifyDomainOnServer(
    domain: string,
  ): Promise<{ exists: boolean; principal: StalwartPrincipal | null }> {
    const name = domain.trim().toLowerCase();
    try {
      const principal = await stalwartFetch<StalwartPrincipal>(
        STALWART_PATHS.principalByName(name),
        { method: 'GET' },
      );
      return { exists: principal != null, principal: principal ?? null };
    } catch (err) {
      if (err instanceof StalwartError && err.status === 404) {
        return { exists: false, principal: null };
      }
      throw err;
    }
  },
};

export type StalwartAdmin = typeof stalwartAdmin;
