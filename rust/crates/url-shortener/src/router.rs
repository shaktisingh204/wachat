//! Axum router for `/v1/url-shortener/*`.

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{FromRef, Multipart, Path, Query, State},
    routing::{delete as axum_delete, get, post},
};
use sabnode_auth::{AuthConfig, AuthUser};
use sabnode_common::Result;
use sabnode_db::bson_helpers::oid_from_str;
use serde::Deserialize;

use crate::{
    from_form,
    redirect,
    state::UrlShortenerState,
    store::{
        self, AddDomainBody, AddDomainResult, BulkCreateBody, BulkCreateResult, CreateBody,
        CreateResult, DeleteDomainResult, DeleteManyBody, DeleteManyResult, DeleteOneResult,
        VerifyDomainResult,
    },
};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    UrlShortenerState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Public: browser hits this from the redirect server-component, no JWT.
        .route("/resolve", post(redirect::resolve))
        // User-scoped CRUD.
        .route("/", get(list).post(create))
        .route("/bulk", post(bulk_create))
        .route("/bulk-upload", post(bulk_upload))
        .route("/delete-many", post(delete_many))
        .route("/count", get(count_user))
        .route("/admin/count-global", post(count_global))
        .route("/{id}", get(get_one).delete(delete_one))
        // Analytics sub-routes — must come before /{id} catch-all in declaration
        // but Axum route matching is exact-then-parameterised so order here is fine.
        .route("/{id}/analytics/timeline", get(analytics_timeline))
        .route("/{id}/analytics/geo", get(analytics_geo))
        .route("/{id}/analytics/devices", get(analytics_devices))
        .route("/{id}/analytics/referrers", get(analytics_referrers))
        // Password verification — public (caller provides the hash to compare).
        .route("/verify-password", post(verify_password_handler))
        // Admin helpers.
        .route("/admin/activate-scheduled", post(activate_scheduled_handler))
        // Custom domains live on the user doc but are exposed here.
        .route("/domains", get(list_domains).post(add_domain))
        .route("/domains/{domain_id}/verify", post(verify_domain))
        .route("/domains/{domain_id}", axum_delete(delete_domain))
        // Multipart entrypoints — Server Actions forward FormData here.
        .route("/from-form/create", post(from_form::create_short_url))
        .route("/from-form/add-domain", post(from_form::add_custom_domain))
}

async fn count_user(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
) -> Result<Json<store::CountResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::count_for_user(&s.mongo, oid).await?))
}

async fn count_global(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
) -> Result<Json<store::CountResult>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(sabnode_common::ApiError::Forbidden(
            "admin role required".to_owned(),
        ));
    }
    Ok(Json(store::count_global(&s.mongo).await?))
}

async fn create(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<CreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::create(&s.mongo, oid, body).await?))
}

async fn bulk_create(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Json(body): Json<BulkCreateBody>,
) -> Result<Json<BulkCreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::bulk_create(&s.mongo, oid, body.items).await?))
}

/// Multipart bulk upload — accepts a `.csv` or `.xlsx` file directly,
/// parses Rust-side, and inserts. Replaces the legacy
/// "TS parses with papaparse + xlsx → JSON to /bulk" round-trip.
async fn bulk_upload(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    mut multipart: Multipart,
) -> Result<Json<BulkCreateResult>> {
    let oid = oid_from_str(&user.user_id)?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut filename: String = String::new();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| sabnode_common::ApiError::BadRequest(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        if name == "urlFile" || name == "file" {
            if let Some(fname) = field.file_name() {
                filename = fname.to_owned();
            }
            let bytes = field
                .bytes()
                .await
                .map_err(|e| sabnode_common::ApiError::BadRequest(format!("{e}")))?;
            file_bytes = Some(bytes.to_vec());
        }
    }

    let bytes = file_bytes.unwrap_or_default();
    if bytes.is_empty() {
        return Ok(Json(BulkCreateResult {
            error: Some("A file is required.".to_owned()),
            message: None,
        }));
    }

    let items = match store::parse_bulk_upload(&filename, &bytes) {
        Ok(it) => it,
        Err(e) => {
            return Ok(Json(BulkCreateResult {
                error: Some(e.to_string()),
                message: None,
            }));
        }
    };
    Ok(Json(store::bulk_create(&s.mongo, oid, items).await?))
}

async fn list(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
) -> Result<Json<store::ListResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::list(&s.mongo, oid).await?))
}

async fn get_one(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
) -> Result<Json<Option<serde_json::Value>>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::get_one(&s.mongo, oid, &id).await?))
}

async fn delete_one(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
) -> Result<Json<DeleteOneResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::delete_one(&s.mongo, oid, &id).await?))
}

async fn delete_many(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Json(body): Json<DeleteManyBody>,
) -> Result<Json<DeleteManyResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::delete_many(&s.mongo, oid, &body.ids).await?))
}

async fn list_domains(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::list_domains(&s.mongo, oid).await?))
}

async fn add_domain(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Json(body): Json<AddDomainBody>,
) -> Result<Json<AddDomainResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::add_domain(&s.mongo, oid, body).await?))
}

async fn verify_domain(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(domain_id): Path<String>,
) -> Result<Json<VerifyDomainResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::verify_domain(&s.mongo, &s.resolver, oid, &domain_id).await?,
    ))
}

async fn delete_domain(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(domain_id): Path<String>,
) -> Result<Json<DeleteDomainResult>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::delete_domain(&s.mongo, oid, &domain_id).await?,
    ))
}

// ---------------------------------------------------------------------------
// Analytics handlers
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct DaysQuery {
    #[serde(default = "default_days")]
    days: i64,
}

fn default_days() -> i64 {
    30
}

async fn analytics_timeline(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
    Query(q): Query<DaysQuery>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::get_analytics_timeline(&s.mongo, oid, &id, q.days).await?,
    ))
}

async fn analytics_geo(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(store::get_analytics_geo(&s.mongo, oid, &id).await?))
}

async fn analytics_devices(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::get_analytics_devices(&s.mongo, oid, &id).await?,
    ))
}

async fn analytics_referrers(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let oid = oid_from_str(&user.user_id)?;
    Ok(Json(
        store::get_analytics_referrers(&s.mongo, oid, &id).await?,
    ))
}

// ---------------------------------------------------------------------------
// Password verification handler
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VerifyPasswordBody {
    short_code: String,
    password_hash: String,
}

#[derive(serde::Serialize)]
struct VerifyPasswordResult {
    valid: bool,
}

async fn verify_password_handler(
    State(s): State<UrlShortenerState>,
    Json(body): Json<VerifyPasswordBody>,
) -> Result<Json<VerifyPasswordResult>> {
    let valid = store::verify_link_password(&s.mongo, &body.short_code, &body.password_hash).await?;
    Ok(Json(VerifyPasswordResult { valid }))
}

// ---------------------------------------------------------------------------
// Admin: activate scheduled links
// ---------------------------------------------------------------------------

#[derive(serde::Serialize)]
struct ActivateScheduledResult {
    activated: u64,
}

async fn activate_scheduled_handler(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
) -> Result<Json<ActivateScheduledResult>> {
    if !user.roles.iter().any(|r| r == "admin") {
        return Err(sabnode_common::ApiError::Forbidden(
            "admin role required".to_owned(),
        ));
    }
    let activated = store::activate_scheduled_links(&s.mongo).await?;
    Ok(Json(ActivateScheduledResult { activated }))
}
