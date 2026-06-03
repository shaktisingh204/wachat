//! HTTP handlers for the Auto Lead Rule entity.

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
    CreateRuleInput, CreateRuleResponse, DeleteRuleResponse, ListQuery, UpdateRuleInput,
};
use crate::types::CrmAutoLeadRule;

const COLL: &str = "crm_auto_lead_rules";
const ENTITY_KIND: &str = "auto_lead_rule";

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    is_active: Option<bool>,
    assign_to_team: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "active" | "paused" => {
            filter.insert("status", status.unwrap());
        }
        _ => {
            filter.insert("status", doc! { "$ne": "archived" });
        }
    }
    if let Some(b) = is_active {
        filter.insert("isActive", b);
    }
    if let Some(t) = assign_to_team.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("assignToTeam", t);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn rule_from_create(input: CreateRuleInput, user_id: ObjectId) -> Result<CrmAutoLeadRule> {
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    Ok(CrmAutoLeadRule {
        id: None,
        user_id,
        name: input.name.trim().to_owned(),
        conditions: input.conditions.unwrap_or_default(),
        assign_to_user_id: input
            .assign_to_user_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s).ok()),
        assign_to_team: input
            .assign_to_team
            .map(|s| s.trim().to_owned())
            .filter(|s| !s.is_empty()),
        priority: input.priority,
        execution_order: input.execution_order,
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateRuleInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .name
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("name", v);
    }
    if let Some(v) = patch.conditions {
        set.insert("conditions", v);
    }
    if let Some(v) = patch
        .assign_to_user_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        set.insert("assignToUserId", v);
    }
    if let Some(v) = patch.assign_to_team {
        set.insert("assignToTeam", v);
    }
    if let Some(v) = patch.priority {
        set.insert("priority", v);
    }
    if let Some(v) = patch.execution_order {
        set.insert("executionOrder", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &CrmAutoLeadRule) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAutoLeadRule>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_rules(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.is_active,
        q.assign_to_team.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "assignToTeam"]);
        if let Ok(arr) = or.get_array("$or") {
            filter.insert("$or", arr.clone());
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "executionOrder": 1, "createdAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<CrmAutoLeadRule>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.find"))
    })?;
    let mut rows: Vec<CrmAutoLeadRule> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn get_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
) -> Result<Json<CrmAutoLeadRule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<CrmAutoLeadRule>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("auto_lead_rule".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateRuleInput>,
) -> Result<Json<CreateRuleResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = rule_from_create(input, user_id)?;
    let coll = mongo.collection::<CrmAutoLeadRule>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.insert"))
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
    Ok(Json(CreateRuleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn update_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
    Json(patch): Json<UpdateRuleInput>,
) -> Result<Json<CrmAutoLeadRule>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<CrmAutoLeadRule>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("auto_lead_rule".to_owned()))?;
    let update = build_update_doc(patch);
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("auto_lead_rule".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("auto_lead_rule".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rule_id))]
pub async fn delete_rule(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rule_id): Path<String>,
) -> Result<Json<DeleteRuleResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rule_id)?;
    let coll = mongo.collection::<CrmAutoLeadRule>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "isActive": false,
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_auto_lead_rules.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("auto_lead_rule".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteRuleResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None);
        assert!(f.contains_key("status"));
        // default branch must produce $ne: archived, not an exact match
        let status = f.get_document("status").expect("status doc");
        assert_eq!(status.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn rule_from_create_defaults_status_and_is_active() {
        let user_id = ObjectId::new();
        let input = CreateRuleInput {
            name: "Hot Leads".into(),
            ..Default::default()
        };
        let r = rule_from_create(input, user_id).unwrap();
        assert_eq!(r.name, "Hot Leads");
        assert_eq!(r.status, "active");
        assert!(r.is_active);
        assert!(r.conditions.is_empty());
    }

    #[test]
    fn rule_from_create_rejects_empty_name() {
        let user_id = ObjectId::new();
        let input = CreateRuleInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(rule_from_create(input, user_id).is_err());
    }
}
