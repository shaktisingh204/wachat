//! HTTP handlers for the Recognition entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
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
    CreateRecognitionInput, CreateRecognitionResponse, DeleteRecognitionResponse, ListQuery,
    UpdateRecognitionInput,
};
use crate::types::CrmRecognition;

const COLL: &str = "crm_recognitions";
const ENTITY_KIND: &str = "recognition";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "pending" => {
            filter.insert("status", "pending");
        }
        "approved" => {
            filter.insert("status", "approved");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn entity_from_create(input: CreateRecognitionInput, user_id: ObjectId) -> Result<CrmRecognition> {
    if input.to_employee_name.trim().is_empty() {
        return Err(ApiError::Validation(
            "toEmployeeName is required".to_owned(),
        ));
    }
    if input.message.trim().is_empty() {
        return Err(ApiError::Validation("message is required".to_owned()));
    }
    Ok(CrmRecognition {
        id: None,
        user_id,
        from_employee_id: input.from_employee_id,
        from_employee_name: input.from_employee_name,
        to_employee_id: input.to_employee_id,
        to_employee_name: Some(input.to_employee_name.trim().to_string()),
        category: input.category,
        message: Some(input.message.trim().to_string()),
        badge_url: input.badge_url,
        points: input.points,
        is_public: input.is_public,
        award_program_id: input.award_program_id,
        status: Some(input.status.unwrap_or_else(|| "approved".to_owned())),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRecognitionInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.from_employee_id {
        set.insert("fromEmployeeId", v);
    }
    if let Some(v) = patch.from_employee_name {
        set.insert("fromEmployeeName", v);
    }
    if let Some(v) = patch.to_employee_id {
        set.insert("toEmployeeId", v);
    }
    if let Some(v) = patch.to_employee_name {
        set.insert("toEmployeeName", v.trim());
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.message {
        set.insert("message", v.trim());
    }
    if let Some(v) = patch.badge_url {
        set.insert("badgeUrl", v);
    }
    if let Some(v) = patch.points {
        set.insert("points", v);
    }
    if let Some(v) = patch.is_public {
        set.insert("isPublic", v);
    }
    if let Some(v) = patch.award_program_id {
        set.insert("awardProgramId", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmRecognition) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmRecognition>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_recognitions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(cat) = q
        .category
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        filter.insert("category", cat);
    }
    if let Some(is_public) = q.is_public {
        filter.insert("isPublic", is_public);
    }
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["message", "toEmployeeName", "fromEmployeeName"]);
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

    let coll = mongo.collection::<CrmRecognition>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.find"))
        })?;
    let mut rows: Vec<CrmRecognition> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.collect"))
    })?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recognition_id))]
pub async fn get_recognition(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recognition_id): Path<String>,
) -> Result<Json<CrmRecognition>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recognition_id)?;
    let coll = mongo.collection::<CrmRecognition>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recognition".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_recognition(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRecognitionInput>,
) -> Result<Json<CreateRecognitionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = entity_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmRecognition>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateRecognitionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recognition_id))]
pub async fn update_recognition(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recognition_id): Path<String>,
    Json(patch): Json<UpdateRecognitionInput>,
) -> Result<Json<CrmRecognition>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recognition_id)?;

    let coll = mongo.collection::<CrmRecognition>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recognition".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("recognition".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.refetch")))?
        .ok_or_else(|| ApiError::NotFound("recognition".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %recognition_id))]
pub async fn delete_recognition(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recognition_id): Path<String>,
) -> Result<Json<DeleteRecognitionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recognition_id)?;

    let coll = mongo.collection::<CrmRecognition>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_recognitions.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("recognition".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteRecognitionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn entity_from_create_stamps_default_status() {
        let user_id = ObjectId::new();
        let input = CreateRecognitionInput {
            to_employee_name: "Alice".into(),
            message: "Great work on the launch".into(),
            ..Default::default()
        };
        let r = entity_from_create(input, user_id).unwrap();
        assert_eq!(r.status.as_deref(), Some("approved"));
        assert_eq!(r.to_employee_name.as_deref(), Some("Alice"));
    }

    #[test]
    fn entity_from_create_rejects_empty_recipient() {
        let user_id = ObjectId::new();
        let input = CreateRecognitionInput {
            to_employee_name: "  ".into(),
            message: "x".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }

    #[test]
    fn entity_from_create_rejects_empty_message() {
        let user_id = ObjectId::new();
        let input = CreateRecognitionInput {
            to_employee_name: "Alice".into(),
            message: "  ".into(),
            ..Default::default()
        };
        assert!(entity_from_create(input, user_id).is_err());
    }
}
