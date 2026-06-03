//! Admin-gated user handlers.
//!
//! Ports the following TS server actions:
//!
//! - `getWhatsAppProjectsForAdmin` (`src/app/actions/user.actions.ts`)
//!     → `GET   /whatsapp-projects`
//! - `getUsersForAdmin`            (`src/app/actions/user.actions.ts`)
//!     → `GET   /users`
//! - `approveUser`                 (`src/app/actions/admin.actions.ts`)
//!     → `POST  /users/{id}/approve`
//! - `updateUserPlanByAdmin`       (`src/app/actions/admin.actions.ts`)
//!     → `PATCH /users/{id}/plan`
//! - `updateUserPermissions`       (`src/app/actions/admin.actions.ts`)
//!     → `PATCH /users/{id}/permissions`
//! - `impersonateUser`             (`src/app/actions/admin.actions.ts`)
//!     → `POST  /users/{id}/impersonate`
//!
//! `impersonateUser` differs from the TS original: the TS version mints a
//! user-session JWT and sets the `session` cookie itself. Cookie minting stays
//! on the Next.js side (it owns `JWT_SECRET` and the cookie config), so the
//! Rust handler only resolves the target user and returns the fields needed
//! by the TS proxy to mint the cookie.
//!
//! Every handler is gated by [`require_admin`] on top of the
//! `rustAdminFetch` cookie check on the TS side — defense in depth.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, Query, State},
    routing::{get, patch, post},
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

const USERS_COLL: &str = "users";
const PROJECTS_COLL: &str = "projects";
const PLANS_COLL: &str = "plans";

/// Query string for `GET /whatsapp-projects` and `GET /users` — page/limit/query
/// mirror the TS args.
#[derive(Debug, Deserialize)]
pub struct ListQuery {
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

/// `GET /whatsapp-projects` response. `projects` is opaque JSON because the
/// wire shape is `JSON.parse(JSON.stringify(doc))` on legacy TS.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListWhatsAppProjectsResponse {
    pub projects: Vec<Value>,
    pub total: u64,
}

/// `GET /users` response — same opaque-JSON convention.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListUsersResponse {
    pub users: Vec<Value>,
    pub total: u64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserPlanBody {
    #[serde(rename = "planId")]
    pub plan_id: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateUserPermissionsBody {
    pub permissions: Value,
}

/// Response for `POST /users/{id}/impersonate` — the TS proxy uses this to
/// mint the `session` cookie on its end.
#[derive(Debug, Serialize, ToSchema)]
pub struct ImpersonateResponse {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub email: String,
    pub name: Option<String>,
    #[serde(rename = "planId")]
    pub plan_id: Option<String>,
}

/// `GET /v1/admin/whatsapp-projects` — admin-gated paged list of WhatsApp
/// projects (those with a `wabaId`), with owner `{ name, email }` joined from
/// the `users` collection. Mirrors `getWhatsAppProjectsForAdmin` in
/// `user.actions.ts`.
pub async fn list_whatsapp_projects(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListWhatsAppProjectsResponse>> {
    require_admin(&user)?;

    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let mut filter = doc! { "wabaId": { "$exists": true, "$ne": null } };
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
                "from": USERS_COLL,
                "localField": "userId",
                "foreignField": "_id",
                "as": "ownerInfo",
            }
        },
        doc! {
            "$unwind": {
                "path": "$ownerInfo",
                "preserveNullAndEmptyArrays": true,
            }
        },
        doc! {
            "$addFields": {
                "owner.name": "$ownerInfo.name",
                "owner.email": "$ownerInfo.email",
            }
        },
        doc! { "$project": { "ownerInfo": 0 } },
    ];

    let cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("whatsapp_projects.aggregate"))
    })?;

    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("whatsapp_projects.collect"))
    })?;

    let projects: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    let total = coll.count_documents(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("whatsapp_projects.count"))
    })?;

    Ok(Json(ListWhatsAppProjectsResponse { projects, total }))
}

/// `GET /v1/admin/users` — admin-gated paged list of users with the active
/// plan joined under `plan` and `password` stripped. Mirrors
/// `getUsersForAdmin` in `user.actions.ts`.
pub async fn list_users(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListUsersResponse>> {
    require_admin(&user)?;

    let page = q.page.max(1);
    let limit = q.limit.clamp(1, 200);
    let skip = (page - 1) * limit;

    let mut filter = Document::new();
    if let Some(query) = q.query.as_deref().map(str::trim) {
        if !query.is_empty() {
            filter.insert(
                "$or",
                vec![
                    doc! { "name": { "$regex": query, "$options": "i" } },
                    doc! { "email": { "$regex": query, "$options": "i" } },
                ],
            );
        }
    }

    let coll = mongo.collection::<Document>(USERS_COLL);

    let pipeline = vec![
        doc! { "$match": filter.clone() },
        doc! { "$sort": { "createdAt": -1 } },
        doc! { "$skip": skip as i64 },
        doc! { "$limit": limit as i64 },
        doc! { "$project": { "password": 0 } },
        doc! {
            "$lookup": {
                "from": PLANS_COLL,
                "localField": "planId",
                "foreignField": "_id",
                "as": "_plan",
            }
        },
        doc! {
            "$addFields": {
                "plan": { "$arrayElemAt": ["$_plan", 0] },
            }
        },
        doc! { "$project": { "_plan": 0 } },
    ];

    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.aggregate")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.collect")))?;

    let users: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.count")))?;

    Ok(Json(ListUsersResponse { users, total }))
}

/// `POST /v1/admin/users/{id}/approve` — flip `isApproved: true` on the user.
/// Mirrors `approveUser` in `admin.actions.ts`.
pub async fn approve_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let result = mongo
        .collection::<Document>(USERS_COLL)
        .update_one(doc! { "_id": oid }, doc! { "$set": { "isApproved": true } })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.approve")))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("User not found.".to_owned()));
    }

    Ok(Json(crate::dto::AdminOk::new()))
}

/// `PATCH /v1/admin/users/{id}/plan` — assign a new plan to the user.
/// Mirrors `updateUserPlanByAdmin` in `admin.actions.ts`.
pub async fn update_user_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateUserPlanBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;

    let user_oid = oid_from_str(&id)?;
    let plan_oid = oid_from_str(&body.plan_id)?;

    mongo
        .collection::<Document>(USERS_COLL)
        .update_one(
            doc! { "_id": user_oid },
            doc! { "$set": { "planId": plan_oid } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.update_plan")))?;

    Ok(Json(crate::dto::AdminOk::new()))
}

/// `PATCH /v1/admin/users/{id}/permissions` — overwrite `customPermissions`
/// for the user. The permissions blob is admin-controlled JSON; we convert it
/// to BSON unchanged so any future shape is supported without a schema bump.
/// Mirrors `updateUserPermissions` in `admin.actions.ts`.
pub async fn update_user_permissions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateUserPermissionsBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let permissions_bson = bson::to_bson(&body.permissions)
        .map_err(|e| ApiError::BadRequest(format!("Invalid permissions payload: {e}")))?;

    mongo
        .collection::<Document>(USERS_COLL)
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "customPermissions": permissions_bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("users.update_permissions"))
        })?;

    Ok(Json(crate::dto::AdminOk::new()))
}

/// `POST /v1/admin/users/{id}/impersonate` — resolve the target user so the
/// TS proxy can mint a user-session JWT and set the `session` cookie. Unlike
/// the TS original, Rust does not touch cookies — `JWT_SECRET` lives on the
/// Next.js side. Returns 404 if the user does not exist.
pub async fn impersonate_user(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<ImpersonateResponse>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let doc = mongo
        .collection::<Document>(USERS_COLL)
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.find_one")))?
        .ok_or_else(|| ApiError::NotFound("User not found.".to_owned()))?;

    let email = doc
        .get_str("email")
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("users.impersonate.email")))?
        .to_owned();
    let name = doc.get_str("name").ok().map(str::to_owned);
    let plan_id = doc.get_object_id("planId").ok().map(|p| p.to_hex());

    Ok(Json(ImpersonateResponse {
        user_id: oid.to_hex(),
        email,
        name,
        plan_id,
    }))
}

/// Routes mounted under `/v1/admin` from [`crate::router`].
pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/whatsapp-projects", get(list_whatsapp_projects))
        .route("/users", get(list_users))
        .route("/users/{id}/approve", post(approve_user))
        .route("/users/{id}/plan", patch(update_user_plan))
        .route("/users/{id}/permissions", patch(update_user_permissions))
        .route("/users/{id}/impersonate", post(impersonate_user))
}
