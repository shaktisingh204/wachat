//! HTTP handlers for the Award Program entity.

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
    CreateProgramInput, CreateProgramResponse, DeleteProgramResponse, ListQuery, UpdateProgramInput,
};
use crate::types::CrmAwardProgram;

const COLL: &str = "crm_award_programs";
const ENTITY_KIND: &str = "award_program";

fn list_filter(user_id: ObjectId, status: Option<&str>, program_type: Option<&str>) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "active" | "closed" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(t) = program_type.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("programType", t);
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

fn program_from_create(input: CreateProgramInput, user_id: ObjectId) -> Result<CrmAwardProgram> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmAwardProgram {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        program_type: input
            .program_type
            .unwrap_or_else(|| "recognition".to_owned()),
        frequency: input.frequency.unwrap_or_else(|| "monthly".to_owned()),
        period_start: input.period_start.as_deref().and_then(parse_date),
        period_end: input.period_end.as_deref().and_then(parse_date),
        criteria: input.criteria,
        points_value: input.points_value,
        cash_value: input.cash_value,
        description: input.description,
        nominations: Vec::new(),
        winners: Vec::new(),
        status: "draft".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateProgramInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.program_type {
        set.insert("programType", v);
    }
    if let Some(v) = patch.frequency {
        set.insert("frequency", v);
    }
    if let Some(v) = patch.period_start.as_deref().and_then(parse_date) {
        set.insert("periodStart", v);
    }
    if let Some(v) = patch.period_end.as_deref().and_then(parse_date) {
        set.insert("periodEnd", v);
    }
    if let Some(v) = patch.criteria {
        set.insert("criteria", v);
    }
    if let Some(v) = patch.points_value {
        set.insert("pointsValue", v);
    }
    if let Some(v) = patch.cash_value {
        set.insert("cashValue", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.nominations {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|n| bson::to_document(&n).ok())
            .collect();
        set.insert("nominations", arr);
    }
    if let Some(v) = patch.winners {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|w| bson::to_document(&w).ok())
            .collect();
        set.insert("winners", arr);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmAwardProgram) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAwardProgram>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_programs(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(user_id, q.status.as_deref(), q.program_type.as_deref());
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "criteria", "description"]);
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
    let coll = mongo.collection::<CrmAwardProgram>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.find"))
    })?;
    let mut rows: Vec<CrmAwardProgram> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn get_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
) -> Result<Json<CrmAwardProgram>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;
    let coll = mongo.collection::<CrmAwardProgram>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("award_program".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateProgramInput>,
) -> Result<Json<CreateProgramResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = program_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAwardProgram>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.insert"))
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
    Ok(Json(CreateProgramResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn update_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
    Json(patch): Json<UpdateProgramInput>,
) -> Result<Json<CrmAwardProgram>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;
    let coll = mongo.collection::<CrmAwardProgram>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("award_program".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("award_program".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("award_program".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %program_id))]
pub async fn delete_program(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(program_id): Path<String>,
) -> Result<Json<DeleteProgramResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&program_id)?;
    let coll = mongo.collection::<CrmAwardProgram>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_award_programs.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("award_program".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteProgramResponse { deleted: true }))
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
    fn program_from_create_defaults() {
        let user_id = ObjectId::new();
        let input = CreateProgramInput {
            name: "Employee of the Month".into(),
            ..Default::default()
        };
        let p = program_from_create(input, user_id).unwrap();
        assert_eq!(p.program_type, "recognition");
        assert_eq!(p.frequency, "monthly");
        assert_eq!(p.status, "draft");
    }

    #[test]
    fn program_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateProgramInput {
            name: "".into(),
            ..Default::default()
        };
        assert!(program_from_create(input, user_id).is_err());
    }
}
