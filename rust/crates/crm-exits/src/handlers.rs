//! HTTP handlers for the Exit entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateExitInput, CreateExitResponse, DeleteExitResponse, ListQuery, UpdateExitInput,
};
use crate::types::CrmExit;

const COLL: &str = "crm_exits";
const ENTITY_KIND: &str = "exit";

fn list_filter(user_id: ObjectId, status: Option<&str>, r#type: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("archived", true);
        }
        "open" | "complete" | "cancelled" => {
            filter.insert("status", status.unwrap());
            filter.insert("archived", doc! { "$ne": true });
        }
        _ => {
            filter.insert("archived", doc! { "$ne": true });
        }
    }
    if let Some(t) = r#type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("type", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

fn exit_from_create(input: CreateExitInput, user_id: ObjectId) -> Result<CrmExit> {
    let has_name = input
        .employee_name
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    let has_id = input
        .employee_id
        .as_deref()
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false);
    if !has_name && !has_id {
        return Err(ApiError::Validation(
            "employeeName or employeeId is required".to_owned(),
        ));
    }
    Ok(CrmExit {
        id: None,
        user_id,
        employee_name: input.employee_name,
        employee_id: input.employee_id,
        r#type: input.r#type.unwrap_or_else(|| "resignation".to_owned()),
        notice_start: input.notice_start.as_deref().and_then(parse_date),
        last_day: input.last_day.as_deref().and_then(parse_date),
        fnf_status: input.fnf_status.unwrap_or_else(|| "pending".to_owned()),
        noc_status: input.noc_status.unwrap_or_else(|| "pending".to_owned()),
        asset_return_status: input
            .asset_return_status
            .unwrap_or_else(|| "pending".to_owned()),
        knowledge_transfer_status: input
            .knowledge_transfer_status
            .unwrap_or_else(|| "pending".to_owned()),
        exit_interview_notes: input.exit_interview_notes,
        reason: input.reason,
        notes: input.notes,
        status: Some("open".to_owned()),
        archived: false,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateExitInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.employee_id {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.r#type {
        set.insert("type", v);
    }
    if let Some(v) = patch.notice_start.as_deref().and_then(parse_date) {
        set.insert("noticeStart", v);
    }
    if let Some(v) = patch.last_day.as_deref().and_then(parse_date) {
        set.insert("lastDay", v);
    }
    if let Some(v) = patch.fnf_status {
        set.insert("fnfStatus", v);
    }
    if let Some(v) = patch.noc_status {
        set.insert("nocStatus", v);
    }
    if let Some(v) = patch.asset_return_status {
        set.insert("assetReturnStatus", v);
    }
    if let Some(v) = patch.knowledge_transfer_status {
        set.insert("knowledgeTransferStatus", v);
    }
    if let Some(v) = patch.exit_interview_notes {
        set.insert("exitInterviewNotes", v);
    }
    if let Some(v) = patch.reason {
        set.insert("reason", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmExit) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmExit>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_exits(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.r#type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["employeeName", "reason", "notes"]);
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
    let coll = mongo.collection::<CrmExit>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.find")))?;
    let mut rows: Vec<CrmExit> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %exit_id))]
pub async fn get_exit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(exit_id): Path<String>,
) -> Result<Json<CrmExit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&exit_id)?;
    let coll = mongo.collection::<CrmExit>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.find_one")))?
        .ok_or_else(|| ApiError::NotFound("exit".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_exit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateExitInput>,
) -> Result<Json<CreateExitResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = exit_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmExit>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateExitResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %exit_id))]
pub async fn update_exit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(exit_id): Path<String>,
    Json(patch): Json<UpdateExitInput>,
) -> Result<Json<CrmExit>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&exit_id)?;
    let coll = mongo.collection::<CrmExit>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.find_one")))?
        .ok_or_else(|| ApiError::NotFound("exit".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("exit".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.refetch")))?
        .ok_or_else(|| ApiError::NotFound("exit".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %exit_id))]
pub async fn delete_exit(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(exit_id): Path<String>,
) -> Result<Json<DeleteExitResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&exit_id)?;
    let coll = mongo.collection::<CrmExit>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "archived": true,
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_exits.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("exit".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteExitResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None);
        assert!(f.contains_key("archived"));
    }

    #[test]
    fn exit_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateExitInput {
            employee_name: Some("Jane".into()),
            ..Default::default()
        };
        let e = exit_from_create(input, user_id).unwrap();
        assert_eq!(e.r#type, "resignation");
        assert_eq!(e.fnf_status, "pending");
        assert_eq!(e.status.as_deref(), Some("open"));
        assert!(!e.archived);
    }

    #[test]
    fn exit_from_create_rejects_missing_employee() {
        let user_id = ObjectId::new();
        let input = CreateExitInput::default();
        assert!(exit_from_create(input, user_id).is_err());
    }
}
