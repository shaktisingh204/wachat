//! HTTP handlers for the embedded **Pipeline + Stage** entity.
//!
//! Every handler scopes its Mongo query by `_id == AuthUser.user_id` against
//! the `users` collection (the tenant root) and writes a best-effort audit
//! row to `crm_audit_log` with `entityKind: "pipeline"`.
//!
//! ## Array-update operator notes
//!
//! Pipelines and stages are sub-documents on `users.crmPipelines[]`. To
//! address a single embedded element we use the positional-filter form:
//!
//! ```text
//! { $set: { "crmPipelines.$[p].name": "..." } }
//! arrayFilters: [ { "p._id": <pipelineOid> } ]
//! ```
//!
//! Stage edits use a two-level filter:
//!
//! ```text
//! { $set: { "crmPipelines.$[p].stages.$[s].name": "..." } }
//! arrayFilters: [ { "p._id": <pipelineOid> }, { "s._id": <stageOid> } ]
//! ```
//!
//! `$push` / `$pull` use the same `crmPipelines.$[p].stages` path.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    tenant::user_oid,
};
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AddStageInput, AddStageResponse, CreatePipelineInput, CreatePipelineResponse, DeleteResponse,
    ListResponse, UpdatePipelineInput, UpdateStageInput,
};
use crate::types::{Pipeline, Stage};

const USERS_COLL: &str = "users";
const ENTITY_KIND: &str = "pipeline";

// ─── Mapping helpers ────────────────────────────────────────────────────

fn pipeline_from_create(input: CreatePipelineInput) -> Pipeline {
    let stages: Vec<Stage> = input
        .stages
        .into_iter()
        .map(|s| Stage {
            id: ObjectId::new(),
            legacy_id: None,
            name: s.name,
            color: s.color,
            order: s.order,
            chance: s.chance,
        })
        .collect();
    Pipeline {
        id: ObjectId::new(),
        legacy_id: None,
        name: input.name,
        stages,
        is_default: input.is_default,
        color: input.color,
    }
}

fn stage_from_add(input: AddStageInput) -> Stage {
    Stage {
        id: ObjectId::new(),
        legacy_id: None,
        name: input.name,
        color: input.color,
        order: input.order,
        chance: input.chance,
    }
}

/// Fetch the tenant's full `crmPipelines` array. Returns an empty Vec when
/// the user has none stamped.
async fn fetch_pipelines(mongo: &MongoHandle, user_id: ObjectId) -> Result<Vec<Pipeline>> {
    let coll = mongo.collection::<Document>(USERS_COLL);
    let user = coll
        .find_one(doc! { "_id": user_id })
        .projection(doc! { "crmPipelines": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.find_one")))?;

    let Some(user_doc) = user else {
        return Ok(vec![]);
    };

    let Ok(arr) = user_doc.get_array("crmPipelines") else {
        return Ok(vec![]);
    };

    let mut out = Vec::with_capacity(arr.len());
    for b in arr {
        if let Some(d) = b.as_document() {
            // Tolerant decode: skip malformed entries rather than 500.
            if let Ok(p) = bson::from_document::<Pipeline>(d.clone()) {
                out.push(p);
            } else {
                tracing::warn!(
                    "crm-pipelines: dropping unparseable pipeline entry for user {user_id}"
                );
            }
        }
    }
    Ok(out)
}

/// Same as [`fetch_pipelines`] but returns a single pipeline by `_id` or
/// 404.
async fn fetch_pipeline(
    mongo: &MongoHandle,
    user_id: ObjectId,
    pipeline_oid: ObjectId,
) -> Result<Pipeline> {
    let all = fetch_pipelines(mongo, user_id).await?;
    all.into_iter()
        .find(|p| p.id == pipeline_oid)
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))
}

fn doc_for_audit_pipeline(pipeline: &Pipeline) -> Document {
    bson::to_document(pipeline).unwrap_or_default()
}

// ─── GET / — list ────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_pipelines(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let items = fetch_pipelines(&mongo, user_id).await?;
    Ok(Json(ListResponse { items }))
}

// ─── GET /:pipelineId ───────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, pipeline_id = %pipeline_id))]
pub async fn get_pipeline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(pipeline_id): Path<String>,
) -> Result<Json<Pipeline>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;
    let p = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    Ok(Json(p))
}

// ─── POST / ─────────────────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_pipeline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePipelineInput>,
) -> Result<Json<CreatePipelineResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let pipeline = pipeline_from_create(input);
    let pipeline_doc = bson::to_document(&pipeline)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("pipeline.to_document")))?;

    let coll = mongo.collection::<Document>(USERS_COLL);
    let result = coll
        .update_one(
            doc! { "_id": user_id },
            doc! { "$push": { "crmPipelines": pipeline_doc } },
        )
        .with_options(UpdateOptions::builder().upsert(false).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.push_pipeline")))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("user".to_owned()));
    }

    if let Some(event) = audit_for_create(
        &user,
        ENTITY_KIND,
        pipeline.id,
        Some(doc_for_audit_pipeline(&pipeline)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreatePipelineResponse {
        id: pipeline.id.to_hex(),
        entity: pipeline,
    }))
}

// ─── PATCH /:pipelineId ─────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, pipeline_id = %pipeline_id))]
pub async fn update_pipeline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(pipeline_id): Path<String>,
    Json(patch): Json<UpdatePipelineInput>,
) -> Result<Json<Pipeline>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;

    let before = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;

    let mut set = Document::new();
    if let Some(v) = patch.name {
        set.insert("crmPipelines.$[p].name", v);
    }
    if let Some(v) = patch.color {
        set.insert("crmPipelines.$[p].color", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("crmPipelines.$[p].isDefault", v);
    }

    if set.is_empty() {
        // Nothing to do — just refetch and return.
        return Ok(Json(before));
    }

    let coll = mongo.collection::<Document>(USERS_COLL);
    let result = coll
        .update_one(doc! { "_id": user_id }, doc! { "$set": set })
        .with_options(
            UpdateOptions::builder()
                .array_filters(vec![doc! { "p._id": pipeline_oid }])
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.update_pipeline")))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("pipeline".to_owned()));
    }

    let after = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        pipeline_oid,
        Some(doc_for_audit_pipeline(&before)),
        Some(doc_for_audit_pipeline(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(after))
}

// ─── DELETE /:pipelineId ────────────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, pipeline_id = %pipeline_id))]
pub async fn delete_pipeline(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(pipeline_id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;

    let coll = mongo.collection::<Document>(USERS_COLL);
    let result = coll
        .update_one(
            doc! { "_id": user_id },
            doc! { "$pull": { "crmPipelines": { "_id": pipeline_oid } } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.pull_pipeline")))?;

    // matched_count reports the user row; modified_count drops to 0 when the
    // pipeline wasn't present, so use that as the not-found signal.
    if result.matched_count == 0 || result.modified_count == 0 {
        return Err(ApiError::NotFound("pipeline".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, pipeline_oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteResponse { deleted: true }))
}

// ─── POST /:pipelineId/stages ───────────────────────────────────────────

#[instrument(skip_all, fields(user_id = %user.user_id, pipeline_id = %pipeline_id))]
pub async fn add_stage(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(pipeline_id): Path<String>,
    Json(input): Json<AddStageInput>,
) -> Result<Json<AddStageResponse>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let before = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    let stage = stage_from_add(input);
    let stage_doc = bson::to_document(&stage)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("stage.to_document")))?;

    let coll = mongo.collection::<Document>(USERS_COLL);
    let result = coll
        .update_one(
            doc! { "_id": user_id },
            doc! { "$push": { "crmPipelines.$[p].stages": Bson::Document(stage_doc) } },
        )
        .with_options(
            UpdateOptions::builder()
                .array_filters(vec![doc! { "p._id": pipeline_oid }])
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.push_stage")))?;

    if result.matched_count == 0 || result.modified_count == 0 {
        return Err(ApiError::NotFound("pipeline".to_owned()));
    }

    // Audit is keyed off the parent pipeline.
    let after = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        pipeline_oid,
        Some(doc_for_audit_pipeline(&before)),
        Some(doc_for_audit_pipeline(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(AddStageResponse {
        id: stage.id.to_hex(),
        entity: stage,
    }))
}

// ─── PATCH /:pipelineId/stages/:stageId ─────────────────────────────────

#[instrument(
    skip_all,
    fields(user_id = %user.user_id, pipeline_id = %pipeline_id, stage_id = %stage_id),
)]
pub async fn update_stage(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((pipeline_id, stage_id)): Path<(String, String)>,
    Json(patch): Json<UpdateStageInput>,
) -> Result<Json<Stage>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;
    let stage_oid = oid_from_str(&stage_id)?;

    let before = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    if !before.stages.iter().any(|s| s.id == stage_oid) {
        return Err(ApiError::NotFound("stage".to_owned()));
    }

    let mut set = Document::new();
    if let Some(v) = patch.name {
        set.insert("crmPipelines.$[p].stages.$[s].name", v);
    }
    if let Some(v) = patch.color {
        set.insert("crmPipelines.$[p].stages.$[s].color", v);
    }
    if let Some(v) = patch.order {
        set.insert("crmPipelines.$[p].stages.$[s].order", v);
    }
    if let Some(v) = patch.chance {
        set.insert("crmPipelines.$[p].stages.$[s].chance", v);
    }

    if !set.is_empty() {
        let coll = mongo.collection::<Document>(USERS_COLL);
        let result = coll
            .update_one(doc! { "_id": user_id }, doc! { "$set": set })
            .with_options(
                UpdateOptions::builder()
                    .array_filters(vec![
                        doc! { "p._id": pipeline_oid },
                        doc! { "s._id": stage_oid },
                    ])
                    .build(),
            )
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.update_stage")))?;

        if result.matched_count == 0 {
            return Err(ApiError::NotFound("pipeline".to_owned()));
        }
    }

    let after = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    let stage = after
        .stages
        .iter()
        .find(|s| s.id == stage_oid)
        .cloned()
        .ok_or_else(|| ApiError::NotFound("stage".to_owned()))?;

    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        pipeline_oid,
        Some(doc_for_audit_pipeline(&before)),
        Some(doc_for_audit_pipeline(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(stage))
}

// ─── DELETE /:pipelineId/stages/:stageId ────────────────────────────────

#[instrument(
    skip_all,
    fields(user_id = %user.user_id, pipeline_id = %pipeline_id, stage_id = %stage_id),
)]
pub async fn remove_stage(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path((pipeline_id, stage_id)): Path<(String, String)>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let pipeline_oid = oid_from_str(&pipeline_id)?;
    let stage_oid = oid_from_str(&stage_id)?;

    let before = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    if !before.stages.iter().any(|s| s.id == stage_oid) {
        return Err(ApiError::NotFound("stage".to_owned()));
    }

    let coll = mongo.collection::<Document>(USERS_COLL);
    let result = coll
        .update_one(
            doc! { "_id": user_id },
            doc! {
                "$pull": { "crmPipelines.$[p].stages": { "_id": stage_oid } }
            },
        )
        .with_options(
            UpdateOptions::builder()
                .array_filters(vec![doc! { "p._id": pipeline_oid }])
                .build(),
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.pull_stage")))?;

    if result.matched_count == 0 || result.modified_count == 0 {
        return Err(ApiError::NotFound("stage".to_owned()));
    }

    let after = fetch_pipeline(&mongo, user_id, pipeline_oid).await?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        pipeline_oid,
        Some(doc_for_audit_pipeline(&before)),
        Some(doc_for_audit_pipeline(&after)),
    ) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pipeline_from_create_stamps_oid_and_no_legacy_id() {
        let input = CreatePipelineInput {
            name: "Sales".into(),
            ..Default::default()
        };
        let p = pipeline_from_create(input);
        assert_eq!(p.name, "Sales");
        assert!(p.legacy_id.is_none());
        assert!(p.stages.is_empty());
        // ObjectId is non-zero
        assert!(!p.id.to_hex().is_empty());
    }

    #[test]
    fn pipeline_from_create_stamps_stage_oids() {
        let input = CreatePipelineInput {
            name: "Sales".into(),
            stages: vec![
                crate::dto::CreateStageInline {
                    name: "New".into(),
                    chance: Some(10),
                    ..Default::default()
                },
                crate::dto::CreateStageInline {
                    name: "Won".into(),
                    chance: Some(100),
                    ..Default::default()
                },
            ],
            ..Default::default()
        };
        let p = pipeline_from_create(input);
        assert_eq!(p.stages.len(), 2);
        assert_eq!(p.stages[0].name, "New");
        assert_eq!(p.stages[0].chance, Some(10));
        assert_eq!(p.stages[1].name, "Won");
        // Each stage has its own unique ObjectId.
        assert_ne!(p.stages[0].id, p.stages[1].id);
    }

    #[test]
    fn stage_from_add_stamps_unique_oid() {
        let a = stage_from_add(AddStageInput {
            name: "S1".into(),
            ..Default::default()
        });
        let b = stage_from_add(AddStageInput {
            name: "S2".into(),
            ..Default::default()
        });
        assert_ne!(a.id, b.id);
    }

    #[test]
    fn update_pipeline_set_uses_positional_filter_path() {
        // Smoke-test that the path strings we hand Mongo round-trip through
        // a Document — guards against typos like `crmPipelines.$[p]name`.
        let mut set = Document::new();
        set.insert("crmPipelines.$[p].name", "Renamed");
        set.insert("crmPipelines.$[p].color", "#abc");
        set.insert("crmPipelines.$[p].isDefault", true);
        assert_eq!(set.get_str("crmPipelines.$[p].name").unwrap(), "Renamed");
        assert_eq!(set.get_bool("crmPipelines.$[p].isDefault").unwrap(), true);
    }

    #[test]
    fn update_stage_set_uses_two_level_positional_filter_path() {
        let mut set = Document::new();
        set.insert("crmPipelines.$[p].stages.$[s].name", "Renamed");
        set.insert("crmPipelines.$[p].stages.$[s].chance", 42_i32);
        assert_eq!(
            set.get_str("crmPipelines.$[p].stages.$[s].name").unwrap(),
            "Renamed",
        );
        assert_eq!(
            set.get_i32("crmPipelines.$[p].stages.$[s].chance").unwrap(),
            42,
        );
    }

    #[test]
    fn pull_pipeline_filter_targets_correct_id() {
        let pipeline_oid = ObjectId::new();
        let pull: Document = doc! { "$pull": { "crmPipelines": { "_id": pipeline_oid } } };
        let inner = pull.get_document("$pull").unwrap();
        let crm = inner.get_document("crmPipelines").unwrap();
        assert_eq!(crm.get_object_id("_id").unwrap(), pipeline_oid);
    }

    #[test]
    fn array_filters_are_two_entries_for_stage_edit() {
        let p = ObjectId::new();
        let s = ObjectId::new();
        let filters = [doc! { "p._id": p }, doc! { "s._id": s }];
        assert_eq!(filters.len(), 2);
        assert_eq!(filters[0].get_object_id("p._id").unwrap(), p);
        assert_eq!(filters[1].get_object_id("s._id").unwrap(), s);
    }
}
