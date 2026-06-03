//! HTTP handlers for the wachat broadcast surface.
//!
//! Conventions (mirrored from `wachat-send-router::handlers`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes [`AuthUser`] — there is no anonymous access.
//! - Per-project endpoints additionally enforce
//!   `user.tenant_id == project.userId.to_hex()` after loading the
//!   project via [`load_project_for`]. (More granular per-project
//!   membership lands alongside `sabnode-tenancy`.)
//! - Per-broadcast endpoints derive the project id from the broadcast
//!   document and run the same project tenancy guard before doing any
//!   real work.
//!
//! No business logic lives here beyond the orchestration of:
//! 1. validation,
//! 2. Mongo I/O,
//! 3. enqueue onto `broadcast-control`.

use axum::{
    Json,
    body::Bytes,
    extract::{Multipart, Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::{FindOneOptions, FindOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::{Value, json};
use tracing::{instrument, warn};
use wachat_queue::JobOptions;
use wachat_types::Project;

use crate::dto::{
    ApiBroadcastBody, AttemptsExportQuery, AttemptsListResponse, AttemptsQuery, AudienceType,
    BroadcastKind, BroadcastListResponse, BulkBroadcastBody, ContactRecord, MessageResponse,
    PageQuery, RequeueBroadcastBody, RequeueStuckResponse, StartBroadcastBody,
};
use crate::state::WachatBroadcastState;

/// Mongo collection names — kept inline (not in a separate `consts`
/// module) because they're only used here and matching the TS literal
/// strings 1:1 makes review against the legacy code trivial.
const PROJECTS_COLL: &str = "projects";
const BROADCASTS_COLL: &str = "broadcasts";
const BROADCAST_CONTACTS_COLL: &str = "broadcast_contacts";
const BROADCAST_LOGS_COLL: &str = "broadcast_logs";
const TEMPLATES_COLL: &str = "templates";
const META_FLOWS_COLL: &str = "meta_flows";
const CONTACTS_COLL: &str = "contacts";

/// BullMQ queue name + job name. Values match
/// `src/lib/queue/broadcast-queue.ts` and the existing PM2 worker so the
/// Node consumer cannot tell the producer changed.
const CONTROL_QUEUE: &str = "broadcast-control";
const CONTROL_JOB: &str = "process-broadcast";

/// Default page size for the `attempts/export` path. The TS unbounded
/// the export — we cap at 50k to avoid OOMing the API process if a
/// caller asks for a million-row broadcast.
const EXPORT_HARD_CAP: i64 = 50_000;

/// Insertion batch size for `broadcast_contacts.insertMany`. Mirrors
/// the TS value (`createBroadcastContacts`'s `batchSize = 1000`).
const CONTACTS_INSERT_BATCH: usize = 1_000;

// ===========================================================================
// Tenancy guards
// ===========================================================================

/// Load a project by hex id and enforce that `user.tenant_id` matches
/// its `userId`. Returns `404` if the project doesn't exist (rather
/// than `403`, which would leak existence) and `403` if the caller is
/// not its owner.
///
/// Matches `wachat-send-router::handlers::load_project_for` so behaviour
/// is identical across crates.
#[instrument(skip_all, fields(project_id = %project_id_hex))]
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}

/// Load a broadcast doc and re-run the project tenancy guard against
/// its `projectId`. Returns the parsed broadcast document plus the
/// loaded project (callers usually need both).
async fn load_broadcast_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    broadcast_id_hex: &str,
) -> Result<(Document, Project)> {
    let oid = oid_from_str(broadcast_id_hex)?;
    let coll = mongo.collection::<Document>(BROADCASTS_COLL);
    let doc_ = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("broadcast {broadcast_id_hex}")))?;

    let project_oid = doc_
        .get_object_id("projectId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("broadcast missing projectId")))?;

    let project = load_project_for(user, mongo, &project_oid.to_hex()).await?;
    Ok((doc_, project))
}

/// Promote a `bson::Document` to `serde_json::Value` while normalising
/// `ObjectId` and `DateTime` into the JSON shape the legacy TS callers
/// expect (`{ "$oid": "..." }` is fine — the TS does
/// `JSON.parse(JSON.stringify(doc))` and treats them the same way).
fn doc_to_json(d: &Document) -> Result<Value> {
    let bson = Bson::Document(d.clone());
    serde_json::to_value(bson).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("bson::Document -> serde_json::Value"))
    })
}

// ===========================================================================
// Read endpoints
// ===========================================================================

/// `GET /admin/list?page=&limit=` — cross-tenant list of every
/// broadcast in the system.
///
/// Mirrors `getAllBroadcasts`. Requires the caller's JWT to carry the
/// `"admin"` role. The TS code derived this from `getAdminSession()`
/// via a separate cookie; the Rust port consolidates auth into the
/// single JWT extractor.
#[instrument(skip_all)]
pub async fn admin_list(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Query(q): Query<PageQuery>,
) -> Result<Json<BroadcastListResponse>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(ApiError::Forbidden(
            "admin role required for cross-tenant broadcast list".to_owned(),
        ));
    }

    let coll = state.mongo.collection::<Document>(BROADCASTS_COLL);
    let skip = q.page.saturating_sub(1) * q.limit;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(q.limit as i64)
        .build();

    let cursor = coll
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("admin_list.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("admin_list.collect")))?;

    let total = coll
        .count_documents(doc! {})
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("admin_list.count")))?;

    let broadcasts = docs.iter().map(doc_to_json).collect::<Result<Vec<_>>>()?;
    Ok(Json(BroadcastListResponse { broadcasts, total }))
}

/// `GET /projects/{project_id}/list?page=&limit=` — list broadcasts for
/// one project.
#[instrument(skip_all, fields(project_id = %project_id))]
pub async fn list_for_project(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(project_id): Path<String>,
    Query(q): Query<PageQuery>,
) -> Result<Json<BroadcastListResponse>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(BROADCASTS_COLL);
    let filter = doc! { "projectId": project.id };
    let skip = q.page.saturating_sub(1) * q.limit;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(q.limit as i64)
        .build();

    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("list_for_project.find")))?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("list_for_project.collect"))
    })?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("list_for_project.count")))?;

    let broadcasts = docs.iter().map(doc_to_json).collect::<Result<Vec<_>>>()?;
    Ok(Json(BroadcastListResponse { broadcasts, total }))
}

/// `GET /{broadcast_id}` — single broadcast read.
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn get_by_id(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
) -> Result<Json<Value>> {
    let (doc_, _project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;
    Ok(Json(doc_to_json(&doc_)?))
}

/// `GET /{broadcast_id}/attempts?page=&limit=&statusFilter=` —
/// paginated per-recipient send attempts.
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn list_attempts(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<AttemptsQuery>,
) -> Result<Json<AttemptsListResponse>> {
    let (_doc, _project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;
    let bcast_oid = oid_from_str(&broadcast_id)?;

    let mut filter = doc! { "broadcastId": bcast_oid };
    if let Some(s) = q.status_filter.as_deref() {
        if !s.is_empty() && s != "ALL" {
            filter.insert("status", s);
        }
    }
    let skip = q.page.saturating_sub(1) * q.limit;
    let opts = FindOptions::builder()
        .sort(doc! { "_id": 1 })
        .skip(skip)
        .limit(q.limit as i64)
        .build();

    let coll = state.mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("attempts.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("attempts.collect")))?;
    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("attempts.count")))?;

    let attempts = docs.iter().map(doc_to_json).collect::<Result<Vec<_>>>()?;
    Ok(Json(AttemptsListResponse { attempts, total }))
}

/// `GET /{broadcast_id}/attempts/export?statusFilter=` — flat list of
/// every attempt for the broadcast (capped at `EXPORT_HARD_CAP`).
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn export_attempts(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
    Query(q): Query<AttemptsExportQuery>,
) -> Result<Json<Vec<Value>>> {
    let (_doc, _project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;
    let bcast_oid = oid_from_str(&broadcast_id)?;

    let mut filter = doc! { "broadcastId": bcast_oid };
    if let Some(s) = q.status_filter.as_deref() {
        if !s.is_empty() && s != "ALL" {
            filter.insert("status", s);
        }
    }
    // Project the same fields the TS export pulled.
    let opts = FindOptions::builder()
        .projection(doc! {
            "phone": 1,
            "status": 1,
            "messageId": 1,
            "error": 1,
            "sentAt": 1,
        })
        .limit(EXPORT_HARD_CAP)
        .build();

    let coll = state.mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("export.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("export.collect")))?;
    let out = docs.iter().map(doc_to_json).collect::<Result<Vec<_>>>()?;
    Ok(Json(out))
}

/// `GET /{broadcast_id}/logs` — the most recent 100 log lines for a
/// broadcast (matches the TS `.limit(100).sort({ timestamp: -1 })`).
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn list_logs(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
) -> Result<Json<Vec<Value>>> {
    let (_doc, _project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;
    let bcast_oid = oid_from_str(&broadcast_id)?;

    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(100)
        .build();

    let coll = state.mongo.collection::<Document>(BROADCAST_LOGS_COLL);
    let cursor = coll
        .find(doc! { "broadcastId": bcast_oid })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("logs.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("logs.collect")))?;
    let out = docs.iter().map(doc_to_json).collect::<Result<Vec<_>>>()?;
    Ok(Json(out))
}

// ===========================================================================
// Mutations
// ===========================================================================

/// `POST /start` — primary broadcast-create entrypoint.
///
/// Mirrors `handleStartBroadcast` in
/// `src/app/actions/broadcast.actions.ts`. The TS shim is responsible
/// for parsing CSV / XLSX into `body.contacts` and pre-uploading any
/// header / carousel media into Meta — the `body.components` array is
/// expected to already carry the resolved media ids.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn start(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Json(body): Json<StartBroadcastBody>,
) -> Result<Json<MessageResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;

    // ---- Resolve template / flow ----------------------------------------
    let templates_coll = state.mongo.collection::<Document>(TEMPLATES_COLL);
    let flows_coll = state.mongo.collection::<Document>(META_FLOWS_COLL);

    let mut template_doc: Option<Document> = None;
    let mut flow_doc: Option<Document> = None;

    match body.broadcast_type {
        BroadcastKind::Template => {
            let template_id = body
                .template_id
                .as_deref()
                .ok_or_else(|| ApiError::BadRequest("templateId is required".into()))?;
            let oid = oid_from_str(template_id)?;
            let t = templates_coll
                .find_one(doc! { "_id": oid, "projectId": project.id })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("templates.find_one"))
                })?
                .ok_or_else(|| ApiError::NotFound("template not found for this project".into()))?;
            // J3 P1-1 — block PENDING / REJECTED templates at enqueue time.
            let status = t.get_str("status").unwrap_or("");
            if status != "APPROVED" {
                let name = t.get_str("name").unwrap_or("(unnamed)");
                return Err(ApiError::BadRequest(format!(
                    "Template '{name}' is {} . Only APPROVED templates can be broadcast.",
                    if status.is_empty() {
                        "not approved"
                    } else {
                        status
                    }
                )));
            }
            template_doc = Some(t);
        }
        BroadcastKind::Flow => {
            let flow_id = body
                .flow_id
                .as_deref()
                .ok_or_else(|| ApiError::BadRequest("flowId is required".into()))?;
            let oid = oid_from_str(flow_id)?;
            let f = flows_coll
                .find_one(doc! { "_id": oid, "projectId": project.id })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("meta_flows.find_one"))
                })?
                .ok_or_else(|| ApiError::NotFound("flow not found for this project".into()))?;
            flow_doc = Some(f);
        }
    }

    // ---- Resolve audience ------------------------------------------------
    let contacts: Vec<ContactRecord> = match body.audience_type {
        AudienceType::File => {
            if body.contacts.is_empty() {
                return Err(ApiError::Validation(
                    "no contacts found for the selected audience".into(),
                ));
            }
            body.contacts.clone()
        }
        AudienceType::Tags => {
            if body.tag_ids.is_empty() {
                return Err(ApiError::Validation(
                    "tagIds must be non-empty for audienceType=tags".into(),
                ));
            }
            let tag_oids: Vec<ObjectId> = body
                .tag_ids
                .iter()
                .map(|s| oid_from_str(s))
                .collect::<Result<Vec<_>>>()?;
            let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
            let cursor = coll
                .find(doc! {
                    "projectId": project.id,
                    "tagIds": { "$in": tag_oids },
                })
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("contacts.find_by_tags"))
                })?;
            let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("contacts.by_tags.collect"))
            })?;
            if docs.is_empty() {
                return Err(ApiError::Validation(
                    "no contacts found for the selected audience".into(),
                ));
            }
            docs.into_iter()
                .map(|d| ContactRecord {
                    phone: d.get_str("phone").unwrap_or_default().to_owned(),
                    name: d.get_str("name").ok().map(|s| s.to_owned()),
                    variables: doc_to_json(&d).unwrap_or(Value::Null),
                })
                .collect()
        }
    };

    // ---- Build broadcast doc --------------------------------------------
    let broadcast_oid = ObjectId::new();
    let broadcast_mps = body
        .messages_per_second
        .filter(|n| *n > 0)
        .or(project.messages_per_second);

    let mut broadcast_doc = doc! {
        "_id": broadcast_oid,
        "projectId": project.id,
        "phoneNumberId": body.phone_number_id.clone(),
        "status": "PENDING_PROCESSING",
        "contactCount": contacts.len() as i64,
        "successCount": 0i64,
        "errorCount": 0i64,
        "enqueuedCount": 0i64,
        "fileName": body.file_name.clone(),
        "audienceType": body.audience_type.as_str(),
        "tagIds": match body.audience_type {
            AudienceType::Tags => Bson::Array(
                body.tag_ids
                    .iter()
                    .filter_map(|s| ObjectId::parse_str(s).ok())
                    .map(Bson::ObjectId)
                    .collect(),
            ),
            AudienceType::File => Bson::Array(Vec::new()),
        },
        "accessToken": project.access_token.clone().unwrap_or_default(),
        "createdAt": Utc::now(),
        "broadcastType": body.broadcast_type.as_str(),
        "createContacts": body.create_contacts,
        "components": serde_value_to_bson(&Value::Array(body.components.clone())),
    };
    if let Some(mps) = broadcast_mps {
        broadcast_doc.insert("messagesPerSecond", mps as i64);
    }
    if let Some(p_mps) = project.messages_per_second {
        broadcast_doc.insert("projectMessagesPerSecond", p_mps as i64);
    }
    if let Some(ref gv) = body.global_body_vars {
        broadcast_doc.insert("globalBodyVars", serde_value_to_bson(gv));
    }

    if let Some(t) = template_doc.as_ref() {
        let name = t.get_str("name").unwrap_or("");
        let language = t.get_str("language").unwrap_or("en_US");
        let id = t
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("template missing _id")))?;
        broadcast_doc.insert(
            "name",
            format!("{} - {}", name, Utc::now().format("%Y-%m-%d %H:%M:%S")),
        );
        broadcast_doc.insert("templateName", name);
        broadcast_doc.insert("templateId", id);
        broadcast_doc.insert("language", language);
    }
    if let Some(f) = flow_doc.as_ref() {
        let name = f.get_str("name").unwrap_or("(flow)");
        let id = f
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("flow missing _id")))?;
        broadcast_doc.insert(
            "name",
            format!(
                "Flow: {} - {}",
                name,
                Utc::now().format("%Y-%m-%d %H:%M:%S")
            ),
        );
        broadcast_doc.insert("templateName", format!("Flow: {name}"));
        broadcast_doc.insert("flowId", id);
        broadcast_doc.insert("flowName", name);
        if let Some(meta_id) = body.flow_meta_id.as_deref() {
            broadcast_doc.insert("flowMetaId", meta_id);
        }
        if let Some(fc) = body.flow_config.as_ref() {
            broadcast_doc.insert("flowConfig", serde_value_to_bson(fc));
        }
    }

    // ---- Insert broadcast + contacts -----------------------------------
    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);
    bcasts
        .insert_one(broadcast_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("broadcasts.insert_one")))?;
    let inserted = create_broadcast_contacts(&state.mongo, &broadcast_oid, &contacts).await?;

    // ---- Enqueue control job (non-fatal on failure) --------------------
    enqueue_control_best_effort(&state, &broadcast_oid).await;

    Ok(Json(MessageResponse {
        message: format!(
            "Broadcast successfully queued for {inserted} contacts. Sending will begin shortly."
        ),
    }))
}

/// `POST /bulk-start` — fan a single CSV across multiple projects.
#[instrument(skip_all)]
pub async fn bulk_start(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Json(body): Json<BulkBroadcastBody>,
) -> Result<Json<MessageResponse>> {
    if body.project_ids.is_empty() {
        return Err(ApiError::Validation("projectIds must be non-empty".into()));
    }
    if body.contacts.is_empty() {
        return Err(ApiError::Validation(
            "contact file is empty or could not be parsed".into(),
        ));
    }

    let total = body.contacts.len();
    let n_projects = body.project_ids.len();
    let per_project = total.div_ceil(n_projects).max(1);

    let mut success_count = 0u64;
    let mut failed_projects: Vec<String> = Vec::new();

    let templates = state.mongo.collection::<Document>(TEMPLATES_COLL);
    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);

    for (i, project_id) in body.project_ids.iter().enumerate() {
        let slice_start = i * per_project;
        if slice_start >= total {
            continue;
        }
        let slice_end = (slice_start + per_project).min(total);
        let slice = &body.contacts[slice_start..slice_end];
        if slice.is_empty() {
            continue;
        }

        let project = match load_project_for(&user, &state.mongo, project_id).await {
            Ok(p) => p,
            Err(_) => {
                failed_projects.push(format!("Project ID {project_id} (not found)"));
                continue;
            }
        };

        let template = match templates
            .find_one(doc! {
                "projectId": project.id,
                "name": &body.template_name,
                "language": &body.language,
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("bulk.templates.find_one"))
            })? {
            Some(t) => t,
            None => {
                failed_projects.push(format!(
                    "{} (template not found)",
                    project.name.as_deref().unwrap_or("(unnamed project)")
                ));
                continue;
            }
        };
        if template.get_str("status").unwrap_or("") != "APPROVED" {
            failed_projects.push(format!(
                "{} (template not approved)",
                project.name.as_deref().unwrap_or("(unnamed project)")
            ));
            continue;
        }

        let phone_number_id = project
            .phone_numbers
            .first()
            .map(|p| p.id.clone())
            .unwrap_or_default();

        let template_id = template
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("template missing _id")))?;
        let template_components = template
            .get_array("components")
            .cloned()
            .unwrap_or_default();

        let broadcast_oid = ObjectId::new();
        let mut broadcast_doc = doc! {
            "_id": broadcast_oid,
            "name": format!("Bulk: {} - {}", body.template_name, Utc::now().format("%Y-%m-%d %H:%M:%S")),
            "projectId": project.id,
            "broadcastType": "template",
            "phoneNumberId": phone_number_id,
            "templateName": template.get_str("name").unwrap_or(&body.template_name),
            "templateId": template_id,
            "language": template.get_str("language").unwrap_or(&body.language),
            "status": "PENDING_PROCESSING",
            "contactCount": slice.len() as i64,
            "fileName": body.file_name.clone(),
            "audienceType": "file-bulk",
            "accessToken": project.access_token.clone().unwrap_or_default(),
            "components": Bson::Array(template_components),
            "createdAt": Utc::now(),
        };
        // Stamp the project's MPS so the send worker enforces the
        // project-level rate instead of falling back to DEFAULT_MPS.
        if let Some(p_mps) = project.messages_per_second {
            broadcast_doc.insert("messagesPerSecond", p_mps as i64);
            broadcast_doc.insert("projectMessagesPerSecond", p_mps as i64);
        }

        bcasts.insert_one(broadcast_doc).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("bulk.broadcasts.insert_one"))
        })?;
        let _ = create_broadcast_contacts(&state.mongo, &broadcast_oid, slice).await?;
        enqueue_control_best_effort(&state, &broadcast_oid).await;
        success_count += 1;
    }

    let mut message = format!("Successfully queued broadcasts for {success_count} project(s).");
    if !failed_projects.is_empty() {
        message.push_str(&format!(
            " Failed on {} project(s): {}.",
            failed_projects.len(),
            failed_projects.join(", ")
        ));
    }
    Ok(Json(MessageResponse { message }))
}

/// `POST /api-start` — public-API broadcast trigger.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn api_start(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Json(body): Json<ApiBroadcastBody>,
) -> Result<Json<MessageResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let template_oid = oid_from_str(&body.template_id)?;
    let templates = state.mongo.collection::<Document>(TEMPLATES_COLL);
    let template = templates
        .find_one(doc! { "_id": template_oid, "projectId": project.id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("api_start.templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("template not found for this project".into()))?;

    let template_components = template
        .get_array("components")
        .cloned()
        .unwrap_or_default();
    let template_name = template.get_str("name").unwrap_or("").to_owned();
    let language = template.get_str("language").unwrap_or("en_US").to_owned();

    let broadcast_oid = ObjectId::new();
    let mut broadcast_doc = doc! {
        "_id": broadcast_oid,
        "name": format!("API Broadcast - {} - {}", template_name, Utc::now().format("%Y-%m-%d %H:%M:%S")),
        "projectId": project.id,
        "broadcastType": "template",
        "phoneNumberId": body.phone_number_id.clone(),
        "templateName": template_name,
        "templateId": template_oid,
        "language": language,
        "status": "PENDING_PROCESSING",
        "contactCount": body.contacts.len() as i64,
        "fileName": "API Request",
        "audienceType": "api",
        "accessToken": project.access_token.clone().unwrap_or_default(),
        "components": Bson::Array(template_components),
        "createdAt": Utc::now(),
    };
    if let Some(vm) = body.variable_mappings.as_ref() {
        broadcast_doc.insert("variableMappings", serde_value_to_bson(vm));
    }

    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);
    bcasts.insert_one(broadcast_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("api_start.broadcasts.insert_one"))
    })?;
    let _ = create_broadcast_contacts(&state.mongo, &broadcast_oid, &body.contacts).await?;
    enqueue_control_best_effort(&state, &broadcast_oid).await;

    Ok(Json(MessageResponse {
        message: format!(
            "Broadcast successfully queued via API for {} contacts. Sending will begin shortly.",
            body.contacts.len()
        ),
    }))
}

/// `POST /{broadcast_id}/requeue` — duplicate a broadcast (or its
/// failed subset) into a new doc.
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn requeue(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
    Json(body): Json<RequeueBroadcastBody>,
) -> Result<Json<MessageResponse>> {
    let (original, project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;

    let original_template_id = original
        .get_object_id("templateId")
        .map_err(|_| ApiError::BadRequest("original broadcast has no templateId".into()))?;
    let template_oid = match body.template_id.as_deref() {
        Some(s) => oid_from_str(s)?,
        None => original_template_id,
    };

    // Scope the template lookup to the same project to prevent cross-tenant
    // template injection (J3 P0-1-adjacent).
    let templates = state.mongo.collection::<Document>(TEMPLATES_COLL);
    let template = templates
        .find_one(doc! { "_id": template_oid, "projectId": project.id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("requeue.templates.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("template not found in this project".into()))?;
    let status = template.get_str("status").unwrap_or("");
    if status != "APPROVED" {
        let name = template.get_str("name").unwrap_or("(unnamed)");
        return Err(ApiError::BadRequest(format!(
            "Template '{name}' is {} . Only APPROVED templates can be broadcast.",
            if status.is_empty() {
                "not approved"
            } else {
                status
            }
        )));
    }

    let bcast_oid = oid_from_str(&broadcast_id)?;
    let mut filter = doc! { "broadcastId": bcast_oid };
    if body.requeue_scope == "FAILED" {
        filter.insert("status", "FAILED");
    }
    let attempts_coll = state.mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let cursor = attempts_coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requeue.attempts.find")))?;
    let attempts: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("requeue.attempts.collect"))
    })?;
    if attempts.is_empty() {
        return Err(ApiError::Validation("no contacts found to requeue".into()));
    }

    // Clone original + override fields.
    let mut new_doc = original.clone();
    let new_oid = ObjectId::new();
    new_doc.insert("_id", new_oid);
    let original_name = new_doc.get_str("name").unwrap_or("Broadcast").to_owned();
    new_doc.insert("name", format!("{original_name} (Requeued)"));
    new_doc.insert("status", "PENDING_PROCESSING");
    new_doc.insert("contactCount", attempts.len() as i64);
    new_doc.insert("successCount", 0i64);
    new_doc.insert("errorCount", 0i64);
    new_doc.remove("startedAt");
    new_doc.remove("completedAt");
    new_doc.insert("createdAt", Utc::now());
    let template_components = template
        .get_array("components")
        .cloned()
        .unwrap_or_default();
    new_doc.insert("components", Bson::Array(template_components));
    if let Some(url) = body.header_image_url.as_deref() {
        new_doc.insert("headerImageUrl", url);
    }

    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);
    bcasts.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("requeue.broadcasts.insert_one"))
    })?;
    let count = attempts.len();
    let attempt_records: Vec<ContactRecord> = attempts
        .into_iter()
        .map(|d| ContactRecord {
            phone: d.get_str("phone").unwrap_or_default().to_owned(),
            name: d.get_str("name").ok().map(|s| s.to_owned()),
            variables: d
                .get_document("variables")
                .ok()
                .and_then(|inner| serde_json::to_value(inner.clone()).ok())
                .unwrap_or(Value::Null),
        })
        .collect();
    let _ = create_broadcast_contacts(&state.mongo, &new_oid, &attempt_records).await?;
    enqueue_control_best_effort(&state, &new_oid).await;

    Ok(Json(MessageResponse {
        message: format!("{count} contacts have been re-queued for broadcast."),
    }))
}

/// `POST /admin/requeue-stuck` — sweep broadcasts that have been
/// sitting in `PENDING_PROCESSING` / `QUEUED` past the cutoff and push a
/// fresh control job for each.
///
/// Mirrors the legacy `/api/cron/send-broadcasts` route — the sweep used
/// to live in Node and walked Mongo + BullMQ directly. The cron
/// endpoint now just calls this and forwards the response. Admin-only:
/// the cron job authenticates with an admin JWT.
#[instrument(skip_all)]
pub async fn requeue_stuck(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
) -> Result<Json<RequeueStuckResponse>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(ApiError::Forbidden(
            "admin role required for cross-tenant stuck-broadcast sweep".to_owned(),
        ));
    }

    // 30-second cutoff matches the TS cron exactly.
    let cutoff = Utc::now() - chrono::Duration::seconds(30);
    let filter = doc! {
        "status": { "$in": ["PENDING_PROCESSING", "QUEUED"] },
        "$or": [
            { "createdAt": { "$lte": cutoff } },
            { "updatedAt": { "$exists": false } },
        ],
    };
    let opts = FindOptions::builder().limit(50).build();

    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);
    let cursor = bcasts
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requeue_stuck.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("requeue_stuck.collect")))?;

    if docs.is_empty() {
        return Ok(Json(RequeueStuckResponse {
            message: "No stuck broadcasts found.".into(),
            enqueued: 0,
            considered: 0,
            errors: None,
        }));
    }

    let considered = docs.len() as u64;
    let mut enqueued = 0u64;
    let mut errors: Vec<String> = Vec::new();

    for d in docs {
        let oid = match d.get_object_id("_id") {
            Ok(o) => o,
            Err(_) => {
                errors.push("(unknown id): broadcast missing _id".into());
                continue;
            }
        };
        // Best-effort enqueue; on failure, log per-doc and surface to caller.
        if let Err(e) = enqueue_control(&state, &oid).await {
            errors.push(format!("{}: {}", oid.to_hex(), e));
            continue;
        }
        // Bump status + updatedAt so the worker re-picks the doc.
        if let Err(e) = bcasts
            .update_one(
                doc! { "_id": oid },
                doc! { "$set": {
                    "status": "PENDING_PROCESSING",
                    "updatedAt": Utc::now(),
                } },
            )
            .await
        {
            errors.push(format!("{}: update {}", oid.to_hex(), e));
            continue;
        }
        enqueued += 1;
    }

    let message = format!("Re-enqueued {enqueued} of {considered} stuck broadcast(s).");
    Ok(Json(RequeueStuckResponse {
        message,
        enqueued,
        considered,
        errors: if errors.is_empty() {
            None
        } else {
            Some(errors)
        },
    }))
}

/// `POST /{broadcast_id}/stop` — cancel an in-flight or queued
/// broadcast.
#[instrument(skip_all, fields(broadcast_id = %broadcast_id))]
pub async fn stop(
    user: AuthUser,
    State(state): State<WachatBroadcastState>,
    Path(broadcast_id): Path<String>,
) -> Result<Json<MessageResponse>> {
    let (_doc, _project) = load_broadcast_for(&user, &state.mongo, &broadcast_id).await?;
    let bcast_oid = oid_from_str(&broadcast_id)?;

    let bcasts = state.mongo.collection::<Document>(BROADCASTS_COLL);
    let result = bcasts
        .update_one(
            doc! {
                "_id": bcast_oid,
                "status": { "$in": ["QUEUED", "PROCESSING", "PENDING_PROCESSING"] },
            },
            doc! { "$set": { "status": "Cancelled" } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("stop.update_one")))?;
    if result.matched_count == 0 {
        return Err(ApiError::Conflict(
            "broadcast not found or has already completed/failed".into(),
        ));
    }
    Ok(Json(MessageResponse {
        message: "Broadcast has been cancelled.".into(),
    }))
}

// ===========================================================================
// Internals
// ===========================================================================

/// Insert per-recipient rows in batches of [`CONTACTS_INSERT_BATCH`].
/// Mirrors `createBroadcastContacts` from the legacy TS.
async fn create_broadcast_contacts(
    mongo: &MongoHandle,
    broadcast_id: &ObjectId,
    contacts: &[ContactRecord],
) -> Result<u64> {
    if contacts.is_empty() {
        return Ok(0);
    }
    let coll = mongo.collection::<Document>(BROADCAST_CONTACTS_COLL);
    let mut total = 0u64;
    for chunk in contacts.chunks(CONTACTS_INSERT_BATCH) {
        let docs: Vec<Document> = chunk
            .iter()
            .map(|c| {
                doc! {
                    "broadcastId": *broadcast_id,
                    "phone": c.phone.clone(),
                    "name": c.name.clone().unwrap_or_else(|| "Subscriber".into()),
                    "variables": serde_value_to_bson(&c.variables),
                    "status": "PENDING",
                }
            })
            .collect();
        let res = coll.insert_many(docs).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("broadcast_contacts.insert_many"))
        })?;
        total += res.inserted_ids.len() as u64;
    }
    Ok(total)
}

/// Push a `process-broadcast` job onto the `broadcast-control` queue.
/// Returns the resulting BullMQ job id on success; the caller decides
/// whether to surface or swallow the error.
///
/// Priority is clamped to `1..=2_000_000` so older jobs sort ahead of
/// newer ones, mirroring the TS:
///   `priority: Math.max(1, Date.now() % 2_000_000)`
async fn enqueue_control(state: &WachatBroadcastState, broadcast_id: &ObjectId) -> Result<()> {
    let id_hex = broadcast_id.to_hex();
    let priority_now = (Utc::now().timestamp_millis().rem_euclid(2_000_000)).max(1) as u32;
    let opts = JobOptions {
        attempts: 5,
        job_id: Some(format!("bcast_{id_hex}")),
        priority: Some(priority_now),
        ..Default::default()
    };
    let payload = json!({ "broadcastId": id_hex });
    state
        .bull
        .add(CONTROL_QUEUE, CONTROL_JOB, &payload, opts)
        .await
        .map(|_| ())
}

/// Best-effort variant of [`enqueue_control`] used by the create paths:
/// failure is logged and swallowed because the broadcast doc still has
/// `status: PENDING_PROCESSING` and the legacy poller fallback will
/// pick it up. This matches the TS try/catch around
/// `enqueueBroadcastControl`.
async fn enqueue_control_best_effort(state: &WachatBroadcastState, broadcast_id: &ObjectId) {
    if let Err(e) = enqueue_control(state, broadcast_id).await {
        warn!(
            error = ?e,
            broadcast_id = %broadcast_id.to_hex(),
            "failed to enqueue broadcast control job; legacy poller will pick it up"
        );
    }
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value can't be represented (in practice
/// it always can — `Value` and `Bson` are isomorphic for our shapes).
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

// `FindOneOptions` is imported to keep the surface symmetric with other
// crates; not used yet but anticipated by the requeue path's projection
// follow-up.
const _: Option<FindOneOptions> = None;

// ===========================================================================
// Media upload — multipart passthrough to Meta
// ===========================================================================

/// `POST /v1/wachat/broadcast/projects/{project_id}/media`
///
/// Accepts a multipart form with two fields:
///
/// * `phoneNumberId` — the Meta phone-number id whose `/media` edge
///   the upload should target.
/// * `file` — the actual binary blob (image / video / document).
///
/// The endpoint resolves the project's stored access token, verifies
/// caller tenancy, and forwards the bytes to Meta via
/// [`wachat_media::MediaUploader::upload_for_messages`]. Returns the
/// resulting Meta media id (`{ id: "..." }`) so the legacy TS
/// `uploadMediaToMeta` shim collapses to a one-line `rustClient` call.
pub async fn upload_media(
    user: AuthUser,
    State(s): State<WachatBroadcastState>,
    Path(project_id): Path<String>,
    mut form: Multipart,
) -> Result<Json<Value>> {
    let project = load_project_for(&user, &s.mongo, &project_id).await?;
    let access_token = project.access_token.clone().ok_or_else(|| {
        ApiError::BadRequest("Project is missing a Meta access token.".to_owned())
    })?;

    let mut phone_number_id: Option<String> = None;
    let mut file_bytes: Option<Bytes> = None;
    let mut file_mime: Option<String> = None;
    let mut file_name: Option<String> = None;

    while let Some(field) = form
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("invalid multipart body: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        match name.as_str() {
            "phoneNumberId" => {
                let v = field
                    .text()
                    .await
                    .map_err(|e| ApiError::BadRequest(format!("phoneNumberId: {e}")))?;
                phone_number_id = Some(v.trim().to_owned());
            }
            "file" => {
                file_mime = field.content_type().map(|m| m.to_owned());
                file_name = field.file_name().map(|m| m.to_owned());
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| ApiError::BadRequest(format!("file body: {e}")))?;
                file_bytes = Some(bytes);
            }
            _ => {
                // Unknown fields are tolerated for forward compatibility.
                let _ = field.bytes().await;
            }
        }
    }

    let phone_number_id = phone_number_id
        .filter(|s| !s.is_empty())
        .ok_or_else(|| ApiError::BadRequest("missing form field `phoneNumberId`".to_owned()))?;
    let bytes =
        file_bytes.ok_or_else(|| ApiError::BadRequest("missing form field `file`".to_owned()))?;
    let mime = file_mime.unwrap_or_else(|| "application/octet-stream".to_owned());
    let filename = file_name.unwrap_or_else(|| "upload".to_owned());

    let media_id = s
        .media
        .upload_for_messages(&phone_number_id, &access_token, bytes, &mime, &filename)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("meta.media.upload")))?;

    Ok(Json(json!({ "id": media_id.0 })))
}
