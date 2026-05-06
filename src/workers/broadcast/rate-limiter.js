'use strict';

/**
 * Per-broadcast token bucket rate limiter, backed by a Lua script in Redis.
 *
 * Wire-compatible with the Rust `wachat-rate-limit` crate
 * (`rust/crates/wachat-rate-limit/src/acquire.lua`). Both sides charge against
 * the SAME Redis key with the SAME script, so during the broadcast-worker
 * Rust migration a Node and a Rust acquirer can coordinate without drift.
 *
 * Key layout (must match `TokenBucket::redis_key` on the Rust side):
 *   wrl:bucket:bcast:tb:<broadcastId>
 *
 * Bucket model:
 *   - capacity = mps (allows a 1-second burst)
 *   - refill   = mps tokens / second
 *   - cost     = 1 token per message (caller may request `n`)
 *
 * Lua script:
 *   - Inputs:  KEYS[1]=key, ARGV={capacity, refill_per_sec, cost}
 *   - Output:  { granted, retry_after_ms }
 *   - `now` is sourced from `redis.call('TIME')` so the bucket is immune to
 *     client clock skew across worker processes.
 */

const ACQUIRE_LUA = `
local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local refill_ps = tonumber(ARGV[2])
local cost      = tonumber(ARGV[3])

local t = redis.call('TIME')
local now_ms = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

local data    = redis.call('HMGET', key, 'tokens', 'ts')
local tokens  = tonumber(data[1])
local last_ts = tonumber(data[2])

if tokens == nil then
  tokens  = capacity
  last_ts = now_ms
end

local elapsed_sec = math.max(0, (now_ms - last_ts) / 1000.0)
tokens = math.min(capacity, tokens + elapsed_sec * refill_ps)

local ttl_ms = 60000

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
  redis.call('PEXPIRE', key, ttl_ms)
  return { 1, 0 }
end

local missing      = cost - tokens
local retry_after  = math.ceil(missing / refill_ps * 1000.0)

redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
redis.call('PEXPIRE', key, ttl_ms)
return { 0, retry_after }
`;

const REGISTERED = new WeakSet();

function ensureRegistered(redis) {
  if (REGISTERED.has(redis)) return;
  redis.defineCommand('bcastAcquire', {
    numberOfKeys: 1,
    lua: ACQUIRE_LUA,
  });
  REGISTERED.add(redis);
}

function bucketKey(broadcastId) {
  return `wrl:bucket:bcast:tb:${broadcastId}`;
}

/**
 * Block until `n` tokens are available for the given broadcast bucket.
 *
 * @param {import('ioredis').Redis} redis
 * @param {string} broadcastId
 * @param {number} mps        configured messages per second for this broadcast
 * @param {number} [n=1]      tokens to acquire (clamped to mps)
 * @param {number} [maxSleep=2000] cap on a single sleep, ms (so we re-check status periodically)
 */
async function acquireTokens(redis, broadcastId, mps, n = 1, maxSleep = 2000) {
  ensureRegistered(redis);
  const key = bucketKey(broadcastId);
  const capacity = Math.max(1, mps | 0);
  const need = Math.max(1, Math.min(n, capacity));

  // Hard ceiling so a misconfigured / dead broadcast can't loop forever.
  const HARD_DEADLINE = Date.now() + 5 * 60 * 1000;

  while (Date.now() < HARD_DEADLINE) {
    const [granted, waitMs] = await redis.bcastAcquire(
      key,
      String(capacity),
      String(capacity),
      String(need),
    );
    if (granted === 1) return true;

    const sleep = Math.max(1, Math.min(Number(waitMs) || 50, maxSleep));
    await new Promise((r) => setTimeout(r, sleep));
  }
  throw new Error(`Token bucket starvation for broadcast ${broadcastId} (mps=${mps})`);
}

/**
 * Force-reset a bucket. Useful when cancelling a broadcast.
 */
async function resetBucket(redis, broadcastId) {
  await redis.del(bucketKey(broadcastId));
}

module.exports = { acquireTokens, resetBucket, bucketKey };
