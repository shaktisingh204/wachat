import 'server-only';

/**
 * SabCRM — CDC stream consumer (server-only). [RUNTIME-UNVERIFIED]
 *
 * Reads the `sabcrm:cdc` Redis Stream published by `./cdc-bus.server.ts` and
 * fans each normalized record event out to registered handlers (the seam where
 * webhooks / automations / AI indexers subscribe instead of each re-watching
 * Mongo). Register handlers with `onCdcEvent` BEFORE `startCdcConsumer`.
 *
 * ⚠️ Type-clean but not runtime-verified here (needs Redis + the bus producer +
 * a long-lived worker). Degrades safely: no Redis → logs + exits; a throwing
 * handler can't kill the loop. Start it from a Next server context, not a
 * request handler.
 */

import type { SabcrmCdcEvent } from './cdc-bus.server';

const STREAM_KEY = 'sabcrm:cdc';

export type CdcHandler = (event: SabcrmCdcEvent) => Promise<void> | void;

const handlers: CdcHandler[] = [];

/** Register a handler invoked for every CDC event. */
export function onCdcEvent(handler: CdcHandler): void {
  handlers.push(handler);
}

interface RedisLike {
  xread: (...args: Array<string | number>) => Promise<unknown>;
}

async function getRedis(): Promise<RedisLike | null> {
  try {
    const mod = (await import('ioredis')) as unknown as {
      default: new (opts: unknown) => RedisLike;
    };
    return new mod.default({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      maxRetriesPerRequest: null,
    });
  } catch {
    return null;
  }
}

/** Parse a stream entry's flat field array (`['event', '<json>']`) into an event. */
function parseEntry(fields: unknown): SabcrmCdcEvent | null {
  if (!Array.isArray(fields)) return null;
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (fields[i] === 'event' && typeof fields[i + 1] === 'string') {
      try {
        return JSON.parse(fields[i + 1] as string) as SabcrmCdcEvent;
      } catch {
        return null;
      }
    }
  }
  return null;
}

let _running = false;

export function stopCdcConsumer(): void {
  _running = false;
}

/** Tail the CDC stream and dispatch events to handlers. Never throws. */
export async function startCdcConsumer(): Promise<void> {
  if (_running) return;
  _running = true;
  const redis = await getRedis();
  if (!redis) {
    console.warn('[sabcrm-cdc-consumer] Redis unavailable — consumer disabled.');
    _running = false;
    return;
  }
  let lastId = '$'; // only new events from start
  while (_running) {
    try {
      const res = (await redis.xread('BLOCK', 5000, 'COUNT', 100, 'STREAMS', STREAM_KEY, lastId)) as
        | Array<[string, Array<[string, string[]]>]>
        | null;
      if (!res) continue; // BLOCK timeout — loop
      for (const [, entries] of res) {
        for (const [id, fields] of entries) {
          lastId = id;
          const event = parseEntry(fields);
          if (!event) continue;
          for (const handler of handlers) {
            try {
              await handler(event);
            } catch {
              /* a bad handler must not kill the loop */
            }
          }
        }
      }
    } catch (e) {
      console.error('[sabcrm-cdc-consumer] read error; retrying in 5s', e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
