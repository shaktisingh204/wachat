//! HTTP handlers for the user domain.
//!
//! Conventions:
//! - Handlers return `Result<Json<T>, ApiError>`. The `ApiError` `IntoResponse`
//!   impl in `sabnode-common` renders a uniform `{ ok: false, error: ... }`
//!   envelope, so handlers never need to format error bodies themselves.
//! - The Mongo collection name is `"users"`, matching the Next.js side
//!   (`src/lib/mongodb.ts`).

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;

use crate::dto::{MeResponse, SessionResponse};

const USERS_COLLECTION: &str = "users";
const PLANS_COLLECTION: &str = "plans";

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

/// `GET /v1/session` — return the authenticated user's full profile with the
/// active plan joined and `customPermissions` merged on top of the plan's
/// permissions. Mirrors the legacy `getSession()` server action so the
/// Next.js layout can swap a Mongo round-trip for one HTTP call.
#[utoipa::path(
    get,
    path = "/v1/session",
    tag = "users",
    responses(
        (status = 200, description = "Session bundle", body = SessionResponse),
        (status = 401, description = "Missing or invalid bearer token"),
        (status = 404, description = "Authenticated user no longer exists"),
    ),
    security(("bearer_jwt" = []))
)]
pub async fn session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
) -> Result<Json<SessionResponse>> {
    let oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let users = mongo.collection::<Document>(USERS_COLLECTION);
    let plans = mongo.collection::<Document>(PLANS_COLLECTION);

    // Fetch user without password.
    let mut user_doc = users
        .find_one(doc! { "_id": oid })
        .projection(doc! { "password": 0 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("user".to_owned()))?;

    // Resolve plan: explicit `planId` first, fall back to default plan.
    let plan_id = user_doc.get_object_id("planId").ok();
    let mut plan_doc: Option<Document> = if let Some(pid) = plan_id {
        plans
            .find_one(doc! { "_id": pid })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
    } else {
        None
    };
    if plan_doc.is_none() {
        plan_doc = plans
            .find_one(doc! { "isDefault": true })
            .await
            .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?;
    }

    // Initialize credits if missing — mirrors the legacy self-heal write so
    // a freshly-signed-up user lands on a usable allowance on first call.
    let needs_credit_init = !matches!(
        user_doc.get("credits"),
        Some(Bson::Document(_))
            | Some(Bson::Int32(_))
            | Some(Bson::Int64(_))
            | Some(Bson::Double(_))
    );
    if needs_credit_init {
        if let Some(plan) = plan_doc.as_ref() {
            let mut initial = doc! { "broadcast": 0, "sms": 0, "meta": 0, "email": 0 };
            if let Ok(ic) = plan.get_document("initialCredits") {
                initial = ic.clone();
            } else if let Some(legacy) = plan.get("signupCredits").and_then(Bson::as_i32) {
                initial.insert("broadcast", legacy);
            }
            // Best-effort write; failure here doesn't fail the request.
            let _ = users
                .update_one(
                    doc! { "_id": oid },
                    doc! { "$set": { "credits": initial.clone() } },
                )
                .await;
            user_doc.insert("credits", initial);
        }
    }

    // Merge permissions: customPermissions override plan permissions.
    let custom_perms = user_doc
        .get_document("customPermissions")
        .ok()
        .cloned()
        .unwrap_or_default();
    if let Some(plan) = plan_doc.as_mut() {
        let mut final_perms = plan
            .get_document("permissions")
            .ok()
            .cloned()
            .unwrap_or_default();
        for role_key in ["agent", "admin", "owner", "member"] {
            if let Ok(role_overrides) = custom_perms.get_document(role_key) {
                let mut merged = final_perms
                    .get_document(role_key)
                    .ok()
                    .cloned()
                    .unwrap_or_default();
                for (k, v) in role_overrides.iter() {
                    merged.insert(k, v.clone());
                }
                final_perms.insert(role_key, merged);
            }
        }
        plan.insert("permissions", final_perms);
    }

    // Convert both to clean JSON and assemble the response shape the
    // Next.js side expects (`{ user: { ..., _id, planId, plan } }`).
    let user_id_hex = user_doc
        .get_object_id("_id")
        .map_err(|e| ApiError::Internal(anyhow::anyhow!("missing _id: {e}")))?
        .to_hex();
    let plan_id_hex = user_doc.get_object_id("planId").ok().map(|o| o.to_hex());

    let mut user_value = document_to_clean_json(user_doc);
    if let Value::Object(map) = &mut user_value {
        map.insert("_id".to_owned(), Value::String(user_id_hex));
        if let Some(pid) = plan_id_hex {
            map.insert("planId".to_owned(), Value::String(pid));
        }
        map.insert(
            "plan".to_owned(),
            plan_doc.map(document_to_clean_json).unwrap_or(Value::Null),
        );
    }

    Ok(Json(SessionResponse { user: user_value }))
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
