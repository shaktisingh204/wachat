/**
 * Liveness + readiness probes for Mongo, Redis, and BullMQ.
 *
 * - Liveness probes are cheap and only confirm the process is alive.
 * - Readiness probes test the dependencies the app actually needs to serve
 *   traffic.
 *
 * Both are returned as a `HealthSnapshot` so callers (Kubernetes, PM2 health
 * endpoints, status pages) can render them however they like.
 */

import type { HealthSnapshot, Probe, ProbeResult } from './types';

const DEFAULT_PROBE_TIMEOUT_MS = 2_000;

/** Run a single probe and capture timing + error. Never throws. */
export async function runProbe(probe: Probe): Promise<ProbeResult> {
    const startedAt = Date.now();
    const timeoutMs = probe.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS;
    const critical = probe.critical ?? true;
    try {
        const value = await withTimeout(Promise.resolve().then(() => probe.check()), timeoutMs);
        const healthy = value === undefined ? true : Boolean(value);
        return {
            name: probe.name,
            healthy,
            durationMs: Date.now() - startedAt,
            critical,
            error: healthy ? undefined : 'probe returned false',
        };
    } catch (err) {
        return {
            name: probe.name,
            healthy: false,
            durationMs: Date.now() - startedAt,
            critical,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

/** Run all probes in parallel and collapse into a single `HealthSnapshot`. */
export async function runProbes(probes: Probe[]): Promise<HealthSnapshot> {
    const results = await Promise.all(probes.map(runProbe));
    return {
        healthy: results.every((r) => r.healthy || !r.critical),
        checkedAt: Date.now(),
        probes: results,
    };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`probe timed out after ${ms}ms`)), ms);
        promise.then(
            (v) => {
                clearTimeout(timer);
                resolve(v);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

/** Cheap liveness probe — just confirms event loop is responsive. */
export const livenessProbe: Probe = {
    name: 'liveness',
    check: () => true,
    timeoutMs: 500,
};

/** Mongo readiness probe — pings the admin DB. */
export function mongoProbe(getClient: () => Promise<{ db?: unknown; command?: (cmd: object) => Promise<unknown> } & { topology?: unknown } | null | undefined>): Probe {
    return {
        name: 'mongo',
        critical: true,
        timeoutMs: 2_500,
        check: async () => {
            const client = await getClient();
            if (!client) return false;
            const anyClient = client as { db?: (name?: string) => { command: (cmd: object) => Promise<unknown> } };
            if (typeof anyClient.db !== 'function') return false;
            const admin = anyClient.db('admin');
            await admin.command({ ping: 1 });
            return true;
        },
    };
}

/** Redis readiness probe — uses any client exposing a `.ping()` method. */
export function redisProbe(getClient: () => Promise<{ ping: () => Promise<string | 'PONG'> } | null | undefined>): Probe {
    return {
        name: 'redis',
        critical: true,
        timeoutMs: 2_000,
        check: async () => {
            const client = await getClient();
            if (!client) return false;
            const reply = await client.ping();
            return typeof reply === 'string' && reply.toUpperCase() === 'PONG';
        },
    };
}

/** BullMQ readiness probe — confirms the queue's underlying connection is alive. */
export function bullmqProbe(
    getQueue: () => Promise<{ client?: Promise<{ ping: () => Promise<string> }>; getJobCounts?: () => Promise<unknown> } | null | undefined>,
): Probe {
    return {
        name: 'bullmq',
        critical: true,
        timeoutMs: 2_500,
        check: async () => {
            const queue = await getQueue();
            if (!queue) return false;
            if (queue.client) {
                const client = await queue.client;
                const reply = await client.ping();
                return typeof reply === 'string' && reply.toUpperCase() === 'PONG';
            }
            if (typeof queue.getJobCounts === 'function') {
                await queue.getJobCounts();
                return true;
            }
            return false;
        },
    };
}

/** Build a sensible default readiness probe set. */
export interface DefaultReadinessOptions {
    mongo?: () => Promise<Parameters<typeof mongoProbe>[0] extends () => Promise<infer T> ? T : never>;
    redis?: () => Promise<Parameters<typeof redisProbe>[0] extends () => Promise<infer T> ? T : never>;
    bullmq?: () => Promise<Parameters<typeof bullmqProbe>[0] extends () => Promise<infer T> ? T : never>;
}

export function defaultReadinessProbes(opts: DefaultReadinessOptions): Probe[] {
    const probes: Probe[] = [];
    if (opts.mongo) probes.push(mongoProbe(opts.mongo));
    if (opts.redis) probes.push(redisProbe(opts.redis));
    if (opts.bullmq) probes.push(bullmqProbe(opts.bullmq));
    return probes;
}
