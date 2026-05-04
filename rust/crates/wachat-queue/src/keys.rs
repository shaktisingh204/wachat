//! Pure key helpers for BullMQ's Redis layout.
//!
//! BullMQ scopes every queue under a configurable prefix (default `bull`) and
//! a queue name. Inside that scope keys are simple suffixes like `wait`,
//! `active`, `delayed`, `id`, … Job hashes piggyback on the same scheme:
//! the `jobId` itself is treated as the suffix, so a job `42` on the
//! `broadcast-control` queue lives at `bull:broadcast-control:42`.
//!
//! See `node_modules/bullmq/dist/cjs/classes/queue-keys.js` for the reference
//! implementation we mirror here. Keep this file pure — it has no I/O so the
//! producer code can be unit-tested without a Redis instance.
//!
//! ## Layout cheat-sheet
//! ```text
//!   bull:{queue}:id           // INCR counter for auto-generated job ids
//!   bull:{queue}:wait         // LIST of ready jobs (LPUSH producer / RPOP consumer)
//!   bull:{queue}:paused       // LIST used while the queue is paused
//!   bull:{queue}:active       // LIST of in-flight jobs (workers move ids here)
//!   bull:{queue}:delayed      // ZSET keyed by execute-at timestamp
//!   bull:{queue}:prioritized  // ZSET keyed by (priority, counter)
//!   bull:{queue}:failed       // ZSET of failed job ids
//!   bull:{queue}:completed    // ZSET of completed job ids
//!   bull:{queue}:meta         // HASH with queue-level metadata (paused, opts.maxLenEvents, ...)
//!   bull:{queue}:events       // STREAM of queue events (added, waiting, ...)
//!   bull:{queue}:marker       // ZSET workers BRPOPLPUSH on for wakeups
//!   bull:{queue}:pc           // INCR counter feeding prioritized scoring
//!   bull:{queue}:{jobId}      // HASH: name, data, opts, timestamp, delay, priority
//! ```

/// Common prefix used everywhere — `bull:{queue}:`.
///
/// Centralised so we can't drift from the BullMQ convention via a missing
/// colon in one call site.
#[inline]
pub fn queue_prefix(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:")
}

/// Hash key holding the serialized job: `{prefix}:{queue}:{id}`.
#[inline]
pub fn job_key(prefix: &str, queue: &str, id: &str) -> String {
    format!("{prefix}:{queue}:{id}")
}

/// LIST of jobs ready to be picked up by a worker.
#[inline]
pub fn wait_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:wait")
}

/// LIST used while the queue is in the `paused` state.
#[inline]
pub fn paused_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:paused")
}

/// LIST of jobs currently being processed.
#[inline]
pub fn active_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:active")
}

/// ZSET of delayed jobs scored by their target execution timestamp.
#[inline]
pub fn delayed_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:delayed")
}

/// ZSET of prioritized jobs (scored by `priority * 2^something + counter`).
#[inline]
pub fn prioritized_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:prioritized")
}

/// ZSET of failed job ids.
#[inline]
pub fn failed_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:failed")
}

/// ZSET of completed job ids.
#[inline]
pub fn completed_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:completed")
}

/// HASH holding queue-level state (paused flag, event-stream max length, …).
#[inline]
pub fn meta_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:meta")
}

/// XADD STREAM where job lifecycle events are emitted.
#[inline]
pub fn events_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:events")
}

/// Marker ZSET — workers BRPOPLPUSH on this for wakeups.
#[inline]
pub fn marker_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:marker")
}

/// INCR counter used by BullMQ to derive monotonically-increasing job ids
/// when the caller doesn't specify a `jobId`.
#[inline]
pub fn id_counter_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:id")
}

/// INCR counter feeding prioritized-zset score (FIFO tie-breaker within a
/// priority bucket).
#[inline]
pub fn priority_counter_key(prefix: &str, queue: &str) -> String {
    format!("{prefix}:{queue}:pc")
}

#[cfg(test)]
mod tests {
    use super::*;

    // The whole point of this module is "do these strings match BullMQ?".
    // Test the canonical layout once so a future refactor can't silently
    // change a colon and quietly break interop with the Node workers.
    #[test]
    fn matches_bullmq_layout() {
        assert_eq!(
            job_key("bull", "broadcast-control", "42"),
            "bull:broadcast-control:42"
        );
        assert_eq!(
            wait_key("bull", "broadcast-control"),
            "bull:broadcast-control:wait"
        );
        assert_eq!(
            active_key("bull", "broadcast-control"),
            "bull:broadcast-control:active"
        );
        assert_eq!(
            delayed_key("bull", "broadcast-control"),
            "bull:broadcast-control:delayed"
        );
        assert_eq!(
            prioritized_key("bull", "broadcast-control"),
            "bull:broadcast-control:prioritized"
        );
        assert_eq!(
            meta_key("bull", "broadcast-control"),
            "bull:broadcast-control:meta"
        );
        assert_eq!(
            events_key("bull", "broadcast-control"),
            "bull:broadcast-control:events"
        );
        assert_eq!(
            marker_key("bull", "broadcast-control"),
            "bull:broadcast-control:marker"
        );
        assert_eq!(
            id_counter_key("bull", "broadcast-control"),
            "bull:broadcast-control:id"
        );
        assert_eq!(
            priority_counter_key("bull", "broadcast-control"),
            "bull:broadcast-control:pc"
        );
        assert_eq!(
            queue_prefix("bull", "broadcast-control"),
            "bull:broadcast-control:"
        );
    }

    #[test]
    fn respects_custom_prefix() {
        // Production sometimes sharded prefixes (`bull:{shard}`); we must
        // honour whatever string the caller hands us, including colons.
        assert_eq!(job_key("bull:{shard1}", "q", "1"), "bull:{shard1}:q:1");
    }
}
