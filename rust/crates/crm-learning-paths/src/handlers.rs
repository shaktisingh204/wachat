//! HTTP handlers for the Learning Path entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, DateTime as BsonDateTime, Document, doc, oid::ObjectId};
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
    CreateLearningPathInput, CreateLearningPathResponse, DeleteLearningPathResponse, ListQuery,
    UpdateLearningPathInput,
};
use crate::types::CrmLearningPath;

const COLL: &str = "crm_learning_paths";
const ENTITY_KIND: &str = "learning_path";

const VALID_STATUSES: [&str; 3] = ["draft", "active", "archived"];
const VALID_AUDIENCES: [&str; 3] = ["all", "department", "role"];

fn normalise_status(s: Option<String>) -> String {
    match s.as_deref().map(str::trim) {
        Some(v) if VALID_STATUSES.contains(&v) => v.to_owned(),
        _ => "draft".to_owned(),
    }
}

fn normalise_audience(s: Option<String>) -> String {
    match s.as_deref().map(str::trim) {
        Some(v) if VALID_AUDIENCES.contains(&v) => v.to_owned(),
        _ => "all".to_owned(),
    }
}

fn list_filter(user_id: ObjectId, status: Option<&str>, audience: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" => {
            filter.insert("status", "draft");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(a) = audience.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("target_audience", a);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn path_from_create(input: CreateLearningPathInput, user_id: ObjectId) -> Result<CrmLearningPath> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmLearningPath {
        id: None,
        user_id,
        name: input.name.trim().to_string(),
        description: input.description,
        target_audience: normalise_audience(input.target_audience),
        trainings: input
            .trainings
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .collect(),
        duration_weeks: input.duration_weeks,
        is_mandatory: input.is_mandatory,
        status: normalise_status(input.status),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateLearningPathInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v.trim());
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.target_audience {
        set.insert("target_audience", normalise_audience(Some(v)));
    }
    if let Some(v) = patch.trainings {
        let cleaned: Vec<Bson> = v
            .into_iter()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .map(Bson::String)
            .collect();
        set.insert("trainings", Bson::Array(cleaned));
    }
    if let Some(v) = patch.duration_weeks {
        set.insert("duration_weeks", v);
    }
    if let Some(v) = patch.is_mandatory {
        set.insert("is_mandatory", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", normalise_status(Some(v)));
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmLearningPath) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmLearningPath>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_learning_paths(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.target_audience.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);

    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "_id": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<CrmLearningPath>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.find"))
    })?;
    let mut rows: Vec<CrmLearningPath> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %path_id))]
pub async fn get_learning_path(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(path_id): Path<String>,
) -> Result<Json<CrmLearningPath>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&path_id)?;
    let coll = mongo.collection::<CrmLearningPath>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("learning_path".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_learning_path(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLearningPathInput>,
) -> Result<Json<CreateLearningPathResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = path_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmLearningPath>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.insert"))
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

    Ok(Json(CreateLearningPathResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %path_id))]
pub async fn update_learning_path(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(path_id): Path<String>,
    Json(patch): Json<UpdateLearningPathInput>,
) -> Result<Json<CrmLearningPath>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&path_id)?;

    let coll = mongo.collection::<CrmLearningPath>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("learning_path".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("learning_path".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("learning_path".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %path_id))]
pub async fn delete_learning_path(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(path_id): Path<String>,
) -> Result<Json<DeleteLearningPathResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&path_id)?;

    let coll = mongo.collection::<CrmLearningPath>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_learning_paths.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("learning_path".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteLearningPathResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn list_filter_filters_by_audience() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("active"), Some("department"));
        assert_eq!(f.get_str("target_audience").ok(), Some("department"));
        assert_eq!(f.get_str("status").ok(), Some("active"));
    }

    #[test]
    fn path_from_create_defaults_and_trims_trainings() {
        let user_id = ObjectId::new();
        let input = CreateLearningPathInput {
            name: "Onboarding".into(),
            trainings: vec!["t1".into(), "  ".into(), " t2 ".into()],
            ..Default::default()
        };
        let p = path_from_create(input, user_id).unwrap();
        assert_eq!(p.status, "draft");
        assert_eq!(p.target_audience, "all");
        assert_eq!(p.trainings, vec!["t1".to_owned(), "t2".to_owned()]);
    }

    #[test]
    fn path_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateLearningPathInput {
            name: "  ".into(),
            ..Default::default()
        };
        assert!(path_from_create(input, user_id).is_err());
    }

    #[test]
    fn normalise_audience_rejects_unknown_values() {
        assert_eq!(normalise_audience(Some("everyone".into())), "all");
        assert_eq!(normalise_audience(Some("role".into())), "role");
    }
}
