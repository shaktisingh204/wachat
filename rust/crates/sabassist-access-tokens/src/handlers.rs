//! HTTP handlers for SabAssist access tokens.
//!
//! Two surfaces:
//!  * Authenticated technician — issue / list tokens for sessions they own.
//!  * **Public (unauthenticated)** — `/redeem` consumes a token + optional PIN
//!    and flips it to `used`. The customer's browser hits this directly from
//!    the share link landing page.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, doc};
use chrono::{Duration, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use rand::{Rng, distributions::Alphanumeric, thread_rng};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    IssueTokenInput, IssueTokenResponse, ListQuery, RedeemTokenInput, RedeemTokenResponse,
};
use crate::types::SabassistAccessToken;

const COLL: &str = "sabassist_access_tokens";
const SESSIONS_COLL: &str = "sabassist_sessions";
const DEFAULT_TTL_SECS: u32 = 900;

fn generate_token() -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect()
}

fn generate_pin() -> String {
    let mut rng = thread_rng();
    let n: u32 = rng.gen_range(0..1_000_000);
    format!("{n:06}")
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabassistAccessToken>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tokens(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(sid) = q.session_id.as_deref() {
        let oid = oid_from_str(sid)?;
        filter.insert("sessionId", oid);
    }
    if let Some(u) = q.used {
        filter.insert("used", u);
    }
    let coll = mongo.collection::<SabassistAccessToken>(COLL);
    let cursor = coll.find(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_access_tokens.find"))
    })?;
    let rows: Vec<SabassistAccessToken> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_access_tokens.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn issue_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IssueTokenInput>,
) -> Result<Json<IssueTokenResponse>> {
    let user_id = user_oid(&user)?;
    let session_oid = oid_from_str(&input.session_id)?;

    // Ownership check: technician must own the target session.
    let sessions = mongo.collection::<bson::Document>(SESSIONS_COLL);
    let owned = sessions
        .find_one(doc! { "_id": session_oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_sessions.owned_check"))
        })?
        .is_some();
    if !owned {
        return Err(ApiError::NotFound("sabassist_session".to_owned()));
    }

    let ttl_secs = input
        .ttl_secs
        .unwrap_or(DEFAULT_TTL_SECS)
        .max(30)
        .min(86_400);
    let now = Utc::now();
    let expires_at = now + Duration::seconds(ttl_secs as i64);

    let pin = if input.require_pin.unwrap_or(false) {
        Some(generate_pin())
    } else {
        None
    };

    let entity = SabassistAccessToken {
        id: None,
        user_id,
        session_id: session_oid,
        token: generate_token(),
        expires_at: BsonDateTime::from_chrono(expires_at),
        used: false,
        used_at: None,
        one_time_pin: pin.clone(),
        device_fingerprint: input.device_fingerprint,
        created_at: BsonDateTime::from_chrono(now),
    };

    let coll = mongo.collection::<SabassistAccessToken>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabassist_access_tokens.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;

    Ok(Json(IssueTokenResponse {
        id: new_id.to_hex(),
        token: entity.token,
        session_id: session_oid.to_hex(),
        expires_at: expires_at.to_rfc3339(),
        one_time_pin: pin,
    }))
}

#[instrument(skip_all, fields(id = %token_id))]
pub async fn revoke_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(token_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&token_id)?;
    let coll = mongo.collection::<SabassistAccessToken>(COLL);
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": { "used": true, "usedAt": BsonDateTime::from_chrono(Utc::now()) } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_access_tokens.revoke"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("sabassist_access_token".to_owned()));
    }
    Ok(Json(serde_json::json!({ "revoked": true })))
}

/// **Public** endpoint. No auth. Validates a token + optional PIN against
/// the stored document; flips `used = true` on success; returns the
/// minimal payload the customer browser needs to bootstrap the WebRTC
/// transport. Mount this on a router *without* the auth layer.
#[instrument(skip_all)]
pub async fn redeem_token(
    State(mongo): State<MongoHandle>,
    Json(input): Json<RedeemTokenInput>,
) -> Result<Json<RedeemTokenResponse>> {
    if input.token.trim().is_empty() {
        return Err(ApiError::Validation("token is required".to_owned()));
    }

    let tokens = mongo.collection::<SabassistAccessToken>(COLL);
    let row = tokens
        .find_one(doc! { "token": &input.token })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabassist_access_tokens.find_by_token"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_access_token".to_owned()))?;

    if row.used {
        return Err(ApiError::Validation("token already used".to_owned()));
    }
    let now = Utc::now();
    if row.expires_at.to_chrono() < now {
        return Err(ApiError::Validation("token expired".to_owned()));
    }

    // PIN gate (attended sessions): if the token has a pin, the redeemer must supply it.
    if let Some(expected_pin) = row.one_time_pin.as_ref() {
        let supplied = input.pin.as_deref().unwrap_or("");
        if supplied != expected_pin {
            return Err(ApiError::Validation("invalid PIN".to_owned()));
        }
    }

    // Device fingerprint gate (unattended sessions).
    if let Some(expected_fp) = row.device_fingerprint.as_ref() {
        let supplied = input.device_fingerprint.as_deref().unwrap_or("");
        if supplied != expected_fp {
            return Err(ApiError::Validation(
                "device fingerprint mismatch".to_owned(),
            ));
        }
    }

    let token_id = row
        .id
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("redeem: token row missing _id")))?;

    tokens
        .update_one(
            doc! { "_id": token_id, "used": false },
            doc! { "$set": { "used": true, "usedAt": BsonDateTime::from_chrono(now) } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabassist_access_tokens.flip_used"))
        })?;

    // Look up the session to surface its mode.
    let sessions = mongo.collection::<bson::Document>(SESSIONS_COLL);
    let session = sessions
        .find_one(doc! { "_id": row.session_id })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabassist_sessions.lookup_for_redeem"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("sabassist_session".to_owned()))?;

    let mode = session.get_str("mode").unwrap_or("attended").to_owned();

    Ok(Json(RedeemTokenResponse {
        ok: true,
        session_id: row.session_id.to_hex(),
        mode,
        user_id: row.user_id.to_hex(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_token_has_expected_length_and_charset() {
        let t = generate_token();
        assert_eq!(t.len(), 48);
        assert!(t.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn generated_pin_is_six_digits() {
        let p = generate_pin();
        assert_eq!(p.len(), 6);
        assert!(p.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn redeem_response_omits_pin() {
        // RedeemTokenResponse intentionally does not have a `pin` field.
        let r = RedeemTokenResponse {
            ok: true,
            session_id: ObjectId::new().to_hex(),
            mode: "attended".into(),
            user_id: ObjectId::new().to_hex(),
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(!s.contains("pin"));
        assert!(!s.contains("token"));
    }
}
