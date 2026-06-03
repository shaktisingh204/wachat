//! HTTP handlers for the unauthenticated admin bootstrap surface.
//!
//! These four endpoints establish or revoke the admin session itself:
//! `is_configured`, `setup`, `login`, and `logout_revoke`. Once the admin
//! cookie is in place on the Next.js side, the TS proxy mints an admin-role
//! bearer JWT and calls the gated `require_role("admin")` endpoints (added
//! in Phase 2).

use axum::{Json, extract::State};
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::{
    dto::{AdminOk, ConfiguredResponse, LoginBody, LogoutRevokeBody, SetupBody},
    store,
};

/// `GET /v1/admin/configured` — does an admin credential document exist?
/// The Next.js login page calls this to choose between the login form and
/// the first-time setup form.
#[utoipa::path(
    get,
    path = "/v1/admin/configured",
    tag = "admin",
    responses((status = 200, description = "Whether an admin is configured", body = ConfiguredResponse)),
)]
pub async fn is_configured(State(mongo): State<MongoHandle>) -> Result<Json<ConfiguredResponse>> {
    let configured = store::find_credentials(&mongo).await?.is_some();
    Ok(Json(ConfiguredResponse { configured }))
}

/// `POST /v1/admin/setup` — first-time admin creation. Refuses to overwrite
/// an existing admin (returns 409). The TS server action sets the
/// `admin_session` cookie locally after we return ok.
#[utoipa::path(
    post,
    path = "/v1/admin/setup",
    tag = "admin",
    request_body = SetupBody,
    responses(
        (status = 200, description = "Initial admin created", body = AdminOk),
        (status = 400, description = "Invalid email / password / mismatch"),
        (status = 409, description = "An admin already exists"),
    ),
)]
pub async fn setup(
    State(mongo): State<MongoHandle>,
    Json(body): Json<SetupBody>,
) -> Result<Json<AdminOk>> {
    let email = store::normalize_and_validate_email(&body.email)?;

    if body.password.len() < 10 {
        return Err(ApiError::BadRequest(
            "Password must be at least 10 characters.".to_owned(),
        ));
    }
    if body.password != body.confirm_password {
        return Err(ApiError::BadRequest("Passwords do not match.".to_owned()));
    }

    store::create_initial_admin(&mongo, &email, &body.password).await?;
    Ok(Json(AdminOk::new()))
}

/// `POST /v1/admin/login` — verify email + password against the stored
/// bcrypt hash. Does NOT mint the admin cookie; the TS server action does
/// that on the Next.js side using `createAdminSessionToken`.
///
/// Status codes:
/// - 200 — success.
/// - 400 — missing email/password.
/// - 401 — invalid credentials OR no admin configured.
#[utoipa::path(
    post,
    path = "/v1/admin/login",
    tag = "admin",
    request_body = LoginBody,
    responses(
        (status = 200, description = "Credentials verified", body = AdminOk),
        (status = 400, description = "Missing email or password"),
        (status = 401, description = "Invalid credentials"),
    ),
)]
pub async fn login(
    State(mongo): State<MongoHandle>,
    Json(body): Json<LoginBody>,
) -> Result<Json<AdminOk>> {
    let email = body.email.trim().to_lowercase();
    if email.is_empty() || body.password.is_empty() {
        return Err(ApiError::BadRequest(
            "Email and password are required.".to_owned(),
        ));
    }

    let stored = store::find_credentials(&mongo)
        .await?
        .ok_or_else(|| ApiError::Unauthorized("NEEDS_SETUP".to_owned()))?;

    if email != stored.email.to_lowercase() {
        return Err(ApiError::Unauthorized("Invalid credentials.".to_owned()));
    }

    let ok = store::verify_password(&body.password, &stored.password_hash)?;
    if !ok {
        return Err(ApiError::Unauthorized("Invalid credentials.".to_owned()));
    }

    Ok(Json(AdminOk::new()))
}

/// `POST /v1/admin/logout/revoke` — append a JTI to the `revoked_tokens`
/// collection so subsequent `verifyAdminJwt` calls reject it. Always
/// returns 200 to avoid leaking whether the jti existed.
#[utoipa::path(
    post,
    path = "/v1/admin/logout/revoke",
    tag = "admin",
    request_body = LogoutRevokeBody,
    responses((status = 200, description = "Revocation recorded", body = AdminOk)),
)]
pub async fn logout_revoke(
    State(mongo): State<MongoHandle>,
    Json(body): Json<LogoutRevokeBody>,
) -> Result<Json<AdminOk>> {
    if body.jti.trim().is_empty() {
        return Err(ApiError::BadRequest("jti is required.".to_owned()));
    }
    // Soft-fail on persistence errors: if Mongo is unreachable we still
    // return success so the user can finish logout client-side. The TS side
    // already implements this fail-open behavior.
    if let Err(e) = store::revoke_token(&mongo, &body.jti, body.exp_seconds, None).await {
        tracing::warn!(error = %e, jti = %body.jti, "admin logout: revoke failed; cookie will still be cleared");
    }
    Ok(Json(AdminOk::new()))
}
