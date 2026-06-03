//! HTTP handlers for the CrmSetting entity.

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
    CreateSettingInput, CreateSettingResponse, DeleteSettingResponse, ListQuery, UpdateSettingInput,
};
use crate::types::CrmSetting;

const COLL: &str = "crm_settings";
const ENTITY_KIND: &str = "setting";

fn list_filter(user_id: ObjectId, status: Option<&str>, category: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(c) = category.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn setting_from_create(input: CreateSettingInput, user_id: ObjectId) -> Result<CrmSetting> {
    let key = input.key.trim();
    if key.is_empty() {
        return Err(ApiError::Validation("key is required".to_owned()));
    }
    Ok(CrmSetting {
        id: None,
        user_id,
        key: key.to_owned(),
        value: input.value,
        category: input
            .category
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        description: input.description,
        is_secret: input.is_secret.unwrap_or(false),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSettingInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.key {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("key cannot be empty".to_owned()));
        }
        set.insert("key", trimmed);
    }
    if let Some(v) = patch.value {
        set.insert("value", v);
    }
    if let Some(v) = patch.category {
        set.insert("category", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.is_secret {
        set.insert("isSecret", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmSetting) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSetting>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_settings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.category.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["key", "category", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "category": 1, "key": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmSetting>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.find")))?;
    let mut rows: Vec<CrmSetting> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn get_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
) -> Result<Json<CrmSetting>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmSetting>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("setting".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSettingInput>,
) -> Result<Json<CreateSettingResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = setting_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSetting>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSettingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn update_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
    Json(patch): Json<UpdateSettingInput>,
) -> Result<Json<CrmSetting>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmSetting>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.find_one")))?
        .ok_or_else(|| ApiError::NotFound("setting".to_owned()))?;
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("setting".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.refetch")))?
        .ok_or_else(|| ApiError::NotFound("setting".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %setting_id))]
pub async fn delete_setting(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(setting_id): Path<String>,
) -> Result<Json<DeleteSettingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&setting_id)?;
    let coll = mongo.collection::<CrmSetting>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_settings.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("setting".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSettingResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("status"));
        // category is optional and should not be present when not supplied.
        assert!(!f.contains_key("category"));
    }

    #[test]
    fn list_filter_narrows_by_category_and_all_status() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"), Some("general"));
        assert_eq!(f.get_str("category").ok(), Some("general"));
        // "all" must not narrow by status.
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn setting_from_create_rejects_empty_key() {
        let user_id = ObjectId::new();
        let input = CreateSettingInput {
            key: "   ".into(),
            ..Default::default()
        };
        assert!(setting_from_create(input, user_id).is_err());
    }
}
