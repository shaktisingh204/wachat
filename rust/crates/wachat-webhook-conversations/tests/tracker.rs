//! Integration tests for [`wachat_webhook_conversations::ConversationTracker`].
//!
//! These tests require a running MongoDB. Skip them when the environment
//! variable `SKIP_TESTCONTAINERS=1` is set, or when `MONGODB_TEST_URI` is
//! absent (CI without a local Mongo). Same convention used by
//! `wachat-meta-auth/tests/store.rs`.
//!
//! Run locally with:
//! ```bash
//! MONGODB_TEST_URI=mongodb://localhost:27017 cargo test -p wachat-webhook-conversations
//! ```

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::Collection;
use sabnode_db::mongo::MongoHandle;
use wachat_meta_dto::messages::{MediaBody, TextBody};
use wachat_meta_dto::webhook::{ChangeValue, InboundMessage, StatusUpdate};
use wachat_types::project::Project;
use wachat_webhook_conversations::ConversationTracker;

/// Skip the integration test when no test Mongo is reachable. Mirrors the
/// existing skip helper across the workspace so CI can run cargo test
/// without docker.
fn skip() -> bool {
    std::env::var("SKIP_TESTCONTAINERS").is_ok() || std::env::var("MONGODB_TEST_URI").is_err()
}

/// Tiny unique-ish suffix without pulling the `uuid` crate. Same trick as
/// `wachat-meta-auth/tests/store.rs::uuid_like`.
fn uuid_like() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos}")
}

/// Connect to the test Mongo and return a fresh, isolated database handle.
/// Each test gets its own DB so collection state doesn't leak between
/// tests and we can safely drop the DB at the end.
async fn fresh_db() -> MongoHandle {
    let uri = std::env::var("MONGODB_TEST_URI").expect("MONGODB_TEST_URI must be set");
    let db_name = format!("wachat_webhook_conversations_test_{}", uuid_like());
    MongoHandle::connect(&uri, &db_name)
        .await
        .expect("connect to mongo")
}

/// Build a minimal `Project` with the supplied id. Only `id` is used by the
/// tracker (everything else is for tracing context).
fn mk_project(id: ObjectId) -> Project {
    Project {
        id,
        user_id: ObjectId::new(),
        name: "test-project".into(),
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
        created_at: Utc::now(),
    }
}

/// Insert a `contacts` row matching `{ projectId, waId }` and return its
/// `_id`. Mirrors the document shape the contacts agent will eventually
/// upsert (today the TS upserts via `whatsapp.actions.ts`/webhook-processor
/// with `waId`, `projectId`, `phoneNumberId`, etc.).
async fn seed_contact(mongo: &MongoHandle, project_id: ObjectId, wa_id: &str) -> ObjectId {
    let coll: Collection<Document> = mongo.collection("contacts");
    let id = ObjectId::new();
    coll.insert_one(doc! {
        "_id": id,
        "projectId": project_id,
        "waId": wa_id,
        "name": "Test Contact",
        "createdAt": bson::DateTime::now(),
        "updatedAt": bson::DateTime::now(),
    })
    .await
    .expect("insert contact");
    id
}

/// Build an inbound text message for `{wa_id, body}`. Other fields keep
/// their defaults so the test body stays focused on the assertion.
fn inbound_text(wa_id: &str, wamid: &str, body: &str) -> InboundMessage {
    InboundMessage {
        from: wa_id.into(),
        id: wamid.into(),
        timestamp: format!("{}", Utc::now().timestamp()),
        r#type: "text".into(),
        text: Some(TextBody {
            body: body.into(),
            preview_url: false,
        }),
        image: None,
        video: None,
        audio: None,
        document: None,
        button: None,
        interactive: None,
        context: None,
    }
}

/// Build an `image` inbound message with an optional caption — exercises
/// the media-caption preview branch.
#[allow(dead_code)]
fn inbound_image(wa_id: &str, wamid: &str, caption: Option<&str>) -> InboundMessage {
    InboundMessage {
        from: wa_id.into(),
        id: wamid.into(),
        timestamp: format!("{}", Utc::now().timestamp()),
        r#type: "image".into(),
        text: None,
        image: Some(MediaBody {
            id: Some("media-id".into()),
            link: None,
            caption: caption.map(str::to_owned),
            filename: None,
        }),
        video: None,
        audio: None,
        document: None,
        button: None,
        interactive: None,
        context: None,
    }
}

/// Wrap an iterator of inbound messages into the `value.messages` shape
/// the tracker expects.
fn value_with_messages(messages: Vec<InboundMessage>) -> ChangeValue {
    ChangeValue {
        messaging_product: Some("whatsapp".into()),
        metadata: None,
        contacts: None,
        messages: Some(messages),
        statuses: None,
        errors: None,
    }
}

/// Wrap an iterator of status updates into the `value.statuses` shape.
fn value_with_statuses(statuses: Vec<StatusUpdate>) -> ChangeValue {
    ChangeValue {
        messaging_product: Some("whatsapp".into()),
        metadata: None,
        contacts: None,
        messages: None,
        statuses: Some(statuses),
        errors: None,
    }
}

/// Look up the conversation for `(project, contact)` so each test can
/// inspect the materialized fields directly.
async fn fetch_conversation(
    mongo: &MongoHandle,
    project_id: ObjectId,
    contact_id: ObjectId,
) -> Option<Document> {
    let coll: Collection<Document> = mongo.collection("conversations");
    coll.find_one(doc! { "projectId": project_id, "contactId": contact_id })
        .await
        .expect("find conversation")
}

#[tokio::test(flavor = "multi_thread")]
async fn first_inbound_creates_conversation_with_unread_one() {
    if skip() {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    }
    let mongo = fresh_db().await;
    let project = mk_project(ObjectId::new());
    let wa_id = "919876543210";
    let contact_id = seed_contact(&mongo, project.id, wa_id).await;

    let tracker = ConversationTracker::new(mongo.clone());
    let value = value_with_messages(vec![inbound_text(wa_id, "wamid.A1", "hi there")]);
    let outcome = tracker.on_inbound(&project, &value).await.unwrap();
    assert_eq!(outcome.conversations_touched, 1);

    let conv = fetch_conversation(&mongo, project.id, contact_id)
        .await
        .expect("conversation row should exist");
    assert_eq!(conv.get_i32("unreadCount").unwrap(), 1);
    assert_eq!(conv.get_str("lastMessageText").unwrap(), "hi there");
    assert_eq!(conv.get_str("lastMessageDirection").unwrap(), "in");
    assert_eq!(conv.get_str("lastMessageKind").unwrap(), "text");
    assert!(conv.get_datetime("lastMessageAt").is_ok());
    assert!(conv.get_datetime("createdAt").is_ok());
}

#[tokio::test(flavor = "multi_thread")]
async fn second_inbound_increments_unread_to_two() {
    if skip() {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    }
    let mongo = fresh_db().await;
    let project = mk_project(ObjectId::new());
    let wa_id = "919876543210";
    let contact_id = seed_contact(&mongo, project.id, wa_id).await;
    let tracker = ConversationTracker::new(mongo.clone());

    tracker
        .on_inbound(
            &project,
            &value_with_messages(vec![inbound_text(wa_id, "wamid.A1", "first")]),
        )
        .await
        .unwrap();
    tracker
        .on_inbound(
            &project,
            &value_with_messages(vec![inbound_text(wa_id, "wamid.A2", "second")]),
        )
        .await
        .unwrap();

    let conv = fetch_conversation(&mongo, project.id, contact_id)
        .await
        .expect("conversation row should exist");
    assert_eq!(conv.get_i32("unreadCount").unwrap(), 2);
    // lastMessageText reflects the most recent inbound, not the first.
    assert_eq!(conv.get_str("lastMessageText").unwrap(), "second");
}

#[tokio::test(flavor = "multi_thread")]
async fn mark_read_resets_unread_to_zero() {
    if skip() {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    }
    let mongo = fresh_db().await;
    let project = mk_project(ObjectId::new());
    let wa_id = "919876543210";
    let contact_id = seed_contact(&mongo, project.id, wa_id).await;
    let tracker = ConversationTracker::new(mongo.clone());

    // Generate three unread messages.
    for (i, text) in ["a", "b", "c"].iter().enumerate() {
        tracker
            .on_inbound(
                &project,
                &value_with_messages(vec![inbound_text(wa_id, &format!("wamid.M{i}"), text)]),
            )
            .await
            .unwrap();
    }
    let conv = fetch_conversation(&mongo, project.id, contact_id).await.unwrap();
    assert_eq!(conv.get_i32("unreadCount").unwrap(), 3);

    // Agent opens chat → unread resets.
    let outcome = tracker.mark_read(&project, &contact_id).await.unwrap();
    assert_eq!(outcome.conversations_touched, 1);

    let conv = fetch_conversation(&mongo, project.id, contact_id).await.unwrap();
    assert_eq!(conv.get_i32("unreadCount").unwrap(), 0);
}

#[tokio::test(flavor = "multi_thread")]
async fn status_update_does_not_change_unread_or_last_message_at() {
    if skip() {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    }
    let mongo = fresh_db().await;
    let project = mk_project(ObjectId::new());
    let wa_id = "919876543210";
    let contact_id = seed_contact(&mongo, project.id, wa_id).await;
    let tracker = ConversationTracker::new(mongo.clone());

    // Seed an inbound to create the conversation row.
    tracker
        .on_inbound(
            &project,
            &value_with_messages(vec![inbound_text(wa_id, "wamid.IN1", "hey")]),
        )
        .await
        .unwrap();
    let before = fetch_conversation(&mongo, project.id, contact_id).await.unwrap();
    let unread_before = before.get_i32("unreadCount").unwrap();
    let last_at_before = before.get_datetime("lastMessageAt").unwrap().to_owned();

    // Seed an outbound row so the status lookup resolves.
    let outgoing: Collection<Document> = mongo.collection("outgoing_messages");
    outgoing
        .insert_one(doc! {
            "_id": ObjectId::new(),
            "projectId": project.id,
            "contactId": contact_id,
            "wamid": "wamid.OUT1",
            "direction": "out",
            "status": "sent",
            "createdAt": bson::DateTime::now(),
        })
        .await
        .unwrap();

    // Apply a `delivered` status — should set lastDeliveredAt but leave
    // unreadCount and lastMessageAt untouched.
    let status = StatusUpdate {
        id: "wamid.OUT1".into(),
        status: "delivered".into(),
        timestamp: format!("{}", Utc::now().timestamp()),
        recipient_id: wa_id.into(),
        conversation: None,
        pricing: None,
        errors: None,
    };
    let outcome = tracker
        .on_status(&project, &value_with_statuses(vec![status]))
        .await
        .unwrap();
    assert_eq!(outcome.conversations_touched, 1);

    let after = fetch_conversation(&mongo, project.id, contact_id).await.unwrap();
    assert_eq!(after.get_i32("unreadCount").unwrap(), unread_before);
    assert_eq!(
        after.get_datetime("lastMessageAt").unwrap().to_owned(),
        last_at_before,
        "status update must not touch lastMessageAt",
    );
    assert!(
        after.get_datetime("lastDeliveredAt").is_ok(),
        "lastDeliveredAt should be set",
    );
}

#[tokio::test(flavor = "multi_thread")]
async fn missing_contact_skips_message_without_error() {
    if skip() {
        eprintln!("skipping: MONGODB_TEST_URI not set");
        return;
    }
    let mongo = fresh_db().await;
    let project = mk_project(ObjectId::new());
    let tracker = ConversationTracker::new(mongo.clone());

    // Note: NO seed_contact() call — the contact doesn't exist.
    let outcome = tracker
        .on_inbound(
            &project,
            &value_with_messages(vec![inbound_text("919999999999", "wamid.X", "ghost")]),
        )
        .await
        .unwrap();
    // 0 conversations touched, no error propagated. The dispatcher mis-order
    // is logged at warn but does not fail the batch.
    assert_eq!(outcome.conversations_touched, 0);
}
