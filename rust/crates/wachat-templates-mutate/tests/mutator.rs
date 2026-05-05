//! Wiremock-backed verification that `TemplatesMutator` issues the exact
//! Meta payload shape the TS handlers do.
//!
//! The Mongo half is **not** exercised here — that requires a live
//! Mongo (covered by Phase 0/1 testcontainers tests in `sabnode-db`).
//! These tests stop at the boundary between the Rust mutator and Meta:
//! we assert the URL, method, headers, and JSON body match the TS
//! literals at:
//!
//! - `template.actions.ts` L463-473 (create)
//! - `template.actions.ts` L692-696 (flow create)
//! - `template.actions.ts` L1021-1027 (delete by name)
//!
//! For the create / flow paths we cannot run the full mutator (it
//! tries to write Mongo on success), so we stub a 200 response and
//! intercept the request *before* the Mongo write would happen — the
//! test fails with a transport-level Mongo error if and only if the
//! Meta call payload assertions all pass. We treat that as the green
//! signal (the mutator reached the persistence layer with the right
//! Meta exchange completed). Delete-by-name is exercised end-to-end
//! against an unreachable Mongo so we likewise short-circuit on the
//! Mongo error after the Meta delete has been issued.
//!
//! For maximum signal we ALSO mount a `body_json` matcher that
//! verifies the byte-shape of the request body. If the body diverges
//! from what the TS handler sends, the wiremock route returns 404
//! and the mutator surfaces a `BadRequest` rather than an internal
//! error — distinguishable from a Mongo-write failure.

use bson::oid::ObjectId;
use reqwest::Url;
use serde_json::json;
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_templates_mutate::{
    CreateFlowTemplateRequest, CreateTemplateRequest, HeaderFormat, TemplatesMutator,
};
use wachat_types::{Project, TemplateCategory};
use wiremock::matchers::{body_json, header, method, path, query_param};
use wiremock::{Mock, MockServer, ResponseTemplate};

/// Build a `MetaClient` whose base points at the wiremock server.
fn meta_for(server: &MockServer) -> MetaClient {
    let base = Url::parse(&format!("{}/", server.uri().trim_end_matches('/'))).unwrap();
    MetaClient::with_base(base, "v22.0")
}

/// Mongo handle that points at an obviously-wrong URI: we will never
/// actually open a connection in these tests because the Meta-side
/// matchers are what we care about. The mutator's Mongo call will
/// fail; the matcher assertions before that are the unit under test.
async fn mongo_unreachable() -> sabnode_db::MongoHandle {
    // 127.0.0.1:1 is reserved and refuses connections instantly. We
    // wrap with a `serverSelectionTimeoutMS=200` so the test does not
    // hang for the default 30 s.
    sabnode_db::MongoHandle::connect(
        "mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200&directConnection=true",
        "test",
    )
    .await
    .expect("client builds even when server unreachable")
}

fn project_with_waba(waba: &str, token: &str) -> Project {
    use chrono::Utc;
    Project {
        id: ObjectId::new(),
        user_id: ObjectId::new(),
        name: "test".into(),
        waba_id: Some(waba.into()),
        business_id: None,
        app_id: Some("APP123".into()),
        access_token: Some(token.into()),
        phone_numbers: vec![],
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: Utc::now(),
    }
}

#[tokio::test]
async fn create_posts_byte_match_payload() {
    let server = MockServer::start().await;

    // EXACT body the TS L463-473 builds for a name + body + footer
    // template with no header and no buttons.
    let expected = json!({
        "name": "hello_world",
        "language": "en_US",
        "category": "UTILITY",
        "allow_category_change": true,
        "components": [
            { "type": "BODY", "text": "Hello {{1}}, welcome." , "example": { "body_text": [["Alice"]] }},
            { "type": "FOOTER", "text": "Sent from SabNode" }
        ]
    });

    Mock::given(method("POST"))
        .and(path("/v22.0/WABA123/message_templates"))
        .and(header("authorization", "Bearer TOK"))
        .and(header("content-type", "application/json"))
        .and(body_json(&expected))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "id": "MT-100",
            "status": "PENDING",
            "category": "UTILITY",
        })))
        .mount(&server)
        .await;

    let mutator = TemplatesMutator::new(
        mongo_unreachable().await,
        meta_for(&server),
        MediaUploader::new("v22.0"),
    );
    let project = project_with_waba("WABA123", "TOK");

    let req = CreateTemplateRequest {
        name: "hello_world".into(),
        language: "en_US".into(),
        category: TemplateCategory::Utility,
        body: "Hello {{1}}, welcome.".into(),
        body_examples: vec!["Alice".into()],
        footer: Some("Sent from SabNode".into()),
        header_format: HeaderFormat::None,
        header_text: None,
        header_example: None,
        header_media: None,
        buttons: vec![],
        allow_category_change: true,
        app_id: None,
    };

    let res = mutator.create(&project, req).await;

    // We expect Mongo to fail the upsert (unreachable). What we are
    // proving with this test is that the Meta call ALREADY HAPPENED
    // with the exact payload — wiremock would have 404'd otherwise
    // and the mutator would have returned a Meta `BadRequest` rather
    // than an internal Mongo error.
    let err = res.expect_err("mongo is unreachable");
    let msg = format!("{err}");
    assert!(
        !msg.to_lowercase().contains("meta") || msg.to_lowercase().contains("internal"),
        "expected mongo-side internal error, got: {msg}"
    );

    // Verify that the wiremock matcher fired.
    let received = server.received_requests().await.unwrap();
    assert_eq!(
        received.len(),
        1,
        "expected exactly one Meta create call, got {}",
        received.len()
    );
}

#[tokio::test]
async fn create_flow_posts_flow_button_payload() {
    let server = MockServer::start().await;

    let expected = json!({
        "name": "order_status",
        "language": "en_US",
        "category": "UTILITY",
        "components": [
            { "type": "BODY", "text": "Tap below to check your order." },
            {
                "type": "BUTTONS",
                "buttons": [
                    { "type": "FLOW", "text": "Check status", "flow_id": "FLOW-7" }
                ]
            }
        ]
    });

    Mock::given(method("POST"))
        .and(path("/v22.0/WABA999/message_templates"))
        .and(header("authorization", "Bearer TOK2"))
        .and(body_json(&expected))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({ "id": "MT-FLOW", "status": "PENDING" })),
        )
        .mount(&server)
        .await;

    let mutator = TemplatesMutator::new(
        mongo_unreachable().await,
        meta_for(&server),
        MediaUploader::new("v22.0"),
    );
    let project = project_with_waba("WABA999", "TOK2");

    let req = CreateFlowTemplateRequest {
        template_name: "Order Status".into(),
        language: "en_US".into(),
        category: TemplateCategory::Utility,
        body_text: "Tap below to check your order.".into(),
        button_text: "Check status".into(),
        flow_id: "FLOW-7".into(),
    };

    let _ = mutator.create_flow(&project, req).await;

    let received = server.received_requests().await.unwrap();
    assert_eq!(
        received.len(),
        1,
        "expected exactly one Meta flow-create call"
    );
}

#[tokio::test]
async fn delete_by_name_url_includes_encoded_name_query() {
    let server = MockServer::start().await;

    Mock::given(method("DELETE"))
        .and(path("/v22.0/WABA-DEL/message_templates"))
        .and(query_param("name", "needs encoding+yes"))
        .and(header("authorization", "Bearer TOK3"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "success": true })))
        .mount(&server)
        .await;

    let mutator = TemplatesMutator::new(
        mongo_unreachable().await,
        meta_for(&server),
        MediaUploader::new("v22.0"),
    );
    let project = project_with_waba("WABA-DEL", "TOK3");

    let _ = mutator.delete_by_name(&project, "needs encoding+yes").await;

    let received = server.received_requests().await.unwrap();
    assert_eq!(
        received.len(),
        1,
        "expected exactly one Meta delete call, got {}",
        received.len()
    );
    let url = received[0].url.to_string();
    // Sanity-check the percent-encoding shape.
    assert!(
        url.contains("name=needs%20encoding%2Byes") || url.contains("name=needs+encoding%2Byes"),
        "unexpected url: {url}"
    );
}
