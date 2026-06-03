//! Worker-side cancellation honour for the SabFlow executor.
//!
//! Design (matches Track B / Phase 2 sub-task #9):
//!
//! 1. The **dispatcher** (sibling #1) calls [`CancelRegistry::register`] when
//!    it picks up a job, handing in the job's `execution_id` and a fresh
//!    [`CancellationToken`]. The token is what node executors plumb into
//!    `reqwest` / `tokio::select!` so an in-flight HTTP call is aborted
//!    the moment cancel arrives.
//!
//! 2. The dispatcher also runs [`spawn_pubsub_listener`] once at startup.
//!    That task subscribes to the `sabflow:cancel:*` Redis pubsub pattern
//!    and, on every message, looks up the running job by `execution_id`
//!    and calls `token.cancel()`. No per-node polling of Redis.
//!
//! 3. **Per-node lifecycle**: the engine calls [`check_between_nodes`]
//!    between two node executions. If cancelled, it stops iteration,
//!    marks the current node `skipped` and the execution `canceled` via
//!    the forward-declared [`crate::state::transition`].
//!
//! 4. **Mid-node**: long-running node bodies (HTTP requests, sandbox
//!    eval, …) take a `&CancellationToken` and race their future against
//!    [`CancellationToken::cancelled`] with [`run_cancellable`] — when
//!    cancel fires the inner future is dropped, which aborts the
//!    `reqwest` request that was in flight.
//!
//! 5. **Hard-kill path** is owned by the Node side
//!    (`src/lib/sabflow/queue/cancel.ts`): if the execution row has not
//!    transitioned to `canceled` within 10 s, the admin call removes
//!    the worker's Redis lock so sibling #8's drain logic can evict
//!    the stuck worker and a fresh worker picks the row up as
//!    `crashed`. This module only owns the *cooperative* side.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use fred::clients::Client;
use fred::prelude::*;
use fred::types::Message;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::state::{self, ExecutionStatus};

/// Redis pubsub channel pattern used by the Node admin/editor side to
/// broadcast a cancel signal for a single execution. The suffix is the
/// hex `executionId` from Mongo (matches `SABFLOW_EXEC_CHANNEL` on the
/// TS side, with a different segment so we can subscribe via PSUBSCRIBE
/// without colliding with the trace channel).
pub const SABFLOW_CANCEL_CHANNEL_PREFIX: &str = "sabflow:cancel:";

/// Pattern handed to `PSUBSCRIBE`. Wildcard matches any executionId.
pub const SABFLOW_CANCEL_CHANNEL_PATTERN: &str = "sabflow:cancel:*";

/// In-process registry of running jobs and their cancel tokens.
///
/// The dispatcher owns one of these (typically inside an `Arc`) for the
/// life of the worker process. `register` is called on lease, `cancel`
/// is called by the pubsub listener (and also by the worker's local
/// timeout watchdog), and `forget` is called on job completion to keep
/// the map from growing unboundedly.
#[derive(Default, Debug)]
pub struct CancelRegistry {
    inner: RwLock<HashMap<String, CancellationToken>>,
}

impl CancelRegistry {
    /// Construct an empty registry. Cheap — call once and `Arc::clone`
    /// the result everywhere the worker needs it.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a running job. Returns the child token the dispatcher
    /// should plumb into the node executors (and into
    /// [`run_cancellable`] for any in-flight HTTP call).
    ///
    /// Re-registering the same `execution_id` cancels the previous
    /// token — this is the safe behaviour when a worker re-leases a
    /// row after a stale state.
    pub async fn register(&self, execution_id: impl Into<String>) -> CancellationToken {
        let id = execution_id.into();
        let token = CancellationToken::new();
        let mut guard = self.inner.write().await;
        if let Some(prev) = guard.insert(id, token.clone()) {
            // Defensive: never silently shadow an outstanding token.
            prev.cancel();
        }
        token
    }

    /// Look up the token for an executionId and trigger cancellation.
    /// Returns `true` when a running job was found and signalled,
    /// `false` when the executionId is unknown (already finished,
    /// owned by a different worker, …) — the Node side's hard-kill
    /// path handles that case via the 10-second deadline.
    pub async fn cancel(&self, execution_id: &str) -> bool {
        let guard = self.inner.read().await;
        match guard.get(execution_id) {
            Some(token) => {
                token.cancel();
                tracing::info!(execution_id, "sabflow.executor.cancel.signaled",);
                true
            }
            None => {
                tracing::debug!(execution_id, "sabflow.executor.cancel.unknown_execution",);
                false
            }
        }
    }

    /// Remove an entry once the job has finished (succeeded, failed,
    /// canceled). Safe to call when the entry is missing.
    pub async fn forget(&self, execution_id: &str) {
        let mut guard = self.inner.write().await;
        guard.remove(execution_id);
    }

    /// Snapshot count — used by metrics / tests.
    pub async fn len(&self) -> usize {
        self.inner.read().await.len()
    }

    /// True when no jobs are currently registered.
    pub async fn is_empty(&self) -> bool {
        self.inner.read().await.is_empty()
    }
}

/// Spawn the Redis pubsub listener that turns `sabflow:cancel:<id>`
/// messages into [`CancelRegistry::cancel`] calls.
///
/// The returned [`CancellationToken`] is for the *listener* itself —
/// drop the worker, cancel that token, and the listener task exits.
/// The token is unrelated to the per-job tokens stored inside the
/// registry.
///
/// `client` MUST be a fred `Client` dedicated to pubsub (Redis blocks
/// non-pubsub commands on a connection once it has been subscribed).
/// Sibling #1 owns the dispatcher and calls this once at startup with
/// a dedicated client.
pub fn spawn_pubsub_listener(client: Client, registry: Arc<CancelRegistry>) -> CancellationToken {
    let shutdown = CancellationToken::new();
    let shutdown_listener = shutdown.clone();

    tokio::spawn(async move {
        // `message_rx` returns a broadcast receiver that yields every
        // pubsub message delivered to the underlying connection. The
        // sibling `psubscribe` call below tells Redis which channels
        // we care about.
        let mut messages = client.message_rx();

        if let Err(err) = client.psubscribe(SABFLOW_CANCEL_CHANNEL_PATTERN).await {
            tracing::error!(
                error = %err,
                pattern = SABFLOW_CANCEL_CHANNEL_PATTERN,
                "sabflow.executor.cancel.psubscribe_failed",
            );
            return;
        }

        loop {
            tokio::select! {
                _ = shutdown_listener.cancelled() => {
                    tracing::info!("sabflow.executor.cancel.listener_shutdown");
                    let _ = client.punsubscribe(SABFLOW_CANCEL_CHANNEL_PATTERN).await;
                    break;
                }
                next = messages.recv() => {
                    match next {
                        Ok(msg) => handle_pubsub_message(&msg, &registry).await,
                        Err(err) => {
                            tracing::warn!(
                                error = %err,
                                "sabflow.executor.cancel.pubsub_recv_err",
                            );
                            // Brief backoff so we don't busy-loop while
                            // fred reconnects under us.
                            tokio::time::sleep(Duration::from_millis(250)).await;
                        }
                    }
                }
            }
        }
    });

    shutdown
}

async fn handle_pubsub_message(msg: &Message, registry: &CancelRegistry) {
    // We subscribed to a pattern, so the channel string carries the
    // executionId in its suffix. The message payload (the published
    // string) is informational only — we don't trust it for the id.
    //
    // `msg.channel` is a `fred::types::Str` (a Bytes-backed string).
    // It derefs to `str`, so `&*` gives us the string slice we need
    // for `strip_prefix`.
    let channel: &str = &msg.channel;
    let Some(execution_id) = channel.strip_prefix(SABFLOW_CANCEL_CHANNEL_PREFIX) else {
        tracing::debug!(channel, "sabflow.executor.cancel.unexpected_channel",);
        return;
    };

    if execution_id.is_empty() {
        return;
    }

    registry.cancel(execution_id).await;
}

/// Per-node lifecycle hook. Called by the engine between two node
/// executions. Returns [`NodeStep::Stop`] when cancellation has fired
/// — the engine should stop iterating, mark the *current* node as
/// `skipped`, and let the caller finalize the execution row.
pub async fn check_between_nodes(
    execution_id: &str,
    current_node_id: &str,
    token: &CancellationToken,
) -> NodeStep {
    if !token.is_cancelled() {
        return NodeStep::Continue;
    }

    // Best-effort: forward-decl, so we log on failure but do not
    // unwind the engine — sibling #4 will harden this.
    if let Err(err) = state::transition(
        execution_id,
        Some(current_node_id),
        ExecutionStatus::Skipped,
    )
    .await
    {
        tracing::warn!(
            execution_id,
            current_node_id,
            error = %err,
            "sabflow.executor.cancel.node_skip_transition_failed",
        );
    }

    if let Err(err) = state::transition(execution_id, None, ExecutionStatus::Canceled).await {
        tracing::warn!(
            execution_id,
            error = %err,
            "sabflow.executor.cancel.execution_transition_failed",
        );
    }

    NodeStep::Stop
}

/// Per-node lifecycle answer.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeStep {
    /// Proceed to the next node.
    Continue,
    /// Cancellation fired; stop iteration and let the engine finalize.
    Stop,
}

/// Race an in-flight node body (typically a `reqwest` future) against
/// cancellation. When the token fires, the inner future is dropped —
/// `reqwest`'s `Drop` aborts the in-flight HTTP request, satisfying
/// requirement (4) on the Rust side.
///
/// Returns `Err(CancelError::Cancelled)` when cancel won the race and
/// the inner future's `Ok`/`Err` result otherwise.
pub async fn run_cancellable<F, T, E>(
    token: &CancellationToken,
    fut: F,
) -> Result<T, CancelError<E>>
where
    F: std::future::Future<Output = Result<T, E>>,
{
    tokio::select! {
        biased;
        _ = token.cancelled() => Err(CancelError::Cancelled),
        out = fut => out.map_err(CancelError::Inner),
    }
}

/// Error returned by [`run_cancellable`].
#[derive(Debug, thiserror::Error)]
pub enum CancelError<E> {
    /// The cancel token fired before the inner future completed.
    #[error("execution cancelled")]
    Cancelled,
    /// The inner future returned its own error.
    #[error("{0}")]
    Inner(E),
}

impl<E> CancelError<E> {
    /// True when the variant is [`Cancelled`].
    pub fn is_cancelled(&self) -> bool {
        matches!(self, Self::Cancelled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn register_returns_uncancelled_token() {
        let registry = CancelRegistry::new();
        let token = registry.register("exec-1").await;
        assert!(!token.is_cancelled());
        assert_eq!(registry.len().await, 1);
    }

    #[tokio::test]
    async fn cancel_signals_registered_token() {
        let registry = Arc::new(CancelRegistry::new());
        let token = registry.register("exec-2").await;
        assert!(registry.cancel("exec-2").await);
        assert!(token.is_cancelled());
    }

    #[tokio::test]
    async fn cancel_unknown_returns_false() {
        let registry = CancelRegistry::new();
        assert!(!registry.cancel("never-registered").await);
    }

    #[tokio::test]
    async fn re_register_cancels_previous_token() {
        let registry = CancelRegistry::new();
        let first = registry.register("exec-3").await;
        let _second = registry.register("exec-3").await;
        assert!(first.is_cancelled());
    }

    #[tokio::test]
    async fn forget_removes_entry() {
        let registry = CancelRegistry::new();
        registry.register("exec-4").await;
        registry.forget("exec-4").await;
        assert!(registry.is_empty().await);
    }

    #[tokio::test]
    async fn check_between_nodes_continues_when_not_cancelled() {
        let token = CancellationToken::new();
        let step = check_between_nodes("exec-5", "node-a", &token).await;
        assert_eq!(step, NodeStep::Continue);
    }

    #[tokio::test]
    async fn check_between_nodes_stops_when_cancelled() {
        let token = CancellationToken::new();
        token.cancel();
        let step = check_between_nodes("exec-6", "node-b", &token).await;
        assert_eq!(step, NodeStep::Stop);
    }

    #[tokio::test]
    async fn run_cancellable_returns_inner_ok() {
        let token = CancellationToken::new();
        let out: Result<i32, CancelError<&'static str>> =
            run_cancellable(&token, async { Ok::<i32, &'static str>(7) }).await;
        assert!(matches!(out, Ok(7)));
    }

    #[tokio::test]
    async fn run_cancellable_returns_cancelled_when_token_fires_first() {
        let token = CancellationToken::new();
        let child = token.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(5)).await;
            child.cancel();
        });
        let out: Result<(), CancelError<&'static str>> = run_cancellable(&token, async {
            tokio::time::sleep(Duration::from_secs(60)).await;
            Ok(())
        })
        .await;
        assert!(out.unwrap_err().is_cancelled());
    }
}
