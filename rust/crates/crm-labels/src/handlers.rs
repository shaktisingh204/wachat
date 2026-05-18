//! HTTP handlers for the Label foundational entity.

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
    CreateLabelInput, CreateLabelResponse, DeleteLabelResponse, ListQuery, UpdateLabelInput,
};
use crate::types::CrmLabel;

const COLL: &str = "crm_labels";
const ENTITY_KIND: &str = "label";

fn list_filter(user_id: ObjectId, status: Option<&str>, entity_kind: Option<&str>) -> Document {
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
    if let Some(k) = entity_kind.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("entityKind", k);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn label_from_create(input: CreateLabelInput, user_id: ObjectId) -> CrmLabel {
    CrmLabel {
        id: None,
        user_id,
        name: input.name,
        color: input.color,
        icon: input.icon,
        description: input.description,
        entity_kind: input.entity_kind,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
        status: Some("active".to_owned()),
    }
}

fn build_update_doc(patch: UpdateLabelInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.icon {
        set.insert("icon", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.entity_kind {
        set.insert("entityKind", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmLabel) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmLabel>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_labels(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.entity_kind.as_deref());
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

    let coll = mongo.collection::<CrmLabel>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.find")))?;
    let mut rows: Vec<CrmLabel> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.collect")))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn get_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
) -> Result<Json<CrmLabel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmLabel>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.find_one")))?
        .ok_or_else(|| ApiError::NotFound("label".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateLabelInput>,
) -> Result<Json<CreateLabelResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }

    let mut entity = label_from_create(input, user_id);
    let coll = mongo.collection::<CrmLabel>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.insert")))?;
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

    Ok(Json(CreateLabelResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn update_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
    Json(patch): Json<UpdateLabelInput>,
) -> Result<Json<CrmLabel>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmLabel>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.find_one")))?
        .ok_or_else(|| ApiError::NotFound("label".to_owned()))?;

    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("label".to_owned()));
    }

    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.refetch")))?
        .ok_or_else(|| ApiError::NotFound("label".to_owned()))?;

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

#[instrument(skip_all, fields(user_id = %user.user_id, label_id = %label_id))]
pub async fn delete_label(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(label_id): Path<String>,
) -> Result<Json<DeleteLabelResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&label_id)?;

    let coll = mongo.collection::<CrmLabel>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_labels.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("label".to_owned()));
    }

    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }

    Ok(Json(DeleteLabelResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn label_from_create_stamps_active_status() {
        let user_id = ObjectId::new();
        let input = CreateLabelInput {
            name: "VIP".into(),
            ..Default::default()
        };
        let l = label_from_create(input, user_id);
        assert_eq!(l.status.as_deref(), Some("active"));
    }

    #[test]
    fn list_filter_scopes_by_entity_kind() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("task"));
        assert_eq!(f.get_str("entityKind").unwrap(), "task");
    }

    #[test]
    fn list_filter_omits_entity_kind_when_blank() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, Some("  "));
        assert!(!f.contains_key("entityKind"));
    }
}
