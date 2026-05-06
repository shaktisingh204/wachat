//! Re-export shim for the consumer types delivered by `wachat-queue`.
//!
//! Originally a local stub while Agent 1's consumer landed; now a thin
//! `pub use` so the rest of this crate can keep importing
//! `crate::queue_compat::*` without churn. Drop this module entirely
//! when the broadcast worker is fully bedded in and the import paths
//! have been updated to `use wachat_queue::*` directly.

pub use wachat_queue::{
    BullJob, CloseHandle, JobHandler, JobOutcome, QueueError, Worker, WorkerOptions,
};
