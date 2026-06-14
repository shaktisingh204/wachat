//! End-to-end integration tests for the wachat templates pipeline.
//!
//! These tests exercise the **full vertical** of a templates flow:
//!
//! ```text
//!   axum router  →  templates handlers  →  Mongo (testcontainer)
//!                                       →  Meta (wiremock)
//! ```
//!
//! The four scenarios mirror the four user-visible operations the TS code
//! ships in `src/app/actions/template.actions.ts` and
//! `src/app/actions/send-template.actions.ts`:
//!
//! 1. **List** — `getTemplates(projectId)` filter parity.
//! 2. **Create + sync** — `handleCreateTemplate` + `handleSyncTemplates`.
//! 3. **Send** — `handleSendTemplateMessage`, including the
//!    `outgoing_messages` insert with the returned `wamid`.
//! 4. **Delete by id** — `handleDeleteTemplateById` (Meta-side delete + local
//!    doc removal).
//!
//! ## Skipping
//!
//! Every test is gated on `SKIP_TESTCONTAINERS=1`. CI runners without Docker
//! (and developer fast-loops) set the env var; the tests early-return with a
//! one-line skip notice instead of failing.
//!
//! ## Why both router-level and handle-level assertions?
//!
//! We invoke through `tower::ServiceExt::oneshot` against the
//! `wachat-templates-router::router` to catch any wiring drift (route paths,
//! extractors, status codes). After each call we cross-check the persisted
//! Mongo state directly via the driver, because the HTTP response alone is
//! not a sufficient liveness signal — a 200 with a stale doc would be a
//! silent regression.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::Router;
use axum::body::Body;
use axum::extract::FromRef;
use axum::http::{Method, Request, StatusCode, header};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use jsonwebtoken::{Algorithm, EncodingKey, Header, encode};
use mongodb::Collection;
use sabnode_auth::{AuthConfig, Claims};
use sabnode_db::mongo::MongoHandle;
use serde_json::{Value, json};
use testcontainers::ContainerAsync;
use testcontainers::runners::AsyncRunner;
use testcontainers_modules::mongo::Mongo;
use tower::ServiceExt;
use url::Url;
use wachat_media::MediaUploader;
use wachat_meta_client::MetaClient;
use wachat_templates::TemplatesReader;
use wachat_templates_categories::TemplatesLibrary;
use wachat_templates_mutate::TemplatesMutator;
use wachat_templates_router::{TemplatesState, router};
use wachat_templates_send::TemplateSender;
use wachat_templates_sync::TemplatesSyncer;
use wiremock::matchers::{method as wm_method, path as wm_path, path_regex};
use wiremock::{Mock, MockServer, ResponseTemplate};

// ---------------------------------------------------------------------
// constants — collection + Meta version parity with the TS
// ---------------------------------------------------------------------

const META_VERSION: &str = "v25.0";
const TEMPLATES_COLL: &str = "templates";
const PROJECTS_COLL: &str = "projects";
const OUTGOING_COLL: &str = "outgoing_messages";

const TEST_WABA_ID: &str = "waba_test_1";
const TEST_PNID: &str = "1234567890";
const TEST_TOKEN: &str = "tok-test";
const TEST_JWT_SECRET: &[u8] = b"end-to-end-tests-shared-secret-do-not-leak";

// ---------------------------------------------------------------------
// skip helper — `SKIP_TESTCONTAINERS=1` shortcuts every test
// ---------------------------------------------------------------------

fn should_skip() -> bool {
    std::env::var("SKIP_TESTCONTAINERS")
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}

/// Macro emit `eprintln!` + `return` so each test stays a one-liner at the
/// top. Keeps the skip behaviour symmetric with the existing
/// `sabnode-db::tests::integration` suite.
macro_rules! skip_if_no_docker {
    ($name:literal) => {
        if should_skip() {
            eprintln!(concat!("SKIP_TESTCONTAINERS=1 — skipping ", $name));
            return;
        }
    };
}

// ---------------------------------------------------------------------
// test app state — minimal viable shape for the router's `FromRef` bounds
// ---------------------------------------------------------------------
//
// The router crate exposes `TemplatesState` for production use; we wrap it
// inside a `TestState` so the `FromRef<TestState>` impl below can produce
// it (and an `Arc<AuthConfig>`) on demand.

#[derive(Clone)]
struct TestState {
    templates: TemplatesState,
    auth: Arc<AuthConfig>,
}

impl FromRef<TestState> for TemplatesState {
    fn from_ref(s: &TestState) -> Self {
        s.templates.clone()
    }
}

impl FromRef<TestState> for Arc<AuthConfig> {
    fn from_ref(s: &TestState) -> Self {
        s.auth.clone()
    }
}

// ---------------------------------------------------------------------
// boot helpers
// ---------------------------------------------------------------------

/// Spin up a MongoDB testcontainer and connect a [`MongoHandle`].
///
/// The container is returned alongside the handle so its `Drop` keeps the
/// container alive for the lifetime of the test.
async fn boot_mongo() -> (ContainerAsync<Mongo>, MongoHandle) {
    let container = Mongo::default()
        .start()
        .await
        .expect("start mongo container");
    let host = container.get_host().await.expect("container host");
    let port = container
        .get_host_port_ipv4(27017)
        .await
        .expect("container port");
    let uri = format!("mongodb://{host}:{port}");
    let handle = MongoHandle::connect(&uri, "wachat_templates_e2e")
        .await
        .expect("connect to mongo");
    (container, handle)
}

/// Build a [`MetaClient`] pointed at a `wiremock` server. Trailing slash on
/// `base` matters for `Url::join` semantics inside the client.
fn meta_for(server: &MockServer) -> MetaClient {
    let raw = server.uri();
    let base = Url::parse(&format!("{}/", raw.trim_end_matches('/'))).unwrap();
    MetaClient::with_base(base, META_VERSION)
}

/// Build a [`MediaUploader`] pointed at the same wiremock server. The
/// templates pipeline only invokes the uploader when the caller requests
/// a media-header template; for our scenarios it is never called, but the
/// mutator's constructor demands one.
fn media_for(server: &MockServer) -> MediaUploader {
    MediaUploader::new_with_base(server.uri(), META_VERSION)
}

/// Compose a `TemplatesState` bundle from one Mongo handle + one MetaClient.
fn templates_state(mongo: MongoHandle, meta: MetaClient, server: &MockServer) -> TemplatesState {
    TemplatesState {
        reader: Arc::new(TemplatesReader::new(mongo.clone())),
        mutator: Arc::new(TemplatesMutator::new(
            mongo.clone(),
            meta.clone(),
            media_for(server),
        )),
        syncer: Arc::new(TemplatesSyncer::new(mongo.clone(), meta.clone())),
        library: Arc::new(TemplatesLibrary::new(mongo.clone())),
        sender: Arc::new(TemplateSender::new(mongo.clone(), meta)),
        mongo,
    }
}

/// Compose the templates router under a [`TestState`], fully ready to accept
/// `tower::ServiceExt::oneshot` calls.
fn build_app(state: TestState) -> Router {
    let app: Router<TestState> = router::<TestState>();
    app.with_state(state)
}

/// Insert a synthetic `projects` row so the send / sync paths can resolve
/// the WABA id, phone-number id, and access token the way the production
/// handlers do (they read those off `Project`, never out of headers).
///
/// Returns the user id used for the project's `userId` so the JWT can
/// claim that tenant id and pass the per-project tenancy guard.
async fn seed_project(mongo: &MongoHandle, project_id: ObjectId) -> ObjectId {
    let user_id = ObjectId::new();
    let coll: Collection<Document> = mongo.collection(PROJECTS_COLL);
    coll.insert_one(doc! {
        "_id": project_id,
        "userId": user_id,
        "name": "e2e-project",
        "wabaId": TEST_WABA_ID,
        "businessId": "biz_1",
        "appId": "app_1",
        "accessToken": TEST_TOKEN,
        "phoneNumbers": [
            { "id": TEST_PNID, "display_phone_number": "+15555550100", "verified_name": "E2E" }
        ],
        "createdAt": Utc::now(),
    })
    .await
    .expect("seed project");
    user_id
}

/// Insert a single template doc. Returns the `_id` used so callers can
/// later assert against it.
async fn seed_template(
    mongo: &MongoHandle,
    project_id: ObjectId,
    name: &str,
    meta_id: Option<&str>,
    status: &str,
) -> ObjectId {
    let id = ObjectId::new();
    let coll: Collection<Document> = mongo.collection(TEMPLATES_COLL);
    let mut doc = doc! {
        "_id": id,
        "projectId": project_id,
        "name": name,
        "language": "en_US",
        "status": status,
        "category": "MARKETING",
        "components": [
            { "type": "BODY", "text": "Hello {{1}}" }
        ],
        "createdAt": Utc::now(),
    };
    if let Some(m) = meta_id {
        doc.insert("metaId", m);
    }
    coll.insert_one(doc).await.expect("seed template");
    id
}

/// Count templates for a project; small wrapper to keep assertion lines
/// self-documenting at the call site.
async fn count_templates(mongo: &MongoHandle, project_id: ObjectId) -> u64 {
    let coll: Collection<Document> = mongo.collection(TEMPLATES_COLL);
    coll.count_documents(doc! { "projectId": project_id })
        .await
        .expect("count templates")
}

/// Read a single template doc by `_id`.
async fn find_template(mongo: &MongoHandle, id: ObjectId) -> Option<Document> {
    let coll: Collection<Document> = mongo.collection(TEMPLATES_COLL);
    coll.find_one(doc! { "_id": id })
        .await
        .expect("find template")
}

/// Read all outgoing message rows for a project.
async fn list_outgoing(mongo: &MongoHandle, project_id: ObjectId) -> Vec<Document> {
    let coll: Collection<Document> = mongo.collection(OUTGOING_COLL);
    let cursor = coll
        .find(doc! { "projectId": project_id })
        .await
        .expect("find outgoing");
    cursor.try_collect().await.expect("collect outgoing")
}

/// Mint a short-lived HS256 JWT signed with [`TEST_JWT_SECRET`] whose
/// `tid` (tenant id) matches the project's `userId`. The router's
/// `load_project_for` guard compares those strings before delegating to
/// the engines, so without this the requests come back 403 even when
/// every other layer is wired correctly.
fn mint_jwt(user_id: ObjectId, tenant_id: ObjectId) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock past 1970")
        .as_secs() as i64;
    let claims = Claims {
        sub: user_id.to_hex(),
        tid: tenant_id.to_hex(),
        roles: vec!["owner".to_owned()],
        iat: now,
        exp: now + 900, // 15 min — same as the TS issuer's pin
        iss: "sabnode-bff".to_owned(),
    };
    let header = Header::new(Algorithm::HS256);
    encode(&header, &claims, &EncodingKey::from_secret(TEST_JWT_SECRET)).expect("mint test JWT")
}

/// Build a default [`TestState`] backed by an in-memory auth config that
/// trusts [`TEST_JWT_SECRET`].
fn make_state(mongo: MongoHandle, meta: MetaClient, server: &MockServer) -> TestState {
    TestState {
        templates: templates_state(mongo, meta, server),
        auth: Arc::new(AuthConfig {
            secret: TEST_JWT_SECRET.to_vec(),
        }),
    }
}

/// Build an `Authorization: Bearer …` header value for a JWT the router
/// will accept against the project owned by `user_id`.
fn bearer(user_id: ObjectId) -> String {
    format!("Bearer {}", mint_jwt(user_id, user_id))
}

// =====================================================================
// scenario 1 — LIST
// =====================================================================
//
// Seed 3 templates under project A and 2 under project B; hit the router's
// `GET /?project_id=…` endpoint scoped to project A and expect exactly the
// 3 rows back. This exercises the project-scoping filter end-to-end and
// confirms the reader's `{ projectId }` guard is honored at the HTTP edge.
#[tokio::test(flavor = "multi_thread")]
async fn list_returns_only_project_a_templates() {
    skip_if_no_docker!("list_returns_only_project_a_templates");

    let (_mongo_box, mongo) = boot_mongo().await;
    let meta_server = MockServer::start().await; // unused — but the state needs one.
    let meta = meta_for(&meta_server);

    let project_a = ObjectId::new();
    let project_b = ObjectId::new();
    let owner_a = seed_project(&mongo, project_a).await;
    let _owner_b = seed_project(&mongo, project_b).await;

    for n in ["a1", "a2", "a3"] {
        seed_template(&mongo, project_a, n, Some(&format!("m_{n}")), "APPROVED").await;
    }
    for n in ["b1", "b2"] {
        seed_template(&mongo, project_b, n, Some(&format!("m_{n}")), "APPROVED").await;
    }

    let app = build_app(make_state(mongo.clone(), meta, &meta_server));

    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(format!("/?project_id={}", project_a.to_hex()))
                .header(header::ACCEPT, "application/json")
                .header(header::AUTHORIZATION, bearer(owner_a))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("router responds");

    assert_eq!(
        resp.status(),
        StatusCode::OK,
        "GET / should succeed for a known project"
    );

    let bytes = axum::body::to_bytes(resp.into_body(), 64 * 1024)
        .await
        .expect("read body");
    let body: Value = serde_json::from_slice(&bytes).expect("decode JSON list");
    let arr = body
        .as_array()
        .or_else(|| body.get("templates").and_then(Value::as_array))
        .expect("expected an array (or `templates: [...]`) in body");

    assert_eq!(
        arr.len(),
        3,
        "router must return exactly the 3 project_a templates, got {}",
        arr.len()
    );

    // Belt-and-braces: cross-check the Mongo state itself.
    assert_eq!(count_templates(&mongo, project_a).await, 3);
    assert_eq!(count_templates(&mongo, project_b).await, 2);
}

// =====================================================================
// scenario 2 — CREATE + SYNC
// =====================================================================
//
// Empty Mongo → `POST /` creates a template via Meta (stub returns
// `{id: "meta_1"}`) → `POST /sync` re-pulls the WABA listing (stub
// returns the same template) and upserts. Final assertion: the local
// Mongo doc carries `metaId == "meta_1"`.
#[tokio::test(flavor = "multi_thread")]
async fn create_then_sync_persists_meta_id() {
    skip_if_no_docker!("create_then_sync_persists_meta_id");

    let (_mongo_box, mongo) = boot_mongo().await;
    let meta_server = MockServer::start().await;
    let meta = meta_for(&meta_server);

    let project_id = ObjectId::new();
    let owner = seed_project(&mongo, project_id).await;

    // Stub 1 — Meta create returns the assigned id.
    Mock::given(wm_method("POST"))
        .and(wm_path(format!(
            "/{META_VERSION}/{TEST_WABA_ID}/message_templates"
        )))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "id": "meta_1",
            "status": "PENDING",
            "category": "MARKETING",
        })))
        .mount(&meta_server)
        .await;

    // Stub 2 — Meta sync GET returns one row carrying `meta_1`.
    Mock::given(wm_method("GET"))
        .and(path_regex(format!(
            r"/{META_VERSION}/{TEST_WABA_ID}/message_templates"
        )))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "data": [{
                "id": "meta_1",
                "name": "hello_e2e",
                "language": "en_US",
                "status": "APPROVED",
                "category": "MARKETING",
                "components": [
                    { "type": "BODY", "text": "Hello {{1}}" }
                ],
            }],
            "paging": {}
        })))
        .mount(&meta_server)
        .await;

    let app = build_app(make_state(mongo.clone(), meta, &meta_server));

    // ---- POST / (create) -------------------------------------------------
    let create_body = json!({
        "project_id": project_id.to_hex(),
        "name": "hello_e2e",
        "language": "en_US",
        "category": "MARKETING",
        "body": "Hello {{1}}",
        "body_examples": ["World"],
        "header_format": "NONE",
    });
    let create_resp = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, bearer(owner))
                .body(Body::from(serde_json::to_vec(&create_body).unwrap()))
                .unwrap(),
        )
        .await
        .expect("create call");

    assert!(
        create_resp.status().is_success(),
        "POST / should succeed, got {}",
        create_resp.status()
    );

    // ---- POST /sync ------------------------------------------------------
    let sync_body = json!({ "project_id": project_id.to_hex() });
    let sync_resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/sync")
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, bearer(owner))
                .body(Body::from(serde_json::to_vec(&sync_body).unwrap()))
                .unwrap(),
        )
        .await
        .expect("sync call");
    assert!(
        sync_resp.status().is_success(),
        "POST /sync should succeed, got {}",
        sync_resp.status()
    );

    // ---- assert persisted state -----------------------------------------
    let coll: Collection<Document> = mongo.collection(TEMPLATES_COLL);
    let doc = coll
        .find_one(doc! { "projectId": project_id, "name": "hello_e2e" })
        .await
        .expect("find created template")
        .expect("template doc must exist after create+sync");

    let meta_id = doc.get_str("metaId").expect("metaId field present");
    assert_eq!(
        meta_id, "meta_1",
        "sync must persist the Meta-assigned id back onto the local row"
    );
}

// =====================================================================
// scenario 3 — SEND
// =====================================================================
//
// Approved template + project seeded; Meta `POST /{pnid}/messages` stubbed
// to return a single `wamid`. After `POST /:id/send`, the
// `outgoing_messages` collection must carry exactly one row scoped to the
// project and pinned to the returned `wamid` (mirrors TS line 337
// `db.collection('outgoing_messages').insertOne({...})`).
#[tokio::test(flavor = "multi_thread")]
async fn send_writes_outgoing_log_with_wamid() {
    skip_if_no_docker!("send_writes_outgoing_log_with_wamid");

    let (_mongo_box, mongo) = boot_mongo().await;
    let meta_server = MockServer::start().await;
    let meta = meta_for(&meta_server);

    let project_id = ObjectId::new();
    let owner = seed_project(&mongo, project_id).await;
    let template_id =
        seed_template(&mongo, project_id, "hello_e2e", Some("meta_1"), "APPROVED").await;

    // Stub Meta send.
    Mock::given(wm_method("POST"))
        .and(wm_path(format!("/{META_VERSION}/{TEST_PNID}/messages")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "messaging_product": "whatsapp",
            "contacts": [{ "input": "+15555550111", "wa_id": "15555550111" }],
            "messages": [{ "id": "wamid.test" }],
        })))
        .mount(&meta_server)
        .await;

    let app = build_app(make_state(mongo.clone(), meta, &meta_server));

    let send_body = json!({
        "project_id": project_id.to_hex(),
        "recipient_phone": "+15555550111",
        "variables": { "1": "World" },
    });
    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri(format!("/{}/send", template_id.to_hex()))
                .header(header::CONTENT_TYPE, "application/json")
                .header(header::AUTHORIZATION, bearer(owner))
                .body(Body::from(serde_json::to_vec(&send_body).unwrap()))
                .unwrap(),
        )
        .await
        .expect("send call");

    assert!(
        resp.status().is_success(),
        "POST /:id/send should succeed, got {}",
        resp.status()
    );

    let logs = list_outgoing(&mongo, project_id).await;
    assert_eq!(
        logs.len(),
        1,
        "exactly one outgoing_messages row should land per send"
    );
    let log = &logs[0];
    let wamid = log
        .get_str("metaMessageId")
        .or_else(|_| log.get_str("wamid"))
        .or_else(|_| log.get_str("metaWamid"))
        .expect("outgoing log must carry the Meta wamid");
    assert_eq!(
        wamid, "wamid.test",
        "wamid on the log must match what Meta returned"
    );
}

// =====================================================================
// scenario 4 — DELETE BY ID
// =====================================================================
//
// Seed one template; stub Meta `DELETE /{wabaId}/message_templates`; call
// `DELETE /:id` on the router; confirm the local Mongo doc is gone OR
// flagged deleted. The TS uses a hard `deleteOne`, but we accept either
// a hard delete or a soft-delete marker so this test survives a future
// soft-delete migration.
#[tokio::test(flavor = "multi_thread")]
async fn delete_removes_local_doc_after_meta_delete() {
    skip_if_no_docker!("delete_removes_local_doc_after_meta_delete");

    let (_mongo_box, mongo) = boot_mongo().await;
    let meta_server = MockServer::start().await;
    let meta = meta_for(&meta_server);

    let project_id = ObjectId::new();
    let owner = seed_project(&mongo, project_id).await;
    let template_id = seed_template(
        &mongo,
        project_id,
        "to_delete",
        Some("meta_to_delete"),
        "APPROVED",
    )
    .await;

    // Meta returns 200 with `success: true`. The mutator deletes by Meta
    // template id (`DELETE {version}/{metaTemplateId}`), so we match on
    // that path. We also mount a fallback for the WABA-scoped form
    // `DELETE {version}/{wabaId}/message_templates?name=…` in case a
    // future revision swaps to delete-by-name.
    Mock::given(wm_method("DELETE"))
        .and(wm_path(format!("/{META_VERSION}/meta_to_delete")))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "success": true })))
        .mount(&meta_server)
        .await;
    Mock::given(wm_method("DELETE"))
        .and(wm_path(format!(
            "/{META_VERSION}/{TEST_WABA_ID}/message_templates"
        )))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "success": true })))
        .mount(&meta_server)
        .await;

    let app = build_app(make_state(mongo.clone(), meta, &meta_server));

    let resp = app
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!(
                    "/{}?project_id={}",
                    template_id.to_hex(),
                    project_id.to_hex()
                ))
                .header(header::AUTHORIZATION, bearer(owner))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .expect("delete call");

    assert!(
        resp.status().is_success(),
        "DELETE /:id should succeed, got {}",
        resp.status()
    );

    // TS does a hard delete; we accept either outcome (gone OR a
    // `deletedAt` / `status=DELETED` marker) so this test survives a
    // soft-delete migration without rewriting.
    match find_template(&mongo, template_id).await {
        None => { /* hard delete — TS parity */ }
        Some(doc) => {
            let soft_deleted = doc.get_bool("deleted").unwrap_or(false)
                || doc.get("deletedAt").is_some()
                || doc
                    .get_str("status")
                    .map(|s| s == "DELETED")
                    .unwrap_or(false);
            assert!(
                soft_deleted,
                "template still present and not flagged deleted — neither hard nor soft delete fired: {doc:?}"
            );
        }
    }
}
