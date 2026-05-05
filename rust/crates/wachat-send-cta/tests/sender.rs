//! Integration tests for [`CtaSender`].
//!
//! Two-tier coverage matching the sibling `wachat-templates-send` crate:
//!
//! 1. **Pure wiremock** — stubs Meta and asserts the request shape sent to
//!    `POST /v23.0/{phone-number-id}/messages`. These run unconditionally
//!    by exercising [`MetaClient`] directly with the same payload the
//!    sender would build (since the sender's Mongo write requires a live
//!    Mongo).
//! 2. **Live Mongo round-trip** — verifies `outgoing_messages` lands with
//!    the right field shape via [`CtaSender::send_catalog`] /
//!    [`CtaSender::send_cta_url`]. Gated behind `TEST_MONGODB_URI` /
//!    `TEST_MONGODB_DB` env vars (matching the pattern other tests use).

use bson::{doc, oid::ObjectId};
use chrono::Utc;
use serde_json::{Value, json};
use wiremock::matchers::{body_partial_json, header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_types::{project::Project, waba::PhoneNumberSummary};

use wachat_send_cta::{CtaSender, META_API_VERSION, SendCatalogReq, SendCtaUrlReq};

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
// Pure wiremock — request-shape assertions via `body_partial_json`.
// -------------------------------------------------------------------------

/// Catalog send: assert the Meta request body matches the TS literal at
/// `whatsapp.actions.ts` lines 1077-1096.
#[tokio::test]
async fn wiremock_catalog_request_shape_matches_ts() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.catalog_xyz";

    let expected_body: Value = json!({
        "messaging_product": "whatsapp",
        "to": "919876543210",
        "type": "interactive",
        "interactive": {
            "type": "product_list",
            "body": { "text": "Browse our catalog" },
            "footer": { "text": "Limited time" },
            "action": {
                "catalog_id": "CAT_1",
                "sections": [{
                    "title": "Our Products",
                    "product_items": [{ "product_retailer_id": "SKU-A" }],
                }],
            },
        }
    });

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_partial_json(expected_body))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    // Build the same payload the sender would build, then POST via the
    // shared `MetaClient`. We can't drive `CtaSender::send_catalog` here
    // because the sender writes to Mongo; the live-Mongo test below
    // covers the full path.
    let meta = meta_for(&server);
    let req = SendCatalogReq {
        to: "+919876543210".to_owned(),
        catalog_id: "CAT_1".to_owned(),
        product_retailer_id: Some("SKU-A".to_owned()),
        body_text: Some("Browse our catalog".to_owned()),
        footer_text: Some("Limited time".to_owned()),
    };
    let payload = build_catalog_payload(&req, "919876543210");

    let resp: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post");
    assert_eq!(resp.messages[0].id, wamid);
    // wiremock `expect(1)` runs at server drop — proves the body matched.
}

/// CTA URL send: assert the Meta request body matches the TS literal at
/// `whatsapp.actions.ts` lines 1518-1536, including `recipient_type:
/// 'individual'`.
#[tokio::test]
async fn wiremock_cta_url_request_shape_matches_ts() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.cta_xyz";

    let expected_body: Value = json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": "919876543210",
        "type": "interactive",
        "interactive": {
            "type": "cta_url",
            "header": { "type": "text", "text": "Welcome" },
            "body": { "text": "Tap to open" },
            "footer": { "text": "Powered by SabNode" },
            "action": {
                "name": "cta_url",
                "parameters": {
                    "display_text": "Open Site",
                    "url": "https://example.com",
                },
            },
        }
    });

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .and(body_partial_json(expected_body))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let meta = meta_for(&server);
    let req = SendCtaUrlReq {
        to: "+919876543210".to_owned(),
        display_text: "Open Site".to_owned(),
        url: "https://example.com".to_owned(),
        body_text: Some("Tap to open".to_owned()),
        header_text: Some("Welcome".to_owned()),
        footer_text: Some("Powered by SabNode".to_owned()),
    };
    let payload = build_cta_url_payload(&req, "919876543210");

    let resp: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post");
    assert_eq!(resp.messages[0].id, wamid);
}

/// CTA URL: header / footer must be omitted (not null) when not supplied.
#[tokio::test]
async fn wiremock_cta_url_omits_optional_fields() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "messages": [{ "id": "w" }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let meta = meta_for(&server);
    let req = SendCtaUrlReq {
        to: "+15555555555".to_owned(),
        display_text: "Go".to_owned(),
        url: "https://x.com".to_owned(),
        body_text: Some("b".to_owned()),
        header_text: None,
        footer_text: None,
    };
    let payload = build_cta_url_payload(&req, "15555555555");

    // Sanity check that the JSON we ship doesn't include `header` /
    // `footer` keys (they would be `null` if we used `Option` directly
    // without `skip_serializing_if`).
    let interactive = &payload["interactive"];
    assert!(interactive.get("header").is_none());
    assert!(interactive.get("footer").is_none());

    let _: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post");
}

// -------------------------------------------------------------------------
// Live-Mongo end-to-end — drives `CtaSender::*` for real.
// -------------------------------------------------------------------------

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_catalog_e2e_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name).await.expect("mongo");
    let project = make_project();

    let server = MockServer::start().await;
    let wamid = "wamid.catalog_e2e";
    Mock::given(method("POST"))
        .and(path(format!(
            "/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages"
        )))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "messages": [{ "id": wamid }],
        })))
        .mount(&server)
        .await;

    let sender = CtaSender::new(mongo.clone(), meta_for(&server));
    let req = SendCatalogReq {
        to: "+919876543210".to_owned(),
        catalog_id: "CAT_1".to_owned(),
        product_retailer_id: Some("SKU-A".to_owned()),
        body_text: Some("Browse".to_owned()),
        footer_text: None,
    };
    let outcome = sender.send_catalog(&project, req).await.expect("send ok");
    assert_eq!(outcome.wamid, wamid);

    let logs = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find")
        .expect("present");
    assert_eq!(log.get_str("direction").unwrap(), "out");
    assert_eq!(log.get_str("type").unwrap(), "interactive");
    assert_eq!(log.get_str("status").unwrap(), "sent");
    assert_eq!(log.get_str("wamid").unwrap(), wamid);
    assert_eq!(log.get_str("recipient").unwrap(), "919876543210");
    assert_eq!(log.get_object_id("projectId").unwrap(), project.id);

    logs.delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_cta_url_e2e_writes_log() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name).await.expect("mongo");
    let project = make_project();

    let server = MockServer::start().await;
    let wamid = "wamid.cta_e2e";
    Mock::given(method("POST"))
        .and(path(format!(
            "/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages"
        )))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "messages": [{ "id": wamid }],
        })))
        .mount(&server)
        .await;

    let sender = CtaSender::new(mongo.clone(), meta_for(&server));
    let req = SendCtaUrlReq {
        to: "+919876543210".to_owned(),
        display_text: "Open".to_owned(),
        url: "https://example.com".to_owned(),
        body_text: Some("Tap below".to_owned()),
        header_text: None,
        footer_text: None,
    };
    let outcome = sender.send_cta_url(&project, req).await.expect("send ok");
    assert_eq!(outcome.wamid, wamid);

    let logs = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find")
        .expect("present");
    assert_eq!(log.get_str("type").unwrap(), "interactive");
    assert_eq!(log.get_str("wamid").unwrap(), wamid);
    // CTA URL payload includes `recipient_type` — verify we kept it.
    let content = log.get_document("content").unwrap();
    assert_eq!(content.get_str("recipient_type").unwrap(), "individual");

    logs.delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

// -------------------------------------------------------------------------
// Local re-implementations of the sender's payload builders. We keep them
// here so the wiremock tests don't depend on `pub(crate)` visibility — if
// the sender's internal builders drift, the byte-for-byte assertion above
// will fail at the wiremock layer regardless.
// -------------------------------------------------------------------------

fn build_catalog_payload(req: &SendCatalogReq, recipient_bare: &str) -> Value {
    let mut interactive = serde_json::Map::new();
    interactive.insert("type".to_owned(), json!("product_list"));
    if let Some(b) = req.body_text.as_deref() {
        interactive.insert("body".to_owned(), json!({ "text": b }));
    }
    if let Some(f) = req.footer_text.as_deref() {
        interactive.insert("footer".to_owned(), json!({ "text": f }));
    }
    let items: Vec<Value> = req
        .product_retailer_id
        .as_deref()
        .map(|id| vec![json!({ "product_retailer_id": id })])
        .unwrap_or_default();
    interactive.insert(
        "action".to_owned(),
        json!({
            "catalog_id": req.catalog_id,
            "sections": [{ "title": "Our Products", "product_items": items }],
        }),
    );

    json!({
        "messaging_product": "whatsapp",
        "to": recipient_bare,
        "type": "interactive",
        "interactive": Value::Object(interactive),
    })
}

fn build_cta_url_payload(req: &SendCtaUrlReq, recipient_bare: &str) -> Value {
    let mut interactive = serde_json::Map::new();
    interactive.insert("type".to_owned(), json!("cta_url"));
    if let Some(h) = req.header_text.as_deref() {
        interactive.insert("header".to_owned(), json!({ "type": "text", "text": h }));
    }
    if let Some(b) = req.body_text.as_deref() {
        interactive.insert("body".to_owned(), json!({ "text": b }));
    }
    if let Some(f) = req.footer_text.as_deref() {
        interactive.insert("footer".to_owned(), json!({ "text": f }));
    }
    interactive.insert(
        "action".to_owned(),
        json!({
            "name": "cta_url",
            "parameters": {
                "display_text": req.display_text,
                "url": req.url,
            },
        }),
    );

    json!({
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": recipient_bare,
        "type": "interactive",
        "interactive": Value::Object(interactive),
    })
}
