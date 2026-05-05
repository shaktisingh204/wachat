//! HTTP handlers for the wachat templates surface.
//!
//! Conventions (mirrored from sibling routers like `wachat-webhook-config`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes `AuthUser` — there is no anonymous access.
//! - Per-project endpoints additionally enforce
//!   `user.tenant_id == project.userId.to_hex()` after loading the
//!   project from Mongo. (More granular per-project membership lands in
//!   a follow-up alongside `sabnode-tenancy`.)
//! - Engine calls use the typed handles in [`TemplatesState`]. This
//!   crate owns no business logic; it is purely a wire adapter.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::{debug, instrument};
use wachat_templates::LibraryTemplate;
use wachat_templates_categories::{LibraryTemplateId, SaveLibraryTemplateReq};
use wachat_templates_mutate::{
    CreateFlowTemplateRequest, CreateTemplateRequest, EditTemplateRequest, HeaderMedia,
};
use wachat_templates_send::SendTemplateRequest;
use wachat_types::{Project, Template};

use crate::dto::{
    ApplyLibraryBody, ApplyLibraryResponse, BulkCreateBody, BulkCreateResponse, BulkFailure,
    CreateFlowTemplateBody, CreateTemplateBody, DeleteByNameQuery, EditTemplateBody, OkResponse,
    ProjectIdQuery, SaveLibraryResponse, SendResponse, SendTemplateBody, SyncRequest, SyncResponse,
    oid_hex,
};
use crate::state::TemplatesState;

/// Mongo collection name for projects (matches the TS `projects`).
const PROJECTS_COLL: &str = "projects";

// ===========================================================================
// Project loading + tenancy guard
// ===========================================================================

/// Load a project by hex id and enforce that `user.tenant_id` matches its
/// `userId`.
///
/// Returns `404 NOT_FOUND` if the project doesn't exist (rather than
/// 403, which would leak project existence) and `403 FORBIDDEN` if the
/// caller is not its owner.
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

    // Per-project tenancy check. The follow-up `sabnode-tenancy` slice
    // will swap this for a membership lookup against `project_members`;
    // for now we trust `userId` as the single source of ownership.
    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}

// ===========================================================================
// GET / — list templates for a project
// ===========================================================================

/// `GET /` — list every template under `?project_id`.
pub async fn list(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<Vec<Template>>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    let templates = state.reader.list(&project.id).await?;
    Ok(Json(templates))
}

// ===========================================================================
// GET /:id — fetch one template
// ===========================================================================

/// `GET /:id` — fetch one template, scoped to `?project_id`.
pub async fn get_by_id(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<Template>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    let template_oid = oid_from_str(&id)?;
    let template = state
        .reader
        .get_by_id(&project.id, &template_oid)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("template {id}")))?;
    Ok(Json(template))
}

// ===========================================================================
// POST / — create
// ===========================================================================

/// `POST /` — create a template against Meta and persist it.
pub async fn create(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Json(body): Json<CreateTemplateBody>,
) -> Result<Json<Template>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = create_request_from_body(body, project.app_id.clone());
    let created = state.mutator.create(&project, req).await?;
    Ok(Json(created))
}

// ===========================================================================
// POST /bulk — bulk create
// ===========================================================================

/// `POST /bulk` — create multiple templates in one request.
pub async fn bulk_create(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Json(body): Json<BulkCreateBody>,
) -> Result<Json<BulkCreateResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;

    // Each item carries its own `project_id` on the wire (so the bulk
    // payload mirrors the single-create shape exactly), but the engine
    // takes one `&Project`. We fail loudly if the wire payload tries to
    // mix projects rather than silently dropping mismatches.
    let mut requests: Vec<CreateTemplateRequest> = Vec::with_capacity(body.templates.len());
    for tpl in body.templates {
        if tpl.project_id != body.project_id {
            return Err(ApiError::BadRequest(
                "bulk: every template.project_id must match top-level project_id".to_owned(),
            ));
        }
        requests.push(create_request_from_body(tpl, project.app_id.clone()));
    }

    let outcome = state.mutator.bulk_create(&project, requests).await?;

    Ok(Json(BulkCreateResponse {
        created: outcome.created,
        failed: outcome
            .failed
            .into_iter()
            .map(|e| BulkFailure {
                name: e.name,
                message: e.message,
            })
            .collect(),
    }))
}

// ===========================================================================
// POST /flow — flow-button template create
// ===========================================================================

/// `POST /flow` — create a flow-button template.
pub async fn create_flow(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Json(body): Json<CreateFlowTemplateBody>,
) -> Result<Json<Template>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = CreateFlowTemplateRequest {
        template_name: body.template_name,
        language: body.language,
        category: body.category,
        body_text: body.body_text,
        button_text: body.button_text,
        flow_id: body.flow_id,
    };
    let created = state.mutator.create_flow(&project, req).await?;
    Ok(Json(created))
}

// ===========================================================================
// POST /sync — sync templates from Meta
// ===========================================================================

/// `POST /sync` — pull every template from the project's WABA and upsert.
pub async fn sync(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Json(body): Json<SyncRequest>,
) -> Result<Json<SyncResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let access_token = project.access_token.as_deref().unwrap_or("");
    let outcome = state.syncer.sync(&project, access_token).await?;
    Ok(Json(SyncResponse {
        fetched: outcome.fetched,
        upserted: outcome.upserted,
        orphaned: outcome.orphaned,
    }))
}

// ===========================================================================
// POST /:id/edit — edit
// ===========================================================================

/// `POST /:id/edit` — edit a template against Meta. The path `:id` is the
/// **Mongo** template id; the `meta_template_id` field in the body is
/// what gets used in the Meta URL.
pub async fn edit(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
    Json(body): Json<EditTemplateBody>,
) -> Result<Json<Template>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;

    // Ensure the path id resolves to a real template under this project
    // before we round-trip to Meta. Surfaces a clean 404 instead of a
    // Meta error if the caller invented an id.
    let template_oid = oid_from_str(&id)?;
    let _existing = state
        .reader
        .get_by_id(&project.id, &template_oid)
        .await?
        .ok_or_else(|| ApiError::NotFound(format!("template {id}")))?;

    let req = EditTemplateRequest {
        meta_template_id: body.meta_template_id,
        category: body.category,
        header_format: body.header_format,
        header_text: body.header_text,
        header_media: body.header_media_url.map(HeaderMedia::Url),
        body: body.body,
        body_examples: body.body_examples,
        footer: body.footer,
        buttons: body.buttons,
        app_id: project.app_id.clone(),
    };
    let edited = state.mutator.edit(&project, &template_oid, req).await?;
    Ok(Json(edited))
}

// ===========================================================================
// DELETE /:id — delete by id
// ===========================================================================

/// `DELETE /:id` — delete a template by Mongo id (and its Meta-side row).
pub async fn delete_by_id(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<OkResponse>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    let template_oid = oid_from_str(&id)?;
    state.mutator.delete_by_id(&project, &template_oid).await?;
    Ok(Json(OkResponse::ok()))
}

// ===========================================================================
// DELETE /by-name — delete every template with a given name
// ===========================================================================

/// `DELETE /by-name?project_id=…&name=…` — delete every template (across
/// languages) with the given name in the given project.
pub async fn delete_by_name(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Query(q): Query<DeleteByNameQuery>,
) -> Result<Json<OkResponse>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    state.mutator.delete_by_name(&project, &q.name).await?;
    Ok(Json(OkResponse::ok()))
}

// ===========================================================================
// POST /:id/send — send a template message
// ===========================================================================

/// `POST /:id/send` — send a template message via Meta.
pub async fn send(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
    Json(body): Json<SendTemplateBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let template_oid = oid_from_str(&id)?;

    // `Variables` has private fields and no Deserialize impl on purpose —
    // build it from a wire-shaped intermediate via the public builder.
    #[derive(serde::Deserialize, Default)]
    struct VarsWire {
        #[serde(default)]
        positional: Vec<String>,
        #[serde(default)]
        named: std::collections::HashMap<String, String>,
    }
    let wire: VarsWire = serde_json::from_value(body.variables)
        .map_err(|e| ApiError::Validation(format!("invalid `variables` payload: {e}")))?;
    let mut variables = wachat_templates_engine::Variables::new();
    for (i, v) in wire.positional.into_iter().enumerate() {
        variables = variables.set_positional((i + 1) as u16, v);
    }
    if !wire.named.is_empty() {
        variables = variables.with_named(wire.named);
    }

    let req = SendTemplateRequest {
        recipient_phone: body.recipient_phone,
        template_id: template_oid,
        variables,
        media_id: body.media_id,
    };
    let outcome = state.sender.send(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// GET /library — list shared library templates
// ===========================================================================

/// `GET /library` — list every shared library template. No project scope
/// (the library is global to the org), so we only require auth.
pub async fn list_library(
    _user: AuthUser,
    State(state): State<TemplatesState>,
) -> Result<Json<Vec<LibraryTemplate>>> {
    let items = state.reader.list_library().await?;
    Ok(Json(items))
}

// ===========================================================================
// POST /library — save a library template
// ===========================================================================

/// `POST /library` — admin-only insert into the shared library.
///
/// Today we only require an authenticated user; the role gate against
/// `roles.contains("admin"|"owner")` lands in a follow-up alongside the
/// shared `auth_check::ensure_admin` helper used by sibling admin
/// routes.
pub async fn save_library(
    _user: AuthUser,
    State(state): State<TemplatesState>,
    Json(body): Json<SaveLibraryTemplateReq>,
) -> Result<Json<SaveLibraryResponse>> {
    let id: LibraryTemplateId = state.library.save(body).await?;
    let oid: ObjectId = id.into();
    Ok(Json(SaveLibraryResponse { id: oid.to_hex() }))
}

// ===========================================================================
// DELETE /library/:id — delete a library template
// ===========================================================================

/// `DELETE /library/:id` — admin-only delete from the shared library.
pub async fn delete_library(
    _user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
) -> Result<Json<OkResponse>> {
    let oid = oid_from_str(&id)?;
    state.library.delete(&oid).await?;
    Ok(Json(OkResponse::ok()))
}

// ===========================================================================
// POST /library/:id/apply — copy library template into N projects
// ===========================================================================

/// `POST /library/:id/apply` — copy a library template into the listed
/// projects.
///
/// The path `:id` is the **source template id** (a row in the
/// per-project `templates` collection — see
/// `wachat_templates_categories::TemplatesLibrary::apply_to_projects`
/// docs). The `target_project_ids` body lists the destination projects.
///
/// Per the engine's contract, callers should hand it pre-validated
/// project ids. We filter the request list down to projects this user
/// owns and pass only the survivors through; the dropped ids are
/// counted as `skipped`.
pub async fn apply_library(
    user: AuthUser,
    State(state): State<TemplatesState>,
    Path(id): Path<String>,
    Json(body): Json<ApplyLibraryBody>,
) -> Result<Json<ApplyLibraryResponse>> {
    let source_oid = oid_from_str(&id)?;

    let total_targets = body.target_project_ids.len();
    let mut validated: Vec<ObjectId> = Vec::with_capacity(total_targets);
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    for raw in &body.target_project_ids {
        // Bad hex id → drop (mirrors the TS `validatedTargetIds` filter
        // that silently skips ids `getProjectById` rejects).
        let oid = match oid_from_str(raw) {
            Ok(o) => o,
            Err(_) => continue,
        };
        let doc =
            match coll.find_one(doc! { "_id": oid }).await.map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("projects.find_one"))
            })? {
                Some(d) => d,
                None => continue,
            };
        let owner_hex = doc
            .get_object_id("userId")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        if owner_hex == user.tenant_id {
            validated.push(oid);
        }
    }

    let outcome = state
        .library
        .apply_to_projects(&source_oid, &validated)
        .await?;

    let skipped = total_targets.saturating_sub(validated.len()) + outcome.skipped;

    Ok(Json(ApplyLibraryResponse {
        applied: outcome.applied,
        skipped,
    }))
}

// ===========================================================================
// helpers
// ===========================================================================

/// Convert a wire `CreateTemplateBody` into the engine's
/// `CreateTemplateRequest`. `app_id` falls back to the project's
/// configured app id (mirrors TS L251 `project.appId ||
/// NEXT_PUBLIC_META_APP_ID`).
fn create_request_from_body(
    b: CreateTemplateBody,
    project_app_id: Option<String>,
) -> CreateTemplateRequest {
    debug!(name = %b.name, "create_request_from_body");
    CreateTemplateRequest {
        name: b.name,
        language: b.language,
        category: b.category,
        body: b.body,
        body_examples: b.body_examples,
        footer: b.footer.filter(|s| !s.is_empty()),
        header_format: b.header_format,
        header_text: b.header_text,
        header_example: b.header_example,
        header_media: b.header_media_url.map(HeaderMedia::Url),
        buttons: b.buttons,
        allow_category_change: b.allow_category_change,
        app_id: project_app_id,
    }
}
