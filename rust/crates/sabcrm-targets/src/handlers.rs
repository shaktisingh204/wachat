//! HTTP handlers for the SabCRM targets domain.
//!
//! Polymorphic junctions over the `sabcrm_targets` Mongo collection,
//! linking a source activity (`notes` | `tasks` | `activities`) to MANY
//! records of ANY object — Twenty's `task-target` / `note-target` pattern.
//!
//! | Endpoint                                  | Direction                       |
//! |-------------------------------------------|---------------------------------|
//! | `GET    /v1/sabcrm/targets`               | targets of a source activity    |
//! | `GET    /v1/sabcrm/targets/for-record`    | sources attached to a record    |
//! | `POST   /v1/sabcrm/targets`               | link (idempotent upsert)        |
//! | `DELETE /v1/sabcrm/targets`               | unlink                          |
//!
//! Plus the ADDITIVE **sales quotas** sub-resource (goals for the weighted
//! forecast UI), stored in the separate `sabcrm_sales_targets` collection:
//!
//! | Endpoint                                    | Action                        |
//! |---------------------------------------------|-------------------------------|
//! | `GET    /v1/sabcrm/targets/quotas`          | list a project's quotas       |
//! | `POST   /v1/sabcrm/targets/quotas`          | create a quota                |
//! | `PATCH  /v1/sabcrm/targets/quotas/{id}`     | partial update                |
//! | `DELETE /v1/sabcrm/targets/quotas/{id}`     | delete                        |
//!
//! ## Tenancy
//!
//! Every read and write leads with `projectId`. The [`AuthUser`] extractor
//! is required on every endpoint so the surface is never anonymously open.
//! The idempotent key is
//! `(projectId, sourceObject, sourceId, targetObject, targetId)`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateQuotaInput, LinkTargetInput, ListForRecordQuery, ListForSourceQuery, ListQuotasQuery,
    ListQuotasResponse, ListResponse, OkResponse, QuotaResponse, QuotaScopeQuery, TargetResponse,
    UnlinkTargetQuery, UpdateQuotaInput,
};

/// The Mongo collection backing polymorphic targets.
const TARGETS_COLL: &str = "sabcrm_targets";

/// The Mongo collection backing sales quotas (goals for the forecast UI).
/// Separate from [`TARGETS_COLL`] — quota rows never mix with junction rows.
const SALES_TARGETS_COLL: &str = "sabcrm_sales_targets";

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

/// Reject a blank required string field, naming it in the error.
fn require_field<'a>(value: &'a str, field: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{field} is required.")));
    }
    Ok(v)
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

/// Drain a cursor of target documents into wire JSON, newest first.
async fn collect_targets(
    coll: &mongodb::Collection<Document>,
    filter: Document,
) -> Result<Vec<Value>> {
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.find")))?;

    let mut targets = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.cursor")))?
    {
        targets.push(record_to_wire(d));
    }
    Ok(targets)
}

// ===========================================================================
// GET / — targets of a source activity
// ===========================================================================

/// `GET /v1/sabcrm/targets` — the records a single note / task / activity
/// is attached to. Relies on the `(projectId, sourceObject, sourceId)`
/// index.
#[instrument(skip_all)]
pub async fn list_for_source(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListForSourceQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let source_object = require_field(&query.source_object, "sourceObject")?;
    let source_id = require_field(&query.source_id, "sourceId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let targets = collect_targets(
        &coll,
        doc! {
            "projectId": project_id,
            "sourceObject": source_object,
            "sourceId": source_id,
        },
    )
    .await?;

    Ok(Json(ListResponse { targets }))
}

// ===========================================================================
// GET /for-record — sources attached to a record
// ===========================================================================

/// `GET /v1/sabcrm/targets/for-record` — the notes / tasks / activities
/// attached to a single record. Relies on the
/// `(projectId, targetObject, targetId)` index.
#[instrument(skip_all)]
pub async fn list_for_record(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListForRecordQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;
    let target_object = require_field(&query.target_object, "targetObject")?;
    let target_id = require_field(&query.target_id, "targetId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let targets = collect_targets(
        &coll,
        doc! {
            "projectId": project_id,
            "targetObject": target_object,
            "targetId": target_id,
        },
    )
    .await?;

    Ok(Json(ListResponse { targets }))
}

// ===========================================================================
// POST / — link (idempotent upsert)
// ===========================================================================

/// `POST /v1/sabcrm/targets` — link a source activity to a record.
/// Idempotent on the full key
/// `(projectId, sourceObject, sourceId, targetObject, targetId)`;
/// `createdAt` is set once (`$setOnInsert`).
#[instrument(skip_all)]
pub async fn link_target(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<LinkTargetInput>,
) -> Result<Json<TargetResponse>> {
    let project_id = require_project(&body.project_id)?;
    let source_object = require_field(&body.source_object, "sourceObject")?;
    let source_id = require_field(&body.source_id, "sourceId")?;
    let target_object = require_field(&body.target_object, "targetObject")?;
    let target_id = require_field(&body.target_id, "targetId")?;

    let key = doc! {
        "projectId": project_id,
        "sourceObject": source_object,
        "sourceId": source_id,
        "targetObject": target_object,
        "targetId": target_id,
    };

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    let upserted = coll
        .find_one_and_update(
            key.clone(),
            doc! {
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "createdAt": Utc::now().to_rfc3339(),
                },
            },
        )
        .upsert(true)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_targets.find_one_and_update(upsert)"),
            )
        })?
        .ok_or_else(|| {
            ApiError::Internal(anyhow::anyhow!("sabcrm_targets.upsert returned no document"))
        })?;

    Ok(Json(TargetResponse {
        target: record_to_wire(upserted),
    }))
}

// ===========================================================================
// DELETE / — unlink
// ===========================================================================

/// `DELETE /v1/sabcrm/targets` — unlink a source activity from a record.
/// Idempotent: returns `{ ok: true }` whether or not a row matched.
#[instrument(skip_all)]
pub async fn unlink_target(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<UnlinkTargetQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let source_object = require_field(&query.source_object, "sourceObject")?;
    let source_id = require_field(&query.source_id, "sourceId")?;
    let target_object = require_field(&query.target_object, "targetObject")?;
    let target_id = require_field(&query.target_id, "targetId")?;

    let coll = mongo.collection::<Document>(TARGETS_COLL);
    coll.delete_one(doc! {
        "projectId": project_id,
        "sourceObject": source_object,
        "sourceId": source_id,
        "targetObject": target_object,
        "targetId": target_id,
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_targets.delete_one")))?;

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// Sales quotas (`/quotas`) — goals & targets for the weighted forecast
// ===========================================================================

/// Validate a quota `period` kind. Allowed: `month` | `quarter`.
fn validate_period(period: &str) -> Result<&str> {
    let p = period.trim();
    match p {
        "month" | "quarter" => Ok(p),
        _ => Err(ApiError::Validation(
            "period must be \"month\" or \"quarter\".".to_owned(),
        )),
    }
}

/// Validate a quota `metric`. Allowed: `revenue` | `count`.
fn validate_metric(metric: &str) -> Result<&str> {
    let m = metric.trim();
    match m {
        "revenue" | "count" => Ok(m),
        _ => Err(ApiError::Validation(
            "metric must be \"revenue\" or \"count\".".to_owned(),
        )),
    }
}

/// Validate a quota `periodStart` — a calendar date, `YYYY-MM-DD`.
fn validate_period_start(period_start: &str) -> Result<&str> {
    let s = period_start.trim();
    if chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_err() {
        return Err(ApiError::Validation(
            "periodStart must be a YYYY-MM-DD date.".to_owned(),
        ));
    }
    Ok(s)
}

/// Validate a quota `amount` — finite and non-negative.
fn validate_amount(amount: f64) -> Result<f64> {
    if !amount.is_finite() || amount < 0.0 {
        return Err(ApiError::Validation(
            "amount must be a non-negative number.".to_owned(),
        ));
    }
    Ok(amount)
}

/// Parse a path id into an `ObjectId`, mapping failures to a 400.
fn quota_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id.trim())
        .map_err(|_| ApiError::Validation("Invalid quota id.".to_owned()))
}

/// `GET /v1/sabcrm/targets/quotas` — list a project's sales quotas, newest
/// `periodStart` first, optionally narrowed by `period` / `periodStart` /
/// `pipelineId` (exact equality).
#[instrument(skip_all)]
pub async fn list_quotas(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuotasQuery>,
) -> Result<Json<ListQuotasResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(period) = query.period.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", validate_period(period)?);
    }
    if let Some(ps) = query
        .period_start
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("periodStart", validate_period_start(ps)?);
    }
    if let Some(pid) = query
        .pipeline_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("pipelineId", pid);
    }

    let coll = mongo.collection::<Document>(SALES_TARGETS_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "periodStart": -1, "createdAt": -1 })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_sales_targets.find"))
        })?;

    let mut quotas = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_sales_targets.cursor"))
    })? {
        quotas.push(record_to_wire(d));
    }

    Ok(Json(ListQuotasResponse { quotas }))
}

/// `POST /v1/sabcrm/targets/quotas` — create a sales quota.
#[instrument(skip_all)]
pub async fn create_quota(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateQuotaInput>,
) -> Result<Json<QuotaResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = require_field(&body.name, "name")?;
    let period = validate_period(&body.period)?;
    let period_start = validate_period_start(&body.period_start)?;
    let metric = validate_metric(&body.metric)?;
    let amount = validate_amount(body.amount)?;

    let now = Utc::now().to_rfc3339();
    let mut quota = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "name": name,
        "period": period,
        "periodStart": period_start,
        "metric": metric,
        "amount": amount,
        "createdAt": &now,
        "updatedAt": &now,
    };
    if let Some(member_id) = body.member_id.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        quota.insert("memberId", member_id);
    }
    if let Some(pipeline_id) = body
        .pipeline_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        quota.insert("pipelineId", pipeline_id);
    }

    let coll = mongo.collection::<Document>(SALES_TARGETS_COLL);
    coll.insert_one(&quota).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_sales_targets.insert_one"))
    })?;

    Ok(Json(QuotaResponse {
        quota: record_to_wire(quota),
    }))
}

/// `PATCH /v1/sabcrm/targets/quotas/{id}` — partial update. Only present
/// keys are `$set`; an explicit empty-string `memberId` / `pipelineId`
/// `$unset`s the scope back to team-wide / all-pipelines. `updatedAt` is
/// always bumped.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_quota(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateQuotaInput>,
) -> Result<Json<QuotaResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = quota_oid(&id)?;

    let mut set = doc! { "updatedAt": Utc::now().to_rfc3339() };
    let mut unset = Document::new();

    if let Some(name) = body.name.as_deref() {
        set.insert("name", require_field(name, "name")?);
    }
    if let Some(period) = body.period.as_deref() {
        set.insert("period", validate_period(period)?);
    }
    if let Some(ps) = body.period_start.as_deref() {
        set.insert("periodStart", validate_period_start(ps)?);
    }
    if let Some(metric) = body.metric.as_deref() {
        set.insert("metric", validate_metric(metric)?);
    }
    if let Some(amount) = body.amount {
        set.insert("amount", validate_amount(amount)?);
    }
    match body.member_id.as_deref().map(str::trim) {
        Some("") => {
            unset.insert("memberId", Bson::Int32(1));
        }
        Some(member_id) => {
            set.insert("memberId", member_id);
        }
        None => {}
    }
    match body.pipeline_id.as_deref().map(str::trim) {
        Some("") => {
            unset.insert("pipelineId", Bson::Int32(1));
        }
        Some(pipeline_id) => {
            set.insert("pipelineId", pipeline_id);
        }
        None => {}
    }

    // `updatedAt` is always present; require at least one REAL change.
    if set.len() <= 1 && unset.is_empty() {
        return Err(ApiError::Validation("Nothing to update.".to_owned()));
    }

    let mut update = doc! { "$set": set };
    if !unset.is_empty() {
        update.insert("$unset", unset);
    }

    let coll = mongo.collection::<Document>(SALES_TARGETS_COLL);
    let updated = coll
        .find_one_and_update(doc! { "_id": oid, "projectId": project_id }, update)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_sales_targets.find_one_and_update"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Quota not found.".to_owned()))?;

    Ok(Json(QuotaResponse {
        quota: record_to_wire(updated),
    }))
}

/// `DELETE /v1/sabcrm/targets/quotas/{id}` — scoped delete. Idempotent:
/// returns `{ ok: true }` whether or not a row matched.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_quota(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<QuotaScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = quota_oid(&id)?;

    let coll = mongo.collection::<Document>(SALES_TARGETS_COLL);
    coll.delete_one(doc! { "_id": oid, "projectId": project_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_sales_targets.delete_one"))
        })?;

    Ok(Json(OkResponse { ok: true }))
}
