//! HTTP handlers for the Automation entity.

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
    CreateAutomationInput, CreateAutomationResponse, DeleteAutomationResponse, ListQuery,
    UpdateAutomationInput,
};
use crate::types::CrmAutomation;

const COLL: &str = "crm_automations";
const ENTITY_KIND: &str = "automation";

fn list_filter(user_id: ObjectId, status: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "active" | "paused" => {
            filter.insert("status", status.unwrap());
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

fn automation_from_create(
    input: CreateAutomationInput,
    user_id: ObjectId,
) -> Result<CrmAutomation> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmAutomation {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        description: input.description,
        nodes: input.nodes.unwrap_or_default(),
        edges: input.edges.unwrap_or_default(),
        status: input.status.unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAutomationInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.nodes {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|n| bson::to_document(&n).ok())
            .collect();
        set.insert("nodes", arr);
    }
    if let Some(v) = patch.edges {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|e| bson::to_document(&e).ok())
            .collect();
        set.insert("edges", arr);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmAutomation) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAutomation>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_automations(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "updatedAt": -1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmAutomation>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_automations.find"))
        })?;
    let mut rows: Vec<CrmAutomation> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_automations.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn get_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
) -> Result<Json<CrmAutomation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<CrmAutomation>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_automations.find_one")))?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAutomationInput>,
) -> Result<Json<CreateAutomationResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = automation_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAutomation>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_automations.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateAutomationResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn update_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
    Json(patch): Json<UpdateAutomationInput>,
) -> Result<Json<CrmAutomation>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<CrmAutomation>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_automations.find_one")))?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_automations.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("automation".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_automations.refetch")))?
        .ok_or_else(|| ApiError::NotFound("automation".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %automation_id))]
pub async fn delete_automation(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(automation_id): Path<String>,
) -> Result<Json<DeleteAutomationResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&automation_id)?;
    let coll = mongo.collection::<CrmAutomation>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_automations.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("automation".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAutomationResponse { deleted: true }))
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
    fn automation_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateAutomationInput {
            name: "Welcome flow".into(),
            ..Default::default()
        };
        let a = automation_from_create(input, user_id).unwrap();
        assert_eq!(a.name, "Welcome flow");
        assert_eq!(a.status, "draft");
        assert!(a.nodes.is_empty());
        assert!(a.edges.is_empty());
    }

    #[test]
    fn automation_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateAutomationInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(automation_from_create(input, user_id).is_err());
    }
}
