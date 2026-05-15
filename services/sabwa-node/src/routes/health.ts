/**
 * `GET /health` — unauthenticated liveness/readiness probe.
 *
 * Mounted at `/health` (NOT `/v1/health`) so PM2 watchdogs and external uptime
 * checks can reach it without the `X-Sabwa-Service-Token` header. The Rust
 * engine exposed an identical probe at `/healthz`; we keep `/healthz` working
 * elsewhere and add `/health` here with the richer JSON shape the rest of the
 * platform (admin dashboards, deploy scripts) expects.
 *
 * Response shape:
 * ```
 * {
 *   ok: boolean,
 *   ts: string,              // ISO timestamp
 *   version: string,         // package.json version, falls back to "unknown"
 *   sessionsConnected: number,
 *   sessionsTotal: number,
 *   mongoConnected: boolean,
 *   redisConnected: boolean,
 * }
 * ```
 *
 * `ok` is `true` iff Mongo and Redis are both reachable. We deliberately do
 * NOT factor session-pool state into `ok` — a worker with zero connected
 * sessions is still a healthy worker as far as the platform is concerned.
 */

import { Router, type Request, type Response } from 'express';
import type { AppState } from '../state.js';

// Read once at module load — `package.json` version is static for the process.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const VERSION = ((): string => {
  try {
    // `process.env.npm_package_version` is set when launched via `pnpm/npm start`.
    return process.env.npm_package_version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

/** Probe Mongo with a cheap `ping` — bounded so a hung driver can't stall /health. */
async function pingMongo(state: AppState, timeoutMs: number): Promise<boolean> {
  try {
    await Promise.race([
      state.db.command({ ping: 1 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('mongo ping timeout')), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Probe Redis with a cheap `PING`. */
async function pingRedis(state: AppState, timeoutMs: number): Promise<boolean> {
  try {
    const reply = (await Promise.race([
      state.redis.client.ping(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('redis ping timeout')), timeoutMs)),
    ])) as string;
    return reply === 'PONG';
  } catch {
    return false;
  }
}

/** Build the `/health` router (no auth — mount at `/health`). */
export function buildHealthRouter(state: AppState): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response): Promise<void> => {
    const sessionsTotal = state.sessions.size;
    let sessionsConnected = 0;
    for (const s of state.sessions.values()) {
      if (s.status === 'connected') sessionsConnected += 1;
    }

    const [mongoConnected, redisConnected] = await Promise.all([
      pingMongo(state, 2_000),
      pingRedis(state, 2_000),
    ]);

    const ok = mongoConnected && redisConnected;
    res.status(ok ? 200 : 503).json({
      ok,
      ts: new Date().toISOString(),
      version: VERSION,
      sessionsConnected,
      sessionsTotal,
      mongoConnected,
      redisConnected,
    });
  });

  return router;
}
