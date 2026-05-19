//! # email-journey-worker
//!
//! Worker library for the SabNode email journey engine. Drains the
//! BullMQ `"email-journey"` queue produced by `email-journeys`, ticks
//! per-run state, fires emails via the `email-send` queue, and bulk-
//! enrols subscribers when triggers fire.
//!
//! ## Three concurrent loops
//!
//! 1. [`queue::run_consumer`] — BullMQ consumer for `"email-journey"`.
//!    Handles `journey-tick` and `journey-enroll-bulk`.
//! 2. [`scheduler::run_scheduler`] — every 30s, finds runs with
//!    `status=waiting` and `nextStepAt <= now` and enqueues their next
//!    tick.
//! 3. [`trigger_listener::run_trigger_listener`] — every 60s, polls for
//!    new external events (today: list-join only) and bulk-enrols
//!    matching subscribers into active journeys.
//!
//! ## Public surface
//!
//! ```ignore
//! use email_journey_worker::{EmailJourneyWorkerState, run};
//!
//! # async fn boot(mongo: sabnode_db::mongo::MongoHandle,
//! #               bull: wachat_queue::BullProducer,
//! #               redis: sabnode_db::redis::RedisHandle) -> anyhow::Result<()> {
//! let state = EmailJourneyWorkerState { mongo, bull, redis };
//! email_journey_worker::run(state).await?;
//! # Ok(()) }
//! ```

#![forbid(unsafe_code)]

pub mod filter;
pub mod queue;
pub mod scheduler;
pub mod trigger_listener;

use anyhow::Result;
use sabnode_db::{mongo::MongoHandle, redis::RedisHandle};
use tracing::info;
use wachat_queue::BullProducer;

/// Worker state. Cheap to clone — every field is `Arc`-backed.
#[derive(Clone)]
pub struct EmailJourneyWorkerState {
    pub mongo: MongoHandle,
    /// Producer used to:
    ///   * enqueue `journey-tick` jobs (next-node hand-off, scheduler
    ///     wake-up, enrol fan-out), and
    ///   * push `journey-step` jobs onto the `email-send` queue.
    pub bull: BullProducer,
    /// Redis handle the BullMQ consumer drives.
    pub redis: RedisHandle,
}

/// Run all three loops to completion. Returns on the first fatal error;
/// the binary is expected to wrap this in `tokio::select!` against a
/// signal future and abort the other tasks on shutdown.
pub async fn run(state: EmailJourneyWorkerState) -> Result<()> {
    info!("email-journey-worker starting (consumer + scheduler + trigger listener)");
    let consumer = tokio::spawn({
        let s = state.clone();
        async move { queue::run_consumer(s).await }
    });
    let scheduler = tokio::spawn({
        let s = state.clone();
        async move { scheduler::run_scheduler(s).await }
    });
    let triggers = tokio::spawn({
        let s = state.clone();
        async move { trigger_listener::run_trigger_listener(s).await }
    });

    tokio::select! {
        r = consumer => {
            r.map_err(|e| anyhow::anyhow!("consumer join: {e}"))??;
        }
        r = scheduler => {
            r.map_err(|e| anyhow::anyhow!("scheduler join: {e}"))??;
        }
        r = triggers => {
            r.map_err(|e| anyhow::anyhow!("triggers join: {e}"))??;
        }
    }
    Ok(())
}
