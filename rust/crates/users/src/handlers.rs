//! HTTP handlers for the user domain.
//!
//! Conventions:
//! - Handlers return `Result<Json<T>, ApiError>`. The `ApiError` `IntoResponse`
//!   impl in `sabnode-common` renders a uniform `{ ok: false, error: ... }`
//!   envelope, so handlers never need to format error bodies themselves.
//! - The Mongo collection name is `"users"`, matching the Next.js side
//!   (`src/lib/mongodb.ts`).

use axum::{Json, extract::State};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;

use crate::dto::MeResponse;

const USERS_COLLECTION: &str = "users";

/// `GET /v1/me` — return the authenticated user's profile.
#[utoipa::path(
    get,
    path = "/v1/me",
    tag = "users",
    responses(
        (status = 200, description = "Current user profile", body = MeResponse),
        (status = 401, description = "Missing or invalid bearer token"),
        (status = 404, description = "Authenticated user no longer exists"),
    ),
    security(("bearer_jwt" = []))
)]
pub async fn me(user: AuthUser, State(mongo): State<MongoHandle>) -> Result<Json<MeResponse>> {
    let oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(USERS_COLLECTION);

    let raw = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("user".to_owned()))?;

    Ok(Json(document_to_me(&raw)?))
}

fn document_to_me(raw: &Document) -> Result<MeResponse> {
    let id = raw
        .get_object_id("_id")
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("missing _id: {e}")))?
        .to_hex();

    let email = raw
        .get_str("email")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("user document missing email")))?
        .to_owned();

    let name = raw.get_str("name").ok().map(|s| s.to_owned());

    let created_at = match raw.get_datetime("createdAt") {
        Ok(dt) => chrono::DateTime::<chrono::Utc>::from(*dt),
        Err(_) => chrono::DateTime::<chrono::Utc>::from_timestamp(0, 0)
            .expect("epoch is a valid timestamp"),
    };

    Ok(MeResponse {
        id,
        email,
        name,
        created_at,
    })
}
