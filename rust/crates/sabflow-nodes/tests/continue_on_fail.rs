//! Integration tests for the `try_with_continue_on_fail` SDK helper.
//!
//! These cover the three contract branches from PLAN C.2.8:
//!   1. success path,
//!   2. failure with `continueOnFail = true` → sentinel item + metric bumped,
//!   3. failure with `continueOnFail = false` → propagated `NodeError`.
//!
//! In addition, two regression tests guard the audit hook:
//!   - the counter is monotonic across multiple per-item failures,
//!   - the counter is **not** bumped when `continueOnFail` is off (so a
//!     dashboard reading the counter sees only items the node actually
//!     swallowed).

use std::sync::Arc;

use sabflow_nodes::{
    error_sentinel, try_with_continue_on_fail, ItemResult, NodeContext, NodeError,
};

fn ctx(continue_on_fail: bool) -> NodeContext {
    let http = Arc::new(reqwest::Client::new());
    NodeContext::new("test-exec".into(), http).with_continue_on_fail(continue_on_fail)
}

#[tokio::test]
async fn ok_returns_value() {
    let c = ctx(false);
    let r: ItemResult<&'static str> =
        try_with_continue_on_fail(&c, 0, || async { Ok("hello") }).await;

    match r {
        ItemResult::Ok(v) => assert_eq!(v, "hello"),
        other => panic!("expected Ok variant, got {other:?}"),
    }
    assert_eq!(c.metrics.continue_on_fail_count(), 0);
}

#[tokio::test]
async fn ok_works_when_continue_on_fail_is_on_too() {
    // `continueOnFail` should never alter the success path.
    let c = ctx(true);
    let r: ItemResult<i32> = try_with_continue_on_fail(&c, 0, || async { Ok(7) }).await;

    assert!(matches!(r, ItemResult::Ok(7)));
    assert_eq!(c.metrics.continue_on_fail_count(), 0);
}

#[tokio::test]
async fn failure_with_continue_on_fail_emits_sentinel() {
    let c = ctx(true);
    let r: ItemResult<()> = try_with_continue_on_fail(&c, 3, || async {
        Err(NodeError::HttpError("connection reset".into()))
    })
    .await;

    let sentinel = match r {
        ItemResult::ErrorItem(v) => v,
        other => panic!("expected ErrorItem, got {other:?}"),
    };

    // Shape must match the n8n sentinel — error key, json key, pairedItem.
    assert!(
        sentinel["error"]
            .as_str()
            .map(|s| s.contains("connection reset"))
            .unwrap_or(false),
        "missing or unexpected `error` field: {sentinel:?}"
    );
    assert!(sentinel.get("json").is_some(), "missing `json` field");
    assert_eq!(sentinel["pairedItem"]["item"], 3);

    // Audit hook fired.
    assert_eq!(c.metrics.continue_on_fail_count(), 1);
}

#[tokio::test]
async fn failure_without_continue_on_fail_propagates() {
    let c = ctx(false);
    let r: ItemResult<()> = try_with_continue_on_fail(&c, 0, || async {
        Err(NodeError::MissingParameter("url".into()))
    })
    .await;

    match r {
        ItemResult::Abort(NodeError::MissingParameter(name)) => assert_eq!(name, "url"),
        other => panic!("expected Abort(MissingParameter), got {other:?}"),
    }

    // Metric is NOT bumped on hard failure — only swallowed failures count.
    assert_eq!(c.metrics.continue_on_fail_count(), 0);
}

#[tokio::test]
async fn metric_increments_monotonically_across_items() {
    // Simulate a 5-item loop where 3 items fail under continueOnFail.
    let c = ctx(true);

    let outcomes = [true, false, true, false, false]; // false == failure
    for (i, ok) in outcomes.iter().enumerate() {
        let r: ItemResult<usize> = try_with_continue_on_fail(&c, i, || async move {
            if *ok {
                Ok(i)
            } else {
                Err(NodeError::Other(format!("item {i} blew up")))
            }
        })
        .await;

        if *ok {
            assert!(matches!(r, ItemResult::Ok(_)));
        } else {
            assert!(matches!(r, ItemResult::ErrorItem(_)));
        }
    }

    // Three failures, all swallowed → counter == 3.
    assert_eq!(c.metrics.continue_on_fail_count(), 3);
}

#[tokio::test]
async fn error_sentinel_helper_matches_runtime_shape() {
    // Public sentinel builder — useful when a node caught an error
    // out-of-band but still wants to honour `continueOnFail`.
    let err = NodeError::AuthError("bad token".into());
    let v = error_sentinel(2, &err);

    assert_eq!(v["pairedItem"]["item"], 2);
    assert!(v["error"].as_str().unwrap().contains("bad token"));
    assert!(v.get("json").is_some());
}

#[tokio::test]
async fn into_value_collapses_to_node_result() {
    // ItemResult::into_value is the optional helper for callers that
    // want a single combined Result path.
    let c = ctx(true);

    let r: ItemResult<u8> = try_with_continue_on_fail(&c, 0, || async { Ok(9u8) }).await;
    assert_eq!(r.into_value().unwrap(), Some(9u8));

    let r: ItemResult<u8> =
        try_with_continue_on_fail(&c, 1, || async { Err(NodeError::Other("x".into())) }).await;
    assert_eq!(r.into_value().unwrap(), None);

    let c_off = ctx(false);
    let r: ItemResult<u8> =
        try_with_continue_on_fail(&c_off, 0, || async { Err(NodeError::Other("x".into())) }).await;
    assert!(r.into_value().is_err());
}
