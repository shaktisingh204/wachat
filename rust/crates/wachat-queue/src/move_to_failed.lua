--[[
  wachat-queue / minimal BullMQ-compatible moveToFailed (with retry).

  Decide whether the job should retry (re-add to wait or delayed depending
  on backoff) or move to the `failed` zset. The retry decision is made
  here in Lua to keep the whole transition atomic — a worker crash after
  decrementing attemptsMade but before rescheduling would otherwise leak
  retries.

  Inputs:
    KEYS[1]  active list                ({prefix}:{queue}:active)
    KEYS[2]  failed zset                ({prefix}:{queue}:failed)
    KEYS[3]  wait list                  ({prefix}:{queue}:wait)
    KEYS[4]  delayed zset               ({prefix}:{queue}:delayed)
    KEYS[5]  prioritized zset           ({prefix}:{queue}:prioritized)
    KEYS[6]  stalled set                ({prefix}:{queue}:stalled)
    KEYS[7]  events stream              ({prefix}:{queue}:events)
    KEYS[8]  marker zset                ({prefix}:{queue}:marker)
    KEYS[9]  job hash                   ({prefix}:{queue}:{jobId})
    KEYS[10] lock key                   ({prefix}:{queue}:{jobId}:lock)
    KEYS[11] priority counter           ({prefix}:{queue}:pc)

    ARGV[1]  jobId
    ARGV[2]  worker token              (must match lock; else lock-lost)
    ARGV[3]  failed_reason             (HSET failedReason — caller-supplied)
    ARGV[4]  finished_on_ms
    ARGV[5]  retry_delay_ms            (-1 → no retry; 0 → wait/prioritized;
                                        >0 → delayed at now+retry_delay_ms)
    ARGV[6]  priority                  (job's priority from opts; 0 → none)
    ARGV[7]  remove_on_fail_count      ("" → no count cap)
    ARGV[8]  remove_on_fail_age_ms     ("" → no age cap)

  Output:
    1   — retried
    2   — failed (terminal)
    -1  — lock lost; caller should drop the failure result
    -2  — job hash missing
]]

local rcall = redis.call

local activeKey      = KEYS[1]
local failedKey      = KEYS[2]
local waitKey        = KEYS[3]
local delayedKey     = KEYS[4]
local prioritizedKey = KEYS[5]
local stalledKey     = KEYS[6]
local eventsKey      = KEYS[7]
local markerKey      = KEYS[8]
local jobKey         = KEYS[9]
local lockKey        = KEYS[10]
local pcKey          = KEYS[11]

local jobId        = ARGV[1]
local token        = ARGV[2]
local failedReason = ARGV[3]
local finishedOn   = tonumber(ARGV[4])
local retryDelay   = tonumber(ARGV[5])
local priority     = tonumber(ARGV[6]) or 0
local trimCountStr = ARGV[7]
local trimAgeStr   = ARGV[8]

if rcall("EXISTS", jobKey) == 0 then
  rcall("LREM", activeKey, 0, jobId)
  rcall("DEL", lockKey)
  rcall("SREM", stalledKey, jobId)
  return -2
end

local currentToken = rcall("GET", lockKey)
if currentToken and currentToken ~= token then
  return -1
end

if retryDelay >= 0 then
  -- Retry path. Bump attemptsMade, clear processedOn, route to the right
  -- list/zset.
  rcall("HINCRBY", jobKey, "attemptsMade", 1)
  rcall("HDEL", jobKey, "processedOn")
  rcall("HSET", jobKey, "failedReason", failedReason)
  rcall("LREM", activeKey, 0, jobId)
  rcall("DEL", lockKey)
  rcall("SREM", stalledKey, jobId)

  if retryDelay > 0 then
    rcall("ZADD", delayedKey, finishedOn + retryDelay, jobId)
    rcall("ZADD", markerKey, 0, "0")
    rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
          "event", "delayed", "jobId", jobId,
          "delay", finishedOn + retryDelay)
  elseif priority > 0 then
    local counter = rcall("INCR", pcKey)
    local score = priority * 2097152 + (counter % 2097152)
    rcall("ZADD", prioritizedKey, score, jobId)
    rcall("ZADD", markerKey, 0, "0")
    rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
          "event", "waiting", "jobId", jobId)
  else
    rcall("LPUSH", waitKey, jobId)
    rcall("ZADD", markerKey, 0, "0")
    rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
          "event", "waiting", "jobId", jobId)
  end

  return 1
end

-- Terminal failure path.
rcall("HSET", jobKey,
      "failedReason", failedReason,
      "finishedOn", finishedOn)
rcall("HINCRBY", jobKey, "attemptsMade", 1)

rcall("LREM", activeKey, 0, jobId)
rcall("ZADD", failedKey, finishedOn, jobId)
rcall("DEL", lockKey)
rcall("SREM", stalledKey, jobId)

if trimCountStr ~= "" then
  local keep = tonumber(trimCountStr)
  if keep and keep >= 0 then
    rcall("ZREMRANGEBYRANK", failedKey, 0, -keep - 1)
  end
end
if trimAgeStr ~= "" then
  local age = tonumber(trimAgeStr)
  if age and age > 0 then
    local cutoff = finishedOn - age
    rcall("ZREMRANGEBYSCORE", failedKey, "-inf", cutoff)
  end
end

rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
      "event", "failed", "jobId", jobId, "failedReason", failedReason)

return 2
