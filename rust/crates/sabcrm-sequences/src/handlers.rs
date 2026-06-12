//! HTTP handlers for the SabCRM sequences (cadences) domain.
//!
//! Lifecycle over the `sabcrm_sequences` + `sabcrm_sequence_enrollments`
//! Mongo collections.
//!
//! | Endpoint                                            | TS action                       |
//! |-----------------------------------------------------|---------------------------------|
//! | `GET    /v1/sabcrm/sequences`                       | `listSabcrmSequences`           |
//! | `POST   /v1/sabcrm/sequences`                       | `createSabcrmSequence`          |
//! | `GET    /v1/sabcrm/sequences/enrollments`           | `listSabcrmSequenceEnrollments` |
//! | `POST   /v1/sabcrm/sequences/enrollments/{id}/unenroll` | `unenrollSabcrmEnrollment` |
//! | `GET    /v1/sabcrm/sequences/{id}`                  | `getSabcrmSequence`             |
//! | `PATCH  /v1/sabcrm/sequences/{id}`                  | `updateSabcrmSequence`          |
//! | `DELETE /v1/sabcrm/sequences/{id}`                  | `deleteSabcrmSequence`          |
//! | `POST   /v1/sabcrm/sequences/{id}/enroll`           | `enrollSabcrmSequence`          |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus `_id`
//! as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor; the caller's `user_id` is
//! recorded as `enrolledBy` on enrollments.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateSequenceInput, EnrollInput, EnrollResponse, EnrollmentListQuery,
    EnrollmentListResponse, EnrollmentResponse, ListQuery, ListResponse, OkResponse, ScopeQuery,
    SequenceResponse, SequenceSettings, SequenceStep, SequenceStepKind, UnenrollInput,
    UpdateSequenceInput,
};

/// The Mongo collection backing sequence definitions.
const SEQUENCES_COLL: &str = "sabcrm_sequences";

/// The Mongo collection backing per-record enrollments.
const ENROLLMENTS_COLL: &str = "sabcrm_sequence_enrollments";

/// Default page size when `limit` is omitted.
const DEFAULT_LIMIT: i64 = 50;

/// Hard cap on `limit` regardless of the requested value.
const MAX_LIMIT: i64 = 200;

/// Hard cap on records enrolled by one `POST /{id}/enroll` call.
const MAX_ENROLL_BATCH: usize = 200;

/// The lifecycle statuses a sequence may carry.
const SEQUENCE_STATUSES: [&str; 2] = ["active", "paused"];

/// The lifecycle statuses an enrollment may carry.
const ENROLLMENT_STATUSES: [&str; 4] = ["active", "completed", "unenrolled", "failed"];

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

/// Reject an empty required string field, naming it in the error.
fn require_str<'a>(value: &'a str, name: &str) -> Result<&'a str> {
    let v = value.trim();
    if v.is_empty() {
        return Err(ApiError::Validation(format!("{name} is required.")));
    }
    Ok(v)
}

/// Trim an optional string to `None` when blank.
fn opt_str(value: &Option<String>) -> Option<&str> {
    value.as_deref().map(str::trim).filter(|s| !s.is_empty())
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
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_sequences.payload.to_bson"))
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

/// Validate a sequence `status` slug.
fn validate_sequence_status(status: &str) -> Result<()> {
    if SEQUENCE_STATUSES.contains(&status) {
        return Ok(());
    }
    Err(ApiError::Validation(format!(
        "status must be one of {}.",
        SEQUENCE_STATUSES.join(" / ")
    )))
}

/// Validate that every step is executable by the scheduler: an `email` step
/// needs a `templateId` OR an inline `body`; a `task` step needs a non-empty
/// `title`; a `wait` step needs `waitDays > 0`. Steps are stored typed, so a
/// malformed step is a `422`, never a persisted dud.
fn validate_steps(steps: &[SequenceStep]) -> Result<()> {
    for step in steps {
        if step.id.trim().is_empty() {
            return Err(ApiError::Validation("every step needs a non-empty id.".to_owned()));
        }
        match step.kind {
            SequenceStepKind::Email => {
                let email = step.email.as_ref().ok_or_else(|| {
                    ApiError::Validation(format!("step {}: email config is required.", step.id))
                })?;
                let has_template = email
                    .template_id
                    .as_deref()
                    .is_some_and(|s| !s.trim().is_empty());
                let has_body = email.body.as_deref().is_some_and(|s| !s.trim().is_empty());
                if !has_template && !has_body {
                    return Err(ApiError::Validation(format!(
                        "step {}: email needs a templateId or an inline body.",
                        step.id
                    )));
                }
            }
            SequenceStepKind::Task => {
                let task = step.task.as_ref().ok_or_else(|| {
                    ApiError::Validation(format!("step {}: task config is required.", step.id))
                })?;
                if task.title.trim().is_empty() {
                    return Err(ApiError::Validation(format!(
                        "step {}: task title is required.",
                        step.id
                    )));
                }
            }
            SequenceStepKind::Wait => {
                if step.wait_days.unwrap_or(0) == 0 {
                    return Err(ApiError::Validation(format!(
                        "step {}: wait needs waitDays > 0.",
                        step.id
                    )));
                }
            }
        }
    }
    Ok(())
}

/// Serialize a typed value into BSON for storage.
fn to_bson_ctx<T: serde::Serialize>(value: &T, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(value).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

/// Map a Mongo error into an internal `ApiError` with collection context.
fn db_err(e: mongodb::error::Error, ctx: &'static str) -> ApiError {
    ApiError::Internal(anyhow::Error::new(e).context(ctx))
}

// ===========================================================================
// GET / — listSabcrmSequences
// ===========================================================================

/// `GET /v1/sabcrm/sequences` — list sequences for one project, newest first,
/// optionally narrowed by `status`. `page` is 1-based (default 1); `limit`
/// defaults to 50, capped at 200.
#[instrument(skip_all)]
pub async fn list_sequences(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(status) = opt_str(&query.status) {
        validate_sequence_status(status)?;
        filter.insert("status", status);
    }

    let page = query.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let limit_u = limit as u64;
    let skip = (page - 1).saturating_mul(limit_u);

    let coll = mongo.collection::<Document>(SEQUENCES_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.count"))?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.find"))?;

    let mut sequences = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.cursor"))?
    {
        sequences.push(record_to_wire(d));
    }

    Ok(Json(ListResponse {
        sequences,
        total,
        page,
        limit: limit_u,
    }))
}

// ===========================================================================
// POST / — createSabcrmSequence
// ===========================================================================

/// `POST /v1/sabcrm/sequences` — create a sequence definition. Steps are
/// validated for executability (see `validate_steps`); `status` defaults to
/// `active` and `settings` to `{ unenrollOnReply: true }`.
#[instrument(skip_all)]
pub async fn create_sequence(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateSequenceInput>,
) -> Result<Json<SequenceResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = require_str(&body.name, "name")?;

    let steps = body.steps.unwrap_or_default();
    validate_steps(&steps)?;

    let status = body.status.as_deref().map(str::trim).unwrap_or("active");
    validate_sequence_status(status)?;

    let settings = body.settings.unwrap_or_default();

    let now = Utc::now().to_rfc3339();
    let new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "name": name,
        "status": status,
        "steps": to_bson_ctx(&steps, "sabcrm_sequences.steps.to_bson")?,
        "settings": to_bson_ctx(&settings, "sabcrm_sequences.settings.to_bson")?,
        "createdAt": &now,
        "updatedAt": &now,
    };

    mongo
        .collection::<Document>(SEQUENCES_COLL)
        .insert_one(&new_doc)
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.insert_one"))?;

    Ok(Json(SequenceResponse {
        sequence: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// GET /{id} — getSabcrmSequence
// ===========================================================================

/// `GET /v1/sabcrm/sequences/{id}` — fetch one sequence scoped by project.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_sequence(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<SequenceResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let found = mongo
        .collection::<Document>(SEQUENCES_COLL)
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.find_one"))?
        .ok_or_else(|| ApiError::NotFound("sequence".to_owned()))?;

    Ok(Json(SequenceResponse {
        sequence: record_to_wire(found),
    }))
}

// ===========================================================================
// PATCH /{id} — updateSabcrmSequence
// ===========================================================================

/// `PATCH /v1/sabcrm/sequences/{id}` — partial update. `steps` / `settings` /
/// `status` are validated against the typed shapes when present; remaining
/// keys are `$set` verbatim and `updatedAt` is always bumped.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_sequence(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSequenceInput>,
) -> Result<Json<SequenceResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    if let Some(steps) = body.patch.get("steps") {
        let typed: Vec<SequenceStep> = serde_json::from_value(steps.clone()).map_err(|e| {
            ApiError::Validation(format!(
                "steps must be a list of {{ id, kind, email?/task?/waitDays? }}: {e}"
            ))
        })?;
        validate_steps(&typed)?;
    }
    if let Some(settings) = body.patch.get("settings") {
        serde_json::from_value::<SequenceSettings>(settings.clone()).map_err(|e| {
            ApiError::Validation(format!(
                "settings must be {{ unenrollOnReply?, unenrollOnStageChange? }}: {e}"
            ))
        })?;
    }
    if let Some(status) = body.patch.get("status") {
        let status = status.as_str().ok_or_else(|| {
            ApiError::Validation("status must be a string.".to_owned())
        })?;
        validate_sequence_status(status)?;
    }

    let now = Utc::now().to_rfc3339();
    let mut set = payload_to_set(&body.patch)?;
    set.insert("updatedAt", &now);

    let updated = mongo
        .collection::<Document>(SEQUENCES_COLL)
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.find_one_and_update"))?
        .ok_or_else(|| ApiError::NotFound("sequence".to_owned()))?;

    Ok(Json(SequenceResponse {
        sequence: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteSabcrmSequence
// ===========================================================================

/// `DELETE /v1/sabcrm/sequences/{id}` — delete a sequence and unenroll its
/// remaining `active` enrollments (they would otherwise dangle forever as
/// due-but-unrunnable rows in the scheduler).
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_sequence(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let deleted = mongo
        .collection::<Document>(SEQUENCES_COLL)
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.delete_one"))?;
    if deleted.deleted_count == 0 {
        return Err(ApiError::NotFound("sequence".to_owned()));
    }

    // Best-effort sweep: stop the orphaned active enrollments.
    let now = Utc::now().to_rfc3339();
    let _ = mongo
        .collection::<Document>(ENROLLMENTS_COLL)
        .update_many(
            doc! {
                "projectId": project_id,
                "sequenceId": oid.to_hex(),
                "status": "active",
            },
            doc! { "$set": {
                "status": "unenrolled",
                "unenrollCause": "sequence_deleted",
                "updatedAt": &now,
            } },
        )
        .await;

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{id}/enroll — enrollSabcrmSequence
// ===========================================================================

/// `POST /v1/sabcrm/sequences/{id}/enroll` — enroll record(s) into the
/// sequence. Idempotent per record: a record with an `active` enrollment in
/// this sequence is skipped, not duplicated. New enrollments start at
/// `currentStepIndex: 0` with `nextRunAt: now` (the scheduler executes the
/// first step on its next tick). `enrolledBy` is the caller (from the JWT).
#[instrument(skip_all, fields(id = %id))]
pub async fn enroll_records(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<EnrollInput>,
) -> Result<Json<EnrollResponse>> {
    let project_id = require_project(&body.project_id)?;
    let object_slug = require_str(&body.object_slug, "objectSlug")?;
    let sequence_oid = oid_from_str(&id)?;

    if body.record_ids.is_empty() {
        return Err(ApiError::Validation("recordIds must be non-empty.".to_owned()));
    }
    if body.record_ids.len() > MAX_ENROLL_BATCH {
        return Err(ApiError::Validation(format!(
            "recordIds is capped at {MAX_ENROLL_BATCH} per call."
        )));
    }

    // The sequence must exist in this project before anything is enrolled.
    let sequences = mongo.collection::<Document>(SEQUENCES_COLL);
    sequences
        .find_one(doc! { "projectId": project_id, "_id": sequence_oid })
        .await
        .map_err(|e| db_err(e, "sabcrm_sequences.enroll.find_one"))?
        .ok_or_else(|| ApiError::NotFound("sequence".to_owned()))?;

    let sequence_id = sequence_oid.to_hex();
    let coll = mongo.collection::<Document>(ENROLLMENTS_COLL);
    let now = Utc::now().to_rfc3339();

    let mut enrollments = Vec::new();
    let mut created: u64 = 0;
    let mut skipped: u64 = 0;

    for raw in &body.record_ids {
        let record_id = require_str(raw, "recordIds[] entry")?;
        // Stored record ids must at least be valid ObjectId hex.
        oid_from_str(record_id)?;

        // Idempotency: one ACTIVE enrollment per (sequence, record).
        let dedup = doc! {
            "projectId": project_id,
            "sequenceId": &sequence_id,
            "recordId": record_id,
            "status": "active",
        };
        if let Some(existing) = coll
            .find_one(dedup)
            .await
            .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.dedup.find_one"))?
        {
            skipped += 1;
            enrollments.push(record_to_wire(existing));
            continue;
        }

        let new_doc = doc! {
            "_id": ObjectId::new(),
            "projectId": project_id,
            "sequenceId": &sequence_id,
            "objectSlug": object_slug,
            "recordId": record_id,
            "currentStepIndex": 0_i64,
            "status": "active",
            "nextRunAt": &now,
            "enrolledBy": &user.user_id,
            "history": [],
            "createdAt": &now,
            "updatedAt": &now,
        };
        coll.insert_one(&new_doc)
            .await
            .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.insert_one"))?;
        created += 1;
        enrollments.push(record_to_wire(new_doc));
    }

    Ok(Json(EnrollResponse {
        enrollments,
        created,
        skipped,
    }))
}

// ===========================================================================
// POST /enrollments/{id}/unenroll — unenrollSabcrmEnrollment
// ===========================================================================

/// `POST /v1/sabcrm/sequences/enrollments/{id}/unenroll` — manually stop one
/// `active` enrollment. One-shot: completed / failed / already-unenrolled
/// enrollments `404`. The optional `reason` is appended to the history.
#[instrument(skip_all, fields(id = %id))]
pub async fn unenroll_enrollment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UnenrollInput>,
) -> Result<Json<EnrollmentResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let now = Utc::now().to_rfc3339();
    let outcome = match opt_str(&body.reason) {
        Some(reason) => format!("unenrolled:manual ({reason})"),
        None => "unenrolled:manual".to_owned(),
    };

    let updated = mongo
        .collection::<Document>(ENROLLMENTS_COLL)
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid, "status": "active" },
            doc! {
                "$set": {
                    "status": "unenrolled",
                    "unenrollCause": "manual",
                    "unenrolledBy": &user.user_id,
                    "unenrolledAt": &now,
                    "updatedAt": &now,
                },
                "$push": { "history": {
                    "stepId": Bson::Null,
                    "at": &now,
                    "outcome": outcome,
                } },
            },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.unenroll.find_one_and_update"))?
        .ok_or_else(|| ApiError::NotFound("active enrollment".to_owned()))?;

    Ok(Json(EnrollmentResponse {
        enrollment: record_to_wire(updated),
    }))
}

// ===========================================================================
// GET /enrollments — listSabcrmSequenceEnrollments
// ===========================================================================

/// `GET /v1/sabcrm/sequences/enrollments` — list enrollments for one project,
/// newest first, optionally narrowed by `sequenceId` / `objectSlug` /
/// `recordId` / `status`, paginated.
#[instrument(skip_all)]
pub async fn list_enrollments(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<EnrollmentListQuery>,
) -> Result<Json<EnrollmentListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(sequence_id) = opt_str(&query.sequence_id) {
        filter.insert("sequenceId", sequence_id);
    }
    if let Some(object_slug) = opt_str(&query.object_slug) {
        filter.insert("objectSlug", object_slug);
    }
    if let Some(record_id) = opt_str(&query.record_id) {
        filter.insert("recordId", record_id);
    }
    if let Some(status) = opt_str(&query.status) {
        if !ENROLLMENT_STATUSES.contains(&status) {
            return Err(ApiError::Validation(format!(
                "status must be one of {}.",
                ENROLLMENT_STATUSES.join(" / ")
            )));
        }
        filter.insert("status", status);
    }

    let page = query.page.filter(|p| *p > 0).unwrap_or(1);
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let limit_u = limit as u64;
    let skip = (page - 1).saturating_mul(limit_u);

    let coll = mongo.collection::<Document>(ENROLLMENTS_COLL);

    let total = coll
        .count_documents(filter.clone())
        .await
        .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.count"))?;

    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit)
        .await
        .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.find"))?;

    let mut enrollments = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| db_err(e, "sabcrm_sequence_enrollments.cursor"))?
    {
        enrollments.push(record_to_wire(d));
    }

    Ok(Json(EnrollmentListResponse {
        enrollments,
        total,
        page,
        limit: limit_u,
    }))
}
