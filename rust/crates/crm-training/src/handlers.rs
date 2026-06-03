//! HTTP handlers for the Training entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateTrainingInput, CreateTrainingResponse, DeleteTrainingResponse, ListQuery,
    UpdateTrainingInput,
};
use crate::types::CrmTraining;

const COLL: &str = "crm_trainings";
const ENTITY_KIND: &str = "training";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    training_type: Option<&str>,
    is_mandatory: Option<bool>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "planned" | "open_for_enrollment" | "in_progress" | "completed" | "cancelled" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = training_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("trainingType", t);
    }
    if let Some(m) = is_mandatory {
        filter.insert("isMandatory", m);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn parse_oid_vec(v: Vec<String>) -> Vec<ObjectId> {
    v.into_iter()
        .filter_map(|s| ObjectId::parse_str(s).ok())
        .collect()
}

/// Returns `value` clamped to `[0, max]` if `max` is `Some`, else `max(value, 0)`.
fn clamp_counter(value: i32, max: Option<i32>) -> i32 {
    let v = value.max(0);
    match max {
        Some(m) if m >= 0 => v.min(m),
        _ => v,
    }
}

fn training_from_create(input: CreateTrainingInput, user_id: ObjectId) -> Result<CrmTraining> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let max_participants = input.max_participants;
    Ok(CrmTraining {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        training_type: input.training_type,
        delivery_mode: input.delivery_mode,
        trainer_name: input.trainer_name,
        trainer_id: input
            .trainer_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        provider: input.provider,
        start_date: input.start_date.as_deref().and_then(parse_date),
        end_date: input.end_date.as_deref().and_then(parse_date),
        duration_hours: input.duration_hours,
        location: input.location,
        max_participants,
        enrolled: 0,
        completed: 0,
        cost_per_person: input.cost_per_person,
        currency: input.currency,
        certification_provided: input.certification_provided.unwrap_or(false),
        materials_url: input.materials_url,
        is_mandatory: input.is_mandatory.unwrap_or(false),
        department_ids: input.department_ids.map(parse_oid_vec).unwrap_or_default(),
        status: "planned".to_owned(),
        tags: input.tags.unwrap_or_default(),
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateTrainingInput, current: &CrmTraining) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    let effective_max = patch.max_participants.or(current.max_participants);

    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.training_type {
        set.insert("trainingType", v);
    }
    if let Some(v) = patch.delivery_mode {
        set.insert("deliveryMode", v);
    }
    if let Some(v) = patch.trainer_name {
        set.insert("trainerName", v);
    }
    if let Some(v) = patch
        .trainer_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("trainerId", v);
    }
    if let Some(v) = patch.provider {
        set.insert("provider", v);
    }
    if let Some(v) = patch.start_date.as_deref().and_then(parse_date) {
        set.insert("startDate", v);
    }
    if let Some(v) = patch.end_date.as_deref().and_then(parse_date) {
        set.insert("endDate", v);
    }
    if let Some(v) = patch.duration_hours {
        set.insert("durationHours", v);
    }
    if let Some(v) = patch.location {
        set.insert("location", v);
    }
    if let Some(v) = patch.max_participants {
        set.insert("maxParticipants", v);
    }
    if let Some(v) = patch.enrolled {
        set.insert("enrolled", clamp_counter(v, effective_max));
    }
    if let Some(v) = patch.completed {
        set.insert("completed", clamp_counter(v, effective_max));
    }
    if let Some(v) = patch.cost_per_person {
        set.insert("costPerPerson", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.certification_provided {
        set.insert("certificationProvided", v);
    }
    if let Some(v) = patch.materials_url {
        set.insert("materialsUrl", v);
    }
    if let Some(v) = patch.is_mandatory {
        set.insert("isMandatory", v);
    }
    if let Some(v) = patch.department_ids {
        set.insert("departmentIds", parse_oid_vec(v));
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.tags {
        set.insert("tags", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTraining) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTraining>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_trainings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.training_type.as_deref(),
        q.is_mandatory,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["name", "description", "trainerName", "provider", "location"],
        );
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmTraining>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.find")))?;
    let mut rows: Vec<CrmTraining> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.collect")))?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %training_id))]
pub async fn get_training(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(training_id): Path<String>,
) -> Result<Json<CrmTraining>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&training_id)?;
    let coll = mongo.collection::<CrmTraining>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("training".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_training(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTrainingInput>,
) -> Result<Json<CreateTrainingResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = training_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmTraining>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateTrainingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %training_id))]
pub async fn update_training(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(training_id): Path<String>,
    Json(patch): Json<UpdateTrainingInput>,
) -> Result<Json<CrmTraining>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&training_id)?;
    let coll = mongo.collection::<CrmTraining>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("training".to_owned()))?;
    if let Some(ref n) = patch.name {
        if n.trim().is_empty() {
            return Err(ApiError::Validation("name must not be empty".to_owned()));
        }
    }
    let update = build_update_doc(patch, &before);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("training".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.refetch")))?
        .ok_or_else(|| ApiError::NotFound("training".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %training_id))]
pub async fn delete_training(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(training_id): Path<String>,
) -> Result<Json<DeleteTrainingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&training_id)?;
    let coll = mongo.collection::<CrmTraining>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_trainings.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("training".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteTrainingResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn training_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateTrainingInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(training_from_create(input, user_id).is_err());
    }

    #[test]
    fn training_from_create_defaults_status_and_counters() {
        let user_id = ObjectId::new();
        let input = CreateTrainingInput {
            name: "React 101".into(),
            ..Default::default()
        };
        let t = training_from_create(input, user_id).unwrap();
        assert_eq!(t.status, "planned");
        assert_eq!(t.enrolled, 0);
        assert_eq!(t.completed, 0);
        assert!(!t.is_mandatory);
        assert!(!t.certification_provided);
    }

    #[test]
    fn clamp_counter_respects_max_participants() {
        // negative becomes 0
        assert_eq!(clamp_counter(-5, None), 0);
        // no cap → passes through
        assert_eq!(clamp_counter(50, None), 50);
        // cap clamps high values
        assert_eq!(clamp_counter(50, Some(20)), 20);
        // value within cap passes through
        assert_eq!(clamp_counter(10, Some(20)), 10);
    }
}
