//! Admin-gated project handlers.
//!
//! Ports the following TS server actions in `src/app/actions/admin.actions.ts`
//! (and `getProjectByIdSystem` from `src/app/actions/project.actions.ts` for
//! the single-fetch path):
//!
//! - `getProjectsForAdmin`           → `GET    /projects`
//! - `getProjectByIdSystem`          → `GET    /projects/:id`
//! - `handleDeleteProjectByAdmin`    → `DELETE /projects/:id`
//! - `updateProjectCreditsByAdmin`   → `PATCH  /projects/:id/credits`
//! - `updateProjectMpsByAdmin`       → `PATCH  /projects/:id/mps`
//! - `updateProjectPlanByAdmin`      → `PATCH  /projects/:id/plan`
//!
//! Every handler runs the `require_admin` gate against the JWT roles claim
//! before touching Mongo — defense-in-depth on top of the `rustAdminFetch`
//! cookie check on the TS side.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{get, patch},
};
use bson::{Document, doc};
use futures::TryStreamExt;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

use crate::guard::require_admin;

const PROJECTS_COLL: &str = "projects";
const PLANS_COLL: &str = "plans";

/// Query string for `GET /projects` — page/limit/query mirror the TS args.
#[derive(Debug, Deserialize)]
pub struct ListProjectsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub query: Option<String>,
}

fn default_page() -> u64 {
    1
}

fn default_limit() -> u64 {
    10
}

/// Paged list response. `projects` is opaque JSON because the wire shape is
/// the result of `JSON.parse(JSON.stringify(doc))` on legacy TS — every field
/// in `Project` flows through unchanged.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListProjectsResponse {
    pub projects: Vec<Value>,
    pub total: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectResponse {
    pub project: Option<Value>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct OkMessage {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateCreditsBody {
    pub credits: f64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMpsBody {
    pub mps: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdatePlanBody {
    #[serde(rename = "planId")]
    pub plan_id: String,
}

/// `GET /v1/admin/projects` — admin-gated paged list of projects with the
/// active plan joined under `plan`. Mirrors `getProjectsForAdmin` in
/// `admin.actions.ts`.
pub async fn list_projects(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListProjectsQuery>,
) -> Result<Json<ListProjectsResponse>> {
    require_admin(&user)?;

    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let mut filter = Document::new();
    if let Some(query) = q.query.as_deref().map(str::trim) {
        if !query.is_empty() {
            filter.insert("name", doc! { "$regex": query, "$options": "i" });
        }
    }

    let coll = mongo.collection::<Document>(PROJECTS_COLL);

    let pipeline = vec![
        doc! { "$match": filter.clone() },
        doc! { "$sort": { "createdAt": -1 } },
        doc! { "$skip": skip as i64 },
        doc! { "$limit": limit as i64 },
        doc! {
            "$lookup": {
                "from": PLANS_COLL,
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

    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.aggregate")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.collect")))?;

    let projects: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.count")))?;

    Ok(Json(ListProjectsResponse { projects, total }))
}

/// `GET /v1/admin/projects/:id` — single project with plan joined. Returns
/// `{ project: null }` on miss to mirror the legacy nullable shape.
pub async fn get_project(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<ProjectResponse>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);

    let pipeline = vec![
        doc! { "$match": { "_id": oid } },
        doc! {
            "$lookup": {
                "from": PLANS_COLL,
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
        doc! { "$limit": 1 },
    ];

    let mut cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.aggregate")))?;

    let project = match cursor.try_next().await {
        Ok(Some(d)) => Some(document_to_clean_json(d)),
        Ok(None) => None,
        Err(e) => {
            return Err(ApiError::Internal(
                anyhow::Error::new(e).context("projects.next"),
            ));
        }
    };

    Ok(Json(ProjectResponse { project }))
}

/// `DELETE /v1/admin/projects/:id` — hard delete. Matches the legacy
/// behavior; cleanup of dependent collections is still a TODO on the TS side
/// and we preserve that scope.
pub async fn delete_project(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<OkMessage>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.delete_one")))?;

    Ok(Json(OkMessage {
        ok: true,
        message: "Project deleted successfully.".to_owned(),
    }))
}

pub async fn update_credits(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCreditsBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;
    if !body.credits.is_finite() || body.credits < 0.0 {
        return Err(ApiError::BadRequest("Invalid credits amount.".to_owned()));
    }
    let oid = oid_from_str(&id)?;
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "credits": body.credits } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_credits"))
        })?;
    Ok(Json(crate::dto::AdminOk::new()))
}

pub async fn update_mps(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateMpsBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;
    if body.mps < 1 {
        return Err(ApiError::BadRequest("Invalid MPS value.".to_owned()));
    }
    let oid = oid_from_str(&id)?;
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "messagesPerSecond": body.mps } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.update_mps")))?;
    Ok(Json(crate::dto::AdminOk::new()))
}

pub async fn update_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePlanBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;
    let project_oid = oid_from_str(&id)?;
    let plan_oid = oid_from_str(&body.plan_id)?;
    mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid },
            doc! { "$set": { "planId": plan_oid } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.update_plan")))?;
    Ok(Json(crate::dto::AdminOk::new()))
}

/// Routes mounted at `/v1/admin/projects` from [`crate::router`].
pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/projects", get(list_projects))
        .route("/projects/{id}", get(get_project).delete(delete_project))
        .route("/projects/{id}/credits", patch(update_credits))
        .route("/projects/{id}/mps", patch(update_mps))
        .route("/projects/{id}/plan", patch(update_plan))
}
