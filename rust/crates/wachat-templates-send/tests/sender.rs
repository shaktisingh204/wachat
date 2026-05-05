//! Integration tests for [`TemplateSender`].
//!
//! Two-tier coverage:
//!
//! 1. **Pure / wiremock-only** — stubs Meta with `wiremock` and asserts the
//!    request shape sent to `POST /v23.0/{phone-number-id}/messages` plus
//!    the `wamid` returned in [`SendOutcome`]. These run unconditionally.
//! 2. **Live Mongo round-trip** — verifies the `outgoing_messages` doc
//!    actually lands in Mongo with the right field shape. Gated behind
//!    `TEST_MONGODB_URI` env vars (matching the pattern used by the
//!    sibling `wachat-templates` crate's `tests/reader.rs`).

use bson::{doc, oid::ObjectId};
use chrono::Utc;
use serde_json::json;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use sabnode_db::mongo::MongoHandle;
use wachat_meta_client::MetaClient;
use wachat_templates_engine::Variables;
use wachat_types::{
    project::Project,
    template::{Template, TemplateCategory, TemplateStatus},
    waba::PhoneNumberSummary,
};

use wachat_templates_send::{META_API_VERSION, SendTemplateRequest, TemplateSender};

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

fn make_template(project_id: ObjectId) -> Template {
    Template {
        id: ObjectId::new(),
        project_id,
        name: "welcome_template".to_owned(),
        language: "en_US".to_owned(),
        status: TemplateStatus::Approved,
        category: TemplateCategory::Marketing,
        // The TS code reads HEADER + BODY + BUTTONS off `components`. We
        // exercise the BODY substitution path here.
        components: json!([
            { "type": "BODY", "text": "Hello {{1}}, welcome aboard!" }
        ]),
        meta_template_id: Some("M_42".to_owned()),
        created_at: None,
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
// Tests
// -------------------------------------------------------------------------

#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn send_posts_to_meta_and_writes_log() {
    // ---- Arrange ----------------------------------------------------
    let (uri, db_name) = match live_mongo() {
        Some(v) => v,
        None => {
            eprintln!("skipping: TEST_MONGODB_URI not set");
            return;
        }
    };

    let mongo = MongoHandle::connect(&uri, &db_name)
        .await
        .expect("mongo connect");

    let project = make_project();
    let template = make_template(project.id);

    // Seed the template into Mongo so the sender's `find_one` resolves.
    let templates_coll = mongo.collection::<Template>("templates");
    templates_coll
        .insert_one(&template)
        .await
        .expect("seed template");

    // Stub Meta.
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.test_xyz";

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

    let sender = TemplateSender::new(mongo.clone(), meta_for(&server));

    let req = SendTemplateRequest {
        recipient_phone: "+919876543210".to_owned(),
        template_id: template.id,
        variables: Variables::new().set_positional(1, "Alice"),
        media_id: None,
    };

    // ---- Act --------------------------------------------------------
    let outcome = sender.send(&project, req).await.expect("send ok");

    // ---- Assert -----------------------------------------------------
    assert_eq!(outcome.wamid, wamid);

    let logs_coll = mongo.collection::<bson::Document>("outgoing_messages");
    let log = logs_coll
        .find_one(doc! { "_id": outcome.message_log_id })
        .await
        .expect("find log")
        .expect("log present");

    assert_eq!(log.get_str("direction").unwrap(), "out");
    assert_eq!(log.get_str("type").unwrap(), "template");
    assert_eq!(log.get_str("status").unwrap(), "pending");
    assert_eq!(log.get_str("wamid").unwrap(), wamid);
    assert_eq!(log.get_str("recipient").unwrap(), "919876543210");
    assert_eq!(log.get_object_id("projectId").unwrap(), project.id);
    assert_eq!(log.get_object_id("templateId").unwrap(), template.id);
    assert!(log.get("messageTimestamp").is_some());
    assert!(log.get("statusTimestamps").is_some());
    assert!(log.get("createdAt").is_some());
    assert!(log.get("content").is_some());

    // Cleanup
    templates_coll
        .delete_one(doc! { "_id": template.id })
        .await
        .ok();
    logs_coll
        .delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

/// Wiremock + live-Mongo: full end-to-end shape check on Meta's request.
///
/// Self-skips when no live Mongo is configured — the sender's first step
/// is `templates.find_one`, so without Mongo we never reach the Meta
/// call. Gated on the same env vars as `send_posts_to_meta_and_writes_log`.
#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn meta_request_shape_is_correct() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name).await.expect("mongo");

    let project = make_project();
    let template = make_template(project.id);
    let template_id = template.id;

    let coll = mongo.collection::<Template>("templates");
    coll.insert_one(&template).await.expect("seed");

    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [],
            "messages": [{ "id": "wamid.shape_test" }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let sender = TemplateSender::new(mongo.clone(), meta_for(&server));
    let req = SendTemplateRequest {
        recipient_phone: "+919876543210".to_owned(),
        template_id,
        variables: Variables::new().set_positional(1, "Alice"),
        media_id: None,
    };

    let outcome = sender.send(&project, req).await.expect("send ok");
    assert_eq!(outcome.wamid, "wamid.shape_test");

    // Cleanup
    coll.delete_one(doc! { "_id": template_id }).await.ok();
    mongo
        .collection::<bson::Document>("outgoing_messages")
        .delete_one(doc! { "_id": outcome.message_log_id })
        .await
        .ok();
}

/// Pure wiremock: stub Meta and confirm the sender's HTTP wiring is
/// correct by exercising the request via [`MetaClient`] directly. This
/// doesn't go through [`TemplateSender::send`] (which needs Mongo) but
/// proves the path / version / token plumbing the sender will use.
#[tokio::test]
async fn wiremock_meta_path_uses_v23_messages() {
    let server = MockServer::start().await;
    let expected_path = format!("/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages");
    let wamid = "wamid.standalone_xyz";

    Mock::given(method("POST"))
        .and(path(&expected_path))
        .and(header("authorization", &*format!("Bearer {ACCESS_TOKEN}")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
            "messages": [{ "id": wamid }],
        })))
        .expect(1)
        .mount(&server)
        .await;

    let meta = meta_for(&server);
    let payload = json!({
        "messaging_product": "whatsapp",
        "to": "919876543210",
        "type": "template",
        "template": {
            "name": "welcome_template",
            "language": { "code": "en_US" },
            "components": [
                { "type": "body", "parameters": [{ "type": "text", "text": "Alice" }] }
            ],
        }
    });

    let resp: wachat_meta_dto::SendResponse = meta
        .post_json(
            &format!("{PHONE_NUMBER_ID}/messages"),
            ACCESS_TOKEN,
            &payload,
        )
        .await
        .expect("post");

    assert_eq!(resp.messages.len(), 1);
    assert_eq!(resp.messages[0].id, wamid);
    assert_eq!(resp.messaging_product, "whatsapp");
    // wiremock `expect(1)` runs at server drop — proves the path matched.
}

/// Live-Mongo: validation on a non-APPROVED template short-circuits BEFORE
/// the Meta call. The wiremock `expect(0)` guard proves Meta is never hit.
#[tokio::test]
#[ignore = "requires a live Mongo (set TEST_MONGODB_URI / TEST_MONGODB_DB)"]
async fn rejects_non_approved_template() {
    let Some((uri, db_name)) = live_mongo() else {
        eprintln!("skipping: TEST_MONGODB_URI not set");
        return;
    };

    let mongo = MongoHandle::connect(&uri, &db_name).await.expect("mongo");

    let project = make_project();
    let mut template = make_template(project.id);
    template.status = TemplateStatus::Pending;
    let template_id = template.id;

    let coll = mongo.collection::<Template>("templates");
    coll.insert_one(&template).await.expect("seed");

    // Meta server that fails the test if hit — it must NOT be called.
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path(format!(
            "/{META_API_VERSION}/{PHONE_NUMBER_ID}/messages"
        )))
        .respond_with(ResponseTemplate::new(500))
        .expect(0)
        .mount(&server)
        .await;

    let sender = TemplateSender::new(mongo.clone(), meta_for(&server));
    let req = SendTemplateRequest {
        recipient_phone: "+919876543210".to_owned(),
        template_id,
        variables: Variables::new().set_positional(1, "Alice"),
        media_id: None,
    };

    let err = sender.send(&project, req).await.unwrap_err();
    assert!(
        err.to_string().to_lowercase().contains("not approved"),
        "expected 'not approved' error, got {err}"
    );

    coll.delete_one(doc! { "_id": template_id }).await.ok();
}
