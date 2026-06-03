//! HTTP handlers for the Succession Plan entity.

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
    CreatePlanInput, CreatePlanResponse, DeletePlanResponse, ListQuery, UpdatePlanInput,
};
use crate::types::CrmSuccessionPlan;

const COLL: &str = "crm_succession_plans";
const ENTITY_KIND: &str = "succession_plan";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    readiness: Option<&str>,
    critical_role: Option<bool>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "draft" | "approved" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(r) = readiness.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("readinessOverall", r);
    }
    if let Some(c) = critical_role {
        filter.insert("criticalRole", c);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn plan_from_create(input: CreatePlanInput, user_id: ObjectId) -> Result<CrmSuccessionPlan> {
    if input.role_title.trim().is_empty() {
        return Err(ApiError::Validation("roleTitle is required".to_owned()));
    }
    Ok(CrmSuccessionPlan {
        id: None,
        user_id,
        role_title: input.role_title.trim().to_owned(),
        current_incumbent: input
            .current_incumbent
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        successors: input.successors.unwrap_or_default(),
        readiness_overall: input
            .readiness_overall
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        critical_role: input.critical_role.unwrap_or(false),
        notes: input
            .notes
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        status: input
            .status
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "draft".to_owned()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdatePlanInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.role_title {
        set.insert("roleTitle", v);
    }
    if let Some(v) = patch.current_incumbent {
        set.insert("currentIncumbent", v);
    }
    if let Some(v) = patch.successors {
        let arr: Vec<Document> = v
            .into_iter()
            .filter_map(|c| bson::to_document(&c).ok())
            .collect();
        set.insert("successors", arr);
    }
    if let Some(v) = patch.readiness_overall {
        set.insert("readinessOverall", v);
    }
    if let Some(v) = patch.critical_role {
        set.insert("criticalRole", v);
    }
    if let Some(v) = patch.notes {
        set.insert("notes", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmSuccessionPlan) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmSuccessionPlan>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_plans(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.readiness_overall.as_deref(),
        q.critical_role,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["roleTitle", "currentIncumbent", "notes"]);
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
    let coll = mongo.collection::<CrmSuccessionPlan>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.find"))
    })?;
    let mut rows: Vec<CrmSuccessionPlan> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %plan_id))]
pub async fn get_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(plan_id): Path<String>,
) -> Result<Json<CrmSuccessionPlan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&plan_id)?;
    let coll = mongo.collection::<CrmSuccessionPlan>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("succession_plan".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePlanInput>,
) -> Result<Json<CreatePlanResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = plan_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmSuccessionPlan>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.insert"))
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
    Ok(Json(CreatePlanResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %plan_id))]
pub async fn update_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(plan_id): Path<String>,
    Json(patch): Json<UpdatePlanInput>,
) -> Result<Json<CrmSuccessionPlan>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&plan_id)?;
    let coll = mongo.collection::<CrmSuccessionPlan>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("succession_plan".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("succession_plan".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("succession_plan".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %plan_id))]
pub async fn delete_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(plan_id): Path<String>,
) -> Result<Json<DeletePlanResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&plan_id)?;
    let coll = mongo.collection::<CrmSuccessionPlan>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_succession_plans.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("succession_plan".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeletePlanResponse { deleted: true }))
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
    fn plan_from_create_defaults_status_and_critical_role() {
        let user_id = ObjectId::new();
        let input = CreatePlanInput {
            role_title: "Head of Engineering".into(),
            ..Default::default()
        };
        let p = plan_from_create(input, user_id).unwrap();
        assert_eq!(p.status, "draft");
        assert!(!p.critical_role);
        assert!(p.successors.is_empty());
    }

    #[test]
    fn plan_from_create_rejects_empty_role_title() {
        let user_id = ObjectId::new();
        let input = CreatePlanInput {
            role_title: "   ".into(),
            ..Default::default()
        };
        assert!(plan_from_create(input, user_id).is_err());
    }
}
