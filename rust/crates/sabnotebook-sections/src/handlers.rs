//! HTTP handlers for SabNotebook sections.

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
    CreateSectionInput, CreateSectionResponse, DeleteSectionResponse, ListQuery,
    UpdateSectionInput,
};
use crate::types::SabnotebookSection;

const COLL: &str = "sabnotebook_sections";
const ENTITY_KIND: &str = "sabnotebook_section";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn list_filter(
    user_id: ObjectId,
    notebook_id: Option<&str>,
    status: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(p) = notebook_id.map(str::trim).filter(|s| !s.is_empty()) {
        if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("notebookId", oid);
        }
    }
    match status.unwrap_or("active") {
        "all" => {}
        "archived" => {
            filter.insert("archived", true);
        }
        _ => {
            filter.insert("archived", doc! { "$ne": true });
        }
    }
    filter
}

fn section_from_create(
    input: CreateSectionInput,
    user_id: ObjectId,
) -> Result<SabnotebookSection> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let notebook_oid = ObjectId::parse_str(&input.notebook_id)
        .map_err(|_| ApiError::Validation("notebookId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    Ok(SabnotebookSection {
        id: None,
        user_id,
        notebook_id: notebook_oid,
        name: input.name.trim().to_owned(),
        order: input.order.unwrap_or(0),
        color: input.color,
        archived: false,
        created_at: now,
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSectionInput) -> Document {
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.order {
        set.insert("order", v);
    }
    if let Some(v) = patch.color {
        set.insert("color", v);
    }
    if let Some(v) = patch.archived {
        set.insert("archived", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &SabnotebookSection) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabnotebookSection>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sections(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.notebook_id.as_deref(), q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "order": 1, "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabnotebookSection>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.find"))
    })?;
    let mut rows: Vec<SabnotebookSection> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %section_id))]
pub async fn get_section(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(section_id): Path<String>,
) -> Result<Json<SabnotebookSection>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&section_id)?;
    let coll = mongo.collection::<SabnotebookSection>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("section".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_section(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSectionInput>,
) -> Result<Json<CreateSectionResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = section_from_create(input, user_id)?;
    let coll = mongo.collection::<SabnotebookSection>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.insert"))
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
    Ok(Json(CreateSectionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %section_id))]
pub async fn update_section(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(section_id): Path<String>,
    Json(patch): Json<UpdateSectionInput>,
) -> Result<Json<SabnotebookSection>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&section_id)?;
    let coll = mongo.collection::<SabnotebookSection>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("section".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("section".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("section".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %section_id))]
pub async fn delete_section(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(section_id): Path<String>,
) -> Result<Json<DeleteSectionResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&section_id)?;
    let coll = mongo.collection::<SabnotebookSection>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "archived": true,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabnotebook_sections.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("section".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSectionResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateSectionInput {
            notebook_id: ObjectId::new().to_hex(),
            name: "  ".into(),
            ..Default::default()
        };
        assert!(section_from_create(input, user_id).is_err());
    }

    #[test]
    fn section_from_create_rejects_bad_notebook_oid() {
        let user_id = ObjectId::new();
        let input = CreateSectionInput {
            notebook_id: "not-an-oid".into(),
            name: "Inbox".into(),
            ..Default::default()
        };
        assert!(section_from_create(input, user_id).is_err());
    }

    #[test]
    fn section_from_create_defaults_order_zero() {
        let user_id = ObjectId::new();
        let input = CreateSectionInput {
            notebook_id: ObjectId::new().to_hex(),
            name: "Ideas".into(),
            ..Default::default()
        };
        let s = section_from_create(input, user_id).unwrap();
        assert_eq!(s.order, 0);
        assert!(!s.archived);
    }
}
