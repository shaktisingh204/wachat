//! HTTP handlers for BugSavedFilter.

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
    CreateFilterInput, CreateFilterResponse, DeleteFilterResponse, ListQuery, UpdateFilterInput,
};
use crate::types::BugSavedFilter;

const COLL: &str = "sabbugs_saved_filters";
const ENTITY_KIND: &str = "bug_saved_filter";

fn list_filter(user_id: ObjectId, caller: ObjectId, q: &ListQuery) -> Document {
    let mut filter = doc! { "userId": user_id, "status": { "$ne": "archived" } };
    if q.mine_only.unwrap_or(false) {
        filter.insert("ownerId", caller);
    } else {
        // Visible: owned by caller OR shared.
        filter.insert(
            "$or",
            vec![
                Bson::Document(doc! { "ownerId": caller }),
                Bson::Document(doc! { "isShared": true }),
            ],
        );
    }
    filter
}

fn ownership_filter(user_id: ObjectId, caller: ObjectId, oid: ObjectId) -> Document {
    // Tenant + owner — only the owner can mutate / delete their filter.
    doc! { "_id": oid, "userId": user_id, "ownerId": caller }
}

fn filter_from_create(input: CreateFilterInput, user_id: ObjectId) -> Result<BugSavedFilter> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(BugSavedFilter {
        id: None,
        user_id,
        owner_id: user_id,
        name: input.name.trim().to_owned(),
        query_json: input.query_json,
        is_shared: input.is_shared.unwrap_or(false),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateFilterInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be blank".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.query_json {
        let bson_v = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("saved_filter.query_json.bson"))
        })?;
        set.insert("queryJson", bson_v);
    }
    if let Some(v) = patch.is_shared {
        set.insert("isShared", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &BugSavedFilter) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BugSavedFilter>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_filters(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, user_id, &q);
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("nameMatch", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BugSavedFilter>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_saved_filters.find"))
    })?;
    let mut rows: Vec<BugSavedFilter> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_saved_filters.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_filter(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFilterInput>,
) -> Result<Json<CreateFilterResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = filter_from_create(input, user_id)?;
    let coll = mongo.collection::<BugSavedFilter>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_saved_filters.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateFilterResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %filter_id))]
pub async fn update_filter(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(filter_id): Path<String>,
    Json(patch): Json<UpdateFilterInput>,
) -> Result<Json<BugSavedFilter>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&filter_id)?;
    let coll = mongo.collection::<BugSavedFilter>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabbugs_saved_filters.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("saved_filter".to_owned()))?;
    let update = build_update_doc(patch)?;
    coll.update_one(ownership_filter(user_id, user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_saved_filters.update"))
        })?;
    let after = coll
        .find_one(ownership_filter(user_id, user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabbugs_saved_filters.refetch"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("saved_filter".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %filter_id))]
pub async fn delete_filter(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(filter_id): Path<String>,
) -> Result<Json<DeleteFilterResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&filter_id)?;
    let coll = mongo.collection::<BugSavedFilter>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_saved_filters.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("saved_filter".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteFilterResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filter_from_create_defaults_unshared() {
        let user_id = ObjectId::new();
        let f = filter_from_create(
            CreateFilterInput {
                name: "My open bugs".into(),
                query_json: serde_json::json!({ "status": "open" }),
                is_shared: None,
            },
            user_id,
        )
        .unwrap();
        assert!(!f.is_shared);
        assert_eq!(f.status, "active");
        assert_eq!(f.owner_id, user_id);
    }

    #[test]
    fn filter_rejects_empty_name() {
        let user_id = ObjectId::new();
        assert!(
            filter_from_create(
                CreateFilterInput {
                    name: " ".into(),
                    query_json: serde_json::json!({}),
                    is_shared: None,
                },
                user_id,
            )
            .is_err()
        );
    }

    #[test]
    fn update_rejects_blank_rename() {
        let patch = UpdateFilterInput {
            name: Some(" ".into()),
            ..Default::default()
        };
        assert!(build_update_doc(patch).is_err());
    }
}
