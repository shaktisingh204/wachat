//! HTTP handlers for the SLA Policy entity.

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

use crate::dto::{CreateSlaInput, CreateSlaResponse, DeleteSlaResponse, ListQuery, UpdateSlaInput};
use crate::types::CrmSla;

const COLL: &str = "crm_slas";
const ENTITY_KIND: &str = "sla";

fn list_filter(user_id: ObjectId, status: Option<&str>, priority: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" => {
            filter.insert("status", "active");
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(p) = priority.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("priority", p);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn sla_from_create(input: CreateSlaInput, user_id: ObjectId) -> Result<CrmSla> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.first_response_minutes < 1 {
        return Err(ApiError::Validation(
            "firstResponseMinutes must be >= 1".to_owned(),
        ));
    }
    if input.resolution_minutes < 1 {
        return Err(ApiError::Validation(
            "resolutionMinutes must be >= 1".to_owned(),
        ));
    }
    Ok(CrmSla {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        priority: input.priority.unwrap_or_else(|| "medium".to_owned()),
        severity: input.severity,
        channel: input.channel,
        first_response_minutes: input.first_response_minutes,
        resolution_minutes: input.resolution_minutes,
        business_hours_only: input.business_hours_only.unwrap_or(false),
        escalate_to: input.escalate_to,
        escalate_after_minutes: input.escalate_after_minutes,
        description: input.description,
        notes: input.notes,
        status: "active".to_owned(),
        active: true,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateSlaInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.severity {
        set.insert("severity", v);
    }
    if let Some(v) = patch.channel {
        set.insert("channel", v);
    }
    if let Some(v) = patch.first_response_minutes {
        set.insert("firstResponseMinutes", v);
    }
    if let Some(v) = patch.resolution_minutes {
        set.insert("resolutionMinutes", v);
    }
    if let Some(v) = patch.business_hours_only {
        set.insert("businessHoursOnly", v);
    }
    if let Some(v) = patch.escalate_to {
        set.insert("escalateTo", v);
    }
    if let Some(v) = patch.escalate_after_minutes {
        set.insert("escalateAfterMinutes", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.active {
        set.insert("active", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmSla) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSla>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_slas(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.priority.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "notes"]);
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
    let coll = mongo.collection::<CrmSla>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.find")))?;
    let mut rows: Vec<CrmSla> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sla_id))]
pub async fn get_sla(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sla_id): Path<String>,
) -> Result<Json<CrmSla>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sla_id)?;
    let coll = mongo.collection::<CrmSla>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sla".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_sla(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSlaInput>,
) -> Result<Json<CreateSlaResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = sla_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSla>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateSlaResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sla_id))]
pub async fn update_sla(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sla_id): Path<String>,
    Json(patch): Json<UpdateSlaInput>,
) -> Result<Json<CrmSla>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sla_id)?;
    let coll = mongo.collection::<CrmSla>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sla".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sla".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.refetch")))?
        .ok_or_else(|| ApiError::NotFound("sla".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %sla_id))]
pub async fn delete_sla(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(sla_id): Path<String>,
) -> Result<Json<DeleteSlaResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&sla_id)?;
    let coll = mongo.collection::<CrmSla>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "active": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_slas.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sla".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteSlaResponse { deleted: true }))
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
    fn sla_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateSlaInput {
            name: "Premium".into(),
            first_response_minutes: 60,
            resolution_minutes: 480,
            ..Default::default()
        };
        let s = sla_from_create(input, user_id).unwrap();
        assert_eq!(s.priority, "medium");
        assert_eq!(s.status, "active");
        assert!(s.active);
    }

    #[test]
    fn sla_from_create_rejects_zero_response() {
        let user_id = ObjectId::new();
        let input = CreateSlaInput {
            name: "X".into(),
            first_response_minutes: 0,
            resolution_minutes: 480,
            ..Default::default()
        };
        assert!(sla_from_create(input, user_id).is_err());
    }
}
