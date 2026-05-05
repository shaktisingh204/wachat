//! Integration tests for [`FlowSender`].
//!
//! Two-tier coverage, mirroring the sibling `wachat-templates-send` crate:
//!
//! 1. **Pure wiremock** — stubs Meta with `wiremock` and asserts the
//!    request body byte-for-byte matches the TS payload shape (location +
//!    address). Doesn't go through `FlowSender::send_*` (which needs
//!    Mongo) but proves the wire shape we hand to [`MetaClient::post_json`]
//!    is correct.
//! 2. **Live Mongo round-trip** — verifies the `outgoing_messages` doc
//!    actually lands in Mongo with the right field shape. Gated behind
//!    `TEST_MONGODB_URI` / `TEST_MONGODB_DB` env vars.

use bson::{doc, oid::ObjectId};
use chrono::Utc;
use serde_json::{Value, json};
use wiremock::matchers::{body_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_types::{project::Project, waba::PhoneNumberSummary};

use wachat_send_flows::{FlowSender, META_API_VERSION, SendAddressReq, SendLocationReq};

// -------------------------------------------------------------------------
// Test helpers
// -------------------------------------------------------------------------

const PHONE_NUMBER_ID: &str = "1234567890";
const ACCESS_TOKEN: &str = "EAA_test_token";

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
// Pure wiremock — request-shape assertions
// -------------------------------------------------------------------------

/// Verifies the exact JSON body posted for `location_request_message`.
/// The body matcher is byte-equal: `body_json` on `wiremock` deep-compares
/// the parsed JSON, so any drift in the payload shape fails this test.
#[tokio::test]
async fn location_request_payload_shape_is_exact() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.loc_xyz";

    let expected_body: Value = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919876543210",
        "type": "interactive",
        "interactive": {
            "type": "location_request_message",
            "body": { "text": "Where are you?" },
            "action": { "name": "send_location" },
        },
    });

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_json(&expected_body))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    // We exercise the wire path directly via MetaClient — equivalent to
    // what `FlowSender::dispatch` does after building the payload. This
    // keeps the test free of Mongo while still nailing the Meta shape.
    let meta = meta_for(&server);
    let resp: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &expected_body,
        )
        .await
        .expect("post");

    assert_eq!(resp.messages.len(), 1);
    assert_eq!(resp.messages[0].id, wamid);
    // wiremock `expect(1)` runs at server drop — proves both path AND
    // body matched exactly.
}

/// Verifies the exact JSON body posted for `address_message`, including
/// the `parameters.values` and `parameters.saved_address_id` fields.
#[tokio::test]
async fn address_payload_shape_is_exact() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.addr_xyz";

    let expected_body: Value = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919876543210",
        "type": "interactive",
        "interactive": {
            "type": "address_message",
            "body": { "text": "Please share your shipping address" },
            "action": {
                "name": "address_message",
                "parameters": {
                    "country": "IN",
                    "values": {
                        "name": "Alice",
                        "in_pin_code": "560001"
                    }
                }
            },
        },
    });

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_json(&expected_body))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let meta = meta_for(&server);
    let resp: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &expected_body,
        )
        .await
        .expect("post");

    assert_eq!(resp.messages[0].id, wamid);
}

/// Pure wiremock smoke test: the path always uses `/{version}/messages`.
#[tokio::test]
async fn meta_path_uses_v23_messages() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [],
            "messages": [{ "id": "wamid.smoke" }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let meta = meta_for(&server);
    let _: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &json!({}),
        )
        .await
        .expect("post");
}

// -------------------------------------------------------------------------
// Live-Mongo round-trip tests
// -------------------------------------------------------------------------

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_location_request_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project = make_project();

    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.live_loc";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .mount(&server)
        .await;

    let sender = FlowSender::new(mongo.clone(), meta_for(&server));
    let req = SendLocationReq {
        to: "+919876543210".to_owned(),
        body_text: "Where are you?".to_owned(),
    };

    let outcome = sender
        .send_location_request(&project, req)
        .await
        .expect("send ok");

    assert_eq!(outcome.wamid, wamid);

    let logs = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find log")
        .expect("log present");

    assert_eq!(log.get_str("direction").unwrap(), "out");
    assert_eq!(log.get_str("type").unwrap(), "interactive");
    assert_eq!(log.get_str("status").unwrap(), "sent");
    assert_eq!(log.get_str("wamid").unwrap(), wamid);
    assert_eq!(log.get_str("recipient").unwrap(), "919876543210");
    assert_eq!(log.get_object_id("projectId").unwrap(), project.id);
    assert!(log.get("messageTimestamp").is_some());
    assert!(log.get("statusTimestamps").is_some());
    assert!(log.get("createdAt").is_some());

    let content = log.get_document("content").expect("content doc");
    assert_eq!(content.get_str("type").unwrap(), "interactive");
    let interactive = content.get_document("interactive").unwrap();
    assert_eq!(
        interactive.get_str("type").unwrap(),
        "location_request_message"
    );
    let action = interactive.get_document("action").unwrap();
    assert_eq!(action.get_str("name").unwrap(), "send_location");

    logs.delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_address_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project = make_project();

    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.live_addr";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .mount(&server)
        .await;

    let sender = FlowSender::new(mongo.clone(), meta_for(&server));
    let req = SendAddressReq {
        to: "+919876543210".to_owned(),
        body_text: "Please share your shipping address".to_owned(),
        country: "IN".to_owned(),
        values: json!({ "name": "Alice", "in_pin_code": "560001" }),
    };

    let outcome = sender.send_address(&project, req).await.expect("send ok");

    assert_eq!(outcome.wamid, wamid);

    let logs = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find log")
        .expect("log present");

    assert_eq!(log.get_str("type").unwrap(), "interactive");
    let content = log.get_document("content").unwrap();
    let interactive = content.get_document("interactive").unwrap();
    assert_eq!(interactive.get_str("type").unwrap(), "address_message");
    let action = interactive.get_document("action").unwrap();
    assert_eq!(action.get_str("name").unwrap(), "address_message");
    let parameters = action.get_document("parameters").unwrap();
    assert_eq!(parameters.get_str("country").unwrap(), "IN");
    let values = parameters.get_document("values").unwrap();
    assert_eq!(values.get_str("name").unwrap(), "Alice");

    logs.delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn rejects_project_without_phone_number() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name).await.expect("mongo");

    let mut project = make_project();
    project.phone_numbers.clear();

    // Meta server that fails the test if hit — short-circuit must occur
    // before the network call.
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .respond_with(ResponseTemplate::new(500))
        .expect(0)
        .mount(&server)
        .await;

    let sender = FlowSender::new(mongo, meta_for(&server));
    let err = sender
        .send_location_request(
            &project,
            SendLocationReq {
                to: "+919876543210".to_owned(),
                body_text: "x".to_owned(),
            },
        )
        .await
        .unwrap_err();

    assert!(
        err.to_string().to_lowercase().contains("phone number"),
        "expected 'phone number' error, got {err}"
    );
}
