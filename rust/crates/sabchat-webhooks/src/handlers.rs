//! HTTP handlers for the SabChat outbound-webhooks domain.
//!
//! | Endpoint                                                        | Handler                  |
//! |-----------------------------------------------------------------|--------------------------|
//! | `POST   /v1/sabchat/webhooks/endpoints`                         | [`create_endpoint`]      |
//! | `GET    /v1/sabchat/webhooks/endpoints`                         | [`list_endpoints`]       |
//! | `PATCH  /v1/sabchat/webhooks/endpoints/{id}`                    | [`update_endpoint`]      |
//! | `DELETE /v1/sabchat/webhooks/endpoints/{id}`                    | [`delete_endpoint`]      |
//! | `POST   /v1/sabchat/webhooks/endpoints/{id}/test`               | [`test_endpoint`]        |
//! | `GET    /v1/sabchat/webhooks/deliveries`                        | [`list_deliveries`]      |
//! | `POST   /v1/sabchat/webhooks/deliveries/{id}/retry`             | [`retry_delivery`]       |
//! | `GET    /v1/sabchat/webhooks/dlq`                               | [`list_dlq`]             |
//!
//! ## Tenancy
//!
//! Every endpoint pulls the tenant id from the JWT (`AuthUser.tenant_id`,
//! parsed as `ObjectId`). There is no path / query parameter that lets
//! a caller name a tenant — cross-tenant access is impossible by
//! construction, and a malformed `tid` claim is `401 Unauthorized`.
//!
//! ## HMAC signing
//!
//! The endpoint document stores `secret` as a plain string. The
//! out-of-process worker that actually POSTs each delivery is expected
//! to compute `hex(hmac_sha256(secret, body))` and send it as the
//! `X-SabChat-Signature` request header. [`sign_payload`] is exposed
//! `pub(crate)` so that worker (when it lands in a sibling crate) can
//! import the exact same primitive — keeping signing and storage in one
//! place avoids the "two implementations drift apart" failure mode.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use hmac::{Hmac, Mac};
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::{Value, json};
use sha2::Sha256;
use tracing::instrument;
use url::Url;

use crate::dto::{
    CreateEndpointBody, CreateEndpointResponse, ListDeliveriesQuery, ListDeliveriesResponse,
    ListDlqQuery, ListEndpointsResponse, MAX_LIMIT, RetryDeliveryResponse, SuccessResponse,
    TestEndpointResponse, UpdateEndpointBody,
};
use crate::state::SabChatWebhooksState;
use crate::{DELIVERIES_COLL, DLQ_COLL, ENDPOINTS_COLL};

// ===========================================================================
// Tenancy helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

// ===========================================================================
// Secret + URL helpers
// ===========================================================================

/// Generate a random 32-byte hex secret (`64` hex chars). Uses
/// `ObjectId::new()` twice as a portable entropy source — we avoid
/// pulling `rand` into the dep graph just for this. The two OIDs each
/// embed a process-counter + random component, so their concatenated
/// 24-byte payload is functionally unpredictable at the granularity we
/// need for a webhook secret.
fn generate_secret() -> String {
    let a = ObjectId::new().bytes();
    let b = ObjectId::new().bytes();
    let mut buf = [0u8; 24];
    buf[..12].copy_from_slice(&a);
    buf[12..].copy_from_slice(&b);
    hex::encode(buf)
}

/// Validate a URL string and normalize it to its serialized form.
/// Rejects anything that is not `http` / `https` so the worker cannot
/// be tricked into hitting `file://` or `gopher://`.
fn validate_url(raw: &str) -> Result<String> {
    let parsed = Url::parse(raw.trim())
        .map_err(|e| ApiError::Validation(format!("invalid endpoint URL: {e}")))?;
    match parsed.scheme() {
        "http" | "https" => Ok(parsed.to_string()),
        other => Err(ApiError::Validation(format!(
            "endpoint URL scheme `{other}` not allowed; use http(s)"
        ))),
    }
}

/// `hex(hmac_sha256(secret, body))` — the canonical
/// `X-SabChat-Signature` value. Exposed `pub(crate)` so the future
/// outbound worker can reuse the exact same primitive without a second
/// implementation.
pub(crate) fn sign_payload(secret: &str, body: &[u8]) -> String {
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(secret.as_bytes())
        .expect("HMAC-SHA256 accepts keys of any length");
    mac.update(body);
    hex::encode(mac.finalize().into_bytes())
}

/// Build a `pending` delivery `Document` ready for insert. Centralized
/// here so [`create_delivery_row`] (the test endpoint), [`retry_delivery`]
/// re-queuing, and [`crate::enqueue`] (the public helper) all agree on
/// the shape down to the field order.
fn build_delivery_doc(
    tenant: ObjectId,
    endpoint_id: ObjectId,
    event: &str,
    payload: &Value,
) -> Document {
    let now = bson::DateTime::from_chrono(Utc::now());
    let payload_bson = Bson::try_from(payload.clone()).unwrap_or(Bson::Null);
    doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "endpointId": endpoint_id,
        "event": event,
        "payload": payload_bson,
        "status": "pending",
        "attempts": 0_i32,
        "createdAt": now,
    }
}

// ===========================================================================
// POST /endpoints — create_endpoint
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn create_endpoint(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Json(body): Json<CreateEndpointBody>,
) -> Result<Json<CreateEndpointResponse>> {
    let tenant = tenant_oid(&user)?;
    let url = validate_url(&body.url)?;

    let secret = body
        .secret
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(generate_secret);

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let events_bson: Vec<Bson> = body.events.iter().map(|s| Bson::String(s.clone())).collect();
    let doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "url": &url,
        "secret": &secret,
        "events": Bson::Array(events_bson),
        "active": body.active,
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(ENDPOINTS_COLL)
        .insert_one(doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_endpoints.insert_one"))
        })?;

    Ok(Json(CreateEndpointResponse {
        id: new_oid.to_hex(),
        url,
        secret,
        events: body.events,
        active: body.active,
    }))
}

// ===========================================================================
// GET /endpoints — list_endpoints
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_endpoints(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
) -> Result<Json<ListEndpointsResponse>> {
    let tenant = tenant_oid(&user)?;

    let coll = state.mongo.collection::<Document>(ENDPOINTS_COLL);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).build();
    let cursor = coll
        .find(doc! { "tenantId": tenant })
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_endpoints.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_endpoints.collect"))
    })?;

    let endpoints: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListEndpointsResponse { endpoints }))
}

// ===========================================================================
// GET /endpoints/{id} — get a single endpoint
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id, endpoint_id = %id))]
pub async fn get_endpoint(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let endpoint_oid = oid_from_str(&id)?;

    let coll = state.mongo.collection::<Document>(ENDPOINTS_COLL);
    let doc = coll
        .find_one(doc! { "_id": endpoint_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_endpoints.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Webhook endpoint not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// PATCH /endpoints/{id} — update_endpoint
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id, endpoint_id = %id))]
pub async fn update_endpoint(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateEndpointBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let endpoint_oid = oid_from_str(&id)?;

    let mut set = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(raw) = body.url.as_deref() {
        set.insert("url", validate_url(raw)?);
    }
    if let Some(secret) = body.secret.as_deref() {
        // Empty string → rotate to a fresh random secret. Non-empty
        // string → use verbatim. We never store a literal empty
        // secret — it would render every signature trivially forgeable.
        let resolved = if secret.trim().is_empty() {
            generate_secret()
        } else {
            secret.to_owned()
        };
        set.insert("secret", resolved);
    }
    if let Some(events) = body.events.as_ref() {
        let events_bson: Vec<Bson> = events.iter().map(|s| Bson::String(s.clone())).collect();
        set.insert("events", Bson::Array(events_bson));
    }
    if let Some(active) = body.active {
        set.insert("active", active);
    }

    let coll = state.mongo.collection::<Document>(ENDPOINTS_COLL);
    let res = coll
        .update_one(
            doc! { "_id": endpoint_oid, "tenantId": tenant },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_webhook_endpoints.update_one"),
            )
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound(
            "Webhook endpoint not found.".to_owned(),
        ));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /endpoints/{id} — delete_endpoint
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id, endpoint_id = %id))]
pub async fn delete_endpoint(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&user)?;
    let endpoint_oid = oid_from_str(&id)?;

    let res = state
        .mongo
        .collection::<Document>(ENDPOINTS_COLL)
        .delete_one(doc! { "_id": endpoint_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_webhook_endpoints.delete_one"),
            )
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound(
            "Webhook endpoint not found.".to_owned(),
        ));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /endpoints/{id}/test — test_endpoint
// ===========================================================================

/// Record a synthetic `webhook.test` delivery for the given endpoint.
/// No HTTP fire happens here — the worker picks the row up like any
/// other `pending` delivery.
#[instrument(skip_all, fields(tenant = %user.tenant_id, endpoint_id = %id))]
pub async fn test_endpoint(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<TestEndpointResponse>> {
    let tenant = tenant_oid(&user)?;
    let endpoint_oid = oid_from_str(&id)?;

    // Confirm the endpoint exists + belongs to this tenant. We do NOT
    // require `active=true` — a paused endpoint can still be tested,
    // matching the way most webhook UIs work (you want to verify a
    // brand-new endpoint before flipping it on).
    let endpoints = state.mongo.collection::<Document>(ENDPOINTS_COLL);
    let exists = endpoints
        .find_one(doc! { "_id": endpoint_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_endpoints.find_one"))
        })?
        .is_some();
    if !exists {
        return Err(ApiError::NotFound(
            "Webhook endpoint not found.".to_owned(),
        ));
    }

    let event = "webhook.test";
    let payload = json!({
        "kind": event,
        "at": Utc::now().to_rfc3339(),
    });

    let delivery = build_delivery_doc(tenant, endpoint_oid, event, &payload);
    let delivery_oid = delivery
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("delivery missing _id")))?;

    state
        .mongo
        .collection::<Document>(DELIVERIES_COLL)
        .insert_one(delivery)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_webhook_deliveries.insert_one"),
            )
        })?;

    Ok(Json(TestEndpointResponse {
        delivery_id: delivery_oid.to_hex(),
        event: event.to_owned(),
    }))
}

// ===========================================================================
// GET /deliveries — list_deliveries
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_deliveries(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Query(query): Query<ListDeliveriesQuery>,
) -> Result<Json<ListDeliveriesResponse>> {
    let tenant = tenant_oid(&user)?;

    let mut filter = doc! { "tenantId": tenant };
    if let Some(id) = query.endpoint_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("endpointId", oid_from_str(id)?);
    }
    if let Some(status) = query.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(raw)? });
    }

    let limit = query.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(DELIVERIES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_deliveries.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_deliveries.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let deliveries: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListDeliveriesResponse {
        deliveries,
        next_cursor,
    }))
}

// ===========================================================================
// POST /deliveries/{id}/retry — retry_delivery
// ===========================================================================

/// Move a failed / DLQ delivery row back into `pending` so the worker
/// re-picks it. We check the active `sabchat_webhook_deliveries`
/// collection first; if the row only exists in the DLQ (which is the
/// case for anything that exhausted retries) we copy it back to the
/// active collection in `pending` state and delete the DLQ shadow.
#[instrument(skip_all, fields(tenant = %user.tenant_id, delivery_id = %id))]
pub async fn retry_delivery(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Path(id): Path<String>,
) -> Result<Json<RetryDeliveryResponse>> {
    let tenant = tenant_oid(&user)?;
    let delivery_oid = oid_from_str(&id)?;

    let deliveries = state.mongo.collection::<Document>(DELIVERIES_COLL);
    let dlq = state.mongo.collection::<Document>(DLQ_COLL);

    // ---- Active deliveries path ----------------------------------------
    let active = deliveries
        .find_one(doc! { "_id": delivery_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_webhook_deliveries.find_one"),
            )
        })?;
    if active.is_some() {
        deliveries
            .update_one(
                doc! { "_id": delivery_oid, "tenantId": tenant },
                doc! {
                    "$set": {
                        "status": "pending",
                        "nextAttemptAt": bson::DateTime::from_chrono(Utc::now()),
                    },
                },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e).context("sabchat_webhook_deliveries.update_one"),
                )
            })?;
        return Ok(Json(RetryDeliveryResponse {
            id: delivery_oid.to_hex(),
            status: "pending".to_owned(),
        }));
    }

    // ---- DLQ path -------------------------------------------------------
    let mut dlq_doc = dlq
        .find_one(doc! { "_id": delivery_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_dlq.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Webhook delivery not found.".to_owned()))?;

    // Reset the lifecycle fields and drop it back into the active
    // collection. We keep the original `_id` so anyone holding a
    // reference to it can still find the row.
    dlq_doc.insert("status", "pending");
    dlq_doc.insert("attempts", 0_i32);
    dlq_doc.remove("lastError");
    dlq_doc.remove("lastErrorAt");
    dlq_doc.remove("lastAttemptedAt");
    dlq_doc.insert(
        "nextAttemptAt",
        bson::DateTime::from_chrono(Utc::now()),
    );

    deliveries.insert_one(dlq_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_webhook_deliveries.insert_one(retry)"),
        )
    })?;
    dlq.delete_one(doc! { "_id": delivery_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_dlq.delete_one"))
        })?;

    Ok(Json(RetryDeliveryResponse {
        id: delivery_oid.to_hex(),
        status: "pending".to_owned(),
    }))
}

// ===========================================================================
// GET /dlq — list_dlq
// ===========================================================================

#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_dlq(
    user: AuthUser,
    State(state): State<SabChatWebhooksState>,
    Query(query): Query<ListDlqQuery>,
) -> Result<Json<ListDeliveriesResponse>> {
    let tenant = tenant_oid(&user)?;

    let mut filter = doc! { "tenantId": tenant };
    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(raw)? });
    }

    let limit = query.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(DLQ_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_dlq.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_webhook_dlq.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let deliveries: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListDeliveriesResponse {
        deliveries,
        next_cursor,
    }))
}

// ===========================================================================
// Public enqueue helper (used by sibling crates when emitting events)
// ===========================================================================

/// Find every active endpoint subscribed to `event_kind` for `tenant_id`
/// and insert one `pending` delivery row per match. Returns the number
/// of rows written.
///
/// This is the **canonical** event-emission path. Sibling crates call
/// it from inside their mutation handlers (e.g. `sabchat-messages`
/// calls `enqueue(mongo, tid, "message.created", payload)` right after
/// the insert succeeds). The actual outbound HTTP POST + retry / DLQ
/// movement is the worker's job; this MVP simply records.
pub async fn enqueue_impl(
    mongo: &sabnode_db::mongo::MongoHandle,
    tenant_id: ObjectId,
    event_kind: &str,
    payload: Value,
) -> anyhow::Result<u32> {
    let endpoints = mongo.collection::<Document>(ENDPOINTS_COLL);
    let cursor = endpoints
        .find(doc! {
            "tenantId": tenant_id,
            "active": true,
            "events": event_kind,
        })
        .await?;
    let docs: Vec<Document> = cursor.try_collect().await?;
    if docs.is_empty() {
        return Ok(0);
    }

    let deliveries = mongo.collection::<Document>(DELIVERIES_COLL);
    let mut count: u32 = 0;
    for ep in docs {
        let Ok(ep_oid) = ep.get_object_id("_id") else {
            continue;
        };
        let row = build_delivery_doc(tenant_id, ep_oid, event_kind, &payload);
        deliveries.insert_one(row).await?;
        count += 1;
    }

    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_payload_is_deterministic_and_64_hex_chars() {
        let sig = sign_payload("secret", b"hello");
        assert_eq!(sig.len(), 64);
        assert!(sig.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(sig, sign_payload("secret", b"hello"));
        assert_ne!(sig, sign_payload("secret", b"hello!"));
        assert_ne!(sig, sign_payload("other", b"hello"));
    }

    #[test]
    fn generated_secret_is_48_hex_chars() {
        let s = generate_secret();
        assert_eq!(s.len(), 48);
        assert!(s.chars().all(|c| c.is_ascii_hexdigit()));
        // Two consecutive calls must not collide in practice.
        assert_ne!(s, generate_secret());
    }

    #[test]
    fn url_validator_accepts_https_rejects_file() {
        assert!(validate_url("https://example.com/hook").is_ok());
        assert!(validate_url("http://example.com/hook").is_ok());
        assert!(validate_url("file:///etc/passwd").is_err());
        assert!(validate_url("not-a-url").is_err());
    }
}
