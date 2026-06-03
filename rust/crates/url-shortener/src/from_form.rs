//! Multipart-form entrypoints. The Next.js Server Action shim forwards
//! the entire `FormData` to one of these endpoints; Rust parses the
//! parts directly. Eliminates the per-field `formData.get(...)` boilerplate
//! that used to sit in `url-shortener.actions.ts`.

use axum::{
    Json,
    extract::{Multipart, State},
};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use std::collections::HashMap;

use crate::{
    state::UrlShortenerState,
    store::{self, AddDomainBody, AddDomainResult, CreateBody, CreateResult},
};

/// Parse multipart text fields into a `(name → value)` map. Files are
/// ignored — callers that need binary parts use `next_field()` directly.
pub(crate) async fn collect_text_fields(mut mp: Multipart) -> Result<HashMap<String, String>> {
    let mut out = HashMap::new();
    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(format!("multipart: {e}")))?
    {
        let name = field.name().unwrap_or("").to_owned();
        if name.is_empty() {
            continue;
        }
        // `text()` consumes binary content as UTF-8 lossily. For form fields
        // this is what we want; binary parts use `next_field()` direct.
        let value = field
            .text()
            .await
            .map_err(|e| ApiError::BadRequest(format!("field '{name}': {e}")))?;
        out.insert(name, value);
    }
    Ok(out)
}

pub async fn create_short_url(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    multipart: Multipart,
) -> Result<Json<CreateResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let fields = collect_text_fields(multipart).await?;

    let original_url = fields.get("originalUrl").cloned().unwrap_or_default();
    let alias = fields.get("alias").cloned().filter(|s| !s.is_empty());
    let tag_ids: Vec<String> = fields
        .get("tagIds")
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default();
    let expires_at = fields.get("expiresAt").cloned().filter(|s| !s.is_empty());
    let domain_id_raw = fields.get("domainId").cloned();
    let domain_id = match domain_id_raw.as_deref() {
        Some("none") | Some("") | None => None,
        Some(s) => Some(s.to_owned()),
    };

    let body = CreateBody {
        original_url,
        alias,
        tag_ids,
        expires_at,
        domain_id,
        custom_slug: None,
        click_limit: None,
        password_hash: None,
        utm_params: None,
        split_targets: None,
        activate_at: None,
        pixel_ids: None,
        health_status: None,
    };
    Ok(Json(store::create(&s.mongo, oid, body).await?))
}

pub async fn add_custom_domain(
    user: AuthUser,
    State(s): State<UrlShortenerState>,
    multipart: Multipart,
) -> Result<Json<AddDomainResult>> {
    let oid = oid_from_str(&user.user_id)?;
    let fields = collect_text_fields(multipart).await?;
    let hostname = fields.get("hostname").cloned().unwrap_or_default();
    Ok(Json(
        store::add_domain(&s.mongo, oid, AddDomainBody { hostname }).await?,
    ))
}
