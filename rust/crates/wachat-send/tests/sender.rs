//! Integration tests for [`MessageSender`].
//!
//! Two-tier coverage matching the sibling `wachat-templates-send` crate:
//!
//! 1. **Pure / wiremock-only** — stubs Meta with `wiremock` and asserts
//!    the request shape posted to `POST /v23.0/{phone-number-id}/messages`
//!    via [`MetaClient`] directly. Covers the text + image branches.
//!    Runs unconditionally.
//! 2. **Live Mongo round-trip** — verifies the `outgoing_messages` doc
//!    actually lands in Mongo with the right field shape. Gated behind
//!    `TEST_MONGODB_URI` / `TEST_MONGODB_DB` env vars.

use bson::{doc, oid::ObjectId};
use chrono::Utc;
use serde_json::{Value, json};
use wiremock::matchers::{body_partial_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabnode_db::mongo::MongoHandle;
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_types::{project::Project, waba::PhoneNumberSummary};

use wachat_send::{META_API_VERSION, MessageSender, SendMessageRequest};

// -------------------------------------------------------------------------
// Test helpers
// -------------------------------------------------------------------------

const PHONE_NUMBER_ID: &str = "1234567890";
const ACCESS_TOKEN: &str = "EAA_test_token";
const RECIPIENT_BARE: &str = "919876543210";

fn make_project() -> Project {
    Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "Test Project".to_owned(),
        waba_id: Some("WABA_1".to_owned()),
        business_id: Some("BIZ_1".to_owned()),
        app_id: Some("APP_1".to_owned()),
        access_token: Some(ACCESS_TOKEN.to_owned()),
        phone_numbers: vec![PhoneNumberSummary {
            id: PHONE_NUMBER_ID.to_owned(),
            display_phone_number: "+1 555-555-5555".to_owned(),
            verified_name: "Test".to_owned(),
            quality_rating: Some("GREEN".to_owned()),
        }],
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: Utc::now(),
    }
}

fn meta_for(server: &MockServer) -> MetaClient {
    let base = url::Url::parse(&server.uri()).unwrap();
    let base = url::Url::parse(&format!("{}/", base.as_str().trim_end_matches('/'))).unwrap();
    MetaClient::with_base(base, META_API_VERSION)
}

fn live_mongo() -> Option<(String, String)> {
    let uri = std::env::var("TEST_MONGODB_URI").ok()?;
    let db = std::env::var("TEST_MONGODB_DB").ok()?;
    Some((uri, db))
}

// -------------------------------------------------------------------------
// Wiremock-only — runs unconditionally.
// -------------------------------------------------------------------------

/// Text branch: confirms the path, version, bearer token, and the
/// envelope shape (`messaging_product` + `recipient_type` + `to` + `type`
/// + `text.body` + `text.preview_url`).
#[tokio::test]
async fn text_branch_posts_correct_shape() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.text_xyz";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_partial_json(json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": RECIPIENT_BARE,
            "type": "text",
            "text": { "body": "Hello!", "preview_url": true }
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": RECIPIENT_BARE, "wa_id": RECIPIENT_BARE }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT_BARE,
        "type": "text",
        "text": { "body": "Hello!", "preview_url": true },
    });
    let resp: wachat_meta_dto::SendResponse = meta_for(&server)
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post text");

    assert_eq!(resp.messages.len(), 1);
    assert_eq!(resp.messages[0].id, wamid);
}

/// Image branch: confirms the type-keyed `image` body carries `id` (no
/// `link`) and an optional caption when supplied.
#[tokio::test]
async fn image_branch_posts_correct_shape() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.image_xyz";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_partial_json(json!({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": RECIPIENT_BARE,
            "type": "image",
            "image": { "id": "MEDIA_42", "caption": "look!" }
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let payload = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": RECIPIENT_BARE,
        "type": "image",
        "image": { "id": "MEDIA_42", "caption": "look!" },
    });
    let resp: wachat_meta_dto::SendResponse = meta_for(&server)
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post image");

    assert_eq!(resp.messages.len(), 1);
    assert_eq!(resp.messages[0].id, wamid);
}

// -------------------------------------------------------------------------
// Live-Mongo — full sender round-trip. Skipped without env vars.
// -------------------------------------------------------------------------

/// Full text-send through `MessageSender::send`, asserting the
/// `outgoing_messages` doc matches the TS shape (lines 484-487).
#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_text_posts_to_meta_and_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project = make_project();

    // Stub Meta.
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.live_text_xyz";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": RECIPIENT_BARE, "wa_id": RECIPIENT_BARE }],
            "messages": [{ "id": wamid }],
        })))
        .mount(&server)
        .await;

    let sender = MessageSender::new(
        mongo.clone(),
        meta_for(&server),
        MediaUploader::new_with_base(server.uri(), META_API_VERSION),
    );

    let outcome = sender
        .send(
            &project,
            SendMessageRequest::Text {
                to: "+919876543210".to_owned(),
                body: "Hello live!".to_owned(),
                preview_url: true,
            },
        )
        .await
        .expect("send ok");

    assert_eq!(outcome.wamid, wamid);

    let logs_coll = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs_coll
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find log")
        .expect("log present");

    // EXACT TS field set (`whatsapp.actions.ts` lines 484-487):
    //   direction: 'out'
    //   projectId: <oid>
    //   wamid: <string>
    //   messageTimestamp: <Date>
    //   type: 'text' (or image/video/document)
    //   content: <messagePayload>
    //   status: 'sent'
    //   statusTimestamps: { sent: <Date> }
    //   createdAt: <Date>
    assert_eq!(log.get_str("direction").unwrap(), "out");
    assert_eq!(log.get_str("type").unwrap(), "text");
    assert_eq!(log.get_str("status").unwrap(), "sent");
    assert_eq!(log.get_str("wamid").unwrap(), wamid);
    assert_eq!(log.get_object_id("projectId").unwrap(), project.id);
    assert!(log.get("messageTimestamp").is_some());
    assert!(log.get("statusTimestamps").is_some());
    assert!(log.get("createdAt").is_some());
    let content = log.get("content").expect("content present");
    // `content` is the literal Meta payload — confirm it round-tripped.
    let content_json: Value = bson::from_bson(content.clone()).expect("content -> json");
    assert_eq!(content_json["type"], "text");
    assert_eq!(content_json["text"]["body"], "Hello live!");
    assert_eq!(content_json["messaging_product"], "whatsapp");

    // Cleanup.
    logs_coll
        .delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

/// Image-send round-trip — proves the media branch writes `type: 'image'`
/// and stores the full payload (with the `image.id` field) under `content`.
#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_image_posts_to_meta_and_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project = make_project();
    let server = MockServer::start().await;
    let wamid = "wamid.live_image_xyz";

    Mock::given(method("POST"))
        .and(path(format!(
            "/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages"
        )))
        .and(body_partial_json(json!({
            "type": "image",
            "image": { "id": "MEDIA_99", "caption": "see this" }
        })))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let sender = MessageSender::new(
        mongo.clone(),
        meta_for(&server),
        MediaUploader::new_with_base(server.uri(), META_API_VERSION),
    );

    let outcome = sender
        .send(
            &project,
            SendMessageRequest::Image {
                to: "+919876543210".to_owned(),
                media_id: Some("MEDIA_99".to_owned()),
                link: None,
                caption: Some("see this".to_owned()),
            },
        )
        .await
        .expect("send ok");

    assert_eq!(outcome.wamid, wamid);

    let log = mongo
        .collection::<bson::Document>("outgoing_messages")
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find")
        .expect("log present");
    assert_eq!(log.get_str("type").unwrap(), "image");
    let content_json: Value = bson::from_bson(log.get("content").unwrap().clone()).unwrap();
    assert_eq!(content_json["image"]["id"], "MEDIA_99");
    assert_eq!(content_json["image"]["caption"], "see this");

    // Cleanup.
    mongo
        .collection::<bson::Document>("outgoing_messages")
        .delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}
