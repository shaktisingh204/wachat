//! HTTP handlers for the Goal entity.

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
    CreateGoalInput, CreateGoalResponse, DeleteGoalResponse, ListQuery, UpdateGoalInput,
};
use crate::types::CrmGoal;

const COLL: &str = "crm_goals";
const ENTITY_KIND: &str = "goal";

const ALLOWED_STATUS: &[&str] = &["draft", "active", "achieved", "missed", "archived"];

fn normalize_status(raw: Option<String>) -> String {
    match raw {
        Some(s) => {
            let trimmed = s.trim();
            if ALLOWED_STATUS.contains(&trimmed) {
                trimmed.to_owned()
            } else {
                "draft".to_owned()
            }
        }
        None => "draft".to_owned(),
    }
}

fn clamp_progress(p: Option<f64>) -> Option<f64> {
    p.map(|v| {
        if v.is_nan() {
            0.0
        } else if v < 0.0 {
            0.0
        } else if v > 100.0 {
            100.0
        } else {
            v
        }
    })
}

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    employee_id: Option<&str>,
    period: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        s if ALLOWED_STATUS.contains(&s) => {
            filter.insert("status", s);
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(eid) = employee_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("employeeId", eid);
    }
    if let Some(p) = period.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", p);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn goal_from_create(input: CreateGoalInput, user_id: ObjectId) -> Result<CrmGoal> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    Ok(CrmGoal {
        id: None,
        user_id,
        title: title.to_owned(),
        description: input.description,
        employee_id: input
            .employee_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        employee_name: input.employee_name,
        period: input.period,
        target: input.target,
        achieved: input.achieved,
        progress: clamp_progress(input.progress),
        weight: input.weight,
        kpi: input.kpi,
        status: normalize_status(input.status),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateGoalInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .title
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("title", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch
        .employee_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("employeeId", v);
    }
    if let Some(v) = patch.employee_name {
        set.insert("employeeName", v);
    }
    if let Some(v) = patch.period {
        set.insert("period", v);
    }
    if let Some(v) = patch.target {
        set.insert("target", v);
    }
    if let Some(v) = patch.achieved {
        set.insert("achieved", v);
    }
    if let Some(v) = clamp_progress(patch.progress) {
        set.insert("progress", v);
    }
    if let Some(v) = patch.weight {
        set.insert("weight", v);
    }
    if let Some(v) = patch.kpi {
        set.insert("kpi", v);
    }
    if let Some(v) = patch
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| ALLOWED_STATUS.contains(s))
    {
        set.insert("status", v.to_owned());
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmGoal) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmGoal>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_goals(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.employee_id.as_deref(),
        q.period.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(
            needle,
            &["title", "description", "employeeName", "period", "kpi"],
        );
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
    let coll = mongo.collection::<CrmGoal>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.find")))?;
    let mut rows: Vec<CrmGoal> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %goal_id))]
pub async fn get_goal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(goal_id): Path<String>,
) -> Result<Json<CrmGoal>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&goal_id)?;
    let coll = mongo.collection::<CrmGoal>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.find_one")))?
        .ok_or_else(|| ApiError::NotFound("goal".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_goal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateGoalInput>,
) -> Result<Json<CreateGoalResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = goal_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmGoal>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateGoalResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %goal_id))]
pub async fn update_goal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(goal_id): Path<String>,
    Json(patch): Json<UpdateGoalInput>,
) -> Result<Json<CrmGoal>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&goal_id)?;
    let coll = mongo.collection::<CrmGoal>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.find_one")))?
        .ok_or_else(|| ApiError::NotFound("goal".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("goal".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.refetch")))?
        .ok_or_else(|| ApiError::NotFound("goal".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %goal_id))]
pub async fn delete_goal(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(goal_id): Path<String>,
) -> Result<Json<DeleteGoalResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&goal_id)?;
    let coll = mongo.collection::<CrmGoal>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_goals.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("goal".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteGoalResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
    }

    #[test]
    fn goal_from_create_defaults_status_and_clamps_progress() {
        let user_id = ObjectId::new();
        let input = CreateGoalInput {
            title: "Ship Q1 OKR".into(),
            progress: Some(250.0),
            ..Default::default()
        };
        let g = goal_from_create(input, user_id).unwrap();
        assert_eq!(g.status, "draft");
        assert_eq!(g.progress, Some(100.0));
    }

    #[test]
    fn goal_from_create_rejects_empty_title() {
        let user_id = ObjectId::new();
        let input = CreateGoalInput {
            title: "   ".into(),
            ..Default::default()
        };
        assert!(goal_from_create(input, user_id).is_err());
    }
}
