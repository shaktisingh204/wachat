//! Forward-declared state-machine surface for the executor queue.
//!
//! Sibling #4 (Track B / Phase 2) owns the canonical
//! `sabflow_executions.status` transition in Mongo. Until that lands we
//! expose a thin, behaviour-free stub here so the cancel module's
//! per-node lifecycle can call `state::transition(...)` and compile.
//!
//! When sibling #4 ships, this module is replaced by a re-export of the
//! shared crate — call sites do not change.

use std::fmt;

/// Canonical execution-row statuses the SabFlow executor cares about.
/// Mirrors `ExecutionStatus` on the Node side (`src/lib/sabflow/types.ts`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionStatus {
    /// The execution is currently being processed by a worker.
    Running,
    /// The execution completed successfully.
    Succeeded,
    /// The execution failed with an error.
    Failed,
    /// The execution was cancelled cooperatively (worker honoured the
    /// signal before the hard-kill deadline).
    Canceled,
    /// The execution was force-evicted because the worker did not
    /// honour the cancel within the deadline (hard-kill path).
    Crashed,
    /// A node was skipped because the execution was cancelled before
    /// the node started.
    Skipped,
}

impl fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Canceled => "canceled",
            Self::Crashed => "crashed",
            Self::Skipped => "skipped",
        };
        f.write_str(s)
    }
}

/// Forward-declared transition. Sibling #4 will replace this with the
/// real Mongo write; callers should treat it as a fire-and-forget
/// best-effort log for now.
///
/// `node_id` is `Some(_)` when the transition refers to a single node
/// inside the execution (e.g. marking a node `skipped`), and `None`
/// when the whole execution row is moving (e.g. `running -> canceled`).
pub async fn transition(
    execution_id: &str,
    node_id: Option<&str>,
    next: ExecutionStatus,
) -> Result<(), TransitionError> {
    tracing::debug!(
        execution_id,
        node_id = node_id.unwrap_or("<execution>"),
        next = %next,
        "sabflow.executor.state.transition (forward-decl stub)"
    );
    Ok(())
}

/// Error surface for [`transition`]. Sibling #4 will expand this with
/// the real failure modes (Mongo write errors, invalid transitions,
/// etc.); we keep the type stable so call sites do not change.
#[derive(Debug, thiserror::Error)]
pub enum TransitionError {
    #[error("invalid transition: {0}")]
    Invalid(String),
    #[error("storage error: {0}")]
    Storage(String),
}
