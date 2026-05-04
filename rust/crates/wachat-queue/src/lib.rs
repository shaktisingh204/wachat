//! # wachat-queue
//!
//! BullMQ-compatible Redis **producer** for the SabNode Rust port. During
//! the strangler-fig migration, Rust handlers will enqueue jobs into the
//! same Redis-backed BullMQ queues that existing Node workers consume:
//!
//!   * `broadcast-control` — one job per broadcast; processed by
//!     `src/workers/broadcast/control.worker.js`.
//!   * `broadcast-send`    — one job per contact batch; processed by
//!     `src/workers/broadcast/send.worker.js`.
//!
//! ## What this crate is
//!
//! A producer-side compatibility shim. The Rust call-site in
//! `wachat-queue` writes the job hash + queue list/zset entries in exactly
//! the keys and shape BullMQ expects, so a Node consumer cannot tell
//! whether the job was produced by `bullmq.Queue.add()` or by us.
//!
//! ## What this crate is NOT
//!
//! A native Rust **consumer**. Phase 7 of the port owns that work; until
//! then, every job the Rust producer enqueues will be picked up by the
//! existing PM2-managed Node workers.
//!
//! ## BullMQ-compat caveat
//!
//! We ship a **minimal Lua fallback** rather than vendoring BullMQ's
//! upstream `addStandardJob-9.lua`. The upstream script depends on
//! cmsgpack and six other Lua includes whose internal contract BullMQ
//! does not stabilise; our version reproduces the *observable* job-hash
//! shape and key layout the consumer needs, but not advanced producer
//! features. **Supported**: `add()` with optional `delay`, `attempts`,
//! `backoff`, `jobId` (dedupe), `priority`. **Not supported**: parents
//! (`FlowProducer`), repeat / cron, deduplication keys other than
//! `jobId`, rate-limit groups, `lifo`. See `add_job.lua` for the
//! line-by-line list of trade-offs.
//!
//! If a future caller needs one of the unsupported features, the safe
//! path is: enqueue from the Node side, or extend `add_job.lua` and add
//! a new producer method — the existing one's signature is stable.
//!
//! ## Example
//!
//! ```no_run
//! use sabnode_db::redis::RedisHandle;
//! use wachat_queue::{BullProducer, JobOptions};
//! use serde::Serialize;
//!
//! #[derive(Serialize)]
//! struct ControlPayload<'a> { broadcast_id: &'a str }
//!
//! # async fn run() -> Result<(), sabnode_common::ApiError> {
//! let redis = RedisHandle::connect("redis://localhost:6379").await
//!     .map_err(sabnode_common::ApiError::Internal)?;
//! let producer = BullProducer::new(redis);
//!
//! let id = producer.add(
//!     "broadcast-control",
//!     "process-broadcast",
//!     &ControlPayload { broadcast_id: "abc123" },
//!     JobOptions {
//!         job_id: Some("bcast_abc123".into()), // dedupe across retries
//!         priority: Some(1_000),
//!         ..Default::default()
//!     },
//! ).await?;
//! # let _ = id;
//! # Ok(()) }
//! ```

pub mod error;
pub mod keys;
pub mod producer;
pub mod script;

// Re-export the public surface so `use wachat_queue::{BullProducer, ...}`
// works without subpath imports.
pub use error::QueueError;
pub use producer::{Backoff, BullProducer, DEFAULT_PREFIX, JobId, JobOptions};
