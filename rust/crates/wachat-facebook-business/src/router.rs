//! Axum router mounting the Facebook Business Admin & Commerce endpoints.
//!
//! The api crate is expected to nest this under `/v1/facebook/business`.
//! All routes are project-scoped — every handler resolves the project via
//! the inlined `load_project_for` helper (mirrors
//! `wachat-config::router::load_project_for`) before forwarding to Meta.
//!
//! ```text
//! GET    /projects/:id                     getBusinessDetails
//! GET    /projects/:id/owned-pages         getBusinessOwnedPages
//! GET    /projects/:id/owned-ad-accounts   getBusinessOwnedAdAccounts
//! GET    /projects/:id/owned-instagram     getBusinessOwnedInstagramAccounts
//! GET    /projects/:id/system-users        getBusinessSystemUsers
//! GET    /projects/:id/users               getBusinessUsers
//! GET    /projects/:id/pending-users       getBusinessPendingUsers
//! POST   /projects/:id/users/invite        inviteBusinessUser
//! GET    /projects/:id/commerce/settings   getCommerceMerchantSettings
//! GET    /projects/:id/commerce/orders     getFacebookOrders
//! POST   /projects/:id/commerce/orders/:orderId/fulfill  fulfillOrder
//! POST   /projects/:id/commerce/orders/:orderId/cancel   cancelOrder
//! POST   /projects/:id/commerce/orders/:orderId/refund   refundOrder
//! ```

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Path, State},
    routing::{get, post},
};
use bson::{Document, doc};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use wachat_types::Project;

use crate::{business, commerce, state::WachatFacebookBusinessState};

const PROJECTS_COLL: &str = "projects";

/// Tenant gate — reads the project document untyped (raw `Document`) so that
/// schema drift on legacy/mixed-shape rows can't crash the handler with a
/// strict-deserialization 500. We then rebuild a minimal `Project` containing
/// only the fields downstream business/commerce code touches.
/// 404 if the project doesn't exist, 403 if the caller is not its owner.
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let raw = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;
    let owner = raw
        .get_object_id("userId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing userId")))?;
    if user.tenant_id != owner.to_hex() {
        return Err(ApiError::Forbidden("not your project".to_owned()));
    }
    Ok(Project {
        id: oid,
        user_id: owner,
        name: raw.get_str("name").ok().map(str::to_owned),
        waba_id: raw.get_str("wabaId").ok().map(str::to_owned),
        business_id: raw.get_str("businessId").ok().map(str::to_owned),
        app_id: raw.get_str("appId").ok().map(str::to_owned),
        access_token: raw.get_str("accessToken").ok().map(str::to_owned),
        phone_numbers: Vec::new(),
        messages_per_second: None,
        credits: None,
        plan_id: None,
        review_status: None,
        ban_state: None,
        created_at: None,
    })
}

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatFacebookBusinessState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // BUSINESS ADMIN
        .route("/projects/{id}", get(business_details))
        .route("/projects/{id}/owned-pages", get(owned_pages))
        .route("/projects/{id}/owned-ad-accounts", get(owned_ad_accounts))
        .route(
            "/projects/{id}/owned-instagram",
            get(owned_instagram_accounts),
        )
        .route("/projects/{id}/system-users", get(system_users))
        .route("/projects/{id}/users", get(users))
        .route("/projects/{id}/pending-users", get(pending_users))
        .route("/projects/{id}/users/invite", post(invite_user))
        // COMMERCE
        .route("/projects/{id}/commerce/settings", get(commerce_settings))
        .route("/projects/{id}/commerce/orders", get(orders))
        .route(
            "/projects/{id}/commerce/orders/{order_id}/fulfill",
            post(order_fulfill),
        )
        .route(
            "/projects/{id}/commerce/orders/{order_id}/cancel",
            post(order_cancel),
        )
        .route(
            "/projects/{id}/commerce/orders/{order_id}/refund",
            post(order_refund),
        )
}

// ---------------------------------------------------------------------------
// BUSINESS ADMIN handlers
// ---------------------------------------------------------------------------

async fn business_details(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::BusinessResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(business::get_business_details(&s.meta, &p).await?))
}

async fn owned_pages(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::PagesResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(business::get_business_owned_pages(&s.meta, &p).await?))
}

async fn owned_ad_accounts(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::AdAccountsResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        business::get_business_owned_ad_accounts(&s.meta, &p).await?,
    ))
}

async fn owned_instagram_accounts(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::InstagramAccountsResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        business::get_business_owned_instagram_accounts(&s.meta, &p).await?,
    ))
}

async fn system_users(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::SystemUsersResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        business::get_business_system_users(&s.meta, &p).await?,
    ))
}

async fn users(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::UsersResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(business::get_business_users(&s.meta, &p).await?))
}

async fn pending_users(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<business::PendingUsersResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        business::get_business_pending_users(&s.meta, &p).await?,
    ))
}

async fn invite_user(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
    Json(body): Json<business::InviteBody>,
) -> Result<Json<business::AckResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        business::invite_business_user(&s.meta, &p, body).await?,
    ))
}

// ---------------------------------------------------------------------------
// COMMERCE handlers
// ---------------------------------------------------------------------------

async fn commerce_settings(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<commerce::CommerceSettingsResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        commerce::get_commerce_merchant_settings(&s.mongo, &s.meta, &p).await?,
    ))
}

async fn orders(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path(id): Path<String>,
) -> Result<Json<commerce::OrdersResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        commerce::get_facebook_orders(&s.mongo, &s.meta, &p).await?,
    ))
}

async fn order_fulfill(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path((id, order_id)): Path<(String, String)>,
    Json(body): Json<commerce::FulfillBody>,
) -> Result<Json<commerce::AckResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        commerce::fulfill_order(&s.meta, &p, &order_id, body.tracking_info).await?,
    ))
}

async fn order_cancel(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path((id, order_id)): Path<(String, String)>,
    Json(body): Json<commerce::ReasonBody>,
) -> Result<Json<commerce::AckResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        commerce::cancel_order(&s.meta, &p, &order_id, body.reason).await?,
    ))
}

async fn order_refund(
    user: AuthUser,
    State(s): State<WachatFacebookBusinessState>,
    Path((id, order_id)): Path<(String, String)>,
    Json(body): Json<commerce::ReasonBody>,
) -> Result<Json<commerce::AckResp>> {
    let p = load_project_for(&user, &s.mongo, &id).await?;
    Ok(Json(
        commerce::refund_order(&s.meta, &p, &order_id, body.reason).await?,
    ))
}
