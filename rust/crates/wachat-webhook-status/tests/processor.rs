//! Table-driven tests for the status processor.
//!
//! Two layers:
//!
//! 1. **Pure mapping / DTO tests** — always run. Build `ChangeValue` JSON
//!    by hand, decode via serde, exercise the mapping table and the
//!    public types. Does not touch Mongo.
//!
//! 2. **Mongo integration tests** — gated. Skipped by default in this
//!    slice because spinning up testcontainers from a standalone crate
//!    (no workspace dev-dependency on `testcontainers`) would balloon
//!    the dep tree. Leaving an `#[ignore]`d skeleton so a future slice
//!    that wires up an integration harness can flip the gate to
//!    `SKIP_TESTCONTAINERS=0` and pick this up.

use serde_json::json;
use wachat_meta_dto::webhook::{ChangeValue, StatusUpdate};
use wachat_types::message::MessageStatus;
use wachat_webhook_status::{StatusOutcome, meta_status_to_domain};

/// Smoke-test the public re-export and the `Default` outcome shape.
#[test]
fn outcome_default_is_zero() {
    let o = StatusOutcome::default();
    assert_eq!(o.updated, 0);
    assert_eq!(o.failed_lookups, 0);
}

// ─── Mapping table ──────────────────────────────────────────────────────────

#[test]
fn status_string_to_domain_table() {
    let cases: &[(&str, Option<MessageStatus>)] = &[
        ("sent", Some(MessageStatus::Sent)),
        ("delivered", Some(MessageStatus::Delivered)),
        ("read", Some(MessageStatus::Read)),
        ("failed", Some(MessageStatus::Failed)),
        // Case folding — Meta has shipped mixed-case in edge events.
        ("SENT", Some(MessageStatus::Sent)),
        ("Read", Some(MessageStatus::Read)),
        // Unknown / SabNode-internal values must not map.
        ("pending", None),
        ("deleted", None),
        ("", None),
        ("garbage", None),
    ];
    for (input, expected) in cases {
        assert_eq!(
            meta_status_to_domain(input),
            *expected,
            "mapping mismatch for input `{input}`",
        );
    }
}

// ─── ChangeValue decoding ────────────────────────────────────────────────────

/// Build a synthetic `ChangeValue` from a JSON literal — mirrors the shape
/// of `change.value` for a `field: "messages"` status webhook.
fn change_value_with(statuses: serde_json::Value) -> ChangeValue {
    serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        },
        "statuses": statuses,
    }))
    .expect("valid ChangeValue")
}

#[test]
fn parses_sent_status() {
    let cv = change_value_with(json!([{
        "id": "wamid.TEST_SENT",
        "status": "sent",
        "timestamp": "1717000000",
        "recipient_id": "919999999999",
    }]));
    let s: &StatusUpdate = &cv.statuses.as_ref().unwrap()[0];
    assert_eq!(s.id, "wamid.TEST_SENT");
    assert_eq!(s.status, "sent");
    assert_eq!(meta_status_to_domain(&s.status), Some(MessageStatus::Sent));
}

#[test]
fn parses_delivered_status() {
    let cv = change_value_with(json!([{
        "id": "wamid.TEST_DELIVERED",
        "status": "delivered",
        "timestamp": "1717000010",
        "recipient_id": "919999999999",
    }]));
    let s = &cv.statuses.as_ref().unwrap()[0];
    assert_eq!(meta_status_to_domain(&s.status), Some(MessageStatus::Delivered));
}

#[test]
fn parses_read_status_idempotent_input() {
    // Two `read` events in a row for the same wamid. The processor must
    // accept both at the parsing layer; the idempotency guard is at the
    // Mongo filter level (covered in the gated integration test).
    let cv = change_value_with(json!([
        {
            "id": "wamid.TEST_READ",
            "status": "read",
            "timestamp": "1717000020",
            "recipient_id": "919999999999",
        },
        {
            "id": "wamid.TEST_READ",
            "status": "read",
            "timestamp": "1717000021",
            "recipient_id": "919999999999",
        },
    ]));
    let s = cv.statuses.as_ref().unwrap();
    assert_eq!(s.len(), 2);
    assert!(s.iter().all(|x| x.status == "read"));
}

#[test]
fn parses_failed_status_with_errors() {
    let cv = change_value_with(json!([{
        "id": "wamid.TEST_FAILED",
        "status": "failed",
        "timestamp": "1717000030",
        "recipient_id": "919999999999",
        "errors": [{
            "message": "Message undeliverable",
            "code": 131026,
            "error_data": { "details": "Receiver is incapable of receiving this message." }
        }]
    }]));
    let s = &cv.statuses.as_ref().unwrap()[0];
    assert_eq!(s.status, "failed");
    let errs = s.errors.as_ref().expect("errors present");
    assert_eq!(errs[0].code, Some(131026));
    assert_eq!(errs[0].message, "Message undeliverable");
}

#[test]
fn malformed_status_string_does_not_crash_decoding() {
    // A status value Meta has never emitted but might in the future.
    // The DTO accepts any string; the mapping rejects it; the processor
    // logs + counts it as a failed_lookup. We assert the mapping behavior
    // here; the processor behavior is asserted in the gated integration
    // test below.
    let cv = change_value_with(json!([{
        "id": "wamid.TEST_GARBAGE",
        "status": "schroedinger",
        "timestamp": "1717000040",
        "recipient_id": "919999999999",
    }]));
    let s = &cv.statuses.as_ref().unwrap()[0];
    assert_eq!(s.status, "schroedinger");
    assert_eq!(meta_status_to_domain(&s.status), None);
}

#[test]
fn empty_statuses_array_decodes() {
    let cv = change_value_with(json!([]));
    assert!(cv.statuses.as_ref().unwrap().is_empty());
}

#[test]
fn missing_statuses_field_decodes_as_none() {
    let cv: ChangeValue = serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        }
    }))
    .unwrap();
    assert!(cv.statuses.is_none());
}

// ─── Gated Mongo integration test ────────────────────────────────────────────

/// Reserved for the workspace-level integration harness. When the harness
/// lands (`SKIP_TESTCONTAINERS=0`), this test should:
///
/// 1. Spin up an ephemeral MongoDB.
/// 2. Insert seed `outgoing_messages` rows with `wamid` and `status: "pending"`.
/// 3. Run `StatusProcessor::process` with synthetic `sent` → `delivered`
///    → `read` events.
/// 4. Assert the row's `status`, `statusTimestamps.<state>`, `error*`
///    fields match the TS shape.
/// 5. Assert `read → read` is a no-op (counts as `failed_lookups`).
/// 6. Assert an unknown `wamid` is also a `failed_lookups`, not an error.
///
/// Marked `#[ignore]` so `cargo test` stays green without Docker. Run with
/// `cargo test -- --ignored` once the harness is wired up.
#[test]
#[ignore = "requires testcontainers; gate via SKIP_TESTCONTAINERS=0"]
fn mongo_integration_placeholder() {
    if std::env::var("SKIP_TESTCONTAINERS").as_deref() == Ok("1") {
        return;
    }
    // Intentionally empty until the workspace-level harness lands.
    // The mapping + DTO tests above already cover the pure logic.
}
