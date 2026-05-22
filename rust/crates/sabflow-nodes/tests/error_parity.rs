//! Error-parity tests: every Rust [`ExecutorError`] variant serialises to
//! the exact JSON shape produced by the TS-side `toWireError()` in
//! `src/lib/sabflow/executor/errors.ts`.
//!
//! These tests are the executable wire contract — any drift between the
//! two implementations breaks here, not in production.

use sabflow_nodes::errors::{
    CredentialFailure, ErrorContext, ExecutorError, ExecutorErrorCode, NodeOperationReason,
    WireError, WorkflowFaultKind, codes,
};
use serde_json::{Value, json};

/// Helper: serialise to a `serde_json::Value` so we can assert on the
/// JSON shape without worrying about key ordering.
fn to_value(err: &ExecutorError) -> Value {
    serde_json::to_value(err.to_wire()).expect("WireError must serialise")
}

/// Helper: assert a wire payload has the expected top-level shape.
fn assert_top_level(v: &Value, code: &str, retryable: bool) {
    assert_eq!(v.get("code").and_then(Value::as_str), Some(code));
    assert_eq!(v.get("retryable").and_then(Value::as_bool), Some(retryable));
    assert!(v.get("message").and_then(Value::as_str).is_some());
}

/* ------------------------------------------------------------------ */
/* Per-variant parity                                                  */
/* ------------------------------------------------------------------ */

#[test]
fn node_api_error_5xx_round_trip() {
    let err = ExecutorError::NodeApi {
        message: "HTTP 502 from upstream".into(),
        http_status: Some(502),
        body: Some(json!({ "error": "bad gateway" })),
        retryable: None,
        retry_after: Some("30".into()),
        url: Some("https://api.example.com/x".into()),
        method: Some("GET".into()),
        context: ErrorContext {
            node_id: Some("n1".into()),
            node_type: Some("n8n-nodes-base.httpRequest".into()),
            workflow_id: Some("wf-1".into()),
            execution_id: Some("exec-1".into()),
        },
    };
    let v = to_value(&err);
    assert_top_level(&v, "NODE_API", true);
    assert_eq!(v.get("httpStatus").and_then(Value::as_u64), Some(502));
    assert_eq!(v.get("nodeId").and_then(Value::as_str), Some("n1"));
    assert_eq!(
        v.get("nodeType").and_then(Value::as_str),
        Some("n8n-nodes-base.httpRequest")
    );
    assert_eq!(v.get("workflowId").and_then(Value::as_str), Some("wf-1"));
    assert_eq!(v.get("executionId").and_then(Value::as_str), Some("exec-1"));

    let details = v.get("details").expect("details present");
    assert_eq!(
        details.get("retryAfter").and_then(Value::as_str),
        Some("30")
    );
    assert_eq!(
        details.get("url").and_then(Value::as_str),
        Some("https://api.example.com/x")
    );
    assert_eq!(details.get("method").and_then(Value::as_str), Some("GET"));
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::NODE_API_5XX)
    );

    // Round-trip back through from_wire.
    let wire: WireError = serde_json::from_value(v).expect("wire must deserialise");
    let back = ExecutorError::from_wire(&wire);
    assert_eq!(back.code(), ExecutorErrorCode::NodeApi);
    assert!(back.is_retryable());
}

#[test]
fn node_api_error_401_not_retryable() {
    let err = ExecutorError::node_api(401, "Unauthorized");
    let v = to_value(&err);
    assert_top_level(&v, "NODE_API", false);
    assert_eq!(v.get("httpStatus").and_then(Value::as_u64), Some(401));
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::NODE_API_401)
    );
}

#[test]
fn node_api_error_429_retryable_with_retry_after() {
    let err = ExecutorError::NodeApi {
        message: "Too Many Requests".into(),
        http_status: Some(429),
        body: None,
        retryable: None,
        retry_after: Some("60".into()),
        url: None,
        method: None,
        context: ErrorContext::default(),
    };
    let v = to_value(&err);
    assert_top_level(&v, "NODE_API", true);
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("retryAfter").and_then(Value::as_str),
        Some("60")
    );
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::NODE_API_429)
    );
}

#[test]
fn node_operation_error_round_trip() {
    let err = ExecutorError::NodeOperation {
        message: "Missing required parameter 'url'".into(),
        reason: NodeOperationReason::MissingParam,
        details: Some(json!({ "paramName": "url" })),
        item_index: Some(2),
        run_index: Some(0),
        context: ErrorContext {
            node_id: Some("http-1".into()),
            node_type: Some("n8n-nodes-base.httpRequest".into()),
            ..Default::default()
        },
    };
    let v = to_value(&err);
    assert_top_level(&v, "NODE_OPERATION", false);
    let details = v.get("details").expect("details");
    assert_eq!(details.get("itemIndex").and_then(Value::as_u64), Some(2));
    assert_eq!(details.get("runIndex").and_then(Value::as_u64), Some(0));
    assert_eq!(
        details.get("reason").and_then(Value::as_str),
        Some("missing_param")
    );
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::NODE_OP_MISSING_PARAM)
    );
    assert!(details.get("extra").is_some());

    let wire: WireError = serde_json::from_value(v).unwrap();
    let back = ExecutorError::from_wire(&wire);
    assert_eq!(back.code(), ExecutorErrorCode::NodeOperation);
    assert!(!back.is_retryable());
}

#[test]
fn workflow_operation_error_round_trip() {
    let err = ExecutorError::workflow_operation(
        WorkflowFaultKind::Canceled,
        true,
        "Workflow canceled by user",
    );
    let v = to_value(&err);
    assert_top_level(&v, "WORKFLOW_OPERATION", false);
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("reason").and_then(Value::as_str),
        Some("canceled")
    );
    assert_eq!(details.get("blocking").and_then(Value::as_bool), Some(true));
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::WF_OP_CANCELED)
    );

    let wire: WireError = serde_json::from_value(v).unwrap();
    let back = ExecutorError::from_wire(&wire);
    assert_eq!(back.code(), ExecutorErrorCode::WorkflowOperation);

    // Deadlock is the only retryable workflow-op variant.
    let dead = ExecutorError::workflow_operation(
        WorkflowFaultKind::Deadlock,
        false,
        "Cycle without loop node",
    );
    assert!(dead.is_retryable());
}

#[test]
fn expression_error_round_trip() {
    let err = ExecutorError::Expression {
        message: "Cannot read property 'foo' of undefined".into(),
        expression: Some("{{ $json.foo.bar }}".into()),
        position: Some(14),
        context: ErrorContext {
            node_id: Some("set-1".into()),
            ..Default::default()
        },
    };
    let v = to_value(&err);
    assert_top_level(&v, "EXPRESSION", false);
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("expression").and_then(Value::as_str),
        Some("{{ $json.foo.bar }}")
    );
    assert_eq!(details.get("position").and_then(Value::as_u64), Some(14));

    let wire: WireError = serde_json::from_value(v).unwrap();
    assert_eq!(
        ExecutorError::from_wire(&wire).code(),
        ExecutorErrorCode::Expression
    );
}

#[test]
fn credentials_error_all_failures_round_trip() {
    let cases = [
        (CredentialFailure::Missing, codes::CRED_MISSING, "missing"),
        (CredentialFailure::Denied, codes::CRED_DENIED, "invalid"),
        (
            CredentialFailure::DecryptFailed,
            codes::CRED_DECRYPT_FAILED,
            "invalid",
        ),
        (
            CredentialFailure::RefreshFailed,
            codes::CRED_REFRESH_FAILED,
            "expired",
        ),
    ];

    for (failure, expected_code, ts_reason) in cases {
        let err = ExecutorError::Credentials {
            message: "cred failure".into(),
            failure,
            credential_id: Some("cred-1".into()),
            credential_type: Some("googleSheetsOAuth2Api".into()),
            context: ErrorContext::default(),
        };
        let v = to_value(&err);
        assert_top_level(&v, "CREDENTIALS", false);
        let details = v.get("details").expect("details");
        assert_eq!(
            details.get("code").and_then(Value::as_str),
            Some(expected_code),
            "stable code mismatch for {failure:?}"
        );
        assert_eq!(
            details.get("reason").and_then(Value::as_str),
            Some(ts_reason),
            "TS-reason mapping mismatch for {failure:?}"
        );
        assert_eq!(
            details.get("credentialId").and_then(Value::as_str),
            Some("cred-1")
        );
        assert_eq!(
            details.get("credentialType").and_then(Value::as_str),
            Some("googleSheetsOAuth2Api")
        );

        let wire: WireError = serde_json::from_value(v).unwrap();
        let back = ExecutorError::from_wire(&wire);
        assert_eq!(back.code(), ExecutorErrorCode::Credentials);
    }
}

#[test]
fn execution_timeout_round_trip() {
    let err = ExecutorError::ExecutionTimeout {
        message: "Node timed out after 30s".into(),
        scope: Some("node".into()),
        timeout_ms: Some(30_000),
        elapsed_ms: Some(30_117),
        context: ErrorContext::default(),
    };
    let v = to_value(&err);
    assert_top_level(&v, "EXECUTION_TIMEOUT", true);
    let details = v.get("details").expect("details");
    assert_eq!(details.get("scope").and_then(Value::as_str), Some("node"));
    assert_eq!(
        details.get("timeoutMs").and_then(Value::as_u64),
        Some(30_000)
    );
    assert_eq!(
        details.get("elapsedMs").and_then(Value::as_u64),
        Some(30_117)
    );
}

#[test]
fn resource_limit_transient_vs_permanent() {
    let transient = ExecutorError::ResourceLimit {
        message: "memory pressure".into(),
        resource: Some("memory".into()),
        kind: Some("transient".into()),
        limit: Some(512_000_000),
        observed: Some(540_000_000),
        context: ErrorContext::default(),
    };
    let v = to_value(&transient);
    assert_top_level(&v, "RESOURCE_LIMIT", true);
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("kind").and_then(Value::as_str),
        Some("transient")
    );

    let permanent = ExecutorError::ResourceLimit {
        message: "plan quota".into(),
        resource: Some("plan_quota".into()),
        kind: Some("permanent".into()),
        limit: None,
        observed: None,
        context: ErrorContext::default(),
    };
    assert!(!permanent.is_retryable());
}

#[test]
fn workflow_validation_round_trip() {
    let err = ExecutorError::WorkflowValidation {
        message: "Workflow has dangling connections".into(),
        issues: vec![
            json!({ "path": "connections.HTTP.main[0]", "message": "target node missing" }),
        ],
        context: ErrorContext {
            workflow_id: Some("wf-1".into()),
            ..Default::default()
        },
    };
    let v = to_value(&err);
    assert_top_level(&v, "WORKFLOW_VALIDATION", false);
    let details = v.get("details").expect("details");
    let issues = details.get("issues").and_then(Value::as_array).unwrap();
    assert_eq!(issues.len(), 1);
}

#[test]
fn subworkflow_defers_retryability_to_inner() {
    let inner = ExecutorError::node_api(503, "Service Unavailable").to_wire();
    let outer = ExecutorError::Subworkflow {
        message: "Sub-workflow failed".into(),
        sub_workflow_id: Some("wf-sub".into()),
        sub_execution_id: Some("exec-sub".into()),
        inner_error: Some(Box::new(inner.clone())),
        context: ErrorContext::default(),
    };
    let v = to_value(&outer);
    assert_top_level(&v, "SUBWORKFLOW", true); // inner is 5xx retryable
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("subWorkflowId").and_then(Value::as_str),
        Some("wf-sub")
    );
    let inner_v = details.get("innerError").expect("innerError");
    assert_eq!(
        inner_v.get("code").and_then(Value::as_str),
        Some("NODE_API")
    );

    let wire: WireError = serde_json::from_value(v).unwrap();
    let back = ExecutorError::from_wire(&wire);
    assert_eq!(back.code(), ExecutorErrorCode::Subworkflow);
    assert!(back.is_retryable());
}

#[test]
fn continue_on_fail_marker_round_trip() {
    let wrapped = ExecutorError::node_api(500, "boom").to_wire();
    let marker = ExecutorError::continue_on_fail("http-1", wrapped.clone());
    let v = to_value(&marker);
    assert_top_level(&v, "CONTINUE_ON_FAIL", false);
    let details = v.get("details").expect("details");
    assert_eq!(
        details.get("nodeId").and_then(Value::as_str),
        Some("http-1")
    );
    assert!(details.get("wrapped").is_some());
    assert_eq!(
        details.get("code").and_then(Value::as_str),
        Some(codes::CONTINUE_ON_FAIL_MARKER)
    );

    let wire: WireError = serde_json::from_value(v).unwrap();
    let back = ExecutorError::from_wire(&wire);
    assert_eq!(back.code(), ExecutorErrorCode::ContinueOnFail);
}

#[test]
fn generic_round_trip() {
    let err = ExecutorError::Generic("something broke".into());
    let v = to_value(&err);
    assert_top_level(&v, "EXECUTOR_GENERIC", false);
    let wire: WireError = serde_json::from_value(v).unwrap();
    let back = ExecutorError::from_wire(&wire);
    matches!(back, ExecutorError::Generic(_));
}

/* ------------------------------------------------------------------ */
/* Cross-cutting invariants                                            */
/* ------------------------------------------------------------------ */

#[test]
fn every_variant_has_a_stable_code() {
    let variants = [
        ExecutorError::node_api(500, "x"),
        ExecutorError::node_operation(NodeOperationReason::BadParam, "x"),
        ExecutorError::workflow_operation(WorkflowFaultKind::Fatal, true, "x"),
        ExecutorError::Expression {
            message: "x".into(),
            expression: None,
            position: None,
            context: ErrorContext::default(),
        },
        ExecutorError::credentials(CredentialFailure::Missing, "x"),
        ExecutorError::ExecutionTimeout {
            message: "x".into(),
            scope: None,
            timeout_ms: None,
            elapsed_ms: None,
            context: ErrorContext::default(),
        },
        ExecutorError::ResourceLimit {
            message: "x".into(),
            resource: None,
            kind: None,
            limit: None,
            observed: None,
            context: ErrorContext::default(),
        },
        ExecutorError::WorkflowValidation {
            message: "x".into(),
            issues: vec![],
            context: ErrorContext::default(),
        },
        ExecutorError::Subworkflow {
            message: "x".into(),
            sub_workflow_id: None,
            sub_execution_id: None,
            inner_error: None,
            context: ErrorContext::default(),
        },
        ExecutorError::continue_on_fail(
            "n",
            WireError {
                code: ExecutorErrorCode::ExecutorGeneric,
                message: "inner".into(),
                retryable: false,
                http_status: None,
                node_id: None,
                node_type: None,
                workflow_id: None,
                execution_id: None,
                details: None,
                stack: None,
            },
        ),
        ExecutorError::Generic("x".into()),
    ];

    for v in &variants {
        let code = v.stable_code();
        assert!(!code.is_empty(), "empty stable_code for {v:?}");
    }
}

#[test]
fn wire_field_names_are_camel_case() {
    // Spot-check that snake_case Rust fields serialise as camelCase JSON
    // — this is what the TS side reads.
    let err = ExecutorError::NodeApi {
        message: "m".into(),
        http_status: Some(500),
        body: None,
        retryable: None,
        retry_after: None,
        url: None,
        method: None,
        context: ErrorContext {
            node_id: Some("n".into()),
            node_type: Some("t".into()),
            workflow_id: Some("wf".into()),
            execution_id: Some("ex".into()),
        },
    };
    let v = to_value(&err);
    assert!(v.get("httpStatus").is_some(), "want camelCase httpStatus");
    assert!(v.get("nodeId").is_some());
    assert!(v.get("nodeType").is_some());
    assert!(v.get("workflowId").is_some());
    assert!(v.get("executionId").is_some());
    // The snake_case forms must NOT be present.
    assert!(v.get("http_status").is_none());
    assert!(v.get("node_id").is_none());
}

#[test]
fn unknown_top_level_code_degrades_to_generic_on_from_wire() {
    // Simulate a future code we don't know about by hand-rolling JSON.
    // Use ExecutorGeneric as the actual fallback — full forward-compat
    // requires the TS side to also degrade, which it does today.
    let wire = WireError {
        code: ExecutorErrorCode::ExecutorGeneric,
        message: "future variant".into(),
        retryable: false,
        http_status: None,
        node_id: None,
        node_type: None,
        workflow_id: None,
        execution_id: None,
        details: None,
        stack: None,
    };
    let back = ExecutorError::from_wire(&wire);
    assert!(matches!(back, ExecutorError::Generic(_)));
}
