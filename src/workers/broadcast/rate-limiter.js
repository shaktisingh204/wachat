'use strict';

/**
 * Per-broadcast token bucket rate limiter, backed by a Lua script in Redis.
 *
 * Why a Lua script: the refill + check + decrement must be atomic so that
 * multiple worker processes (and concurrent in-process sends) cannot exceed
 * the configured messages-per-second for a given broadcast.
 *
 * Bucket model:
 *   - capacity = mps (allows a 1-second burst)
 *   - refill   = mps tokens / second
 *   - cost     = 1 token per message (caller may request `n`)
 *
 * Returns [granted, wait_ms].
 *  granted=1 -> tokens removed; caller may proceed
 *  granted=0 -> tokens NOT removed; caller should sleep wait_ms and retry
 */

const ACQUIRE_LUA = `
local key  = KEYS[1]
local mps  = tonumber(ARGV[1])
local now  = tonumber(ARGV[2])
local need = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts     = tonumber(data[2])

if tokens == nil then
  tokens = mps
  ts = now
end

local elapsed = math.max(0, now - ts) / 1000.0
tokens = math.min(mps, tokens + elapsed * mps)
ts = now

if tokens >= need then
  tokens = tokens - need
  redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
  redis.call('PEXPIRE', key, 60000)
  return {1, 0}
end

local missing = need - tokens
local wait_ms = math.ceil(missing / mps * 1000.0)
redis.call('HMSET', key, 'tokens', tokens, 'ts', ts)
redis.call('PEXPIRE', key, 60000)
return {0, wait_ms}
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
  return `bcast:tb:${broadcastId}`;
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
  const need = Math.max(1, Math.min(n, mps));

  // Hard ceiling so a misconfigured / dead broadcast can't loop forever.
  const HARD_DEADLINE = Date.now() + 5 * 60 * 1000;

  while (Date.now() < HARD_DEADLINE) {
    const [granted, waitMs] = await redis.bcastAcquire(
      key,
      String(mps),
      String(Date.now()),
      String(need)
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
