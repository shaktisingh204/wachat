/**
 * sabflow-triggers — IMAP IDLE worker.
 *
 * Owns long-lived IMAP IDLE sockets for every active SabFlow "email-received"
 * trigger and translates inbound messages into a normalised payload that gets
 * POSTed to the Next.js internal endpoint
 *
 *     POST {SABFLOW_API_URL}/api/sabflow/internal/trigger/email
 *
 * which is responsible for calling `enqueueExecution(triggerId, payload)`.
 *
 * Why this lives in its own Node process (not a Vercel Function):
 *   - IMAP IDLE is a long-lived TCP socket. Vercel Fluid Compute is
 *     request-shaped (function lifetime is bounded by the request). A
 *     long-lived IDLE socket would be killed by instance recycling and
 *     billed as continuous compute.
 *   - PM2 manages restart / log capture / memory caps the same way it does
 *     for `services/sabwa-node/` and `services/sabflow-ws/`.
 *
 * File ownership: this file is the ONLY runtime entrypoint for this service.
 * Sibling modules (credentials resolver, SabFiles uploader, payload signer)
 * are forward-declared via dynamic `import()` with try/catch fallbacks so the
 * skeleton boots on its own while neighbour agents land their pieces.
 *
 * NOTE on attachments: the payload's `attachments[]` entries reference SabFiles
 * URIs (`sabfile://...`) — not raw bytes. The actual upload to SabFiles (R2)
 * happens through the SabFiles uploader sibling once it lands; until then we
 * emit `{ filename, contentType, size, sabFileId: null }` and the Next.js
 * receiver flags it. DO NOT inline the upload here — SabFiles policy requires
 * every file in the system to originate from the SabFiles library/upload flow
 * (see CLAUDE.md SabFiles policy).
 */

import 'dotenv/config';
import { createServer } from 'node:http';
import express, { type Request, type Response } from 'express';
import { ImapFlow, type FetchMessageObject, type MailboxLockObject } from 'imapflow';
import { simpleParser, type ParsedMail, type Attachment } from 'mailparser';
import { request as undiciRequest } from 'undici';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 4003;

/** Backoff bounds for IMAP reconnection (ms). 1s → 60s with jitter. */
const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 60_000;

/** Polling fallback period for servers that don't advertise IDLE capability. */
const POLL_FALLBACK_MS = 60_000;

/** How often we re-fetch the active trigger list from Next.js. */
const TRIGGER_REFRESH_MS = 60_000;

interface AppConfig {
  port: number;
  apiBaseUrl: string;
  internalToken: string;
}

function loadConfig(): AppConfig {
  const port = Number(process.env.SABFLOW_TRIGGERS_PORT ?? DEFAULT_PORT);
  const apiBaseUrl = process.env.SABFLOW_API_URL ?? 'http://localhost:3000';
  const internalToken = process.env.SABFLOW_INTERNAL_TOKEN ?? '';

  if (!internalToken) {
    throw new Error(
      '[sabflow-triggers] SABFLOW_INTERNAL_TOKEN is required so the Next.js ' +
        'side can verify trigger POSTs originated from this worker.',
    );
  }

  return { port, apiBaseUrl, internalToken };
}

// ---------------------------------------------------------------------------
// Trigger descriptor + credentials resolver (forward-declared)
// ---------------------------------------------------------------------------

/**
 * Shape of an email trigger row as returned by the Next.js index endpoint.
 * Credentials are NEVER returned in plaintext — instead we get a credential
 * handle that the resolver swaps for a decrypted record at runtime.
 */
const EmailTriggerSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  flowId: z.string(),
  credentialId: z.string(),
  folder: z.string().default('INBOX'),
  // Optional filter: only fire for messages matching this IMAP search criteria.
  search: z.record(z.unknown()).optional(),
});
type EmailTrigger = z.infer<typeof EmailTriggerSchema>;

/**
 * Decrypted IMAP credentials. Resolved by the sibling credentials module —
 * forward-declared here so the skeleton boots on its own.
 */
interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

type CredentialsResolver = (credentialId: string) => Promise<ImapCredentials>;

/**
 * Forward-declared credentials resolver. Looks for a sibling module
 * `./credentials.ts` that exports `resolveImapCredentials`. Until that lands
 * we fall back to a stub that hits the Next.js internal credentials endpoint
 * (which is responsible for the actual KMS decrypt).
 */
async function loadCredentialsResolver(cfg: AppConfig): Promise<CredentialsResolver> {
  try {
    const mod = (await import('./credentials.js')) as {
      resolveImapCredentials?: CredentialsResolver;
    };
    if (mod.resolveImapCredentials) return mod.resolveImapCredentials;
  } catch {
    /* module not yet implemented — fall through to HTTP stub */
  }

  return async (credentialId) => {
    const url = `${cfg.apiBaseUrl}/api/sabflow/internal/credentials/${encodeURIComponent(
      credentialId,
    )}`;
    const res = await undiciRequest(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${cfg.internalToken}` },
    });
    if (res.statusCode !== 200) {
      throw new Error(
        `[sabflow-triggers] credentials resolver returned ${res.statusCode} for ${credentialId}`,
      );
    }
    const body = (await res.body.json()) as ImapCredentials;
    return body;
  };
}

// ---------------------------------------------------------------------------
// Payload posted to Next.js
// ---------------------------------------------------------------------------

interface NormalisedAttachment {
  filename: string;
  contentType: string;
  size: number;
  /**
   * Populated once the SabFiles uploader sibling lands. `null` means the
   * attachment has not yet been uploaded — the Next.js receiver flags this
   * so SabFlow nodes that need the bytes can pause until it resolves.
   */
  sabFileId: string | null;
}

interface NormalisedEmailPayload {
  triggerId: string;
  workspaceId: string;
  flowId: string;
  headers: Record<string, string>;
  from: string[];
  to: string[];
  subject: string;
  text: string;
  html: string | null;
  attachments: NormalisedAttachment[];
  received: string; // ISO timestamp
}

function flattenHeaders(parsed: ParsedMail): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of parsed.headers.entries()) {
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

function flattenAddresses(value: ParsedMail['from'] | ParsedMail['to']): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return arr.flatMap((a) => a.value.map((v) => v.address ?? '').filter(Boolean));
}

/**
 * Build the normalised payload. NOTE: attachment uploads to SabFiles are
 * intentionally deferred — see file-header comment. We forward metadata only.
 */
function buildPayload(
  trigger: EmailTrigger,
  parsed: ParsedMail,
  attachments: Attachment[],
): NormalisedEmailPayload {
  return {
    triggerId: trigger.id,
    workspaceId: trigger.workspaceId,
    flowId: trigger.flowId,
    headers: flattenHeaders(parsed),
    from: flattenAddresses(parsed.from),
    to: flattenAddresses(parsed.to),
    subject: parsed.subject ?? '',
    text: parsed.text ?? '',
    html: typeof parsed.html === 'string' ? parsed.html : null,
    attachments: attachments.map((a) => ({
      filename: a.filename ?? 'attachment',
      contentType: a.contentType ?? 'application/octet-stream',
      size: a.size ?? a.content?.length ?? 0,
      sabFileId: null,
    })),
    received: (parsed.date ?? new Date()).toISOString(),
  };
}

async function postToNextjs(
  cfg: AppConfig,
  payload: NormalisedEmailPayload,
): Promise<void> {
  const url = `${cfg.apiBaseUrl}/api/sabflow/internal/trigger/email`;
  const res = await undiciRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.internalToken}`,
    },
    body: JSON.stringify(payload),
  });
  // Drain body so the socket can be reused.
  await res.body.dump();
  if (res.statusCode < 200 || res.statusCode >= 300) {
    throw new Error(
      `[sabflow-triggers] trigger POST returned ${res.statusCode} for ${payload.triggerId}`,
    );
  }
}

// ---------------------------------------------------------------------------
// EmailTriggerWorker — one instance per active trigger
// ---------------------------------------------------------------------------

interface WorkerDeps {
  cfg: AppConfig;
  resolveCredentials: CredentialsResolver;
  logger: typeof console;
}

class EmailTriggerWorker {
  private readonly trigger: EmailTrigger;
  private readonly deps: WorkerDeps;
  private client: ImapFlow | null = null;
  private stopRequested = false;
  private reconnectAttempt = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastSeenUid = 0;

  constructor(trigger: EmailTrigger, deps: WorkerDeps) {
    this.trigger = trigger;
    this.deps = deps;
  }

  get id(): string {
    return this.trigger.id;
  }

  async start(): Promise<void> {
    this.stopRequested = false;
    void this.runLoop();
  }

  async stop(): Promise<void> {
    this.stopRequested = true;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        /* best-effort close */
      }
      this.client = null;
    }
  }

  /**
   * Main supervisor loop: connect → IDLE (or poll fallback) → reconnect with
   * exponential backoff (1s → 60s with jitter) until `stop()` is called.
   */
  private async runLoop(): Promise<void> {
    while (!this.stopRequested) {
      try {
        await this.connectAndWatch();
        // connectAndWatch only resolves on graceful close — reset backoff and
        // immediately reconnect.
        this.reconnectAttempt = 0;
      } catch (err) {
        this.deps.logger.error(
          `[sabflow-triggers] trigger=${this.trigger.id} loop error:`,
          err,
        );
      }

      if (this.stopRequested) break;

      const delay = this.computeBackoff();
      this.reconnectAttempt += 1;
      this.deps.logger.warn(
        `[sabflow-triggers] trigger=${this.trigger.id} reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`,
      );
      await sleep(delay);
    }
  }

  private computeBackoff(): number {
    const base = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_MIN_MS * 2 ** this.reconnectAttempt,
    );
    // Full-jitter: random in [0, base]. Equal-jitter would also be fine.
    return Math.floor(Math.random() * base);
  }

  private async connectAndWatch(): Promise<void> {
    const creds = await this.deps.resolveCredentials(this.trigger.credentialId);
    const client = new ImapFlow({
      host: creds.host,
      port: creds.port,
      secure: creds.secure,
      auth: { user: creds.user, pass: creds.pass },
      logger: false,
    });
    this.client = client;

    await client.connect();
    this.deps.logger.info(
      `[sabflow-triggers] trigger=${this.trigger.id} connected to ${creds.host}:${creds.port}`,
    );

    const lock: MailboxLockObject = await client.getMailboxLock(this.trigger.folder);
    try {
      // Seed the high-water mark so we don't fan out the entire mailbox on first connect.
      const status = await client.status(this.trigger.folder, { uidNext: true });
      this.lastSeenUid = Math.max(0, (status.uidNext ?? 1) - 1);

      const supportsIdle = Boolean(
        // Either an `idle` capability or a working `idle()` method on the client.
        client.capabilities?.get?.('IDLE') ?? typeof client.idle === 'function',
      );

      client.on('exists', () => {
        // New message arrived — drain everything past lastSeenUid.
        void this.drainNew(client).catch((err) =>
          this.deps.logger.error(
            `[sabflow-triggers] trigger=${this.trigger.id} drain error:`,
            err,
          ),
        );
      });

      if (supportsIdle) {
        // Loop IDLE until the connection drops or stop is requested. imapflow's
        // `idle()` resolves when the server breaks the IDLE or we call noop.
        while (!this.stopRequested && client.usable) {
          await client.idle();
        }
      } else {
        await this.runPollFallback(client);
      }
    } finally {
      lock.release();
      try {
        await client.logout();
      } catch {
        /* best-effort */
      }
      this.client = null;
    }
  }

  /**
   * Polling fallback for IMAP servers without IDLE support. Every
   * POLL_FALLBACK_MS we LIST new UIDs > lastSeenUid and drain them.
   */
  private async runPollFallback(client: ImapFlow): Promise<void> {
    while (!this.stopRequested && client.usable) {
      await this.drainNew(client);
      await sleep(POLL_FALLBACK_MS);
    }
  }

  /**
   * Fetch every message with UID > lastSeenUid, parse, and POST.
   */
  private async drainNew(client: ImapFlow): Promise<void> {
    const range = `${this.lastSeenUid + 1}:*`;
    for await (const msg of client.fetch(
      { uid: range },
      { source: true, uid: true, envelope: true },
    ) as AsyncIterable<FetchMessageObject>) {
      if (typeof msg.uid !== 'number') continue;
      if (msg.uid <= this.lastSeenUid) continue;
      this.lastSeenUid = msg.uid;

      if (!msg.source) continue;
      try {
        const parsed = await simpleParser(msg.source);
        const payload = buildPayload(this.trigger, parsed, parsed.attachments ?? []);
        await postToNextjs(this.deps.cfg, payload);
      } catch (err) {
        this.deps.logger.error(
          `[sabflow-triggers] trigger=${this.trigger.id} uid=${msg.uid} parse/post failed:`,
          err,
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// WorkerPool — refreshes the active-trigger list from Next.js and reconciles
// ---------------------------------------------------------------------------

class WorkerPool {
  private readonly workers = new Map<string, EmailTriggerWorker>();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(private readonly deps: WorkerDeps) {}

  async start(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      void this.refresh().catch((err) =>
        this.deps.logger.error('[sabflow-triggers] refresh failed:', err),
      );
    }, TRIGGER_REFRESH_MS);
  }

  async stop(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    await Promise.all([...this.workers.values()].map((w) => w.stop()));
    this.workers.clear();
  }

  size(): number {
    return this.workers.size;
  }

  private async refresh(): Promise<void> {
    const url = `${this.deps.cfg.apiBaseUrl}/api/sabflow/internal/trigger/email/active`;
    const res = await undiciRequest(url, {
      method: 'GET',
      headers: { authorization: `Bearer ${this.deps.cfg.internalToken}` },
    });
    if (res.statusCode !== 200) {
      this.deps.logger.warn(
        `[sabflow-triggers] active-trigger list returned ${res.statusCode}`,
      );
      await res.body.dump();
      return;
    }
    const body = (await res.body.json()) as unknown;
    const list = z.array(EmailTriggerSchema).parse(body);

    const desired = new Set(list.map((t) => t.id));

    // Stop removed.
    for (const [id, worker] of this.workers) {
      if (!desired.has(id)) {
        await worker.stop();
        this.workers.delete(id);
      }
    }
    // Start new.
    for (const trig of list) {
      if (!this.workers.has(trig.id)) {
        const worker = new EmailTriggerWorker(trig, this.deps);
        this.workers.set(trig.id, worker);
        await worker.start();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// HTTP surface — health + admin
// ---------------------------------------------------------------------------

function buildHttpServer(pool: WorkerPool) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req: Request, res: Response) => {
    res.json({ status: 'ok', workers: pool.size() });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', workers: pool.size() });
  });

  return createServer(app);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const cfg = loadConfig();
  const logger = console;
  const resolveCredentials = await loadCredentialsResolver(cfg);
  const pool = new WorkerPool({ cfg, resolveCredentials, logger });

  await pool.start();

  const server = buildHttpServer(pool);
  server.listen(cfg.port, () => {
    logger.info(`[sabflow-triggers] listening on :${cfg.port}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`[sabflow-triggers] received ${signal}, shutting down`);
    server.close();
    await pool.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Only run when invoked directly (not when imported by tests).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error('[sabflow-triggers] fatal:', err);
    process.exit(1);
  });
}

export { EmailTriggerWorker, WorkerPool, buildPayload };
export type { EmailTrigger, ImapCredentials, NormalisedEmailPayload, NormalisedAttachment };
