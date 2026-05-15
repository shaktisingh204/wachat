//! Background worker tasks spawned alongside the HTTP server.
//!
//! Each submodule wraps one long-running future in a `run(state)` entry
//! point. [`spawn_all`] starts every worker on its own Tokio task and
//! returns immediately — supervision (restart on panic, log on failure) is
//! intentionally left to the caller because the bootstrap loop in
//! `main.rs` already handles the process-level lifecycle.

pub mod bulk;
pub mod inbound;
pub mod outbound;
pub mod webhooks_runner;

use crate::state::AppState;

/// Spawn every long-running worker.
///
/// Currently:
/// - [`webhooks_runner`] — bridges the realtime Redis pub/sub fan-out to
///   registered outbound webhook subscribers.
/// - [`outbound`] — drains `sabwa:{sessionId}:outbound` queues, applies
///   anti-ban gating, sends via the WhatsApp pool, and persists results.
///   See SABWA_PLAN.md §5 + §8.
/// - [`inbound`] — `PSUBSCRIBE sabwa:*:events`, persists message / chat /
///   status events into Mongo so HTTP reads have a consistent backing store.
///
/// Each worker is launched on a detached Tokio task. If a worker returns
/// (which should only happen on a fatal error) the failure is logged at
/// `error` level so an operator can correlate it with the surrounding
/// trace context.
///
/// `async` so we can await the same supervise contract in the future; today
/// it just spawns and returns.
pub async fn spawn_all(state: AppState) {
    tokio::spawn(supervise(
        "webhooks_runner",
        webhooks_runner::run(state.clone()),
    ));
    tokio::spawn(supervise("outbound", outbound::run(state.clone())));
    tokio::spawn(supervise("inbound", inbound::run(state.clone())));
    tokio::spawn(supervise("bulk", bulk::run(state)));
}

async fn supervise<F>(name: &'static str, fut: F)
where
    F: std::future::Future<Output = anyhow::Result<()>> + Send + 'static,
{
    match fut.await {
        Ok(()) => {
            tracing::warn!(target: "sabwa::workers", worker = name, "worker exited cleanly");
        }
        Err(err) => {
            tracing::error!(
                target: "sabwa::workers",
                worker = name,
                error = %err,
                "worker exited with error"
            );
        }
    }
}
