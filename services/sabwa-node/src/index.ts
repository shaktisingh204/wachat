/**
 * sabwa-node entry point.
 *
 * Responsibilities of this file (only):
 *   1. Load `.env` (dotenv).
 *   2. Connect to MongoDB and Redis.
 *   3. Build the shared `AppState`.
 *   4. Wire Express: unauthenticated `/healthz` + `/health`, service-token-
 *      gated `/metrics`, JWT-gated `/realtime/*` SSE, and `/v1/*` behind the
 *      service-token gate.
 *   5. Listen on `PORT` (default 4001 — matches the Rust engine).
 *   6. Wire graceful shutdown for SIGINT/SIGTERM.
 *
 * This service replaces `services/sabwa-engine/` (Rust). The HTTP contract
 * exposed here is identical, so the Next.js `engineFetch` client in
 * `src/lib/sabwa/engine-client.ts` keeps working unchanged.
 */

import 'dotenv/config';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

import { log } from './log.js';
import { connectMongo } from './db/mongo.js';
import { connectRedis } from './db/redis.js';
import { requireServiceToken } from './middleware/auth.js';
import { buildHealthRouter } from './routes/health.js';
import { buildMetricsRouter } from './routes/metrics.js';
import { buildV1Router } from './routes/index.js';
import { buildRealtimeStreamRouter } from './routes/realtime.js';
import type { AppConfig, AppState, BaileysSession } from './state.js';
import { SessionPool } from './wa/pool.js';
import { parseAuthStateKey } from './wa/auth-state.js';
import { startBulkSender } from './workers/bulk-sender.js';
import { startExportWorker } from './workers/export.js';
import { startWorkers } from './workers/index.js';

/** Hard cap on graceful shutdown — after this we exit(1) so PM2 restarts us. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

function loadConfig(): AppConfig {
  const port = Number.parseInt(process.env.PORT ?? '4001', 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer (got ${process.env.PORT})`);
  }

  const mongoUrl = process.env.MONGO_URL ?? process.env.MONGODB_URI;
  if (!mongoUrl) throw new Error('MONGO_URL (or MONGODB_URI) is required');

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error('REDIS_URL is required');

  const serviceToken = process.env.SABWA_ENGINE_TOKEN;
  if (!serviceToken || serviceToken.trim().length === 0) {
    throw new Error('SABWA_ENGINE_TOKEN is required');
  }

  const authStateKey = process.env.AUTH_STATE_KEY ?? process.env.SABWA_AUTH_ENCRYPTION_KEY;
  if (!authStateKey || authStateKey.trim().length === 0) {
    throw new Error('AUTH_STATE_KEY is required (base64-encoded 32 bytes)');
  }

  return { port, mongoUrl, redisUrl, serviceToken, authStateKey };
}

/**
 * Gracefully end every live Baileys socket in the pool.
 *
 * The sessions agent will eventually ship a real `sessionPool` module with its
 * own `stopAll`. Until then, walk `state.sessions` directly and call
 * `sock.end(undefined)` on each entry — that is Baileys' documented "clean
 * close" call: it flushes pending writes, saves creds, and avoids triggering
 * the reconnect path. We swallow per-session errors so one broken socket can't
 * block the rest from closing.
 */
async function stopAllSessions(state: AppState): Promise<void> {
  // Tear down sessions from the live pool (managed by `src/wa/pool.ts`). We
  // call `stop()` rather than `logout()` so the linked WA device survives a
  // restart — `logout()` would wipe the device on WhatsApp's side. The legacy
  // `state.sessions` placeholder map is also drained for backwards compat
  // with any caller that wrote into it directly.
  const live = state.pool.list();
  if (live.length === 0 && state.sessions.size === 0) return;
  state.log.info(
    { count: live.length, legacy: state.sessions.size },
    'stopping all sessions',
  );

  const tasks: Array<Promise<void>> = live.map((s) =>
    s.stop().catch((err) => {
      state.log.warn({ err, sessionId: s.sessionId }, 'pool session stop failed');
    }),
  );
  for (const [sessionId, session] of state.sessions.entries()) {
    tasks.push(
      (async () => {
        try {
          const sock = session.sock as { end?: (err: unknown) => void } | undefined;
          if (sock && typeof sock.end === 'function') {
            sock.end(undefined);
          }
          session.status = 'disconnected';
        } catch (err) {
          state.log.warn({ err, sessionId }, 'legacy session shutdown error');
        }
      })(),
    );
  }
  await Promise.allSettled(tasks);
  state.sessions.clear();
}

async function main(): Promise<void> {
  const config = loadConfig();

  const { client: mongo, db } = await connectMongo(config.mongoUrl, log);
  const redis = await connectRedis(config.redisUrl, log);

  // Decode the AES-256-GCM key once at boot so per-session encrypt/decrypt
  // calls don't re-parse on every hop. `parseAuthStateKey` accepts the same
  // 64-char hex / base64-32 shape the Rust engine's `AuthStateCrypto::from_key_string`
  // accepts so the same env-var works for both engines.
  const decodedAuthKey = parseAuthStateKey(config.authStateKey);

  const state: AppState = {
    config,
    log,
    mongo,
    db,
    redis,
    authStateKey: decodedAuthKey,
    pool: new SessionPool(),
    sessions: new Map<string, BaileysSession>(),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Stash the shared state on `app.locals` so downstream handlers/agents can
  // reach it via `req.app.locals.state` without imports.
  app.locals.state = state;

  // ── Unauthenticated probes ─────────────────────────────────────────────
  // `/healthz` — legacy minimal probe (kept for the Rust engine's contract).
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, svc: 'sabwa-node' });
  });
  // `/health` — richer JSON probe consumed by PM2 watchdogs & admin UI.
  app.use('/health', buildHealthRouter(state));

  // ── Service-token-gated ops surface ───────────────────────────────────
  app.use('/metrics', requireServiceToken(state), buildMetricsRouter(state));

  // ── Authenticated API surface ──────────────────────────────────────────
  app.use('/v1', requireServiceToken(state), buildV1Router(state));

  // ── Browser-facing SSE bridge (JWT-authenticated, NOT service-token) ──
  // The Next.js `/api/sabwa/stream` proxy mints a token via
  // `POST /v1/realtime/token` then opens `GET /realtime/sse/:sessionId`
  // here, mirroring the Rust engine's path layout.
  app.use('/realtime', buildRealtimeStreamRouter(state));

  // ── 404 fallback ───────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ error: 'not found', path: req.path });
  });

  // ── Error handler (must be 4-arg for Express to recognise it) ──────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    log.error({ err, path: req.path }, 'unhandled error');
    if (res.headersSent) return;
    const message = err instanceof Error ? err.message : 'internal error';
    res.status(500).json({ error: message, code: 'internal' });
  });

  const server = app.listen(config.port, () => {
    log.info(`sabwa-node listening on :${config.port}`);
  });

  // ── Background workers ─────────────────────────────────────────────────
  // The bulk-sender drains the per-campaign queue ZSETs at each campaign's
  // configured `sendRate` (msgs/min) and persists per-recipient status.
  // The export worker drains queued export jobs serialised to disk.
  // `startWorkers` is the new umbrella bootstrap — it currently spins up
  // the scheduler tick loop (drains due `sabwa_scheduled` rows every 30 s).
  // The bulk-sender and export workers stay wired inline until they migrate
  // under the same umbrella.
  const stopBulkSender = startBulkSender(state);
  const stopExportWorker = startExportWorker(state);
  const workers = startWorkers(state);

  // ── Graceful shutdown ──────────────────────────────────────────────────
  //
  // Sequence on SIGINT/SIGTERM (signal → exit):
  //   1. Stop accepting new HTTP connections (`server.close()`).
  //   2. Gracefully end every live Baileys socket via `sock.end(undefined)`
  //      so creds save and the reconnect path doesn't fire.
  //   3. Close Mongo + Redis (cmd/pub/sub) connections.
  //   4. exit(0). If the whole sequence takes > 10s we exit(1) so PM2 can
  //      restart instead of letting the process hang forever.
  //
  // Re-entry is guarded by `shuttingDown` — a double SIGTERM (common under
  // PM2 reload) is a no-op.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      log.warn({ signal }, 'shutdown already in progress; ignoring');
      return;
    }
    shuttingDown = true;
    log.info({ signal }, 'shutting down');

    // Hard timeout — if anything below hangs, force-exit so PM2 can recover.
    const timeout = setTimeout(() => {
      log.error({ ms: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out; force-exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    try {
      // 1) Stop accepting new connections (existing ones keep running).
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) log.warn({ err }, 'server.close error');
          resolve();
        });
      });

      // 2) Stop background workers, then gracefully end every Baileys
      //    session in the pool.
      await Promise.allSettled([
        stopBulkSender(),
        stopExportWorker(),
        workers.stopAll(),
      ]);
      await stopAllSessions(state);

      // 3) Close Mongo + Redis (cmd/pub/sub).
      await Promise.allSettled([
        mongo.close(),
        redis.client.quit(),
        redis.pub.quit(),
        redis.sub.quit(),
      ]);

      log.info('shutdown complete');
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      log.error({ err }, 'shutdown error');
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error({ err }, 'sabwa-node failed to start');
  process.exit(1);
});
