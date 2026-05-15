/**
 * Redis connection helper for sabwa-node.
 *
 * Returns three handles:
 *   - `client`   — general commands (GET/SET/INCR/queues/etc.)
 *   - `pub`      — dedicated publisher
 *   - `sub`      — dedicated subscriber (node-redis requires sub clients to be
 *                  isolated from regular command traffic)
 *
 * All three share the same URL but use independent connections so a long-lived
 * subscription never blocks command throughput.
 */

import { createClient, type RedisClientType } from 'redis';
import type { Logger } from '../log.js';

export interface RedisHandles {
  client: RedisClientType;
  pub: RedisClientType;
  sub: RedisClientType;
}

async function buildClient(url: string, label: string, log: Logger): Promise<RedisClientType> {
  const c: RedisClientType = createClient({ url });
  c.on('error', (err) => {
    log.error({ err, label }, 'redis client error');
  });
  c.on('reconnecting', () => {
    log.warn({ label }, 'redis reconnecting');
  });
  await c.connect();
  return c;
}

/**
 * Open the three Redis connections used by sabwa-node.
 * Caller is responsible for calling `disconnect()` on all three at shutdown.
 */
export async function connectRedis(url: string, log: Logger): Promise<RedisHandles> {
  const [client, pub, sub] = await Promise.all([
    buildClient(url, 'cmd', log),
    buildClient(url, 'pub', log),
    buildClient(url, 'sub', log),
  ]);
  await client.ping();
  log.info('redis connected (cmd/pub/sub)');
  return { client, pub, sub };
}
