//! HTTP handlers for the wachat-razorpay domain.
//!
//! Backs `src/app/wachat/integrations/razorpay/page.tsx` +
//! `src/app/actions/integrations.actions.ts`:
//!
//! | Endpoint                                         | TS source                    |
//! |--------------------------------------------------|------------------------------|
//! | `GET  /projects/{id}/settings`                   | (project.razorpaySettings)   |
//! | `PUT  /projects/{id}/settings`                   | `saveRazorpaySettings`       |
//! | `GET  /projects/{id}/logs/transactions`          | `getRazorpayLogs` (payments) |
//! | `GET  /projects/{id}/logs/payment-links`         | `getRazorpayLogs` (links)    |
//! | `POST /projects/{id}/payment-links`              | `createRazorpayPaymentLink`  |
//!
//! ## Tenancy
//!
//! Every endpoint runs the owner-or-agent guard ([`load_project_membership`])
//! before reading creds or touching the network — a project is only visible to
//! its `userId` or an entry in `agents.userId`. Credentials live in the real
//! `projects.razorpaySettings` sub-doc (no second store).
//!
//! ## External seam
//!
//! All Razorpay HTTP is delegated to [`crate::razorpay_client`]. The settings
//! GET/PUT never reach the network and work with no creds. The log + create
//! endpoints require configured creds (else
//! `ApiError::BadRequest("Razorpay not configured")`) and surface any upstream
//! failure as `ApiError::Internal` — nothing here panics or unwraps a network
//! result.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePaymentLinkBody, CreatePaymentLinkResponse, LogsResponse, PutSettingsBody,
    SettingsResponse, SuccessResponse,
};
use crate::razorpay_client::{self, RazorpayCreds};
use crate::state::WachatRazorpayState;

const PROJECTS_COLL: &str = "projects";

/// Razorpay collection page size — mirrors the TS `{ count: 10 }`.
const LOG_COUNT: u32 = 10;

/// Masked stand-in returned in place of a stored `keySecret`.
const MASKED_SECRET: &str = "••••••••";

// ===========================================================================
// Tenancy guard
// ===========================================================================

/// Load a project and enforce **owner-or-agent** access for the caller.
/// Collapses not-found and forbidden into a single 404 so project existence
/// is not leaked (mirrors `wachat-contacts::load_project_with_membership`).
async fn load_project_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    coll.find_one(doc! {
        "_id": project_oid,
        "$or": [
            { "userId": user_oid },
            { "agents.userId": user_oid },
        ],
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
    .ok_or_else(|| {
        ApiError::NotFound("Project not found or you do not have permission.".to_owned())
    })
}

/// Pull `razorpaySettings` off a loaded project doc, if present.
fn razorpay_settings(project: &Document) -> Option<&Document> {
    project.get_document("razorpaySettings").ok()
}

/// Load the project (with the membership guard) and extract its Razorpay
/// creds, returning `ApiError::BadRequest("Razorpay not configured")` when the
/// sub-doc is missing or empty. Used by the network-touching endpoints.
async fn load_creds(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<RazorpayCreds> {
    let project = load_project_membership(user, mongo, project_id_hex).await?;
    RazorpayCreds::from_settings(razorpay_settings(&project))
        .ok_or_else(|| ApiError::BadRequest("Razorpay not configured".to_owned()))
}

// ===========================================================================
// GET /projects/{id}/settings
// ===========================================================================

/// `GET /projects/{id}/settings` — read `razorpaySettings`, masking the
/// secret. Works with no creds (returns `configured: false`). No network.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn get_settings(
    user: AuthUser,
    State(state): State<WachatRazorpayState>,
    Path(id): Path<String>,
) -> Result<Json<SettingsResponse>> {
    let project = load_project_membership(&user, &state.mongo, &id).await?;

    let (key_id, has_secret) = match razorpay_settings(&project) {
        Some(s) => (
            s.get_str("keyId").unwrap_or_default().to_owned(),
            !s.get_str("keySecret").unwrap_or_default().trim().is_empty(),
        ),
        None => (String::new(), false),
    };
    let configured = !key_id.trim().is_empty() && has_secret;

    Ok(Json(SettingsResponse {
        key_id,
        key_secret: if has_secret {
            MASKED_SECRET.to_owned()
        } else {
            String::new()
        },
        configured,
    }))
}

// ===========================================================================
// PUT /projects/{id}/settings
// ===========================================================================

/// `PUT /projects/{id}/settings` — upsert `razorpaySettings`. Mirrors
/// `saveRazorpaySettings`: both fields required, stored verbatim. No network.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn put_settings(
    user: AuthUser,
    State(state): State<WachatRazorpayState>,
    Path(id): Path<String>,
    Json(body): Json<PutSettingsBody>,
) -> Result<Json<SuccessResponse>> {
    if body.key_id.trim().is_empty() || body.key_secret.trim().is_empty() {
        return Err(ApiError::Validation(
            "Both Key ID and Key Secret are required.".to_owned(),
        ));
    }

    // Guard first so we never write to a project the caller cannot see.
    let project = load_project_membership(&user, &state.mongo, &id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    let now = bson::DateTime::from_chrono(Utc::now());
    state
        .mongo
        .collection::<Document>(PROJECTS_COLL)
        .update_one(
            doc! { "_id": project_oid },
            doc! { "$set": {
                "razorpaySettings": {
                    "keyId": body.key_id.trim(),
                    "keySecret": body.key_secret.trim(),
                },
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(razorpaySettings)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /projects/{id}/logs/transactions
// ===========================================================================

/// `GET /projects/{id}/logs/transactions` — Razorpay `payments.all`.
/// Requires configured creds. EXTERNAL SEAM via `razorpay_client`.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn list_transactions(
    user: AuthUser,
    State(state): State<WachatRazorpayState>,
    Path(id): Path<String>,
) -> Result<Json<LogsResponse>> {
    let creds = load_creds(&user, &state.mongo, &id).await?;
    let items = razorpay_client::list_payments(&creds, LOG_COUNT).await?;
    Ok(Json(LogsResponse { items }))
}

// ===========================================================================
// GET /projects/{id}/logs/payment-links
// ===========================================================================

/// `GET /projects/{id}/logs/payment-links` — Razorpay `paymentLink.all`.
/// Requires configured creds. EXTERNAL SEAM via `razorpay_client`.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn list_payment_links(
    user: AuthUser,
    State(state): State<WachatRazorpayState>,
    Path(id): Path<String>,
) -> Result<Json<LogsResponse>> {
    let creds = load_creds(&user, &state.mongo, &id).await?;
    let items = razorpay_client::list_payment_links(&creds, LOG_COUNT).await?;
    Ok(Json(LogsResponse { items }))
}

// ===========================================================================
// POST /projects/{id}/payment-links
// ===========================================================================

/// `POST /projects/{id}/payment-links` — create a Razorpay payment link.
/// Mirrors `createRazorpayPaymentLink`: amount in rupees (≥1) is converted to
/// paise. Requires configured creds. EXTERNAL SEAM via `razorpay_client`.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn create_payment_link(
    user: AuthUser,
    State(state): State<WachatRazorpayState>,
    Path(id): Path<String>,
    Json(body): Json<CreatePaymentLinkBody>,
) -> Result<Json<CreatePaymentLinkResponse>> {
    if body.amount < 1.0 {
        return Err(ApiError::Validation(
            "Payment amount must be at least ₹1.".to_owned(),
        ));
    }
    if body.contact.trim().is_empty() || body.description.trim().is_empty() {
        return Err(ApiError::Validation(
            "Contact and description are required.".to_owned(),
        ));
    }

    let creds = load_creds(&user, &state.mongo, &id).await?;

    // Rupees -> paise (smallest currency unit), matching the TS `amount * 100`.
    let amount_paise = (body.amount * 100.0).round() as i64;
    // Razorpay expects Indian numbers without the +91 prefix.
    let contact = body
        .contact
        .trim()
        .trim_start_matches('+')
        .trim_start_matches("91")
        .to_owned();

    let (link_id, short_url) = razorpay_client::create_payment_link(
        &creds,
        amount_paise,
        &contact,
        body.description.trim(),
        body.name.as_deref(),
        body.email.as_deref(),
    )
    .await?;

    Ok(Json(CreatePaymentLinkResponse {
        id: link_id,
        short_url,
    }))
}
