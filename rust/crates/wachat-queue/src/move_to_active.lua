--[[
  wachat-queue / minimal BullMQ-compatible moveToActive.

  Atomically promote one job from `wait` (or `prioritized`, or a now-due
  `delayed` entry) into `active`, set the per-job lock, and return the job
  hash + parsed opts the caller needs to drive lock renewal and retry.

  Mirrors a *subset* of upstream `moveToActive-9.lua`:
    * promote due delayed jobs (score <= now) into wait first
    * prefer prioritized over wait (lower score = higher priority)
    * RPOPLPUSH the chosen list into active
    * SET the lock key with PX = lock_duration_ms (NX so a stalled worker
      can't steal a job that another incarnation already locked)
    * HSET processedOn = now (BullMQ's `Job#processedOn`)
    * SADD the jobId into the stalled set so the stalled-sweep below can
      see it
    * Return { id, name, data, opts, attemptsMade, timestamp }

  What we deliberately DON'T do:
    * rate limiting (no rate-limit groups in the producer, so there's
      nothing to enforce here)
    * dependencies / parents
    * the upstream "removeOnComplete" trim — that lives in moveToCompleted
      because we want to apply it after the user's handler runs

  Inputs:
    KEYS[1]  wait list           ({prefix}:{queue}:wait)
    KEYS[2]  active list         ({prefix}:{queue}:active)
    KEYS[3]  prioritized zset    ({prefix}:{queue}:prioritized)
    KEYS[4]  delayed zset        ({prefix}:{queue}:delayed)
    KEYS[5]  stalled set         ({prefix}:{queue}:stalled)
    KEYS[6]  meta hash           ({prefix}:{queue}:meta)
    KEYS[7]  events stream       ({prefix}:{queue}:events)

    ARGV[1]  key prefix          (`{prefix}:{queue}:`)
    ARGV[2]  worker token        (uuid; written into the lock key)
    ARGV[3]  lock_duration_ms    (PX on the lock SET)
    ARGV[4]  now_ms              (current wall clock — used to gate delayed
                                  promotion and to stamp processedOn)
    ARGV[5]  max_promote         (cap on how many delayed jobs we promote
                                  in one call; keeps the script latency
                                  bounded under heavy delayed-load)

  Output:
    nil                                  — nothing to do, queue empty
    {                                    — job acquired
      id, name, data, opts,
      attemptsMade, timestamp
    }

  Notes on paused queues:
    upstream BullMQ checks `meta.paused`; if set, the worker is supposed
    to skip dequeue. We replicate the check so a Node admin command that
    pauses the queue (HSET meta paused 1) still freezes our consumer.
]]

local rcall = redis.call

local waitKey        = KEYS[1]
local activeKey      = KEYS[2]
local prioritizedKey = KEYS[3]
local delayedKey     = KEYS[4]
local stalledKey     = KEYS[5]
local metaKey        = KEYS[6]
local eventsKey      = KEYS[7]

local keyPrefix      = ARGV[1]
local workerToken    = ARGV[2]
local lockDuration   = tonumber(ARGV[3])
local now            = tonumber(ARGV[4])
local maxPromote     = tonumber(ARGV[5]) or 10

-- Honour the pause flag the way upstream BullMQ does.
if rcall("HGET", metaKey, "paused") == "1" then
  return nil
end

-- 1) Promote due delayed jobs into wait (bounded). BullMQ stores delayed
--    score as `runAt * 0x1000 + counter` upstream; our producer stores the
--    raw `runAt` in ms. We accept both: any score <= now * 0x1000 OR <= now
--    is considered due. We pick the "<= now" interpretation since that's
--    what our producer writes.
local due = rcall("ZRANGEBYSCORE", delayedKey, 0, now, "LIMIT", 0, maxPromote)
for _, jobId in ipairs(due) do
  rcall("ZREM", delayedKey, jobId)
  rcall("LPUSH", waitKey, jobId)
  rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
        "event", "waiting", "jobId", jobId, "prev", "delayed")
end

-- 2) Pick a job. Prioritized has precedence — lowest score first.
local jobId
local source = "prioritized"
local prio = rcall("ZRANGE", prioritizedKey, 0, 0)
if prio[1] then
  jobId = prio[1]
  rcall("ZREM", prioritizedKey, jobId)
  rcall("LPUSH", activeKey, jobId)
else
  source = "wait"
  -- RPOPLPUSH wait → active is the BullMQ pattern; FIFO with LPUSH on
  -- producer side. We use RPOP + LPUSH explicitly so we can fail fast on
  -- nil without a second round-trip.
  jobId = rcall("RPOPLPUSH", waitKey, activeKey)
end

if not jobId then
  return nil
end

local jobKey = keyPrefix .. jobId
local lockKey = jobKey .. ":lock"

-- 3) Acquire the lock. NX so a parallel worker can't double-process a job
-- after a stalled-sweep re-queued it. If the SET fails we drop the job
-- back where it came from so the other worker keeps it.
local lockOk = rcall("SET", lockKey, workerToken, "PX", lockDuration, "NX")
if not lockOk then
  rcall("LREM", activeKey, 1, jobId)
  if source == "prioritized" then
    -- Re-add to prioritized at score 0 — a stalled-sweep already moved it
    -- here; preserving exact ordering is best-effort once a job has bounced
    -- through active twice.
    rcall("ZADD", prioritizedKey, 0, jobId)
  else
    rcall("RPUSH", waitKey, jobId)
  end
  return nil
end

-- 4) Stamp processedOn + register in stalled set.
rcall("HSET", jobKey, "processedOn", now)
rcall("SADD", stalledKey, jobId)

-- 5) Read the fields we need to hand back to the caller. HMGET preserves
-- order so we can decode positionally on the Rust side.
local fields = rcall("HMGET", jobKey,
  "name", "data", "opts", "attemptsMade", "timestamp")

rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
      "event", "active", "jobId", jobId, "prev", source)

return {
  jobId,
  fields[1] or "",
  fields[2] or "",
  fields[3] or "",
  fields[4] or "0",
  fields[5] or "0",
}
