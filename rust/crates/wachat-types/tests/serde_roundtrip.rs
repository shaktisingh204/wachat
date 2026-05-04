//! Roundtrip tests for every public type in `wachat-types`.
//!
//! For each type we serialize → deserialize → assert equality. This pins the
//! camelCase / `_id` / enum-string conventions and catches accidental field
//! renames. JSON is the primary wire format we test (HTTP boundaries); we
//! also do a BSON roundtrip on one representative type to confirm the
//! `bson::DateTime` ⇄ `chrono::DateTime<Utc>` interop is wired correctly.

use bson::oid::ObjectId;
use chrono::{TimeZone, Utc};
use serde_json::json;

use wachat_types::{
    Broadcast, BroadcastStatus, Conversation, Direction, MessageLog, MessageStatus,
    PhoneNumberSummary, Project, Template, TemplateCategory, TemplateStatus, WaContact,
    WhatsAppBusinessAccount,
};

fn ts() -> chrono::DateTime<Utc> {
    // Fixed instant so failure messages are stable.
    Utc.with_ymd_and_hms(2024, 1, 2, 3, 4, 5).unwrap()
}

/// Serialize → deserialize → compare-as-JSON roundtrip helper. We compare
/// `serde_json::Value`s rather than the structs themselves so we don't have
/// to derive `PartialEq` on every domain type just for tests.
fn roundtrip<T>(value: &T)
where
    T: serde::Serialize + serde::de::DeserializeOwned,
{
    let json = serde_json::to_value(value).expect("serialize");
    let back: T = serde_json::from_value(json.clone()).expect("deserialize");
    let json2 = serde_json::to_value(&back).expect("re-serialize");
    assert_eq!(json, json2, "JSON shape changed across roundtrip");
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

#[test]
fn project_roundtrip() {
    let p = Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "Acme Wachat".into(),
        waba_id: Some("123456789012345".into()),
        business_id: Some("987654321".into()),
        app_id: Some("555000111".into()),
        access_token: Some("EAAG...redacted".into()),
        phone_numbers: vec![PhoneNumberSummary {
            id: "PHONE_1".into(),
            display_phone_number: "+1 555-555-5555".into(),
            verified_name: "Acme Inc".into(),
            quality_rating: Some("GREEN".into()),
        }],
        messages_per_second: Some(40),
        credits: Some(1234.5),
        plan_id: Some(ObjectId::new()),
        review_status: Some("APPROVED".into()),
        ban_state: Some("DEFAULT".into()),
        created_at: ts(),
    };
    roundtrip(&p);

    // Pin the camelCase + `_id` conventions explicitly.
    let v = serde_json::to_value(&p).unwrap();
    assert!(v.get("_id").is_some(), "id should serialize as _id");
    assert!(v.get("userId").is_some(), "must be camelCase userId");
    assert!(v.get("wabaId").is_some());
    assert!(v.get("phoneNumbers").is_some());
    assert!(v.get("messagesPerSecond").is_some());
}

// ---------------------------------------------------------------------------
// WaContact
// ---------------------------------------------------------------------------

#[test]
fn wa_contact_roundtrip() {
    let c = WaContact {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        phone: "15555555555".into(),
        name: Some("Jane Doe".into()),
        email: Some("jane@example.com".into()),
        tags: vec!["lead".into(), "vip".into()],
        variables: json!({ "first_name": "Jane", "order_id": "A123" }),
        created_at: ts(),
        updated_at: ts(),
    };
    roundtrip(&c);

    let v = serde_json::to_value(&c).unwrap();
    assert!(v["projectId"].is_string() || v["projectId"].is_object());
    assert!(v.get("createdAt").is_some());
    assert!(v.get("updatedAt").is_some());
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

#[test]
fn template_roundtrip() {
    let t = Template {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        name: "order_confirmation".into(),
        language: "en_US".into(),
        status: TemplateStatus::Approved,
        category: TemplateCategory::Utility,
        components: json!([
            { "type": "BODY", "text": "Hi {{1}}, your order {{2}} is confirmed." }
        ]),
        meta_template_id: Some("999111222333".into()),
        created_at: Some(ts()),
    };
    roundtrip(&t);

    let v = serde_json::to_value(&t).unwrap();
    // Status / category serialize as Meta strings.
    assert_eq!(v["status"], json!("APPROVED"));
    assert_eq!(v["category"], json!("UTILITY"));
    // metaId rename preserved.
    assert!(
        v.get("metaId").is_some(),
        "meta_template_id must serialize as metaId"
    );
}

#[test]
fn template_status_variants_roundtrip() {
    for s in [
        TemplateStatus::Approved,
        TemplateStatus::Pending,
        TemplateStatus::Rejected,
        TemplateStatus::Disabled,
        TemplateStatus::Paused,
    ] {
        let v = serde_json::to_value(s).unwrap();
        let back: TemplateStatus = serde_json::from_value(v).unwrap();
        assert_eq!(s, back);
    }
}

#[test]
fn template_category_variants_roundtrip() {
    for c in [
        TemplateCategory::Marketing,
        TemplateCategory::Utility,
        TemplateCategory::Authentication,
    ] {
        let v = serde_json::to_value(c).unwrap();
        let back: TemplateCategory = serde_json::from_value(v).unwrap();
        assert_eq!(c, back);
    }
}

// ---------------------------------------------------------------------------
// MessageLog
// ---------------------------------------------------------------------------

#[test]
fn message_log_outbound_roundtrip() {
    let m = MessageLog {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        broadcast_id: Some(ObjectId::new()),
        contact_phone: "15555555555".into(),
        direction: Direction::Outbound,
        status: MessageStatus::Sent,
        meta_message_id: Some("wamid.HBgL...".into()),
        error: None,
        created_at: ts(),
        status_updated_at: Some(ts()),
    };
    roundtrip(&m);

    let v = serde_json::to_value(&m).unwrap();
    assert_eq!(v["direction"], json!("out"));
    assert_eq!(v["status"], json!("sent"));
}

#[test]
fn message_log_inbound_roundtrip() {
    let m = MessageLog {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        broadcast_id: None,
        contact_phone: "15555555555".into(),
        direction: Direction::Inbound,
        status: MessageStatus::Delivered,
        meta_message_id: Some("wamid.HBgL...".into()),
        error: None,
        created_at: ts(),
        status_updated_at: None,
    };
    roundtrip(&m);

    let v = serde_json::to_value(&m).unwrap();
    assert_eq!(v["direction"], json!("in"));
}

#[test]
fn message_status_queued_serializes_as_pending() {
    // Critical compatibility check: existing TS rows store the pre-send
    // state as `"pending"`. Rust enum spells it `Queued` for clarity but
    // must round-trip to the same wire string.
    let v = serde_json::to_value(MessageStatus::Queued).unwrap();
    assert_eq!(v, json!("pending"));
    let back: MessageStatus = serde_json::from_value(json!("pending")).unwrap();
    assert_eq!(back, MessageStatus::Queued);
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

#[test]
fn broadcast_roundtrip() {
    let b = Broadcast {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        template_id: ObjectId::new(),
        status: BroadcastStatus::Sending,
        recipient_count: 100_000,
        sent_count: 42_000,
        failed_count: 17,
        mps: 80,
        created_at: ts(),
        started_at: Some(ts()),
        completed_at: None,
    };
    roundtrip(&b);

    let v = serde_json::to_value(&b).unwrap();
    assert_eq!(v["status"], json!("SENDING"));
    assert_eq!(v["recipientCount"], json!(100_000));
}

#[test]
fn broadcast_status_variants_roundtrip() {
    for s in [
        BroadcastStatus::Draft,
        BroadcastStatus::Queued,
        BroadcastStatus::Sending,
        BroadcastStatus::Paused,
        BroadcastStatus::Completed,
        BroadcastStatus::Failed,
    ] {
        let v = serde_json::to_value(s).unwrap();
        let back: BroadcastStatus = serde_json::from_value(v).unwrap();
        assert_eq!(s, back);
    }
}

// ---------------------------------------------------------------------------
// WABA + PhoneNumberSummary
// ---------------------------------------------------------------------------

#[test]
fn waba_roundtrip() {
    let w = WhatsAppBusinessAccount {
        id: "WABA_123".into(),
        name: "Acme WABA".into(),
        phone_numbers: vec![PhoneNumberSummary {
            id: "PN_1".into(),
            display_phone_number: "+1 555 0100".into(),
            verified_name: "Acme".into(),
            quality_rating: Some("GREEN".into()),
        }],
        timezone: Some("Asia/Kolkata".into()),
        message_template_namespace: Some("acme_namespace_v2".into()),
    };
    roundtrip(&w);

    // snake_case for Meta-shaped types — these are wire-identical to Meta API.
    let v = serde_json::to_value(&w).unwrap();
    assert!(v.get("phone_numbers").is_some());
    assert!(v.get("message_template_namespace").is_some());
}

#[test]
fn phone_number_summary_roundtrip() {
    let p = PhoneNumberSummary {
        id: "PN_99".into(),
        display_phone_number: "+44 7700 900000".into(),
        verified_name: "UK Test".into(),
        quality_rating: None,
    };
    roundtrip(&p);
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

#[test]
fn conversation_roundtrip() {
    let c = Conversation {
        id: ObjectId::new(),
        project_id: ObjectId::new(),
        contact_id: ObjectId::new(),
        last_message_at: ts(),
        unread_count: 3,
        assigned_agent: Some(ObjectId::new()),
    };
    roundtrip(&c);

    let v = serde_json::to_value(&c).unwrap();
    assert!(v.get("lastMessageAt").is_some());
    assert!(v.get("unreadCount").is_some());
    assert!(v.get("assignedAgent").is_some());
}

// ---------------------------------------------------------------------------
// BSON roundtrip — pins the bson::DateTime ⇄ chrono interop
// ---------------------------------------------------------------------------

#[test]
fn project_bson_roundtrip() {
    let p = Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "BSON Test".into(),
        waba_id: None,
        business_id: None,
        app_id: None,
        access_token: None,
        phone_numbers: vec![],
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: ts(),
    };

    let doc = bson::to_document(&p).expect("project -> bson Document");
    // `_id` should land as a bson ObjectId, not a string.
    assert!(
        matches!(doc.get("_id"), Some(bson::Bson::ObjectId(_))),
        "_id must serialize as bson ObjectId, got {:?}",
        doc.get("_id")
    );

    let back: Project = bson::from_document(doc).expect("bson Document -> project");
    assert_eq!(back.id, p.id);
    assert_eq!(back.created_at, p.created_at);
}
