//! HTTP handlers for the Budget entity.

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
    CreateBudgetInput, CreateBudgetResponse, DeleteBudgetResponse, ListQuery, UpdateBudgetInput,
};
use crate::types::CrmBudget;

const COLL: &str = "crm_budgets";
const ENTITY_KIND: &str = "budget";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    department: Option<&str>,
    period: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "approved" | "rejected" | "locked" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(d) = department.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("department", d);
    }
    if let Some(p) = period.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("period", p);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn budget_from_create(input: CreateBudgetInput, user_id: ObjectId) -> Result<CrmBudget> {
    if input.budget_head.trim().is_empty() {
        return Err(ApiError::Validation("budgetHead is required".to_owned()));
    }
    if input.period.trim().is_empty() {
        return Err(ApiError::Validation("period is required".to_owned()));
    }
    let project_id = input
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    Ok(CrmBudget {
        id: None,
        user_id,
        budget_head: input.budget_head.trim().to_string(),
        department: input.department,
        project_id,
        period: input.period,
        planned_amount: input.planned_amount,
        actual_amount: 0.0,
        currency: input.currency,
        status: Some("draft".to_owned()),
        locked: false,
        approved_by: None,
        approved_at: None,
        locked_at: None,
        rejected_at: None,
        reject_reason: None,
        notes: input.notes,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateBudgetInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.budget_head {
        set.insert("budgetHead", v);
    }
    if let Some(v) = patch.department {
        set.insert("department", v);
    }
    if let Some(v) = patch
        .project_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("projectId", v);
    }
    if let Some(v) = patch.period {
        set.insert("period", v);
    }
    if let Some(v) = patch.planned_amount {
        set.insert("plannedAmount", v);
    }
    if let Some(v) = patch.actual_amount {
        set.insert("actualAmount", v);
    }
    if let Some(v) = patch.currency {
        set.insert("currency", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmBudget) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmBudget>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_budgets(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.department.as_deref(),
        q.period.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["budgetHead", "department", "notes"]);
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
    let coll = mongo.collection::<CrmBudget>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.find")))?;
    let mut rows: Vec<CrmBudget> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %budget_id))]
pub async fn get_budget(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(budget_id): Path<String>,
) -> Result<Json<CrmBudget>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&budget_id)?;
    let coll = mongo.collection::<CrmBudget>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("budget".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_budget(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateBudgetInput>,
) -> Result<Json<CreateBudgetResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = budget_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmBudget>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) = audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
    Ok(Json(CreateBudgetResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %budget_id))]
pub async fn update_budget(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(budget_id): Path<String>,
    Json(patch): Json<UpdateBudgetInput>,
) -> Result<Json<CrmBudget>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&budget_id)?;
    let coll = mongo.collection::<CrmBudget>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.find_one")))?
        .ok_or_else(|| ApiError::NotFound("budget".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("budget".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.refetch")))?
        .ok_or_else(|| ApiError::NotFound("budget".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %budget_id))]
pub async fn delete_budget(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(budget_id): Path<String>,
) -> Result<Json<DeleteBudgetResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&budget_id)?;
    let coll = mongo.collection::<CrmBudget>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_budgets.archive")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("budget".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteBudgetResponse { deleted: true }))
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
    fn budget_from_create_stamps_draft_and_zero_actual() {
        let user_id = ObjectId::new();
        let input = CreateBudgetInput {
            budget_head: "Marketing".into(),
            period: "FY26-Q1".into(),
            planned_amount: 50000.0,
            ..Default::default()
        };
        let b = budget_from_create(input, user_id).unwrap();
        assert_eq!(b.status.as_deref(), Some("draft"));
        assert_eq!(b.actual_amount, 0.0);
        assert!(!b.locked);
    }

    #[test]
    fn budget_from_create_rejects_empty_head() {
        let user_id = ObjectId::new();
        let input = CreateBudgetInput {
            budget_head: "  ".into(),
            period: "FY26".into(),
            planned_amount: 100.0,
            ..Default::default()
        };
        assert!(budget_from_create(input, user_id).is_err());
    }
}
