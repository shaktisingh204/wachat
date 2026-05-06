--[[
  wachat-queue / minimal BullMQ-compatible stalled-job sweep.

  A job is "stalled" if it sits in `active` but its lock key has expired
  (no PEXPIRE renewals from a live worker). This script:

    1. Iterates the `stalled` set (which moveToActive populates).
    2. For each entry, checks whether the lock still exists.
    3. If the lock is gone:
       - Increment `stalledCount` on the job hash.
       - If `stalledCount > max_stalled_count`, fail terminally
         (HSET failedReason, ZADD failed, LREM active, SREM stalled).
       - Otherwise re-queue: LPUSH back into wait (or ZADD prioritized
         if the job has priority) and SREM from stalled.
    4. Returns lists of {failed_ids, requeued_ids} for caller observability.

  We intentionally do NOT block on the result — the consumer fires this
  every `stalled_interval_ms` and logs the count. Callers must NOT treat
  the returned lists as causally ordered; use them only for metrics.

  Inputs:
    KEYS[1]  active list                ({prefix}:{queue}:active)
    KEYS[2]  failed zset                ({prefix}:{queue}:failed)
    KEYS[3]  wait list                  ({prefix}:{queue}:wait)
    KEYS[4]  prioritized zset           ({prefix}:{queue}:prioritized)
    KEYS[5]  stalled set                ({prefix}:{queue}:stalled)
    KEYS[6]  events stream              ({prefix}:{queue}:events)
    KEYS[7]  marker zset                ({prefix}:{queue}:marker)
    KEYS[8]  priority counter           ({prefix}:{queue}:pc)

    ARGV[1]  key prefix                 (`{prefix}:{queue}:`)
    ARGV[2]  max_stalled_count          (1 by default; matches BullMQ)
    ARGV[3]  finished_on_ms             (used when failing terminally)

  Output:
    { { failed_id_1, ... }, { requeued_id_1, ... } }
]]

local rcall = redis.call

local activeKey      = KEYS[1]
local failedKey      = KEYS[2]
local waitKey        = KEYS[3]
local prioritizedKey = KEYS[4]
local stalledKey     = KEYS[5]
local eventsKey      = KEYS[6]
local markerKey      = KEYS[7]
local pcKey          = KEYS[8]

local keyPrefix     = ARGV[1]
local maxStalled    = tonumber(ARGV[2]) or 1
local finishedOn    = tonumber(ARGV[3])

local failed   = {}
local requeued = {}

local candidates = rcall("SMEMBERS", stalledKey)
for _, jobId in ipairs(candidates) do
  local jobKey = keyPrefix .. jobId
  local lockKey = jobKey .. ":lock"

  if rcall("EXISTS", lockKey) == 0 then
    -- Lock has expired without renewal.
    if rcall("EXISTS", jobKey) == 0 then
      -- Job hash gone — already torn down. Just clean up the dangling
      -- stalled entry.
      rcall("SREM", stalledKey, jobId)
      rcall("LREM", activeKey, 0, jobId)
    else
      local count = tonumber(rcall("HINCRBY", jobKey, "stalledCount", 1))
      if count and count > maxStalled then
        -- Terminal failure.
        rcall("HSET", jobKey,
              "failedReason", "job stalled more than allowable limit",
              "finishedOn", finishedOn)
        rcall("LREM", activeKey, 0, jobId)
        rcall("ZADD", failedKey, finishedOn, jobId)
        rcall("SREM", stalledKey, jobId)
        rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
              "event", "failed", "jobId", jobId,
              "failedReason", "stalled")
        failed[#failed + 1] = jobId
      else
        -- Re-queue. Prefer prioritized when the job had a priority.
        rcall("HDEL", jobKey, "processedOn")
        rcall("LREM", activeKey, 0, jobId)
        rcall("SREM", stalledKey, jobId)

        local priority = tonumber(rcall("HGET", jobKey, "priority")) or 0
        if priority > 0 then
          local counter = rcall("INCR", pcKey)
          local score = priority * 2097152 + (counter % 2097152)
          rcall("ZADD", prioritizedKey, score, jobId)
        else
          rcall("LPUSH", waitKey, jobId)
        end
        rcall("ZADD", markerKey, 0, "0")
        rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
              "event", "stalled", "jobId", jobId)
        requeued[#requeued + 1] = jobId
      end
    end
  end
end

return { failed, requeued }
