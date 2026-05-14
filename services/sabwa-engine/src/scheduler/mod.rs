//! Scheduler subsystem for SabWa.
//!
//! Implements SABWA_PLAN.md §8 "Worker & queue design" — the delayed-job
//! scheduler that fires `sabwa_scheduled` messages at their `scheduledFor`
//! time, expands recurring (cron) parents into materialised one-off
//! instances 30 days out, and pushes due jobs onto each session's outbound
//! queue.
//!
//! We intentionally do **not** depend on a BullMQ-compatible crate here.
//! The implementation is a thin, pure-Rust delayed-job queue on top of
//! `redis::AsyncCommands` (Redis sorted set + index hash).
//!
//! ## Module layout
//!
//! - [`queue`]     — Redis-backed delayed-job queue (ZADD by score = unix-ts).
//! - [`tick`]      — background loop that drains due jobs every 5 s.
//! - [`recurring`] — cron expansion → materialised one-off children.
//!
//! Spawn the tick task from `main.rs`:
//!
//! ```ignore
//! tokio::spawn(scheduler::tick::run(state.clone()));
//! ```

pub mod queue;
pub mod tick;
pub mod recurring;
