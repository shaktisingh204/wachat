//! Action-state-shaped HTTP handlers.
//!
//! Every handler:
//! - Requires an [`AuthUser`].
//! - Loads the target [`Project`] (when scoped) and enforces
//!   `user.tenant_id == project.userId.to_hex()`.
//! - Catches engine errors and folds them into the action-state envelope
//!   (`{ error: '…' }`) so the TS shim can return them verbatim.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;
use wachat_templates_mutate::{
    CreateFlowTemplateRequest, CreateTemplateRequest, EditTemplateRequest, HeaderMedia,
};
use wachat_types::Project;

use crate::dto::{
    ActionState, ApplyActionResult, ApplyBody, BulkCreateActionResult, BulkCreateBody, CreateBody,
    CreateFlowActionResult, CreateFlowBody, DeleteByIdBody, DeleteByNameBody, EditBody,
    LibrarySaveBody, ProjectIdQuery, SyncActionResult, SyncBody, TemplatesList, WireCreate,
};
use crate::state::WachatTemplatesActionsState;

const PROJECTS_COLL: &str = "projects";

// ===========================================================================
// Project loading + tenancy guard (mirrors wachat-config::router::load_project_for)
// ===========================================================================

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
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(project)
}

/// Convert a wire `WireCreate` into the engine's `CreateTemplateRequest`.
fn create_request_from(b: WireCreate, project_app_id: Option<String>) -> CreateTemplateRequest {
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

// ===========================================================================
// GET /list — `getTemplates(projectId)`
// ===========================================================================

pub async fn list(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Query(q): Query<ProjectIdQuery>,
) -> Result<Json<TemplatesList>> {
    let project = load_project_for(&user, &s.mongo, &q.project_id).await?;
    let templates = s.reader.list(&project.id).await?;
    Ok(Json(templates))
}

// ===========================================================================
// POST /sync — `handleSyncTemplates(projectId)`
// ===========================================================================

pub async fn sync(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<SyncBody>,
) -> Json<SyncActionResult> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(SyncActionResult {
                error: Some(e.to_string()),
                ..Default::default()
            });
        }
    };
    let token = project.access_token.as_deref().unwrap_or("");
    match s.syncer.sync(&project, token).await {
        Ok(outcome) => Json(SyncActionResult {
            message: Some(format!(
                "Successfully synced {} template(s).",
                outcome.upserted
            )),
            count: Some(outcome.upserted),
            error: None,
        }),
        Err(e) => Json(SyncActionResult {
            error: Some(e.to_string()),
            ..Default::default()
        }),
    }
}

// ===========================================================================
// POST /create — `handleCreateTemplate(prevState, FormData)`
// ===========================================================================

pub async fn create(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<CreateBody>,
) -> Json<ActionState> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    let req = create_request_from(body, project.app_id.clone());
    match s.mutator.create(&project, req).await {
        Ok(_) => Json(ActionState::ok("Template submitted successfully!")),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}

// ===========================================================================
// POST /bulk-create — `handleBulkCreateTemplate(prevState, FormData)`
// ===========================================================================

pub async fn bulk_create(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<BulkCreateBody>,
) -> Json<BulkCreateActionResult> {
    // Resolve which target projects the caller actually owns. Drop the
    // rest into `skipped` (matches the TS access-check semantic).
    let coll = s.mongo.collection::<Document>(PROJECTS_COLL);
    let mut owned: Vec<Project> = Vec::with_capacity(body.project_ids.len());
    let mut skipped = 0_usize;
    for raw in &body.project_ids {
        let oid = match oid_from_str(raw) {
            Ok(o) => o,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        let doc_opt = match coll.find_one(doc! { "_id": oid }).await {
            Ok(d) => d,
            Err(e) => {
                return Json(BulkCreateActionResult {
                    error: Some(e.to_string()),
                    ..Default::default()
                });
            }
        };
        let Some(d) = doc_opt else {
            skipped += 1;
            continue;
        };
        let owner_hex = d
            .get_object_id("userId")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        if owner_hex != user.tenant_id {
            skipped += 1;
            continue;
        }
        // Coerce the document into a typed Project. Fall back to skipped
        // on any malformed row so a bad doc never hard-fails the batch.
        let project: Project = match bson::from_document(d) {
            Ok(p) => p,
            Err(_) => {
                skipped += 1;
                continue;
            }
        };
        owned.push(project);
    }

    let mut applied = 0_usize;
    let mut errors: Vec<String> = Vec::new();
    for project in owned {
        let req = CreateTemplateRequest {
            name: body.name.clone(),
            language: body.language.clone(),
            category: body.category,
            body: body.body.clone(),
            body_examples: body.body_examples.clone(),
            footer: body.footer.clone().filter(|s| !s.is_empty()),
            header_format: body.header_format,
            header_text: body.header_text.clone(),
            header_example: body.header_example.clone(),
            header_media: body.header_media_url.clone().map(HeaderMedia::Url),
            buttons: body.buttons.clone(),
            allow_category_change: body.allow_category_change,
            app_id: project.app_id.clone(),
        };
        match s.mutator.create(&project, req).await {
            Ok(_) => applied += 1,
            Err(e) => errors.push(e.to_string()),
        }
    }

    Json(BulkCreateActionResult {
        error: if errors.is_empty() {
            None
        } else {
            Some(errors.join("; "))
        },
        applied: Some(applied),
        skipped: Some(skipped),
        successes: Some(applied),
    })
}

// ===========================================================================
// POST /create-flow — `handleCreateFlowTemplate(prevState, FormData)`
// ===========================================================================

pub async fn create_flow(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<CreateFlowBody>,
) -> Json<CreateFlowActionResult> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => {
            return Json(CreateFlowActionResult {
                error: Some(e.to_string()),
                name: None,
            });
        }
    };
    let req = CreateFlowTemplateRequest {
        template_name: body.template_name,
        language: body.language,
        category: body.category,
        body_text: body.body_text,
        button_text: body.button_text,
        flow_id: body.flow_id,
    };
    match s.mutator.create_flow(&project, req).await {
        Ok(t) => Json(CreateFlowActionResult {
            error: None,
            name: t.name,
        }),
        Err(e) => Json(CreateFlowActionResult {
            error: Some(e.to_string()),
            name: None,
        }),
    }
}

// ===========================================================================
// POST /library/save — `saveLibraryTemplate`
// ===========================================================================

pub async fn library_save(
    _user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<LibrarySaveBody>,
) -> Json<ActionState> {
    match s.library.save(body).await {
        Ok(_) => Json(ActionState::ok("Template added to the library.")),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}

// ===========================================================================
// POST /library/{id}/delete — `deleteLibraryTemplate(id)`
// ===========================================================================

pub async fn library_delete(
    _user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Path(id): Path<String>,
) -> Json<ActionState> {
    let oid = match oid_from_str(&id) {
        Ok(o) => o,
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    match s.library.delete(&oid).await {
        Ok(()) => Json(ActionState::ok("Custom template removed from the library.")),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}

// ===========================================================================
// GET /library/list — `getLibraryTemplates`
// ===========================================================================

pub async fn library_list(
    _user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
) -> Result<Json<serde_json::Value>> {
    let items = s.reader.list_library().await?;
    Ok(Json(
        serde_json::to_value(items).unwrap_or(serde_json::Value::Null),
    ))
}

// ===========================================================================
// POST /library/{id}/apply — `handleApplyTemplateToProjects`
// ===========================================================================

pub async fn library_apply(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Path(source_id): Path<String>,
    Json(body): Json<ApplyBody>,
) -> Json<ApplyActionResult> {
    let source_oid = match oid_from_str(&source_id) {
        Ok(o) => o,
        Err(e) => {
            return Json(ApplyActionResult {
                success: false,
                error: Some(e.to_string()),
                applied: None,
                skipped: None,
            });
        }
    };

    let total_targets = body.target_project_ids.len();
    let coll = s.mongo.collection::<Document>(PROJECTS_COLL);
    let mut validated: Vec<ObjectId> = Vec::with_capacity(total_targets);
    for raw in &body.target_project_ids {
        let oid = match oid_from_str(raw) {
            Ok(o) => o,
            Err(_) => continue,
        };
        let doc_opt = match coll.find_one(doc! { "_id": oid }).await {
            Ok(d) => d,
            Err(e) => {
                return Json(ApplyActionResult {
                    success: false,
                    error: Some(e.to_string()),
                    applied: None,
                    skipped: None,
                });
            }
        };
        let Some(d) = doc_opt else { continue };
        let owner_hex = d
            .get_object_id("userId")
            .map(|o| o.to_hex())
            .unwrap_or_default();
        if owner_hex == user.tenant_id {
            validated.push(oid);
        }
    }

    match s.library.apply_to_projects(&source_oid, &validated).await {
        Ok(outcome) => {
            let skipped = total_targets.saturating_sub(validated.len()) + outcome.skipped;
            Json(ApplyActionResult {
                success: true,
                error: None,
                applied: Some(outcome.applied),
                skipped: Some(skipped),
            })
        }
        Err(e) => Json(ApplyActionResult {
            success: false,
            error: Some(e.to_string()),
            applied: None,
            skipped: None,
        }),
    }
}

// ===========================================================================
// POST /edit — `handleEditTemplate(prevState, FormData)`
// ===========================================================================

pub async fn edit(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<EditBody>,
) -> Json<ActionState> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    // Engine `edit` takes a Mongo template id; we look it up by metaId so
    // the wire signature only requires `metaTemplateId`.
    let coll = s
        .mongo
        .collection::<Document>(wachat_templates_categories::TEMPLATES_COLLECTION);
    let template_oid = match coll
        .find_one(doc! { "projectId": project.id, "metaId": &body.meta_template_id })
        .await
    {
        Ok(Some(d)) => match d.get_object_id("_id") {
            Ok(o) => o,
            Err(e) => return Json(ActionState::err(e.to_string())),
        },
        Ok(None) => {
            return Json(ActionState::err(format!(
                "template metaId={} not found",
                body.meta_template_id
            )));
        }
        Err(e) => return Json(ActionState::err(e.to_string())),
    };

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
    match s.mutator.edit(&project, &template_oid, req).await {
        Ok(_) => Json(ActionState::ok(
            "Template updated successfully and resubmitted for approval.",
        )),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}

// ===========================================================================
// POST /delete-by-name — `handleDeleteTemplate(projectId, name, _metaId?)`
// ===========================================================================

pub async fn delete_by_name(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<DeleteByNameBody>,
) -> Json<ActionState> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    let name = body.template_name;
    match s.mutator.delete_by_name(&project, &name).await {
        Ok(()) => Json(ActionState::ok(format!(
            "Template \"{name}\" deleted successfully from Meta and local database."
        ))),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}

// ===========================================================================
// POST /delete-by-id — `handleDeleteTemplateById(projectId, metaTemplateId)`
// ===========================================================================

pub async fn delete_by_id(
    user: AuthUser,
    State(s): State<WachatTemplatesActionsState>,
    Json(body): Json<DeleteByIdBody>,
) -> Json<ActionState> {
    let project = match load_project_for(&user, &s.mongo, &body.project_id).await {
        Ok(p) => p,
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    // Resolve metaTemplateId → Mongo template id for the engine.
    let coll = s
        .mongo
        .collection::<Document>(wachat_templates_categories::TEMPLATES_COLLECTION);
    let template_oid = match coll
        .find_one(doc! { "projectId": project.id, "metaId": &body.meta_template_id })
        .await
    {
        Ok(Some(d)) => match d.get_object_id("_id") {
            Ok(o) => o,
            Err(e) => return Json(ActionState::err(e.to_string())),
        },
        Ok(None) => {
            return Json(ActionState::err(format!(
                "template metaId={} not found",
                body.meta_template_id
            )));
        }
        Err(e) => return Json(ActionState::err(e.to_string())),
    };
    match s.mutator.delete_by_id(&project, &template_oid).await {
        Ok(()) => Json(ActionState::ok("Template deleted successfully.")),
        Err(e) => Json(ActionState::err(e.to_string())),
    }
}
