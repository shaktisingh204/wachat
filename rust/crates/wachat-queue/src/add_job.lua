--[[
  wachat-queue / minimal BullMQ-compatible addJob.

  Why this exists: the upstream BullMQ `addStandardJob-9.lua` script depends
  on six other includes (storeJob, getTargetQueueList, deduplicateJob,
  handleDuplicatedJob, getOrSetMaxEvents, addJobInTargetList,
  addBaseMarkerIfNeeded, getDelayedScore, addDelayMarkerIfNeeded,
  addJobWithPriority) and serializes its argument vector with cmsgpack.
  Embedding the full chain into a Rust-side producer means either bundling
  cmsgpack on our side (no good crate matches BullMQ's exact encoding) or
  re-implementing all of it. Either way we'd be silently coupled to the
  internal BullMQ wire format, which BullMQ explicitly does not stabilise.

  Instead we reproduce the *observable* behavior the existing Node workers
  rely on, using straight Redis commands. Specifically we replicate:

    * job hash shape: HMSET on `{prefix}:{queue}:{id}` with
        name, data, opts, timestamp, delay, priority, attemptsMade
      — these are the fields BullMQ's Job#fromRedis reads when a worker
      hydrates a job, and the only ones the broadcast workers actually
      touch (see processControlJob / processSendBatch).
    * jobId allocation: numeric INCR on `{prefix}:{queue}:id` when the
      caller did not supply a `jobId` (matches BullMQ's behavior).
    * dedupe by jobId: if `{prefix}:{queue}:{jobId}` already exists, no-op
      and return the existing id. The TS call site documents this:
        "calling this twice for the same broadcast is a no-op"
    * routing: LPUSH to `{prefix}:{queue}:wait` for ready jobs, ZADD to
      `{prefix}:{queue}:delayed` (score = now + delay) for delayed jobs,
      ZADD to `{prefix}:{queue}:prioritized` for prioritized jobs.
    * marker wakeup: ZADD `{prefix}:{queue}:marker 0 0` so a worker
      currently parked on BZPOPMIN wakes up. See addBaseMarkerIfNeeded.lua.
    * events stream: XADD `added` so any listener on the queue's event
      stream still sees the lifecycle event.
    * meta key: HSETNX opts.maxLenEvents = 10000 if missing, mirroring
      getOrSetMaxEvents — without this BullMQ's downstream Worker setup
      can pick up odd defaults.

  What we deliberately DON'T support (and the Rust types reject at
  compile time so this can't surprise you):
    * job parents / dependencies (no FlowProducer)
    * deduplication keys other than `jobId`
    * repeat / cron jobs
    * rate-limit groups
    * priority counters with overflow semantics — we approximate by
      multiplying priority by 2^21 and adding the queue counter; this
      matches BullMQ's getPriorityScore intent (lower priority number =
      higher priority, FIFO within bucket) but does not preserve the
      exact lex order BullMQ uses past 2,097,152 jobs in one bucket.

  Treat this as the "producer subset" of BullMQ: enough for Node consumers
  to dequeue and process; not a full re-implementation. The crate README
  / lib.rs docstring restates these limits for callers.

  Inputs:
    KEYS[1]  job hash key       ({prefix}:{queue}:{id})
    KEYS[2]  wait list           ({prefix}:{queue}:wait)
    KEYS[3]  delayed zset        ({prefix}:{queue}:delayed)
    KEYS[4]  prioritized zset    ({prefix}:{queue}:prioritized)
    KEYS[5]  meta hash           ({prefix}:{queue}:meta)
    KEYS[6]  events stream       ({prefix}:{queue}:events)
    KEYS[7]  marker zset         ({prefix}:{queue}:marker)
    KEYS[8]  id counter          ({prefix}:{queue}:id)
    KEYS[9]  priority counter    ({prefix}:{queue}:pc)

    ARGV[1]  job_id_or_empty   (when "" we INCR KEYS[8])
    ARGV[2]  job hash key prefix (`{prefix}:{queue}:`) — used to rebuild
             the hash key when we generated a numeric id.
    ARGV[3]  name              (job name, e.g. "process-broadcast")
    ARGV[4]  data              (JSON-stringified payload)
    ARGV[5]  opts              (JSON-stringified options object)
    ARGV[6]  timestamp_ms      (number, current wall clock from caller)
    ARGV[7]  delay_ms          (number, 0 if immediate)
    ARGV[8]  priority          (number, 0 if unset)

  Output:
    string job id  (existing one if dedupe hit, fresh one otherwise)
]]

local rcall = redis.call

local jobIdArg     = ARGV[1]
local keyPrefix    = ARGV[2]
local name         = ARGV[3]
local data         = ARGV[4]
local opts         = ARGV[5]
local timestamp    = tonumber(ARGV[6])
local delay        = tonumber(ARGV[7]) or 0
local priority     = tonumber(ARGV[8]) or 0

local waitKey        = KEYS[2]
local delayedKey     = KEYS[3]
local prioritizedKey = KEYS[4]
local metaKey        = KEYS[5]
local eventsKey      = KEYS[6]
local markerKey      = KEYS[7]
local idCounterKey   = KEYS[8]
local pcKey          = KEYS[9]

-- Resolve job id and hash key. When the caller supplied a custom jobId
-- KEYS[1] is already correct; otherwise we INCR and rebuild.
local jobId
local jobKey
if jobIdArg == "" then
  jobId  = tostring(rcall("INCR", idCounterKey))
  jobKey = keyPrefix .. jobId
else
  jobId  = jobIdArg
  jobKey = KEYS[1]
end

-- Dedupe by jobId: BullMQ's documented behavior is that calling add()
-- twice with the same custom jobId is a no-op. The broadcast queue relies
-- on this for retry safety (see broadcast-queue.ts).
if jobIdArg ~= "" and rcall("EXISTS", jobKey) == 1 then
  -- Still emit a `duplicated` event so listeners see something happened,
  -- mirroring upstream handleDuplicatedJob.lua.
  rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
        "event", "duplicated", "jobId", jobId)
  return jobId
end

-- Bootstrap the meta hash with the default events stream cap.
-- HSETNX so we never clobber a value the consumer side already set.
rcall("HSETNX", metaKey, "opts.maxLenEvents", 10000)

-- Persist the job hash. Field set is intentionally minimal: it covers
-- everything BullMQ's Job#fromRedis needs to hydrate a workable Job for
-- the Node consumer. attemptsMade=0 because this is a fresh enqueue.
rcall("HMSET", jobKey,
      "name",         name,
      "data",         data,
      "opts",         opts,
      "timestamp",    timestamp,
      "delay",        delay,
      "priority",     priority,
      "attemptsMade", 0)

-- Route the job to one of three lists/zsets, mirroring BullMQ's
-- addStandardJob branching:
--   delayed > 0  →  ZSET delayed (score = run-at timestamp).
--   priority > 0 →  ZSET prioritized (score = priority bucket * counter).
--   else         →  LIST wait (FIFO via LPUSH; consumer RPOPs).
if delay > 0 then
  -- BullMQ uses `(timestamp + delay) * 0x1000 + counter`; we use
  -- `timestamp + delay` directly. The high-bit counter is only used to
  -- tie-break between two jobs scheduled for the same exact ms, which is
  -- vanishingly rare for our scheduled-broadcast use case. Worker still
  -- pops them in order; ordering within the same ms is undefined either
  -- way.
  rcall("ZADD", delayedKey, timestamp + delay, jobId)
  rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
        "event", "delayed", "jobId", jobId, "delay", timestamp + delay)
elseif priority > 0 then
  -- Priority FIFO: combine the priority into the high bits and the
  -- per-queue counter into the low bits so equal-priority jobs preserve
  -- enqueue order. 2^21 = 2,097,152 — same magnitude BullMQ uses.
  local counter = rcall("INCR", pcKey)
  local score   = priority * 2097152 + (counter % 2097152)
  rcall("ZADD", prioritizedKey, score, jobId)
  rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
        "event", "waiting", "jobId", jobId)
else
  rcall("LPUSH", waitKey, jobId)
  rcall("XADD", eventsKey, "MAXLEN", "~", 10000, "*",
        "event", "waiting", "jobId", jobId)
end

-- Marker: a worker parked on BZPOPMIN of the marker zset wakes up when
-- anything is added here. Score 0 / member "0" is what BullMQ uses; we
-- ZADD unconditionally because the cost is one Redis call and missing
-- a wakeup is a pathological dead-job latency bug.
rcall("ZADD", markerKey, 0, "0")

-- Always emit the `added` event last so listeners can rely on its
-- ordering relative to `waiting`/`delayed`. Mirrors storeJob.lua.
rcall("XADD", eventsKey, "*",
      "event", "added", "jobId", jobId, "name", name)

return jobId
