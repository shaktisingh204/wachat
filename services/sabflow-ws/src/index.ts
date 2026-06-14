/**
 * sabflow-ws — entry point.
 *
 * Standalone Node WebSocket gateway for SabFlow real-time CRDT collab. This
 * service follows the standard SabNode sidecar shape (Express on :PORT, PM2-managed,
 * env-driven config) but exposes a WebSocket surface instead of a REST one.
 *
 * Per `docs/adr/sabflow-ws-gateway-node.md` (Track A Phase 1 #3), the gateway
 * lives in its own process — not folded into the Next.js app (blast
 * radius) and not on Vercel Fluid Compute (WS lifetime / instance recycling /
 * pricing model). The browser dials it via a Vercel Routing Middleware rewrite
 * from `/_sabflow/ws`.
 *
 * Responsibilities of THIS file (only):
 *   1. Load `.env` (dotenv).
 *   2. Validate required env vars (SABFLOW_WS_JWT_SECRET, REDIS_URL).
 *   3. Build the Express HTTP server (healthz + metrics endpoint mount point).
 *   4. Attach a `ws.Server` to the same HTTP server in `noServer` mode so the
 *      upgrade handshake can run auth/seat checks before sending `101`.
 *   5. Wire sibling modules (auth / room / connection / reconnect /
 *      backpressure / seats / logger / metrics) via lazy try/catch imports so
 *      this skeleton compiles and boots standalone while sibling agents are
 *      still landing their files (Track A Phase 3 #2 .. #10).
 *   6. Listen on `SABFLOW_WS_PORT` (default 4002).
 *   7. Graceful SIGINT/SIGTERM shutdown.
 *
 * This file does NOT implement any of the protocol logic itself — see the
 * sibling modules above for the actual auth, room fan-out, reconnect handling,
 * backpressure shed-not-buffer policy, seat enforcement, etc.
 */

import 'dotenv/config';
import { createServer, type IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';

/** Hard cap on graceful shutdown — after this we exit(1) so PM2 restarts us. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Default port per the ADR: sabflow-ws = 4002. */
const DEFAULT_PORT = 4002;

interface AppConfig {
  port: number;
  jwtSecret: string;
  redisUrl: string;
  otlpEndpoint: string | undefined;
}

/**
 * Minimal stdout logger used until the real `./logger` module is wired.
 * Sibling agent owns `./logger` (pino-based, structured); we fall back to
 * this so the skeleton can boot on its own.
 */
type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

const fallbackLogger: Logger = {
  info: (...args) => console.log('[sabflow-ws]', ...args),
  warn: (...args) => console.warn('[sabflow-ws]', ...args),
  error: (...args) => console.error('[sabflow-ws]', ...args),
  debug: (...args) => {
    if (process.env.DEBUG) console.debug('[sabflow-ws]', ...args);
  },
};

/**
 * Try to load a sibling module by relative specifier. If the module does not
 * yet exist (sibling agent hasn't landed it), returns `undefined` and logs a
 * warning. This is what lets the skeleton boot stand-alone during Phase 3
 * fan-out.
 *
 * We deliberately use a dynamic `import()` with a swallowed error rather than
 * a static import so TypeScript does not block the build on a missing file.
 */
async function tryLoad<T>(
  specifier: string,
  log: Logger,
): Promise<T | undefined> {
  try {
    // The `/* @vite-ignore */` style hint isn't needed under tsc; the dynamic
    // string keeps the resolver from complaining at type-check time when the
    // file truly doesn't exist on disk.
    const mod = (await import(specifier)) as T;
    return mod;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
      log.warn(
        `sibling module not present yet: ${specifier} — booting without it`,
      );
      return undefined;
    }
    log.error(`failed to load sibling module ${specifier}`, err);
    return undefined;
  }
}

function loadConfig(): AppConfig {
  const portStr = process.env.SABFLOW_WS_PORT ?? String(DEFAULT_PORT);
  const port = Number.parseInt(portStr, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(
      `SABFLOW_WS_PORT must be a positive integer (got ${portStr})`,
    );
  }

  const jwtSecret = process.env.SABFLOW_WS_JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim().length < 16) {
    throw new Error(
      'SABFLOW_WS_JWT_SECRET is required (>= 16 chars). Generate via `openssl rand -base64 32`.',
    );
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required (seat counter + Phase 7 pub/sub)');
  }

  const otlpEndpoint = process.env.OTLP_ENDPOINT;
  // OTLP is optional in dev — `./metrics` will no-op without it.

  return { port, jwtSecret, redisUrl, otlpEndpoint };
}

/**
 * Shape of each sibling module's expected default export. These are the
 * contracts the sibling agents (Phase 3 sub-tasks #2 .. #10) will land. We
 * only call into them when present; the skeleton works without them.
 *
 * Keep these intentionally loose (`unknown` returns, optional methods) so the
 * skeleton does not constrain the sibling agents' final API shapes.
 */
interface AuthModule {
  /** Validates the upgrade request; resolves to a session triple or throws. */
  authenticateUpgrade?: (
    req: IncomingMessage,
    cfg: { jwtSecret: string },
  ) => Promise<{ userId: string; workspaceId: string; planTier: string }>;
}
interface LoggerModule {
  log?: Logger;
  createLogger?: (name: string) => Logger;
}
interface MetricsModule {
  buildMetricsRouter?: () => express.Router;
  recordUpgrade?: (outcome: 'ok' | 'fail') => void;
  recordSocket?: (delta: 1 | -1) => void;
}
interface RoomModule {
  /** Returns/creates the in-memory room for `docId` and registers the socket. */
  joinRoom?: (docId: string, socket: WebSocket, ctx: unknown) => Promise<void>;
}
interface ConnectionModule {
  /** Wires per-socket framing, heartbeat, message dispatch. */
  attachConnection?: (socket: WebSocket, ctx: unknown) => void;
}
interface ReconnectModule {
  /** Server-side helper for the lastSyncedClock hint flow. */
  recordReconnect?: (userId: string, docId: string) => void;
}
interface BackpressureModule {
  /** Per-socket send-queue / rate-limit enforcement. */
  attachBackpressure?: (socket: WebSocket) => void;
}
interface SeatsModule {
  /** Atomic Redis INCR seat check; throws on over-budget. */
  acquireSeat?: (ctx: {
    workspaceId: string;
    docId: string;
    userId: string;
    planTier: string;
  }) => Promise<{ release: () => Promise<void> }>;
}

interface SiblingModules {
  auth: AuthModule | undefined;
  logger: LoggerModule | undefined;
  metrics: MetricsModule | undefined;
  room: RoomModule | undefined;
  connection: ConnectionModule | undefined;
  reconnect: ReconnectModule | undefined;
  backpressure: BackpressureModule | undefined;
  seats: SeatsModule | undefined;
}

async function loadSiblings(log: Logger): Promise<SiblingModules> {
  // Load all siblings in parallel — none depend on each other at import time.
  const [
    logger,
    auth,
    metrics,
    room,
    connection,
    reconnect,
    backpressure,
    seats,
  ] = await Promise.all([
    tryLoad<LoggerModule>('./logger.js', log),
    tryLoad<AuthModule>('./auth.js', log),
    tryLoad<MetricsModule>('./metrics.js', log),
    tryLoad<RoomModule>('./room.js', log),
    tryLoad<ConnectionModule>('./connection.js', log),
    tryLoad<ReconnectModule>('./reconnect.js', log),
    tryLoad<BackpressureModule>('./backpressure.js', log),
    tryLoad<SeatsModule>('./seats.js', log),
  ]);

  return {
    logger,
    auth,
    metrics,
    room,
    connection,
    reconnect,
    backpressure,
    seats,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();

  // Sibling `./logger` is loaded first so subsequent boot logs use it if
  // present; otherwise we keep the fallback console logger for the whole run.
  const earlyLoggerMod = await tryLoad<LoggerModule>(
    './logger.js',
    fallbackLogger,
  );
  const log: Logger =
    earlyLoggerMod?.log ??
    earlyLoggerMod?.createLogger?.('sabflow-ws') ??
    fallbackLogger;

  log.info(`booting on :${config.port}`);
  if (!config.otlpEndpoint) {
    log.warn('OTLP_ENDPOINT not set — metrics export disabled');
  }

  const siblings = await loadSiblings(log);

  // ── Express HTTP surface ────────────────────────────────────────────────
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Unauthenticated probes — standard sidecar health-check shape so PM2
  // watchdogs and the admin UI can reuse the same health-check code path.
  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, svc: 'sabflow-ws' });
  });
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      svc: 'sabflow-ws',
      port: config.port,
      siblings: {
        auth: Boolean(siblings.auth),
        logger: Boolean(siblings.logger),
        metrics: Boolean(siblings.metrics),
        room: Boolean(siblings.room),
        connection: Boolean(siblings.connection),
        reconnect: Boolean(siblings.reconnect),
        backpressure: Boolean(siblings.backpressure),
        seats: Boolean(siblings.seats),
      },
    });
  });

  // `./metrics` (Phase 3 #9) owns the actual Prometheus / OTLP export router.
  // If absent, expose a stub so scrapers don't 404.
  if (siblings.metrics?.buildMetricsRouter) {
    app.use('/metrics', siblings.metrics.buildMetricsRouter());
  } else {
    app.get('/metrics', (_req, res) => {
      res.type('text/plain').send('# sabflow-ws metrics not yet wired\n');
    });
  }

  // ── HTTP + WS coupling ──────────────────────────────────────────────────
  // We create the underlying http.Server ourselves and attach `ws.Server` in
  // `noServer` mode so the upgrade handshake can run auth + seat checks
  // BEFORE replying with `101` (per ADR §3).
  const server = createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on(
    'upgrade',
    (req: IncomingMessage, socket: Socket, head: Buffer) => {
      const url = req.url ?? '/';
      if (!url.startsWith('/ws')) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      // The full auth/seat/rbac pipeline lives in `./auth` + `./seats`. Here
      // we just gate on whether those siblings are wired yet. If not, the
      // skeleton accepts the upgrade so devs can smoke-test the transport;
      // production deploys MUST land all siblings before going live.
      const finalize = (): void => {
        wss.handleUpgrade(req, socket, head, (ws) => {
          siblings.metrics?.recordUpgrade?.('ok');
          siblings.metrics?.recordSocket?.(1);
          wss.emit('connection', ws, req);
        });
      };

      if (!siblings.auth?.authenticateUpgrade) {
        log.warn('auth sibling missing — accepting upgrade without auth (dev)');
        finalize();
        return;
      }

      siblings.auth
        .authenticateUpgrade(req, { jwtSecret: config.jwtSecret })
        .then(() => finalize())
        .catch((err) => {
          log.warn('upgrade auth rejected', err);
          siblings.metrics?.recordUpgrade?.('fail');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
        });
    },
  );

  wss.on('connection', (ws, _req) => {
    // Delegate the whole per-socket lifecycle (framing, heartbeat, dispatch,
    // backpressure, room join, reconnect bookkeeping) to siblings. Each
    // sibling is optional at skeleton time; missing ones just no-op.
    try {
      siblings.connection?.attachConnection?.(ws, {
        log,
        config,
        siblings,
      });
      siblings.backpressure?.attachBackpressure?.(ws);
    } catch (err) {
      log.error('connection setup failed', err);
      try {
        ws.close(4500, 'server-error');
      } catch {
        /* socket already gone */
      }
    }

    ws.on('close', () => {
      siblings.metrics?.recordSocket?.(-1);
    });
  });

  server.listen(config.port, () => {
    log.info(`sabflow-ws listening on :${config.port} (ws path: /ws)`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────────
  // Standard sidecar pattern: stop accepting connections, close active
  // sockets cleanly, then exit. PM2 takes over on exit code != 0.
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      log.warn(`shutdown already in progress; ignoring ${signal}`);
      return;
    }
    shuttingDown = true;
    log.info(`shutting down (${signal})`);

    const timeout = setTimeout(() => {
      log.error(`shutdown timed out after ${SHUTDOWN_TIMEOUT_MS}ms; exit(1)`);
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timeout.unref();

    try {
      // 1) Stop accepting new HTTP/WS connections.
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      // 2) Close every live WS with code 1001 (going away). The Phase 5 client
      //    SDK treats 1001 as retryable, so editors will reconnect once the
      //    new process is up.
      for (const ws of wss.clients) {
        try {
          ws.close(1001, 'server-restart');
        } catch {
          /* ignore */
        }
      }
      await new Promise<void>((resolve) => wss.close(() => resolve()));

      log.info('shutdown complete');
      clearTimeout(timeout);
      process.exit(0);
    } catch (err) {
      log.error('shutdown error', err);
      clearTimeout(timeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  fallbackLogger.error('sabflow-ws failed to start', err);
  process.exit(1);
});
