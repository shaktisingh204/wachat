/**
 * In-process pub/sub for per-step execution traces.
 *
 * The engine (`executeFlow` → `runFlowInner`) calls `publishTraceStep` after
 * each block runs.  The SSE route (`/api/sabflow/executions/[id]/stream`)
 * subscribes per-executionId and forwards each step to the browser.
 *
 * Per-process, in-memory — multi-instance deployments need a real bus
 * (Redis pub/sub, NATS, etc.).  The public API stays identical.
 */

import type { ExecutionStep } from '@/lib/sabflow/engine/types';

export type TraceEvent =
  | { kind: 'step'; executionId: string; step: ExecutionStep; index: number }
  | { kind: 'end'; executionId: string; status: 'success' | 'error' | 'cancelled'; error?: string };

type Listener = (event: TraceEvent) => void;

const listeners = new Map<string, Set<Listener>>();

export function publishTraceEvent(event: TraceEvent): void {
  // In-process listeners (same Node process — fastest path).
  const subs = listeners.get(event.executionId);
  if (subs) {
    for (const fn of subs) {
      try {
        fn(event);
      } catch {
        /* listener errors are not the publisher's problem */
      }
    }
  }

  // Cross-instance fan-out via Redis pub/sub when available.  The existing
  // SSE endpoint at /api/sabflow/executions/[id]/stream subscribes to the
  // `sabflow:exec:{id}` channel, so trace events surface to clients even
  // when the engine and SSE handler are on different Vercel function
  // instances.  Best-effort — Redis being unreachable must not break the run.
  void publishToRedis(event).catch(() => {
    /* swallow — engine is single-source-of-truth */
  });

  // Last event for a finished execution — drop the in-process listener set
  // so we don't leak memory if subscribers never disconnected.
  if (event.kind === 'end') {
    listeners.delete(event.executionId);
  }
}

let redisClientPromise: Promise<unknown> | null = null;

async function publishToRedis(event: TraceEvent): Promise<void> {
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const mod = (await import('ioredis')) as unknown as {
          Redis: new (cfg: object) => unknown;
          default?: new (cfg: object) => unknown;
        };
        const Ctor = mod.Redis ?? mod.default;
        if (!Ctor) return null;
        const client = new Ctor({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
          lazyConnect: true,
          enableReadyCheck: false,
          maxRetriesPerRequest: 1,
        }) as { connect: () => Promise<void> };
        await client.connect();
        return client;
      } catch {
        return null;
      }
    })();
  }
  const client = (await redisClientPromise) as
    | { publish: (ch: string, msg: string) => Promise<number> }
    | null;
  if (!client) return;
  const channel = `sabflow:exec:${event.executionId}`;
  await client.publish(
    channel,
    JSON.stringify({ type: 'trace', status: 'running', data: event }),
  );
}

export function subscribeToTrace(
  executionId: string,
  listener: Listener,
): () => void {
  let set = listeners.get(executionId);
  if (!set) {
    set = new Set();
    listeners.set(executionId, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
    if (set!.size === 0) listeners.delete(executionId);
  };
}

/** Snapshot — for debugging / tests only. */
export function describeTraceBus(): { executions: number; totalSubscribers: number } {
  let total = 0;
  for (const set of listeners.values()) total += set.size;
  return { executions: listeners.size, totalSubscribers: total };
}
