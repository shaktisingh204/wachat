//! HTTP handlers for the project domain.
//!
//! The two endpoints here mirror `getProjects()` and `getProjectById()`
//! from `src/app/actions/project.actions.ts`. We deliberately return raw
//! BSON-as-JSON instead of typed DTOs because the TypeScript `Project`
//! shape is open-ended and would break callers on every schema tweak.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

use crate::dto::{ListQuery, ListResponse, ProjectResponse};

const PROJECTS_COLLECTION: &str = "projects";

/// `GET /v1/projects` — list projects the authenticated user owns or is
/// agent on, with optional `query` (name regex) and `type` (whatsapp /
/// facebook) filters. Sorted by `createdAt` desc to match legacy.
pub async fn list_projects(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(filters): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let mut filter = doc! {
        "$or": [
            { "userId": user_oid },
            { "agents.userId": user_oid },
        ],
    };

    if let Some(q) = filters
        .query
        .as_deref()
        .map(str::trim)
        .filter(|s: &&str| !s.is_empty())
    {
        filter.insert("name", doc! { "$regex": q, "$options": "i" });
    }

    match filters.kind.as_deref() {
        Some("whatsapp") => {
            filter.insert("wabaId", doc! { "$exists": true, "$ne": null });
        }
        Some("facebook") => {
            filter.insert("facebookPageId", doc! { "$exists": true, "$ne": null });
        }
        _ => {}
    }

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let mut out: Vec<Value> = Vec::new();
    while let Some(doc) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    {
        out.push(document_to_clean_json(doc));
    }

    Ok(Json(ListResponse { projects: out }))
}

/// `GET /v1/projects/:id` — single project with `plan` joined and an
/// owner-or-agent access check (returns 404 for non-members so we don't
/// leak existence).
pub async fn get_project(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<ProjectResponse>> {
    let project_oid = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let pipeline = vec![
        doc! { "$match": { "_id": project_oid } },
        doc! {
            "$lookup": {
                "from": "plans",
                "localField": "planId",
                "foreignField": "_id",
                "as": "planInfo",
            }
        },
        doc! {
            "$unwind": {
                "path": "$planInfo",
                "preserveNullAndEmptyArrays": true,
            }
        },
        doc! { "$addFields": { "plan": "$planInfo" } },
        doc! { "$project": { "planInfo": 0 } },
    ];

    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;

    let doc = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    // Access check — owner OR agent. Deny by 404 to avoid leaking presence.
    let is_owner = doc
        .get_object_id("userId")
        .map(|o| o == user_oid)
        .unwrap_or(false);
    let is_agent = doc
        .get_array("agents")
        .ok()
        .map(|agents| {
            agents.iter().any(|a| {
                a.as_document()
                    .and_then(|d| d.get_object_id("userId").ok())
                    .map(|o| o == user_oid)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false);

    if !is_owner && !is_agent {
        return Err(ApiError::NotFound("project".to_owned()));
    }

    Ok(Json(ProjectResponse {
        project: document_to_clean_json(doc),
    }))
}
