//! HTTP handlers for the Role Assignment entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateAssignmentInput, CreateAssignmentResponse, DeleteAssignmentResponse, ListQuery,
};
use crate::types::SabcreatorRoleAssignment;

const COLL: &str = "sabcreator_role_assignments";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorRoleAssignment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_assignments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.app_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("appId", oid_from_str(s)?);
    }
    if let Some(s) = q.assignee_user_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("assigneeUserId", oid_from_str(s)?);
    }
    if let Some(s) = q.role_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("roleId", oid_from_str(s)?);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "assignedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabcreatorRoleAssignment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_role_assignments.find"))
    })?;
    let mut rows: Vec<SabcreatorRoleAssignment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_role_assignments.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateAssignmentInput>,
) -> Result<Json<CreateAssignmentResponse>> {
    let user_id = user_oid(&user)?;
    let app_oid = oid_from_str(&input.app_id)?;
    let assignee_oid = oid_from_str(&input.assignee_user_id)?;
    let role_oid = oid_from_str(&input.role_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabcreatorRoleAssignment>(COLL);

    // Upsert by (userId, appId, assigneeUserId, roleId) so re-assigning is idempotent.
    let filter = doc! {
        "userId": user_id,
        "appId": app_oid,
        "assigneeUserId": assignee_oid,
        "roleId": role_oid,
    };
    if let Some(existing) = coll.find_one(filter.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_role_assignments.lookup"))
    })? {
        let id = existing.id.unwrap_or_default();
        return Ok(Json(CreateAssignmentResponse {
            id: id.to_hex(),
            entity: existing,
        }));
    }

    let mut entity = SabcreatorRoleAssignment {
        id: None,
        user_id,
        app_id: app_oid,
        assignee_user_id: assignee_oid,
        role_id: role_oid,
        assigned_at: now,
        assigned_by: Some(user_id),
    };
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_role_assignments.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateAssignmentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %assignment_id))]
pub async fn delete_assignment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(assignment_id): Path<String>,
) -> Result<Json<DeleteAssignmentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&assignment_id)?;
    let coll = mongo.collection::<SabcreatorRoleAssignment>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_role_assignments.delete"))
        })?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("assignment".to_owned()));
    }
    Ok(Json(DeleteAssignmentResponse { deleted: true }))
}
