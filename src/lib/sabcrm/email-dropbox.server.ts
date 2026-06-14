import 'server-only';

/**
 * SabCRM BCC-dropbox — server runtime (token minting, resolution, capture).
 *
 * Per-project dropbox config lives in `sabcrm_email_dropbox` (projectId-scoped,
 * the native-Mongo config pattern of `./scoring.server.ts` /
 * `./email-tracking.server.ts`). One doc per project:
 *
 *   { projectId, token, enabled, autoBcc, createdAt, updatedAt }
 *
 * - `token`     opaque, minted once, the only secret tying an inbound dropbox
 *               address back to a project (`resolveDropboxProject`).
 * - `enabled`   master switch: when false, the dropbox address is "off" — the
 *               inbound bridge skips it and sends don't self-BCC.
 * - `autoBcc`   when true, record-detail sends add the dropbox to BCC so they
 *               self-log (wired in `email-core.ts`).
 *
 * The address SHAPE comes from `./email-dropbox.ts` (pure). The DOMAIN suffix
 * is resolved best-effort: the tenant's first SabMail domain, else the
 * `SABCRM_DROPBOX_DOMAIN` env. With no domain, `dropboxAddressForProject`
 * returns `''` and every wiring degrades to "exactly as today".
 *
 * `captureDropboxEmail` is the inbound entry: it resolves the token -> project,
 * then hands the message to `routeInboundSabcrmEmail` with the OTHER party's
 * address as the `from` (so the message lands on the record matched by the
 * correspondent, not by the dropbox itself). Everything is best-effort and
 * never throws — an inbound webhook must stay healthy.
 */

import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  routeInboundSabcrmEmail,
  type RouteInboundSabcrmEmailResult,
} from '@/lib/sabcrm/email-inbound';
import {
  buildDropboxAddress,
  normaliseToken,
  isValidDropboxToken,
} from './email-dropbox';

/** Mongo collection holding one dropbox config doc per project. */
const DROPBOX_COLL = 'sabcrm_email_dropbox';

/** Env fallback for the dropbox mail domain when the tenant has none. */
const DROPBOX_DOMAIN_ENV = 'SABCRM_DROPBOX_DOMAIN';

/** Persisted shape of a dropbox config doc. */
export interface DropboxConfig {
  projectId: string;
  /** Opaque inbound token (lowercase alnum, 8–64). */
  token: string;
  /** Master on/off for the whole dropbox. */
  enabled: boolean;
  /** When true, record-detail sends self-BCC the dropbox. */
  autoBcc: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What `ensureDropbox` / the actions return to the UI. */
export interface DropboxStatus extends DropboxConfig {
  /** The full `crm+<token>@<domain>` address, or `''` when no domain resolves. */
  address: string;
  /** True when a mail domain was resolvable (the address is usable). */
  hasDomain: boolean;
  /** The resolved suffix domain (for display), or `''`. */
  domain: string;
}

/** Mint a fresh URL-safe token (16 bytes -> 32 lowercase hex chars). */
function mintToken(): string {
  return randomBytes(16).toString('hex'); // hex is lowercase a-f0-9, len 32 -> valid
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Resolve the dropbox mail domain for a project, best-effort:
 *   1. the tenant's first verified-ish SabMail domain (`listMailDomains`);
 *   2. else the `SABCRM_DROPBOX_DOMAIN` env.
 * Returns `''` when neither is available (the dropbox stays address-less).
 *
 * `listMailDomains` is session-based, so it only yields a value in an
 * action/page context; the env fallback covers sessionless callers
 * (`captureDropboxEmail` doesn't need a domain — only the address builders do).
 */
async function resolveDropboxDomain(): Promise<string> {
  try {
    const { listMailDomains } = await import('@/app/actions/mailbox.actions');
    const domains = await listMailDomains();
    const active =
      domains.find((d) => d.status !== 'archived' && d.domain) ?? domains[0];
    if (active?.domain) return active.domain;
  } catch {
    /* sessionless or engine down — fall back to env */
  }
  return (process.env[DROPBOX_DOMAIN_ENV] ?? '').trim();
}

/** Read the raw config doc for a project, or `null`. */
async function readConfig(projectId: string): Promise<DropboxConfig | null> {
  try {
    const { db } = await connectToDatabase();
    const doc = await db
      .collection<DropboxConfig>(DROPBOX_COLL)
      .findOne({ projectId });
    return doc ? { ...doc, projectId } : null;
  } catch {
    return null;
  }
}

/**
 * Get-or-create the dropbox config for a project (mints a token on first use)
 * and resolve its current address. Idempotent — re-running never re-mints.
 * Defaults: `enabled: true`, `autoBcc: false` (opt-in self-logging).
 */
export async function ensureDropbox(projectId: string): Promise<DropboxStatus> {
  if (!projectId) {
    return blankStatus('');
  }
  const { db } = await connectToDatabase();
  const coll = db.collection<DropboxConfig>(DROPBOX_COLL);

  const existing = await coll.findOne({ projectId });
  if (existing) return decorate(existing);

  const fresh: DropboxConfig = {
    projectId,
    token: mintToken(),
    enabled: true,
    autoBcc: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  try {
    await coll.updateOne(
      { projectId },
      { $setOnInsert: fresh },
      { upsert: true },
    );
  } catch {
    /* race / down DB — fall through to re-read */
  }
  // Re-read so a concurrent creator's row wins; fall back to `fresh`.
  const reread = await coll.findOne({ projectId });
  return decorate(reread ?? fresh);
}

/**
 * Update the enable / autoBcc toggles (and mint a token if somehow missing).
 * Bumps the doc's own `updatedAt`. Returns the refreshed status.
 */
export async function setDropboxConfig(
  projectId: string,
  patch: { enabled?: boolean; autoBcc?: boolean },
): Promise<DropboxStatus> {
  // ensure the doc + token exist first
  const current = await ensureDropbox(projectId);
  const set: Partial<DropboxConfig> = { updatedAt: nowIso() };
  if (typeof patch.enabled === 'boolean') set.enabled = patch.enabled;
  if (typeof patch.autoBcc === 'boolean') set.autoBcc = patch.autoBcc;

  try {
    const { db } = await connectToDatabase();
    await db
      .collection<DropboxConfig>(DROPBOX_COLL)
      .updateOne({ projectId }, { $set: set });
  } catch {
    /* best-effort */
  }

  return {
    ...current,
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : current.enabled,
    autoBcc: typeof patch.autoBcc === 'boolean' ? patch.autoBcc : current.autoBcc,
    updatedAt: set.updatedAt!,
  };
}

/**
 * The dropbox address to add to a record-send's BCC, or `''` when self-logging
 * is off / unconfigured. Used by `email-core.ts` (sessionless-safe: reads
 * config from Mongo + domain from env when no session). Returns `''` unless the
 * dropbox is BOTH `enabled` AND `autoBcc`.
 */
export async function dropboxBccForProject(projectId: string): Promise<string> {
  if (!projectId) return '';
  const cfg = await readConfig(projectId);
  if (!cfg || !cfg.enabled || !cfg.autoBcc || !cfg.token) return '';
  const domain = await resolveDropboxDomain();
  if (!domain) return '';
  return buildDropboxAddress(cfg.token, domain);
}

/**
 * Resolve a dropbox token (or full address) back to `{ projectId }`. Accepts a
 * bare token or a `crm+<token>@<domain>` address. Returns `null` when the token
 * is unknown or the dropbox is disabled.
 */
export async function resolveDropboxProject(
  tokenOrAddress: string,
): Promise<{ projectId: string } | null> {
  const raw = (tokenOrAddress ?? '').trim();
  if (!raw) return null;

  // Accept a full address (`crm+<token>@…`) or a bare token.
  let token = normaliseToken(raw);
  if (raw.includes('@') || raw.includes('+')) {
    const { parseDropboxAddress } = await import('./email-dropbox');
    const parsed = parseDropboxAddress(raw);
    if (!parsed) return null;
    token = parsed;
  }
  if (!isValidDropboxToken(token)) return null;

  try {
    const { db } = await connectToDatabase();
    const cfg = await db
      .collection<DropboxConfig>(DROPBOX_COLL)
      .findOne({ token, enabled: true }, { projection: { projectId: 1 } });
    return cfg?.projectId ? { projectId: String(cfg.projectId) } : null;
  } catch {
    return null;
  }
}

/**
 * INBOUND ENTRY for mail BCC'd to a dropbox address. Resolves the dropbox
 * `address`'s token -> project, finds the project's owning user, then routes
 * the message onto the record matched by the OTHER party (`from`) through
 * `routeInboundSabcrmEmail` with an explicit identity. Best-effort, never
 * throws — returns a structured no-op when anything is missing.
 *
 * Note: `from` here is the correspondent the rep was emailing (the address that
 * should match a CRM record), NOT the dropbox.
 */
export async function captureDropboxEmail(
  address: string,
  from: string,
  subject: string,
  body: string,
  messageId?: string,
): Promise<RouteInboundSabcrmEmailResult> {
  const none = (reason: string): RouteInboundSabcrmEmailResult => ({
    routed: false,
    matchedRecords: 0,
    activitiesLogged: 0,
    sequencesUnenrolled: 0,
    reason,
  });

  const sender = (from ?? '').trim().toLowerCase();
  if (!sender || !sender.includes('@')) return none('invalid-from');

  const resolved = await resolveDropboxProject(address);
  if (!resolved) return none('no-dropbox');

  // Resolve the project's owning user so `routeInboundSabcrmEmail` can use the
  // Rust engine with an explicit identity (no session in webhook context).
  let userId: string | null = null;
  try {
    const { db } = await connectToDatabase();
    if (ObjectId.isValid(resolved.projectId)) {
      const project = await db
        .collection('projects')
        .findOne(
          { _id: new ObjectId(resolved.projectId) },
          { projection: { userId: 1 } },
        );
      if (project?.userId) userId = String(project.userId);
    }
  } catch {
    /* fall through */
  }
  if (!userId) return none('no-tenant');

  try {
    return await routeInboundSabcrmEmail(
      {
        to: address,
        from: sender,
        subject: subject || '(no subject)',
        bodyText: body,
        messageId,
      },
      { userId, projectId: resolved.projectId },
    );
  } catch (e) {
    return none(e instanceof Error ? e.message : 'capture-failed');
  }
}

/* ── decorators ──────────────────────────────────────────────────────────── */

async function decorate(cfg: DropboxConfig): Promise<DropboxStatus> {
  const domain = await resolveDropboxDomain();
  const address = domain ? buildDropboxAddress(cfg.token, domain) : '';
  return {
    ...cfg,
    projectId: String(cfg.projectId),
    address,
    domain,
    hasDomain: Boolean(domain),
  };
}

function blankStatus(projectId: string): DropboxStatus {
  const t = mintToken();
  return {
    projectId,
    token: t,
    enabled: false,
    autoBcc: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    address: '',
    domain: '',
    hasDomain: false,
  };
}
