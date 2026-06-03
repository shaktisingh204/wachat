//! HTTP handlers for the SavedView entity.

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
    CreateSavedViewInput, CreateSavedViewResponse, DeleteSavedViewResponse, ListQuery,
    UpdateSavedViewInput,
};
use crate::types::CrmSavedView;

const COLL: &str = "crm_saved_views";
const ENTITY_KIND: &str = "saved_view";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    entity: Option<&str>,
    scope: Option<&str>,
) -> Document {
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
    if let Some(e) = entity.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("entity", e);
    }
    if let Some(s) = scope.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("scope", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn view_from_create(input: CreateSavedViewInput, user_id: ObjectId) -> Result<CrmSavedView> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let entity = input.entity.trim();
    if entity.is_empty() {
        return Err(ApiError::Validation("entity is required".to_owned()));
    }
    let scope = input.scope.unwrap_or_else(|| "private".to_owned());
    if scope != "private" && scope != "shared" {
        return Err(ApiError::Validation(
            "scope must be 'private' or 'shared'".to_owned(),
        ));
    }
    Ok(CrmSavedView {
        id: None,
        user_id,
        name: name.to_owned(),
        entity: entity.to_owned(),
        filters: input.filters,
        columns: input.columns.unwrap_or_default(),
        sort: input.sort,
        scope,
        is_default: input.is_default.unwrap_or(false),
        owner_id: Some(user_id),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSavedViewInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.entity {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("entity cannot be empty".to_owned()));
        }
        set.insert("entity", trimmed);
    }
    if let Some(v) = patch.filters {
        set.insert("filters", v);
    }
    if let Some(v) = patch.columns {
        set.insert("columns", v);
    }
    if let Some(v) = patch.sort {
        set.insert("sort", v);
    }
    if let Some(v) = patch.scope {
        if v != "private" && v != "shared" {
            return Err(ApiError::Validation(
                "scope must be 'private' or 'shared'".to_owned(),
            ));
        }
        set.insert("scope", v);
    }
    if let Some(v) = patch.is_default {
        set.insert("isDefault", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmSavedView) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSavedView>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_views(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.entity.as_deref(),
        q.scope.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "entity"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "isDefault": -1, "name": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmSavedView>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.find"))
        })?;
    let mut rows: Vec<CrmSavedView> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn get_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
) -> Result<Json<CrmSavedView>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<CrmSavedView>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.find_one")))?
        .ok_or_else(|| ApiError::NotFound("saved_view".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSavedViewInput>,
) -> Result<Json<CreateSavedViewResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = view_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSavedView>(COLL);
    if entity.is_default {
        // Demote any existing defaults for this {user, entity} pair.
        let _ = coll
            .update_many(
                doc! { "userId": user_id, "entity": &entity.entity, "isDefault": true },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSavedViewResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn update_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
    Json(patch): Json<UpdateSavedViewInput>,
) -> Result<Json<CrmSavedView>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<CrmSavedView>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.find_one")))?
        .ok_or_else(|| ApiError::NotFound("saved_view".to_owned()))?;
    // If the patch marks this view as default, demote peers for the
    // same {user, entity} pair (using the patched entity if provided).
    if matches!(patch.is_default, Some(true)) {
        let demote_entity = patch
            .entity
            .clone()
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| before.entity.clone());
        let _ = coll
            .update_many(
                doc! {
                    "userId": user_id,
                    "entity": demote_entity,
                    "isDefault": true,
                    "_id": { "$ne": oid },
                },
                doc! { "$set": { "isDefault": false } },
            )
            .await;
    }
    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("saved_view".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.refetch")))?
        .ok_or_else(|| ApiError::NotFound("saved_view".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %view_id))]
pub async fn delete_view(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(view_id): Path<String>,
) -> Result<Json<DeleteSavedViewResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&view_id)?;
    let coll = mongo.collection::<CrmSavedView>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isDefault": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_saved_views.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("saved_view".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSavedViewResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        // entity is optional and should not be present when not supplied.
        assert!(!f.contains_key("entity"));
    }

    #[test]
    fn list_filter_narrows_by_entity_and_scope() {
        let oid = ObjectId::new();
        let f = list_filter(oid, Some("all"), Some("leads"), Some("shared"));
        assert_eq!(f.get_str("entity").ok(), Some("leads"));
        assert_eq!(f.get_str("scope").ok(), Some("shared"));
        // "all" must not narrow by status.
        assert!(!f.contains_key("status"));
    }

    #[test]
    fn view_from_create_defaults_scope_and_status() {
        let user_id = ObjectId::new();
        let input = CreateSavedViewInput {
            name: "My Leads".into(),
            entity: "leads".into(),
            ..Default::default()
        };
        let v = view_from_create(input, user_id).unwrap();
        assert_eq!(v.scope, "private");
        assert_eq!(v.status, "active");
        assert!(!v.is_default);
        assert_eq!(v.owner_id, Some(user_id));
    }
}
