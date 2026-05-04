//! Tests for `wachat-webhook-inbound`.
//!
//! Two layers, mirroring the sibling `wachat-webhook-status` crate:
//!
//! 1. **Pure mapping tests** — exercise `extract_text`, `extract_media_id`,
//!    `message_kind` over hand-built `InboundMessage` fixtures.
//!
//! 2. **Document-shape tests** — call the public `build_inbound_doc`
//!    helper and assert every key/value the receiver writes to the
//!    `incoming_messages` collection. This catches regressions on the
//!    field names that TS readers (chat UI, analytics) depend on
//!    *without* spinning up Mongo. The Mongo-backed idempotency test
//!    (same wamid → second upsert is a duplicate) is gated behind a real
//!    Mongo handle and lives at the end of the file as `#[ignore]`.

use bson::{Bson, doc, oid::ObjectId};
use chrono::Utc;
use serde_json::json;
use wachat_meta_dto::webhook::{ChangeValue, InboundMessage};
use wachat_types::project::Project;
use wachat_webhook_inbound::{
    InboundOutcome, build_inbound_doc, extract_media_id, extract_text, message_kind,
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

/// Minimal `Project` good enough to feed the doc-builder. Only `id` is read
/// — the doc-builder doesn't touch any other field.
fn fixture_project() -> Project {
    Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "test-project".into(),
        waba_id: Some("123".into()),
        business_id: None,
        app_id: None,
        access_token: None,
        phone_numbers: vec![],
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: Utc::now(),
    }
}

/// Decode a JSON-literal `change.value` into the typed DTO. Mirrors the
/// helper in `wachat-webhook-status/tests/processor.rs`.
fn change_value_with(messages: serde_json::Value) -> ChangeValue {
    serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        },
        "messages": messages,
    }))
    .expect("valid ChangeValue")
}

fn first_message(messages: serde_json::Value) -> InboundMessage {
    let cv = change_value_with(messages);
    cv.messages.expect("messages").into_iter().next().expect("one message")
}

// ─── InboundOutcome smoke ────────────────────────────────────────────────────

#[test]
fn outcome_default_is_zero() {
    let o = InboundOutcome::default();
    assert_eq!(o.stored, 0);
    assert_eq!(o.duplicates, 0);
}

// ─── Mapping: extract_text ───────────────────────────────────────────────────

#[test]
fn extract_text_from_text_message() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.TEXT",
        "timestamp": "1717000000",
        "type": "text",
        "text": { "body": "hello" },
    }]));
    assert_eq!(extract_text(&m).as_deref(), Some("hello"));
}

#[test]
fn extract_text_from_button_tap() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.BUTTON",
        "timestamp": "1717000000",
        "type": "button",
        "button": { "text": "Yes please", "payload": "YES_PAYLOAD" },
    }]));
    assert_eq!(extract_text(&m).as_deref(), Some("Yes please"));
}

#[test]
fn extract_text_from_interactive_button_reply() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.IBR",
        "timestamp": "1717000000",
        "type": "interactive",
        "interactive": {
            "type": "button_reply",
            "button_reply": { "id": "btn-1", "title": "Confirm" },
        },
    }]));
    assert_eq!(extract_text(&m).as_deref(), Some("Confirm"));
    assert_eq!(message_kind(&m), "interactive_button_reply");
}

#[test]
fn extract_text_from_interactive_list_reply() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.ILR",
        "timestamp": "1717000000",
        "type": "interactive",
        "interactive": {
            "type": "list_reply",
            "list_reply": { "id": "row-1", "title": "Option A", "description": "..." },
        },
    }]));
    assert_eq!(extract_text(&m).as_deref(), Some("Option A"));
    assert_eq!(message_kind(&m), "interactive_list_reply");
}

#[test]
fn extract_text_returns_none_for_image() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.IMG",
        "timestamp": "1717000000",
        "type": "image",
        "image": { "id": "media-123", "caption": "hi" },
    }]));
    // Captions are intentionally NOT promoted to text — see mapping.rs comment.
    assert!(extract_text(&m).is_none());
}

// ─── Mapping: extract_media_id ───────────────────────────────────────────────

#[test]
fn extract_media_id_for_each_kind() {
    for kind in ["image", "video", "audio", "document"] {
        // `kind` is `&str` (iterator over `[&str; 4]` yields by-value); the
        // `serde_json::json!` macro accepts a `&str`-typed expression as a
        // dynamic key when wrapped in parens.
        let m = first_message(json!([{
            "from": "919999999999",
            "id": format!("wamid.{kind}"),
            "timestamp": "1717000000",
            "type": kind,
            (kind): { "id": "media-abc" },
        }]));
        assert_eq!(extract_media_id(&m).as_deref(), Some("media-abc"), "kind={kind}");
    }
}

#[test]
fn extract_media_id_none_for_text() {
    let m = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.TEXT2",
        "timestamp": "1717000000",
        "type": "text",
        "text": { "body": "hi" },
    }]));
    assert!(extract_media_id(&m).is_none());
}

// ─── Mapping: message_kind ───────────────────────────────────────────────────

#[test]
fn message_kind_table() {
    let cases = &[
        ("text", "text"),
        ("image", "image"),
        ("video", "video"),
        ("audio", "audio"),
        ("document", "document"),
        ("sticker", "sticker"),
        ("location", "location"),
        ("contacts", "contacts"),
        ("button", "button"),
        ("totally_new_meta_type", "unknown"),
    ];
    for (wire, expected) in cases {
        let m = first_message(json!([{
            "from": "1",
            "id": format!("wamid.{wire}"),
            "timestamp": "1717000000",
            "type": wire,
        }]));
        assert_eq!(message_kind(&m), *expected, "wire={wire}");
    }
}

// ─── Document shape: TS field-name fidelity ──────────────────────────────────

#[test]
fn build_doc_text_message_has_ts_field_names() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.TEXT_BUILD",
        "timestamp": "1717000000",
        "type": "text",
        "text": { "body": "hello world" },
    }]));

    let (filter, set) = build_inbound_doc(&project, &msg).expect("build ok");

    // Filter shape — wamid + projectId — exactly what TS line 1503 uses.
    assert_eq!(filter.get_str("wamid").unwrap(), "wamid.TEXT_BUILD");
    assert_eq!(filter.get_object_id("projectId").unwrap(), project.id);

    // Body shape — every key must match the TS write at lines 1505-1515.
    assert_eq!(set.get_str("direction").unwrap(), "in");
    assert_eq!(set.get_object_id("projectId").unwrap(), project.id);
    assert_eq!(set.get("contactId").unwrap(), &Bson::Null);
    assert_eq!(set.get_str("wamid").unwrap(), "wamid.TEXT_BUILD");
    assert_eq!(set.get_str("type").unwrap(), "text");
    assert!(!set.get_bool("isRead").unwrap());
    assert!(set.get_datetime("messageTimestamp").is_ok());
    assert!(set.get_datetime("createdAt").is_ok());

    // `content` should be the full inbound payload, with `text.body` reachable.
    let content = set.get_document("content").expect("content is a doc");
    assert_eq!(content.get_str("type").unwrap(), "text");
    let text = content.get_document("text").expect("text body");
    assert_eq!(text.get_str("body").unwrap(), "hello world");
}

#[test]
fn build_doc_image_with_caption_preserves_caption_in_content() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.IMG_BUILD",
        "timestamp": "1717000000",
        "type": "image",
        "image": { "id": "media-xyz", "caption": "look at this" },
    }]));

    let (_filter, set) = build_inbound_doc(&project, &msg).expect("build ok");

    assert_eq!(set.get_str("type").unwrap(), "image");
    let content = set.get_document("content").unwrap();
    let image = content.get_document("image").unwrap();
    assert_eq!(image.get_str("id").unwrap(), "media-xyz");
    assert_eq!(image.get_str("caption").unwrap(), "look at this");
}

#[test]
fn build_doc_button_reply_stored_as_interactive() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.IBR_BUILD",
        "timestamp": "1717000000",
        "type": "interactive",
        "interactive": {
            "type": "button_reply",
            "button_reply": { "id": "yes", "title": "Yes" },
        },
    }]));

    let (_filter, set) = build_inbound_doc(&project, &msg).expect("build ok");
    assert_eq!(set.get_str("type").unwrap(), "interactive");
    let content = set.get_document("content").unwrap();
    let interactive = content.get_document("interactive").unwrap();
    let br = interactive.get_document("button_reply").unwrap();
    assert_eq!(br.get_str("title").unwrap(), "Yes");
}

#[test]
fn build_doc_list_reply_stored_as_interactive() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.ILR_BUILD",
        "timestamp": "1717000000",
        "type": "interactive",
        "interactive": {
            "type": "list_reply",
            "list_reply": { "id": "row-1", "title": "Option A" },
        },
    }]));
    let (_filter, set) = build_inbound_doc(&project, &msg).expect("build ok");
    let content = set.get_document("content").unwrap();
    let lr = content
        .get_document("interactive")
        .unwrap()
        .get_document("list_reply")
        .unwrap();
    assert_eq!(lr.get_str("title").unwrap(), "Option A");
}

#[test]
fn build_doc_location_message_persisted_via_content_passthrough() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.LOC",
        "timestamp": "1717000000",
        "type": "location",
        // The DTO doesn't model a typed `location` body — it round-trips
        // through `content` because the chat UI reads it from there. We
        // assert the type discriminator landed correctly; the lat/long
        // payload is preserved via the original Meta payload at the
        // receiver level (not re-emitted on the typed `InboundMessage`).
    }]));
    let (_filter, set) = build_inbound_doc(&project, &msg).expect("build ok");
    assert_eq!(set.get_str("type").unwrap(), "location");
    assert_eq!(message_kind(&msg), "location");
}

#[test]
fn build_doc_unknown_type_still_persisted() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.UNKNOWN",
        "timestamp": "1717000000",
        "type": "totally_new_meta_type",
    }]));
    let (_filter, set) = build_inbound_doc(&project, &msg).expect("build ok");
    // Unknown wire types still produce a row — we don't drop data we don't
    // understand. `type` keeps the verbatim Meta string so a later schema
    // bump can re-classify historical rows.
    assert_eq!(set.get_str("type").unwrap(), "totally_new_meta_type");
    assert_eq!(message_kind(&msg), "unknown");
}

#[test]
fn build_doc_rejects_non_numeric_timestamp() {
    let project = fixture_project();
    let msg = first_message(json!([{
        "from": "919999999999",
        "id": "wamid.BADTS",
        "timestamp": "not-a-number",
        "type": "text",
        "text": { "body": "hi" },
    }]));
    let err = build_inbound_doc(&project, &msg).unwrap_err();
    let s = format!("{err}");
    assert!(s.contains("timestamp"), "expected timestamp error, got: {s}");
}

#[test]
fn build_doc_idempotency_filter_is_stable_per_wamid() {
    // The Mongo-side idempotency contract is: same `wamid + projectId`
    // means the *filter* matches an existing row, so `$setOnInsert` is a
    // no-op and `update_one` returns `upserted_id: None` → counted as a
    // duplicate. We cannot exercise the Mongo round-trip without a live
    // instance, but we can assert the filter is a deterministic function
    // of `(project, msg.id)` so two calls produce identical filters
    // (i.e. they will match the same document).
    let project = fixture_project();
    let payload = json!([{
        "from": "919999999999",
        "id": "wamid.DUP",
        "timestamp": "1717000000",
        "type": "text",
        "text": { "body": "first" },
    }]);
    let msg1 = first_message(payload.clone());
    let msg2 = first_message(payload);
    let (filter1, _) = build_inbound_doc(&project, &msg1).unwrap();
    let (filter2, _) = build_inbound_doc(&project, &msg2).unwrap();
    assert_eq!(filter1, filter2);
}

// ─── Live-Mongo integration test (gated) ─────────────────────────────────────

/// End-to-end idempotency check against a real Mongo. Skipped by default
/// because spinning up testcontainers from this standalone crate would
/// pull a heavy dep tree; enable by exporting `MONGO_URI` and removing
/// the `#[ignore]`. Asserts that a second upsert with the same wamid
/// returns `duplicates: 1, stored: 0`.
#[tokio::test]
#[ignore = "requires MONGO_URI; run with `cargo test -- --ignored`"]
async fn live_mongo_second_upsert_is_duplicate() {
    use sabnode_db::mongo::MongoHandle;
    use wachat_meta_dto::webhook::ChangeValue;
    use wachat_webhook_inbound::InboundProcessor;

    let uri = std::env::var("MONGO_URI").expect("MONGO_URI required");
    let mongo = MongoHandle::connect(&uri, "wachat_inbound_test").await.unwrap();
    let processor = InboundProcessor::new(mongo);
    let project = fixture_project();

    let cv: ChangeValue = serde_json::from_value(json!({
        "messaging_product": "whatsapp",
        "metadata": {
            "display_phone_number": "15551234567",
            "phone_number_id": "1111111111111",
        },
        "messages": [{
            "from": "919999999999",
            "id": format!("wamid.LIVE_{}", chrono::Utc::now().timestamp_nanos_opt().unwrap()),
            "timestamp": "1717000000",
            "type": "text",
            "text": { "body": "hi" },
        }],
    }))
    .unwrap();

    let first = processor.process(&project, &cv).await.unwrap();
    assert_eq!(first.stored, 1);
    assert_eq!(first.duplicates, 0);

    let second = processor.process(&project, &cv).await.unwrap();
    assert_eq!(second.stored, 0);
    assert_eq!(second.duplicates, 1);
}
