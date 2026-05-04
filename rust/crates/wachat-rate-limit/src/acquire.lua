--[[
  wachat-rate-limit / token-bucket acquire.

  Wire-compatible with `src/workers/broadcast/rate-limiter.js` (Node side) so a
  Rust acquirer and a Node acquirer can share the same bucket without drift.
  The hash schema and refill math below MUST stay identical to that file —
  any change here without a matching TS change will let one side burn
  through tokens that the other side thinks are still in the bucket, and
  the broadcast will exceed its configured MPS.

  Bucket schema (Redis HASH at KEYS[1]):
    tokens : float — tokens currently available
    ts     : int   — last update timestamp, ms since epoch

  The Node version stores these under the same field names (`tokens`, `ts`);
  do NOT rename them.

  Inputs:
    KEYS[1] = bucket key, e.g. `wrl:bucket:bcast:tb:<broadcastId>`
    ARGV[1] = capacity      (max tokens, integer)
    ARGV[2] = refill_per_sec (tokens added per second, integer; for the
              broadcast limiter this equals capacity = mps)
    ARGV[3] = cost          (tokens to consume on success, integer >= 1)

  Returns: { granted, retry_after_ms }
    granted=1 : tokens were decremented, caller may proceed; retry_after_ms=0
    granted=0 : tokens unchanged, caller should sleep retry_after_ms and retry

  Why we use redis.call('TIME') instead of accepting `now` as ARGV:
    * Lua scripts running inside Redis cannot call `os.time()` (it is
      stripped from the sandbox). Redis exposes server time via the `TIME`
      command, which returns {seconds, microseconds} on the master. Using
      it makes the bucket immune to caller clock skew — every acquirer,
      Rust or Node, sees the same monotonic-ish reference frame.
    * The Node side currently passes Date.now() as ARGV; client clocks
      drifting against the Redis server can let one process double-spend
      a refill window. Sourcing `now` from Redis fixes that and matches
      the rest of the SabNode Lua scripts (BullMQ also uses TIME).
  See README in this crate for the migration plan to switch the Node side
  over to the same source of truth.
]]

local key       = KEYS[1]
local capacity  = tonumber(ARGV[1])
local refill_ps = tonumber(ARGV[2])
local cost      = tonumber(ARGV[3])

-- Redis TIME returns { seconds, microseconds }. Compose into milliseconds.
-- Both halves are integers; multiplying first keeps everything in Lua's
-- number type without losing precision for the next ~285,000 years.
local t = redis.call('TIME')
local now_ms = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)

-- Read prior bucket state. HMGET returns Lua nil for missing fields.
local data    = redis.call('HMGET', key, 'tokens', 'ts')
local tokens  = tonumber(data[1])
local last_ts = tonumber(data[2])

-- Cold-start: first call against this bucket. Initialize at full capacity
-- so the very first acquire succeeds (matches the TS limiter, which writes
-- `tokens = mps` when the hash is empty).
if tokens == nil then
  tokens  = capacity
  last_ts = now_ms
end

-- Refill since `last_ts`. `elapsed_sec` is clamped to 0 in the unlikely
-- case the clock went backwards between calls (TIME is monotonic on a
-- single Redis instance, but a failover can move it slightly).
local elapsed_sec = math.max(0, (now_ms - last_ts) / 1000.0)
tokens = math.min(capacity, tokens + elapsed_sec * refill_ps)

-- Persist the new timestamp regardless of whether we grant — this prevents
-- losing partial accumulation when callers are denied repeatedly. TTL is
-- 60s like the TS limiter so idle buckets eventually drop out of memory.
local ttl_ms = 60000

if tokens >= cost then
  tokens = tokens - cost
  redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
  redis.call('PEXPIRE', key, ttl_ms)
  return { 1, 0 }
end

-- Denied. Compute how long the caller should sleep before retrying. We
-- use ceil() so we never tell a caller to retry before there could
-- possibly be enough tokens — under-promising slightly is safer than the
-- alternative of a tight retry loop.
local missing      = cost - tokens
local retry_after  = math.ceil(missing / refill_ps * 1000.0)

redis.call('HMSET', key, 'tokens', tokens, 'ts', now_ms)
redis.call('PEXPIRE', key, ttl_ms)
return { 0, retry_after }
