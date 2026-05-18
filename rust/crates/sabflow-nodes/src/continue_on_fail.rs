//! SDK helper — n8n-parity `continueOnFail` handling for Rust nodes.
//!
//! ## Why this exists
//!
//! n8n nodes are expected to honour the user-toggled `continueOnFail`
//! parameter on every node. The contract is:
//!
//! - If `continueOnFail === false` (default), a per-item failure aborts
//!   the whole node — the dispatcher applies the retry policy, then
//!   bubbles the error up to the workflow runner.
//! - If `continueOnFail === true`, the node MUST emit a sentinel item
//!   shaped like `{ json: { error: "<message>", ... }, pairedItem: { item } }`
//!   on the regular output port so downstream blocks can branch on
//!   `$json.error`.
//!
//! Implementing this in every one of the 306 Rust nodes is duplicative,
//! easy to mis-do, and makes auditing (C.1.8 metrics, C.2.5 error
//! taxonomy) effectively impossible. This module exposes a single
//! function so node authors call:
//!
//! ```ignore
//! use sabflow_nodes::{try_with_continue_on_fail, ItemResult};
//!
//! for (i, item) in input.items.iter().enumerate() {
//!     match try_with_continue_on_fail(ctx, i, || do_one(ctx, item)).await {
//!         ItemResult::Ok(value) => out.push(value),
//!         ItemResult::ErrorItem(sentinel) => out.push(sentinel),
//!         ItemResult::Abort(err) => return Err(err),
//!     }
//! }
//! ```
//!
//! ## Cross-references
//!
//! - Sibling C.2.5 will land `docs/adr/sabflow-executor-rust-errors.md`,
//!   the canonical error taxonomy. This helper intentionally pairs with
//!   `NodeError` from `crate::error` and surfaces the `Display` message
//!   on the sentinel — the ADR's serialisation is the runtime's
//!   concern, not the node author's.
//! - The C.1.8 metrics dashboard pulls `ctx.metrics.continue_on_fail_count`,
//!   which this helper increments every time it produces an
//!   `ErrorItem`. That's the audit hook.
//! - n8n-parity reference: `src/lib/sabflow/executor/nodes/http-request.ts`
//!   (the canonical TS implementation we mirror) and
//!   `src/lib/sabflow/n8n/core/execution-engine/node-execution-context/`.

use std::future::Future;

use serde_json::{json, Value};

use crate::{
    context::NodeContext,
    error::{NodeError, NodeResult},
};

/// Outcome of a per-item attempt under `continueOnFail` semantics.
///
/// The variant is *typed* (rather than a plain `Result`) because the
/// caller needs to distinguish three cases:
///
/// 1. Success — emit `value` on the regular output.
/// 2. Swallowed failure — emit `sentinel` on the regular output (the
///    runtime treats this as a success).
/// 3. Hard failure — propagate `err` and let the dispatcher retry / abort.
///
/// Collapsing (2) and (3) into a single `Result<_, NodeError>` would
/// force the caller to re-derive intent from a flag, which is exactly
/// the duplication this helper exists to remove.
#[derive(Debug)]
#[must_use = "an ItemResult must be matched — discarding it drops the per-item value"]
pub enum ItemResult<O> {
    /// Success — `O` is the per-item output value.
    Ok(O),
    /// `continueOnFail` swallowed a failure. The pre-shaped sentinel
    /// item is ready to push onto the node's output buffer.
    ErrorItem(Value),
    /// `continueOnFail` was off — propagate this error.
    Abort(NodeError),
}

impl<O> ItemResult<O> {
    /// Convenience: collapse to a `NodeResult` where the caller already
    /// has a way to convert `O` into an output item. Returns `None` if
    /// the variant is `ErrorItem` (the caller should use the sentinel
    /// separately) — most call sites will match the enum directly.
    pub fn into_value(self) -> NodeResult<Option<O>> {
        match self {
            ItemResult::Ok(v) => Ok(Some(v)),
            ItemResult::ErrorItem(_) => Ok(None),
            ItemResult::Abort(e) => Err(e),
        }
    }

    /// True iff this is `Ok(_)`.
    pub fn is_ok(&self) -> bool {
        matches!(self, ItemResult::Ok(_))
    }

    /// True iff this is `ErrorItem(_)`.
    pub fn is_error_item(&self) -> bool {
        matches!(self, ItemResult::ErrorItem(_))
    }
}

/// Run `f` for one item under `continueOnFail` semantics.
///
/// - Returns [`ItemResult::Ok`] when `f` succeeds.
/// - Returns [`ItemResult::ErrorItem`] when `f` fails *and*
///   [`NodeContext::continue_on_fail`] is `true`. The sentinel value
///   has shape `{ "error": "<message>", "json": {}, "pairedItem": { "item": <index> } }`,
///   matching n8n's `INodeExecutionData` sentinel exactly. The audit
///   counter [`crate::context::NodeMetrics::continue_on_fail_count`]
///   is incremented atomically.
/// - Returns [`ItemResult::Abort`] when `f` fails *and*
///   `continue_on_fail()` is `false`. The caller propagates this
///   directly — the dispatcher applies the retry policy.
///
/// `f` is `FnOnce` because each item gets its own future; `Fut` is the
/// returned future. Both bounds match what every existing async node
/// implementation already produces.
pub async fn try_with_continue_on_fail<O, F, Fut>(
    ctx: &NodeContext,
    index: usize,
    f: F,
) -> ItemResult<O>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<O, NodeError>>,
{
    match f().await {
        Ok(value) => ItemResult::Ok(value),
        Err(err) => {
            if ctx.continue_on_fail() {
                // Audit hook for the C.1.8 dashboard.
                ctx.metrics.incr_continue_on_fail();
                ItemResult::ErrorItem(error_sentinel(index, &err))
            } else {
                ItemResult::Abort(err)
            }
        }
    }
}

/// Build the `{ error, json, pairedItem }` sentinel item.
///
/// Public so node authors that already caught an error out-of-band can
/// produce a parity-matching sentinel without re-running `f`. The shape
/// must stay aligned with the TS reference at
/// `src/lib/sabflow/executor/nodes/http-request.ts`.
pub fn error_sentinel(index: usize, err: &NodeError) -> Value {
    let message = err.to_string();
    json!({
        "error": message,
        "json": {
            "error": message,
        },
        "pairedItem": { "item": index },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn ctx(continue_on_fail: bool) -> NodeContext {
        let http = Arc::new(reqwest::Client::new());
        NodeContext::new("exec-test".into(), http).with_continue_on_fail(continue_on_fail)
    }

    #[tokio::test]
    async fn ok_path_yields_value_and_does_not_bump_metric() {
        let c = ctx(true);
        let r: ItemResult<u32> = try_with_continue_on_fail(&c, 0, || async { Ok(42u32) }).await;
        assert!(matches!(r, ItemResult::Ok(42)));
        assert_eq!(c.metrics.continue_on_fail_count(), 0);
    }

    #[tokio::test]
    async fn failure_with_continue_emits_sentinel_and_bumps_metric() {
        let c = ctx(true);
        let r: ItemResult<u32> = try_with_continue_on_fail(&c, 7, || async {
            Err(NodeError::Other("boom".into()))
        })
        .await;
        match r {
            ItemResult::ErrorItem(v) => {
                assert_eq!(v["pairedItem"]["item"], 7);
                assert!(v["error"].as_str().unwrap().contains("boom"));
            }
            other => panic!("expected ErrorItem, got {other:?}"),
        }
        assert_eq!(c.metrics.continue_on_fail_count(), 1);
    }

    #[tokio::test]
    async fn failure_without_continue_aborts() {
        let c = ctx(false);
        let r: ItemResult<u32> = try_with_continue_on_fail(&c, 0, || async {
            Err(NodeError::Other("nope".into()))
        })
        .await;
        assert!(matches!(r, ItemResult::Abort(_)));
        assert_eq!(c.metrics.continue_on_fail_count(), 0);
    }
}
