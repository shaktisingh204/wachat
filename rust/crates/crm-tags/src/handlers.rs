//! HTTP handlers for the Tag foundational entity.

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

use crate::dto::{CreateTagInput, CreateTagResponse, DeleteTagResponse, ListQuery, UpdateTagInput};
use crate::types::CrmTag;

const COLL: &str = "crm_tags";
const ENTITY_KIND: &str = "tag";

fn list_filter(user_id: ObjectId, status: Option<&str>, scope: Option<&str>) -> Document {
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
    if let Some(s) = scope
        .map(str::trim)
        .filter(|s| !s.is_empty() && *s != "all")
    {
        filter.insert("scope", s);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn tag_from_create(input: CreateTagInput, user_id: ObjectId) -> CrmTag {
    CrmTag {
        id: None,
        user_id,
        name: input.name,
        color: input.color,
        description: input.description,
        scope: input.scope,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateTagInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.scope {
        set.insert("scope", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmTag) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmTag>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tags(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.scope.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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

    let coll = mongo.collection::<CrmTag>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.find")))?;
    let mut rows: Vec<CrmTag> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, tag_id = %tag_id))]
pub async fn get_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
) -> Result<Json<CrmTag>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;

    let coll = mongo.collection::<CrmTag>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateTagInput>,
) -> Result<Json<CreateTagResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut entity = tag_from_create(input, user_id);
    let coll = mongo.collection::<CrmTag>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }

    Ok(Json(CreateTagResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, tag_id = %tag_id))]
pub async fn update_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
    Json(patch): Json<UpdateTagInput>,
) -> Result<Json<CrmTag>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;

    let coll = mongo.collection::<CrmTag>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.find_one")))?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tag".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.refetch")))?
        .ok_or_else(|| ApiError::NotFound("tag".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, tag_id = %tag_id))]
pub async fn delete_tag(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(tag_id): Path<String>,
) -> Result<Json<DeleteTagResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&tag_id)?;

    let coll = mongo.collection::<CrmTag>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_tags.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("tag".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteTagResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_with_scope() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("lead"));
        assert_eq!(f.get_str("scope").unwrap(), "lead");
    }

    #[test]
    fn list_filter_scope_all_omits_scope_clause() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("all"));
        assert!(!f.contains_key("scope"));
    }

    #[test]
    fn tag_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateTagInput {
            name: "Hot".into(),
            ..Default::default()
        };
        let t = tag_from_create(input, user_id);
        assert_eq!(t.status.as_deref(), Some("active"));
    }
}
