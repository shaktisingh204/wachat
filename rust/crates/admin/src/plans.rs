//! Admin-gated plan handlers.
//!
//! Ports the following TS server actions:
//!
//! - `getPlans`                  → `GET    /plans`
//! - `getPlanById`               → `GET    /plans/:id`
//! - `savePlan` (create)         → `POST   /plans`
//! - `savePlan` (update)         → `PUT    /plans/:id`
//! - `updatePlanPermissions`     → `PATCH  /plans/:id/permissions`
//! - `getLibraryTemplates`       → `GET    /library-templates`
//!
//! Like [`crate::projects`], every handler runs the `require_admin` gate
//! against the JWT roles claim before touching Mongo. The Plan shape is huge
//! and largely free-form (legacy schema evolves frequently in the TS layer),
//! so we accept and persist it as `serde_json::Value` round-tripped through
//! BSON rather than re-encoding every field as a strongly typed DTO.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::{get, patch},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde::Serialize;
use serde_json::Value;
use utoipa::ToSchema;

use crate::guard::require_admin;

const PLANS_COLL: &str = "plans";
const LIBRARY_TEMPLATES_COLL: &str = "library_templates";

/// `GET /plans` response — admin sees every plan, sorted by creation time
/// descending. Plans are opaque JSON because the underlying TS shape evolves
/// frequently and every field flows through unchanged.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListPlansResponse {
    pub plans: Vec<Value>,
}

/// `GET /plans/:id` response — nullable to mirror the TS `WithId<Plan> | null`.
#[derive(Debug, Serialize, ToSchema)]
pub struct PlanResponse {
    pub plan: Option<Value>,
}

/// `POST /plans` response — the new plan's ObjectId as a hex string.
#[derive(Debug, Serialize, ToSchema)]
pub struct CreatePlanResponse {
    pub id: String,
}

/// `GET /library-templates` response.
#[derive(Debug, Serialize, ToSchema)]
pub struct ListLibraryTemplatesResponse {
    pub templates: Vec<Value>,
}

/// `GET /v1/admin/plans` — admin-gated full list of plans. Mirrors
/// `getPlans` in `plan.actions.ts` (no caller-supplied filter; admin sees
/// everything). Sort order is `createdAt` desc, which differs from the TS
/// default of `price` asc — admin UI requested most-recent-first.
pub async fn list_plans(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ListPlansResponse>> {
    require_admin(&user)?;

    let coll = mongo.collection::<Document>(PLANS_COLL);
    let cursor = coll
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.find")))?;

    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.collect")))?;

    let plans: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListPlansResponse { plans }))
}

/// `GET /v1/admin/plans/:id` — single plan fetch. Returns `{ plan: null }` on
/// miss to mirror the legacy nullable shape.
pub async fn get_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<PlanResponse>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(PLANS_COLL);

    let doc = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.find_one")))?;

    Ok(Json(PlanResponse {
        plan: doc.map(document_to_clean_json),
    }))
}

/// Serialize the caller-supplied Plan JSON into a BSON document for insert /
/// `$set`, stripping any caller-supplied `_id` so callers can't smuggle in a
/// different document identity.
fn plan_value_to_doc(value: Value) -> Result<Document> {
    let mut doc = bson::to_document(&value)
        .map_err(|e| ApiError::BadRequest(format!("Invalid plan payload: {e}")))?;
    doc.remove("_id");
    Ok(doc)
}

/// `POST /v1/admin/plans` — create a new plan. The body is the full Plan
/// shape; we accept it as `serde_json::Value` and persist it verbatim (minus
/// any caller-supplied `_id`). Returns the new ObjectId hex.
pub async fn create_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<Value>,
) -> Result<Json<CreatePlanResponse>> {
    require_admin(&user)?;

    let mut doc = plan_value_to_doc(body)?;
    let oid = ObjectId::new();
    doc.insert("_id", oid);

    mongo
        .collection::<Document>(PLANS_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.insert_one")))?;

    Ok(Json(CreatePlanResponse { id: oid.to_hex() }))
}

/// `PUT /v1/admin/plans/:id` — update an existing plan. Replaces every field
/// the caller sent via `$set`, ignoring any `_id` in the body.
pub async fn update_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let set_doc = plan_value_to_doc(body)?;

    mongo
        .collection::<Document>(PLANS_COLL)
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.update_one")))?;

    Ok(Json(crate::dto::AdminOk::new()))
}

/// `PATCH /v1/admin/plans/:id/permissions` body — opaque permissions blob
/// emitted by `<PlanPermissionSelector />`. Shape is
/// `{ [moduleKey]: { view, create, edit, delete } }` but we treat it as
/// free-form JSON and let Mongo store whatever the admin UI sent.
#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct UpdatePlanPermissionsBody {
    pub permissions: Value,
}

/// `PATCH /v1/admin/plans/:id/permissions` — narrow update that only touches
/// the `permissions` sub-document. Mirrors `updatePlanPermissions` in
/// `admin.actions.ts`.
pub async fn update_plan_permissions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdatePlanPermissionsBody>,
) -> Result<Json<crate::dto::AdminOk>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let perms_bson = bson::to_bson(&body.permissions)
        .map_err(|e| ApiError::BadRequest(format!("Invalid permissions payload: {e}")))?;

    mongo
        .collection::<Document>(PLANS_COLL)
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "permissions": perms_bson } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("plans.update_permissions"))
        })?;

    Ok(Json(crate::dto::AdminOk::new()))
}

/// `GET /v1/admin/library-templates` — admin-gated list of every template in
/// the shared library. Mirrors `getLibraryTemplates` in
/// `template.actions.ts`; we read directly from Mongo here instead of
/// proxying through the wachat template handler because this is an admin-only
/// view that should not be filtered by tenant.
pub async fn list_library_templates(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<ListLibraryTemplatesResponse>> {
    require_admin(&user)?;

    let coll = mongo.collection::<Document>(LIBRARY_TEMPLATES_COLL);
    let cursor = coll
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("library_templates.find")))?;

    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("library_templates.collect"))
    })?;

    let templates: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListLibraryTemplatesResponse { templates }))
}

/// `DELETE /v1/admin/plans/:id` — hard delete. Refuses to delete the default
/// plan since dropping it would orphan any user/project that uses it.
/// Mirrors `deletePlan` in `plan.actions.ts`.
pub async fn delete_plan(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<crate::projects::OkMessage>> {
    require_admin(&user)?;

    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<Document>(PLANS_COLL);

    let existing = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.find_one")))?
        .ok_or_else(|| ApiError::NotFound("plan".to_owned()))?;

    if existing.get_bool("isDefault").unwrap_or(false) {
        return Err(ApiError::Conflict(
            "Cannot delete the default plan.".to_owned(),
        ));
    }

    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("plans.delete_one")))?;

    Ok(Json(crate::projects::OkMessage {
        ok: true,
        message: "Plan successfully deleted.".to_owned(),
    }))
}

/// Routes mounted at `/v1/admin` from [`crate::router`].
pub fn routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/plans", get(list_plans).post(create_plan))
        .route(
            "/plans/{id}",
            get(get_plan).put(update_plan).delete(delete_plan),
        )
        .route("/plans/{id}/permissions", patch(update_plan_permissions))
        .route("/library-templates", get(list_library_templates))
}
