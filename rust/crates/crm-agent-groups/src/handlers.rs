//! HTTP handlers for the Support Agent Group entity.

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
    CreateAgentGroupInput, CreateAgentGroupResponse, DeleteAgentGroupResponse, ListQuery,
    UpdateAgentGroupInput,
};
use crate::types::CrmAgentGroup;

const COLL: &str = "crm_agent_groups";
const ENTITY_KIND: &str = "agent_group";

const ALLOWED_STRATEGIES: &[&str] = &["round_robin", "load_balanced", "manual", "sticky"];

fn list_filter(
    user_id: ObjectId,
    status: Option<&str>,
    assignment_strategy: Option<&str>,
    is_active: Option<bool>,
    manager_id: Option<ObjectId>,
) -> Document {
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
    if let Some(s) = assignment_strategy.map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("assignmentStrategy", s);
    }
    if let Some(a) = is_active {
        filter.insert("isActive", a);
    }
    if let Some(m) = manager_id {
        filter.insert("managerId", m);
    }
    filter
}

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn parse_oid_list(values: &[String]) -> Vec<ObjectId> {
    values
        .iter()
        .filter_map(|s| ObjectId::parse_str(s.trim()).ok())
        .collect()
}

fn validate_assignment_strategy(value: &str) -> Result<()> {
    if ALLOWED_STRATEGIES.contains(&value) {
        Ok(())
    } else {
        Err(ApiError::Validation(format!(
            "assignmentStrategy must be one of {ALLOWED_STRATEGIES:?}"
        )))
    }
}

fn group_from_create(input: CreateAgentGroupInput, user_id: ObjectId) -> Result<CrmAgentGroup> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    let member_ids = input
        .member_ids
        .as_deref()
        .map(parse_oid_list)
        .unwrap_or_default();
    let strategy = input.assignment_strategy.map(|s| s.trim().to_owned());
    if let Some(ref s) = strategy {
        if !s.is_empty() {
            validate_assignment_strategy(s)?;
        }
    }
    let member_count = member_ids.len() as i64;
    Ok(CrmAgentGroup {
        id: None,
        user_id,
        name,
        description: input.description.map(|s| s.trim().to_owned()),
        email: input.email.map(|s| s.trim().to_owned()),
        member_ids,
        member_count,
        manager_id: input
            .manager_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s.trim()).ok()),
        assignment_strategy: strategy.filter(|s| !s.is_empty()),
        business_hours_id: input
            .business_hours_id
            .as_deref()
            .and_then(|s| ObjectId::parse_str(s.trim()).ok()),
        is_active: input.is_active.unwrap_or(true),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateAgentGroupInput) -> Result<Document> {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.name {
        let trimmed = v.trim().to_owned();
        if trimmed.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        set.insert("name", trimmed);
    }
    if let Some(v) = patch.description {
        set.insert("description", v.trim().to_owned());
    }
    if let Some(v) = patch.email {
        set.insert("email", v.trim().to_owned());
    }
    if let Some(v) = patch.member_ids {
        let oids = parse_oid_list(&v);
        let count = oids.len() as i64;
        set.insert("memberIds", oids);
        set.insert("memberCount", count);
    }
    if let Some(v) = patch
        .manager_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s.trim()).ok())
    {
        set.insert("managerId", v);
    }
    if let Some(v) = patch.assignment_strategy {
        let trimmed = v.trim().to_owned();
        if !trimmed.is_empty() {
            validate_assignment_strategy(&trimmed)?;
        }
        set.insert("assignmentStrategy", trimmed);
    }
    if let Some(v) = patch
        .business_hours_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s.trim()).ok())
    {
        set.insert("businessHoursId", v);
    }
    if let Some(v) = patch.is_active {
        set.insert("isActive", v);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    Ok(doc! { "$set": set })
}

fn doc_for_audit(entity: &CrmAgentGroup) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

/// Per-tenant unique name check. Considers only non-archived rows so a
/// soft-deleted group's name can be re-used. `exclude_id` lets updates
/// skip the row being modified.
async fn ensure_unique_name(
    mongo: &MongoHandle,
    user_id: ObjectId,
    name: &str,
    exclude_id: Option<ObjectId>,
) -> Result<()> {
    let mut filter = doc! {
        "userId": user_id,
        "name": name,
        "status": { "$ne": "archived" },
    };
    if let Some(id) = exclude_id {
        filter.insert("_id", doc! { "$ne": id });
    }
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
    let existing = coll.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.unique_name"))
    })?;
    if existing.is_some() {
        return Err(ApiError::Conflict(format!(
            "agent group with name '{name}' already exists"
        )));
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<CrmAgentGroup>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_agent_groups(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let manager_oid = q
        .manager_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s.trim()).ok());
    let mut filter = list_filter(
        user_id,
        q.status.as_deref(),
        q.assignment_strategy.as_deref(),
        q.is_active,
        manager_oid,
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description", "email"]);
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
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.find"))
        })?;
    let mut rows: Vec<CrmAgentGroup> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn get_agent_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<CrmAgentGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("agent_group".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_agent_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAgentGroupInput>,
) -> Result<Json<CreateAgentGroupResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = group_from_create(input, user_id)?;
    ensure_unique_name(&mongo, user_id, &entity.name, None).await?;
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.insert"))
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
    Ok(Json(CreateAgentGroupResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn update_agent_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
    Json(patch): Json<UpdateAgentGroupInput>,
) -> Result<Json<CrmAgentGroup>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("agent_group".to_owned()))?;

    // Per-tenant unique name check on rename. Skip when name unchanged
    // or the row is being archived/un-archived without touching name.
    if let Some(new_name) = patch.name.as_deref().map(str::trim) {
        if new_name.is_empty() {
            return Err(ApiError::Validation("name cannot be empty".to_owned()));
        }
        if new_name != before.name {
            ensure_unique_name(&mongo, user_id, new_name, Some(oid)).await?;
        }
    }

    let update = build_update_doc(patch)?;
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("agent_group".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.refetch")))?
        .ok_or_else(|| ApiError::NotFound("agent_group".to_owned()))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %group_id))]
pub async fn delete_agent_group(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(group_id): Path<String>,
) -> Result<Json<DeleteAgentGroupResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&group_id)?;
    let coll = mongo.collection::<CrmAgentGroup>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("crm_agent_groups.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("agent_group".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteAgentGroupResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_filter_excludes_archived_by_default() {
        let oid = ObjectId::new();
        let f = list_filter(oid, None, None, None, None);
        // Default branch sets status: { $ne: "archived" }.
        assert!(f.contains_key("status"));
        let status_clause = f.get("status").and_then(|v| v.as_document()).unwrap();
        assert_eq!(status_clause.get_str("$ne").unwrap(), "archived");
    }

    #[test]
    fn group_from_create_rejects_empty_name_and_bad_strategy() {
        let user_id = ObjectId::new();
        let blank = CreateAgentGroupInput {
            name: "   ".into(),
            ..Default::default()
        };
        assert!(group_from_create(blank, user_id).is_err());

        let bad_strategy = CreateAgentGroupInput {
            name: "Tier 1".into(),
            assignment_strategy: Some("teleport".into()),
            ..Default::default()
        };
        assert!(group_from_create(bad_strategy, user_id).is_err());
    }

    #[test]
    fn group_from_create_syncs_member_count_with_member_ids() {
        let user_id = ObjectId::new();
        let m1 = ObjectId::new().to_hex();
        let m2 = ObjectId::new().to_hex();
        let input = CreateAgentGroupInput {
            name: "Support".into(),
            member_ids: Some(vec![m1.clone(), m2.clone(), "not-an-oid".into()]),
            assignment_strategy: Some("round_robin".into()),
            ..Default::default()
        };
        let g = group_from_create(input, user_id).unwrap();
        // Only the 2 valid oids are kept; member_count tracks the parsed list.
        assert_eq!(g.member_ids.len(), 2);
        assert_eq!(g.member_count, 2);
        assert_eq!(g.assignment_strategy.as_deref(), Some("round_robin"));
        assert_eq!(g.status, "active");
        assert!(g.is_active);
    }
}
