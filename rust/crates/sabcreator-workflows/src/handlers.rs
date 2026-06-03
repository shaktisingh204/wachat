//! HTTP handlers for the Workflow entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    search::build_q_filter,
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateWorkflowInput, CreateWorkflowResponse, DeleteWorkflowResponse, ListQuery,
    RunWorkflowInput, RunWorkflowResponse, UpdateWorkflowInput,
};
use crate::types::SabcreatorWorkflow;

const COLL: &str = "sabcreator_workflows";

fn list_filter(
    user_id: ObjectId,
    app_id: Option<ObjectId>,
    trigger_kind: Option<&str>,
    status: Option<&str>,
) -> Document {
    let mut filter = doc! { "userId": user_id };
    if let Some(a) = app_id {
        filter.insert("appId", a);
    }
    if let Some(k) = trigger_kind {
        filter.insert("trigger.kind", k);
    }
    match status.unwrap_or("active_visible") {
        "all" => {}
        "archived" => {
            filter.insert("status", "archived");
        }
        "paused" => {
            filter.insert("status", "paused");
        }
        "active" => {
            filter.insert("status", "active");
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

fn json_to_bson(v: &Value, ctx: &'static str) -> Result<bson::Bson> {
    to_bson(v).map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabcreatorWorkflow>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_workflows(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let app_oid = match q.app_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let mut filter = list_filter(
        user_id,
        app_oid,
        q.trigger_kind.as_deref(),
        q.status.as_deref(),
    );
    if let Some(needle) = q.q.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        let or = build_q_filter(needle, &["name", "description"]);
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
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.find"))
    })?;
    let mut rows: Vec<SabcreatorWorkflow> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workflow_id))]
pub async fn get_workflow(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workflow_id): Path<String>,
) -> Result<Json<SabcreatorWorkflow>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workflow_id)?;
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("workflow".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_workflow(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateWorkflowInput>,
) -> Result<Json<CreateWorkflowResponse>> {
    let user_id = user_oid(&user)?;
    if input.name.trim().is_empty() {
        return Err(ApiError::Validation("name is required".to_owned()));
    }
    if input.trigger.kind.trim().is_empty() {
        return Err(ApiError::Validation("trigger.kind is required".to_owned()));
    }
    let app_oid = oid_from_str(&input.app_id)?;
    let sabflow_ref_oid = match input.sabflow_ref_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabcreatorWorkflow {
        id: None,
        user_id,
        app_id: app_oid,
        name: input.name.trim().to_owned(),
        description: input.description,
        trigger: input.trigger,
        sabflow_ref_id: sabflow_ref_oid,
        inline_steps_json: input.inline_steps_json,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateWorkflowResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workflow_id))]
pub async fn update_workflow(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workflow_id): Path<String>,
    Json(patch): Json<UpdateWorkflowInput>,
) -> Result<Json<SabcreatorWorkflow>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workflow_id)?;
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.name {
        set.insert("name", v);
    }
    if let Some(v) = patch.description {
        set.insert("description", v);
    }
    if let Some(v) = patch.trigger {
        let b = to_bson(&v)
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("trigger serialize")))?;
        set.insert("trigger", b);
    }
    if let Some(v) = patch.sabflow_ref_id.filter(|s| !s.is_empty()) {
        set.insert("sabflowRefId", oid_from_str(&v)?);
    }
    if let Some(v) = patch.inline_steps_json {
        set.insert("inlineStepsJson", json_to_bson(&v, "inlineStepsJson")?);
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("workflow".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("workflow".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %workflow_id))]
pub async fn delete_workflow(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workflow_id): Path<String>,
) -> Result<Json<DeleteWorkflowResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workflow_id)?;
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
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
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("workflow".to_owned()));
    }
    Ok(Json(DeleteWorkflowResponse { deleted: true }))
}

/// Lightweight ack endpoint — real dispatch happens in the Next.js
/// server action which forwards to SabFlow (if `sabflowRefId` is set)
/// or evaluates `inlineStepsJson` locally. This endpoint exists so the
/// frontend can update workflow state ("lastRunAt", etc.) and so the
/// route surface mirrors the rest of the SabCreator API.
#[instrument(skip_all, fields(user_id = %user.user_id, id = %workflow_id))]
pub async fn run_workflow(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(workflow_id): Path<String>,
    Json(_input): Json<RunWorkflowInput>,
) -> Result<Json<RunWorkflowResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&workflow_id)?;
    let coll = mongo.collection::<SabcreatorWorkflow>(COLL);
    let _ = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": { "lastRunAt": BsonDateTime::from_chrono(Utc::now()) }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.markRun"))
        })?;
    // ensure ownership existed (avoid accepting unknown ids).
    let _ = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcreator_workflows.verify"))
        })?
        .ok_or_else(|| ApiError::NotFound("workflow".to_owned()))?;
    Ok(Json(RunWorkflowResponse {
        accepted: true,
        workflow_id: oid.to_hex(),
    }))
}
