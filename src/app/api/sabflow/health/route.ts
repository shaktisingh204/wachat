/**
 * SabFlow — Dependency health check
 *
 * GET /api/sabflow/health
 *   → {
 *       overall: 'green' | 'yellow' | 'red',
 *       checks: { mongo, redis, smtp, engine },
 *       generatedAt: string,
 *     }
 *
 * Each probe is wrapped in a 5s timeout so a hung dependency cannot stall
 * the whole response.  MongoDB is the only "critical" dependency — Redis
 * and SMTP being unavailable degrade the system to "yellow" but do not
 * mark it red.  Engine routes are co-located and always reported green.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROBE_TIMEOUT_MS = 5_000;

type ProbeResult = {
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

type SmtpResult = {
  ok: 'configured' | 'missing';
  error?: string;
};

type EngineResult = {
  ok: true;
};

type HealthOverall = 'green' | 'yellow' | 'red';

type HealthResponse = {
  overall: HealthOverall;
  checks: {
    mongo: ProbeResult;
    redis: ProbeResult;
    smtp: SmtpResult;
    engine: EngineResult;
  };
  generatedAt: string;
};

/**
 * Race a probe against a timeout; swallow throws and report them as
 * `{ ok: false, error }` so a single broken dependency never trips the
 * outer handler.
 */
async function withTimeout<T extends ProbeResult>(
  label: string,
  probe: () => Promise<T>,
): Promise<T | ProbeResult> {
  const start = Date.now();
  try {
    return await Promise.race<T | ProbeResult>([
      probe(),
      new Promise<ProbeResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} probe timed out after ${PROBE_TIMEOUT_MS}ms`)),
          PROBE_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeMongo(): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    await db.admin().ping();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function probeRedis(): Promise<ProbeResult> {
  const start = Date.now();
  // ioredis isn't a hard dependency for every SabFlow install — dynamic
  // import + try/catch lets us report "down" instead of crashing the route
  // when the package or env vars are missing.
  let client: { connect: () => Promise<void>; ping: () => Promise<string>; quit: () => Promise<unknown>; disconnect?: () => void } | null = null;
  try {
    const mod: unknown = await import('ioredis');
    const Redis =
      (mod as { default?: unknown }).default ??
      (mod as { Redis?: unknown }).Redis ??
      mod;
    // Match the rest of the stack (workers, queue producers): REDIS_URL
    // wins when set; otherwise host/port with localhost defaults. `.env`
    // commonly declares `REDIS_HOST=` as an EMPTY string, which must mean
    // "default", not "unconfigured" — use `||`, never `??`/truthy-gating.
    const url = process.env.REDIS_URL || '';
    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT || 6379);
    const password = process.env.REDIS_PASSWORD || undefined;
    const RedisCtor = Redis as unknown as new (
      urlOrOpts: string | Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => {
      connect: () => Promise<void>;
      ping: () => Promise<string>;
      quit: () => Promise<unknown>;
      disconnect?: () => void;
      on: (evt: string, cb: (e: unknown) => void) => void;
    };
    // lazyConnect + explicit connect(): with the offline queue disabled,
    // an eager constructor races ping() against the handshake and fails
    // with "Stream isn't writeable" even when Redis is healthy.
    const connOpts = {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    };
    client = url
      ? new RedisCtor(url, connOpts)
      : new RedisCtor({ host, port, password, ...connOpts });
    // Silence error events so an unreachable Redis doesn't spam unhandled
    // error logs while we're still racing the timeout.
    (client as unknown as { on: (evt: string, cb: (e: unknown) => void) => void }).on(
      'error',
      () => {},
    );
    await client.connect();
    const pong = await client.ping();
    if (pong !== 'PONG') {
      return {
        ok: false,
        latencyMs: Date.now() - start,
        error: `Unexpected ping response: ${pong}`,
      };
    }
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (client) {
      try {
        await client.quit();
      } catch {
        try {
          client.disconnect?.();
        } catch {
          /* noop */
        }
      }
    }
  }
}

function probeSmtp(): SmtpResult {
  // Just an env-var presence check — actually opening an SMTP connection is
  // expensive and noisy on a polling endpoint.
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const missing: string[] = [];
  if (!host) missing.push('SMTP_HOST');
  if (!user) missing.push('SMTP_USER');
  if (!pass) missing.push('SMTP_PASS');
  if (missing.length > 0) {
    return { ok: 'missing', error: `Missing: ${missing.join(', ')}` };
  }
  return { ok: 'configured' };
}

export async function GET() {
  const [mongo, redis] = await Promise.all([
    withTimeout('mongo', probeMongo),
    withTimeout('redis', probeRedis),
  ]);
  const smtp = probeSmtp();
  const engine: EngineResult = { ok: true };

  // Mongo is the only critical dep.  Anything optional (Redis, SMTP) being
  // unavailable degrades us to "yellow" but never "red".
  const mongoOk = mongo.ok === true;
  const optionalDegraded = !redis.ok || smtp.ok === 'missing';
  const overall: HealthOverall = !mongoOk
    ? 'red'
    : optionalDegraded
      ? 'yellow'
      : 'green';

  const body: HealthResponse = {
    overall,
    checks: {
      mongo: mongo as ProbeResult,
      redis: redis as ProbeResult,
      smtp,
      engine,
    },
    generatedAt: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: 200,
    headers: { 'cache-control': 'no-store' },
  });
}
