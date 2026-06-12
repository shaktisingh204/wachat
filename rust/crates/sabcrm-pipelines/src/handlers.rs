//! HTTP handlers for the SabCRM sales-pipelines domain.
//!
//! CRUD over the `sabcrm_pipelines` Mongo collection.
//!
//! | Endpoint                                  | TS action        |
//! |-------------------------------------------|------------------|
//! | `GET    /v1/sabcrm/pipelines`             | `listPipelines`  |
//! | `GET    /v1/sabcrm/pipelines/{id}`        | `getPipeline`    |
//! | `POST   /v1/sabcrm/pipelines`             | `createPipeline` |
//! | `PATCH  /v1/sabcrm/pipelines/{id}`        | `updatePipeline` |
//! | `DELETE /v1/sabcrm/pipelines/{id}`        | `deletePipeline` |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Array, Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    BoardQuery, BoardResponse, BoardStage, CreatePipelineInput, ListQuery, ListResponse,
    MoveRecordInput, MoveRecordResponse, OkResponse, PipelineResponse, ReorderStagesInput,
    ScopeQuery, StageGovernance, UpdatePipelineInput,
};

/// The Mongo collection backing sales pipelines.
const PIPELINES_COLL: &str = "sabcrm_pipelines";

/// The single Mongo collection backing every SabCRM object's records — the
/// board rolls up live records from here, scoped by `{ projectId, object }`.
const RECORDS_COLL: &str = "sabcrm_records";

/// Default target object for a pipeline when none is supplied.
const DEFAULT_OBJECT: &str = "leads";

/// Default `data.<field>` carrying a record's pipeline stage.
const DEFAULT_STAGE_FIELD: &str = "stage";

/// Default `data.<field>` carrying a record's numeric amount.
const DEFAULT_AMOUNT_FIELD: &str = "amount";

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

/// Convert an incoming flattened JSON object into a BSON `Document`,
/// dropping `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

/// Coerce any stage / group key into its canonical string form so the board
/// tolerates non-string (numeric / boolean) stored stage values. `null`
/// (absent stage) maps to `None`; everything else to a stable string.
fn stage_key_to_string(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        other => Some(other.to_string()),
    }
}

/// Same coercion for a BSON aggregation `_id` bucket key. Numeric / boolean
/// stage ids are stringified; `null`/missing maps to `None` (unassigned).
fn bson_stage_key_to_string(b: &Bson) -> Option<String> {
    match b {
        Bson::Null => None,
        Bson::String(s) => Some(s.clone()),
        Bson::Int32(i) => Some(i.to_string()),
        Bson::Int64(i) => Some(i.to_string()),
        Bson::Double(d) => Some(d.to_string()),
        Bson::Boolean(x) => Some(x.to_string()),
        _ => None,
    }
}

/// Coerce a numeric BSON amount accumulator into `f64`; non-numeric → `0.0`.
fn bson_to_f64(b: &Bson) -> f64 {
    match b {
        Bson::Int32(i) => *i as f64,
        Bson::Int64(i) => *i as f64,
        Bson::Double(d) => *d,
        _ => 0.0,
    }
}

/// Pull the ordered `stages` array out of a pipeline document as wire JSON.
/// A pipeline with no `stages` key yields an empty ordered list.
fn pipeline_stages(pipeline: &Value) -> Vec<Value> {
    pipeline
        .get("stages")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
}

/// Read a stage descriptor's id from its JSON object, tolerating a numeric
/// id key. Returns the canonical string id, or `None` if no `id` is present.
fn stage_descriptor_id(stage: &Value) -> Option<String> {
    stage.get("id").and_then(stage_key_to_string)
}

// ===========================================================================
// GET / — listPipelines
// ===========================================================================

/// `GET /v1/sabcrm/pipelines` — list the pipelines for one project, scoped
/// by `{ projectId }`, ordered by `createdAt`.
#[instrument(skip_all)]
pub async fn list_pipelines(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.find")))?;

    let mut pipelines = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.cursor"))
    })? {
        pipelines.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { pipelines }))
}

// ===========================================================================
// GET /{id} — getPipeline
// ===========================================================================

/// `GET /v1/sabcrm/pipelines/{id}` — fetch a single pipeline scoped by
/// `{ projectId, _id }`. `404` if no pipeline matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let found = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(found),
    }))
}

// ===========================================================================
// POST / — createPipeline
// ===========================================================================

/// `POST /v1/sabcrm/pipelines` — create a pipeline. `object` defaults to
/// `"opportunities"`, `stages` defaults to `[]`; `createdAt` / `updatedAt`
/// are set server-side (RFC3339).
#[instrument(skip_all)]
pub async fn create_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreatePipelineInput>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&body.project_id)?;

    let mut new_doc = payload_to_set(&body.pipeline)?;

    // Default `object` to "opportunities" when absent / blank.
    let needs_object = match new_doc.get("object") {
        Some(Bson::String(s)) => s.trim().is_empty(),
        _ => true,
    };
    if needs_object {
        new_doc.insert("object", DEFAULT_OBJECT);
    }

    // Default `stages` to [] when absent.
    if !new_doc.contains_key("stages") {
        new_doc.insert("stages", Array::new());
    }

    let now = Utc::now().to_rfc3339();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.insert_one"))
    })?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updatePipeline
// ===========================================================================

/// `PATCH /v1/sabcrm/pipelines/{id}` — partial update. Each key in the
/// flattened body (minus `projectId`) is `$set` verbatim; `updatedAt` is
/// always bumped. Returns the updated pipeline.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePipelineInput>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_pipelines.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deletePipeline
// ===========================================================================

/// `DELETE /v1/sabcrm/pipelines/{id}` — scoped delete. Returns `404` if no
/// pipeline matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_pipeline(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("pipeline".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// shared — fetch a scoped pipeline document
// ===========================================================================

/// Load a single pipeline scoped by `{ projectId, _id }`, returning the raw
/// (uncleaned) Mongo document. `404` if no pipeline matches.
async fn load_pipeline(mongo: &MongoHandle, project_id: &str, oid: ObjectId) -> Result<Document> {
    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    coll.find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.find_one")))?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))
}

/// The pipeline's target object slug (`object` key), defaulting to
/// [`DEFAULT_OBJECT`] when absent / blank.
fn pipeline_object(pipeline: &Value) -> String {
    pipeline
        .get("object")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_OBJECT)
        .to_owned()
}

// ===========================================================================
// GET /{id}/board — pipeline board with per-stage counts + summed amount
// ===========================================================================

/// `GET /v1/sabcrm/pipelines/{id}/board` — the board view of one pipeline:
/// the pipeline document, its ordered stages each carrying a live `count` and
/// summed `amount`, plus an `unassigned` tail bucket and grand totals.
///
/// Rollups come from a single `$group` over the live records of the
/// pipeline's target object (`sabcrm_records`, scoped by `{ projectId,
/// object }`), bucketed by `data.<stageField>` and summing
/// `data.<amountField>`. Bucket keys are coerced to strings so numeric stage
/// ids match string stage descriptors. Stage descriptors are returned in
/// pipeline order even when they hold zero records.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_board(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<BoardQuery>,
) -> Result<Json<BoardResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let pipeline_doc = load_pipeline(&mongo, project_id, oid).await?;
    let pipeline = record_to_wire(pipeline_doc);

    let object = pipeline_object(&pipeline);
    let stage_field = query
        .stage_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_STAGE_FIELD);
    let amount_field = query
        .amount_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_AMOUNT_FIELD);

    // Roll up live (non-trashed) records by stage in one aggregation.
    let pipeline_agg = vec![
        doc! {
            "$match": {
                "projectId": project_id,
                "object": &object,
                "$or": [
                    { "deletedAt": { "$exists": false } },
                    { "deletedAt": Bson::Null },
                ],
            }
        },
        doc! {
            "$group": {
                "_id": format!("$data.{stage_field}"),
                "count": { "$sum": 1i64 },
                "amount": { "$sum": format!("$data.{amount_field}") },
            }
        },
    ];

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let mut cursor = coll.aggregate(pipeline_agg).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.board.aggregate"))
    })?;

    // Per-stage rollups keyed by the stringified stage id, plus the
    // unassigned bucket (records whose stage value is null / missing).
    let mut by_stage: std::collections::HashMap<String, (i64, f64)> =
        std::collections::HashMap::new();
    let mut unassigned_count: i64 = 0;
    let mut unassigned_amount: f64 = 0.0;

    while let Some(bucket) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.board.cursor"))
    })? {
        let count = bucket.get("count").map(bson_to_f64).unwrap_or(0.0) as i64;
        let amount = bucket.get("amount").map(bson_to_f64).unwrap_or(0.0);
        match bucket.get("_id").and_then(bson_stage_key_to_string) {
            Some(key) => {
                let entry = by_stage.entry(key).or_insert((0, 0.0));
                entry.0 += count;
                entry.1 += amount;
            }
            None => {
                unassigned_count += count;
                unassigned_amount += amount;
            }
        }
    }

    // Walk declared stages in pipeline order, attaching rollups. Stage ids
    // matched here are removed from `by_stage`; whatever remains is folded
    // into `unassigned` (records pointing at stages no longer declared).
    let mut total_count: i64 = 0;
    let mut total_amount: f64 = 0.0;
    let mut stages = Vec::new();
    for (position, stage) in pipeline_stages(&pipeline).into_iter().enumerate() {
        let Some(stage_id) = stage_descriptor_id(&stage) else {
            continue;
        };
        let (count, amount) = by_stage.remove(&stage_id).unwrap_or((0, 0.0));
        total_count += count;
        total_amount += amount;
        let governance = StageGovernance::from_stage(&stage);
        stages.push(BoardStage {
            id: stage_id,
            label: stage
                .get("label")
                .and_then(Value::as_str)
                .map(str::to_owned),
            color: stage
                .get("color")
                .and_then(Value::as_str)
                .map(str::to_owned),
            position,
            count,
            amount,
            required_fields: governance.required_fields,
            requires_approval: governance.requires_approval,
            rotting_days: governance.rotting_days,
            kind: governance.kind,
            probability: governance.probability,
        });
    }

    // Anything still in `by_stage` references an undeclared stage → unassigned.
    for (_, (count, amount)) in by_stage {
        unassigned_count += count;
        unassigned_amount += amount;
    }
    total_count += unassigned_count;
    total_amount += unassigned_amount;

    let unassigned = BoardStage {
        id: String::new(),
        label: Some("Unassigned".to_owned()),
        color: None,
        position: stages.len(),
        count: unassigned_count,
        amount: unassigned_amount,
        required_fields: Vec::new(),
        requires_approval: false,
        rotting_days: None,
        kind: None,
        probability: None,
    };

    Ok(Json(BoardResponse {
        pipeline,
        stages,
        unassigned,
        total_count,
        total_amount,
    }))
}

// ===========================================================================
// POST /{id}/stages/reorder — reorder pipeline stages by id
// ===========================================================================

/// `POST /v1/sabcrm/pipelines/{id}/stages/reorder` — reorder a pipeline's
/// stages. The `order` list of stage ids defines the new leading order;
/// stages omitted from `order` keep their relative order and are appended
/// after. Stage ids are matched tolerantly (numeric stored ids match string
/// request ids). Returns the updated pipeline.
#[instrument(skip_all, fields(id = %id))]
pub async fn reorder_stages(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<ReorderStagesInput>,
) -> Result<Json<PipelineResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let pipeline_doc = load_pipeline(&mongo, project_id, oid).await?;
    let pipeline = record_to_wire(pipeline_doc);
    let existing = pipeline_stages(&pipeline);

    // Index stages by their stringified id (tolerant of numeric ids).
    let mut by_id: std::collections::HashMap<String, Value> = std::collections::HashMap::new();
    let mut original_order: Vec<String> = Vec::with_capacity(existing.len());
    for stage in existing {
        if let Some(sid) = stage_descriptor_id(&stage) {
            original_order.push(sid.clone());
            by_id.insert(sid, stage);
        }
    }

    // Lead with the requested order (skipping unknown / duplicate ids), then
    // append any remaining stages in their original relative order.
    let mut reordered: Vec<Value> = Vec::with_capacity(by_id.len());
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for sid in &body.order {
        if seen.contains(sid) {
            continue;
        }
        if let Some(stage) = by_id.remove(sid) {
            seen.insert(sid.clone());
            reordered.push(stage);
        }
    }
    for sid in &original_order {
        if let Some(stage) = by_id.remove(sid) {
            reordered.push(stage);
        }
    }

    // Persist the new ordering as the canonical `stages` array.
    let stages_bson = bson::to_bson(&Value::Array(reordered)).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_pipelines.reorder.to_bson"))
    })?;
    let set = doc! {
        "stages": stages_bson,
        "updatedAt": Utc::now().to_rfc3339(),
    };

    let coll = mongo.collection::<Document>(PIPELINES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_pipelines.reorder.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("pipeline".to_owned()))?;

    Ok(Json(PipelineResponse {
        pipeline: record_to_wire(updated),
    }))
}

// ===========================================================================
// POST /{id}/move-record — move a record into a stage
// ===========================================================================

/// `POST /v1/sabcrm/pipelines/{id}/move-record` — move one target-object
/// record into a stage of this pipeline by `$set`-ting `data.<stageField>`
/// to the stage id. The stage id must match a declared stage (tolerant of
/// numeric ids). Both the pipeline and the record are scoped by `projectId`
/// (the record additionally by the pipeline's target `object`). Returns the
/// updated record document.
#[instrument(skip_all, fields(id = %id))]
pub async fn move_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<MoveRecordInput>,
) -> Result<Json<MoveRecordResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let stage_id = body.stage_id.trim();
    if stage_id.is_empty() {
        return Err(ApiError::Validation("stageId is required.".to_owned()));
    }
    let record_oid = oid_from_str(body.record_id.trim())?;

    let pipeline_doc = load_pipeline(&mongo, project_id, oid).await?;
    let pipeline = record_to_wire(pipeline_doc);
    let object = pipeline_object(&pipeline);

    // The target stage must be a declared stage of this pipeline.
    let declared = pipeline_stages(&pipeline)
        .iter()
        .filter_map(stage_descriptor_id)
        .any(|sid| sid == stage_id);
    if !declared {
        return Err(ApiError::Validation(format!(
            "stage `{stage_id}` is not a stage of this pipeline."
        )));
    }

    let stage_field = body
        .stage_field
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_STAGE_FIELD);

    let set = doc! {
        format!("data.{stage_field}"): stage_id,
        "updatedAt": Utc::now().to_rfc3339(),
    };

    let coll = mongo.collection::<Document>(RECORDS_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "object": &object, "_id": record_oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_pipelines.move_record.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("record".to_owned()))?;

    Ok(Json(MoveRecordResponse {
        record: record_to_wire(updated),
    }))
}
