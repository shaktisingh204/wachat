--[[
  wachat-queue / minimal BullMQ-compatible moveToCompleted.

  Mark the in-flight job as completed and run any configured trim of the
  `completed` zset (BullMQ `removeOnComplete`).

  We require the caller to pass the worker's lock token — if it doesn't
  match what's currently in the lock key, the job has been re-assigned to
  another worker by the stalled-sweep and we must NOT mark it complete
  (the new owner is still allowed to). The script returns:

    1     — completed (caller may proceed)
    -1    — lock lost; caller should drop this result silently
    -2    — job hash missing (probably already-completed; treat as success)

  Inputs:
    KEYS[1]  active list                 ({prefix}:{queue}:active)
    KEYS[2]  completed zset              ({prefix}:{queue}:completed)
    KEYS[3]  stalled set                 ({prefix}:{queue}:stalled)
    KEYS[4]  events stream               ({prefix}:{queue}:events)
    KEYS[5]  job hash                    ({prefix}:{queue}:{jobId})
    KEYS[6]  lock key                    ({prefix}:{queue}:{jobId}:lock)

    ARGV[1]  jobId                       (the same id stored at KEYS[5])
    ARGV[2]  worker token                (must match the lock value)
    ARGV[3]  return value                (JSON string; HSET returnvalue)
    ARGV[4]  finished_on_ms              (HSET finishedOn)
    ARGV[5]  remove_on_complete_count    ("" → no count cap; numeric → keep
                                          the last N)
    ARGV[6]  remove_on_complete_age_ms   ("" → no age cap; numeric → drop
                                          entries older than now - age)

  Output: integer (see above)
]]

local rcall = redis.call

local activeKey    = KEYS[1]
local completedKey = KEYS[2]
local stalledKey   = KEYS[3]
local eventsKey    = KEYS[4]
local jobKey       = KEYS[5]
local lockKey      = KEYS[6]

local jobId        = ARGV[1]
local token        = ARGV[2]
local returnvalue  = ARGV[3]
local finishedOn   = tonumber(ARGV[4])
local trimCountStr = ARGV[5]
local trimAgeStr   = ARGV[6]

if rcall("EXISTS", jobKey) == 0 then
  -- Already moved out of active — likely a duplicate completion call.
  rcall("LREM", activeKey, 0, jobId)
  rcall("DEL", lockKey)
  rcall("SREM", stalledKey, jobId)
  return -2
end

local currentToken = rcall("GET", lockKey)
if currentToken and currentToken ~= token then
  -- Another worker owns the job now. Don't touch any of the state;
  -- they'll complete or fail it.
  return -1
end

rcall("HSET", jobKey,
      "returnvalue", returnvalue,
      "finishedOn", finishedOn)

rcall("LREM", activeKey, 0, jobId)
rcall("ZADD", completedKey, finishedOn, jobId)
rcall("DEL", lockKey)
rcall("SREM", stalledKey, jobId)

-- Apply removeOnComplete. Both fields are independent — BullMQ runs the
-- count trim first, then the age trim. We mirror that order.
if trimCountStr ~= "" then
  local keep = tonumber(trimCountStr)
  if keep and keep >= 0 then
    -- Keep the most recent `keep` entries — i.e. drop everything below
    -- index (-keep - 1) when sorted by score asc (oldest → newest).
    rcall("ZREMRANGEBYRANK", completedKey, 0, -keep - 1)
  end
end
if trimAgeStr ~= "" then
  local age = tonumber(trimAgeStr)
  if age and age > 0 then
    local cutoff = finishedOn - age
    rcall("ZREMRANGEBYSCORE", completedKey, "-inf", cutoff)
  end
end

rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
      "event", "completed", "jobId", jobId, "returnvalue", returnvalue)

return 1
