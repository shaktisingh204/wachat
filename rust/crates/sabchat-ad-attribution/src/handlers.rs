//! HTTP handlers for the agent / admin SabChat ad-attribution surface.
//!
//! Routes (mounted relative — caller nests under
//! `/v1/sabchat/ad-attribution`):
//!
//! | Endpoint                                  | Handler             |
//! |-------------------------------------------|---------------------|
//! | `GET   /touches`                          | [`list_touches`]    |
//! | `GET   /touches/{id}`                     | [`get_touch`]       |
//! | `POST  /attribute-revenue`                | [`attribute_revenue`] |
//! | `GET   /report`                           | [`report`]          |
//!
//! ## Tenancy
//!
//! Every read filters on `tenantId == ObjectId(auth.tenant_id)`. The
//! tenant id is taken from the JWT, never from the URL — there is no
//! cross-tenant touch lookup, and a malformed `tid` claim is treated as
//! `401 Unauthorized` (matches the sibling sabchat crates).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AttributeRevenueBody, AttributeRevenueResponse, DEFAULT_LIMIT, ListTouchesQuery,
    ListTouchesResponse, MAX_LIMIT, ReportEntry, ReportQuery, ReportResponse,
};
use crate::state::SabChatAdAttributionState;
use crate::{CONVERSATIONS_COLL, REVENUE_COLL, TOUCHES_COLL};

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse the caller's tenant id from the JWT into an `ObjectId`.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Parse an RFC 3339 timestamp string into a `bson::DateTime` for a
/// `doc!` filter. Invalid input becomes `400 Bad Request`.
fn parse_rfc3339(field: &str, raw: &str) -> Result<bson::DateTime> {
    let dt: DateTime<Utc> = DateTime::parse_from_rfc3339(raw)
        .map_err(|e| {
            ApiError::BadRequest(format!("invalid RFC3339 timestamp for `{field}`: {e}"))
        })?
        .with_timezone(&Utc);
    Ok(bson::DateTime::from_chrono(dt))
}

/// Normalise the `source` field on a revenue attribution row.
///
/// `payment_request` and `manual` are the canonical values; anything
/// else folds to `manual` so the ledger stays small and queryable.
fn normalise_revenue_source(raw: Option<&str>) -> &'static str {
    match raw.unwrap_or("payment_request") {
        "payment_request" => "payment_request",
        _ => "manual",
    }
}

/// Normalise the `groupBy` query param on `/report`. Unknown values
/// fold to `source` so the dashboard always gets a sensible default.
fn normalise_group_by(raw: Option<&str>) -> &'static str {
    match raw.unwrap_or("source") {
        "campaign" => "campaign",
        "ad" => "ad",
        _ => "source",
    }
}

/// Translate a `groupBy` discriminant into the Mongo field path that
/// holds its bucket key.
fn group_by_field(group_by: &str) -> &'static str {
    match group_by {
        "campaign" => "campaignId",
        "ad" => "adId",
        _ => "source",
    }
}

// ===========================================================================
// GET /touches — list_touches
// ===========================================================================

/// `GET /v1/sabchat/ad-attribution/touches` — paginated touch list for
/// the caller's tenant.
///
/// Filters are all optional; an empty query returns the most recent
/// `DEFAULT_LIMIT` touches for the tenant. Pagination is cursor-style
/// on `_id`, newest first.
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn list_touches(
    user: AuthUser,
    State(state): State<SabChatAdAttributionState>,
    Query(query): Query<ListTouchesQuery>,
) -> Result<Json<ListTouchesResponse>> {
    let tenant = tenant_oid(&user)?;

    // ---- Build filter ---------------------------------------------------
    let mut filter = doc! { "tenantId": tenant };

    if let Some(id) = query
        .conversation_id
        .as_deref()
        .filter(|s| !s.is_empty())
    {
        filter.insert("conversationId", oid_from_str(id)?);
    }

    if let Some(raw) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(raw)?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    // ---- Clamp the page size -------------------------------------------
    let raw_limit = if query.limit <= 0 {
        DEFAULT_LIMIT
    } else {
        query.limit
    };
    let limit = raw_limit.clamp(1, MAX_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    // ---- Query ----------------------------------------------------------
    let coll = state.mongo.collection::<Document>(TOUCHES_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.collect"))
    })?;

    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|oid| oid.to_hex())
    };

    let touches: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListTouchesResponse {
        touches,
        next_cursor,
    }))
}

// ===========================================================================
// GET /touches/{id} — get_touch
// ===========================================================================

/// `GET /v1/sabchat/ad-attribution/touches/{id}` — fetch a single touch
/// scoped to the caller's tenant.
///
/// Returns `404` for unknown ids or ids belonging to other tenants —
/// the tenant filter is part of the lookup, so cross-tenant existence
/// is never leaked.
#[instrument(skip_all, fields(tenant = %user.tenant_id, touch_id = %touch_id))]
pub async fn get_touch(
    user: AuthUser,
    State(state): State<SabChatAdAttributionState>,
    Path(touch_id): Path<String>,
) -> Result<Json<Value>> {
    let tenant = tenant_oid(&user)?;
    let touch_oid = oid_from_str(&touch_id)?;

    let coll = state.mongo.collection::<Document>(TOUCHES_COLL);
    let doc = coll
        .find_one(doc! {
            "_id": touch_oid,
            "tenantId": tenant,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Touch not found.".to_owned()))?;

    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// POST /attribute-revenue — attribute_revenue
// ===========================================================================

/// `POST /v1/sabchat/ad-attribution/attribute-revenue` — record a
/// payment against a conversation's most recent touch.
///
/// Resolution order:
/// 1. Validate the conversation exists and belongs to the tenant.
/// 2. Find the most recent touch already bound to that conversation.
/// 3. If none, fall back to the most recent touch keyed by the
///    conversation's `contactId`.
/// 4. Insert the attribution row, bump `attributed_revenue_minor` on
///    the touch, and (in the fallback case) bind the touch to the
///    conversation so future queries find it by `conversationId`.
#[instrument(skip_all, fields(tenant = %user.tenant_id, conversation = %body.conversation_id))]
pub async fn attribute_revenue(
    user: AuthUser,
    State(state): State<SabChatAdAttributionState>,
    Json(body): Json<AttributeRevenueBody>,
) -> Result<Json<AttributeRevenueResponse>> {
    let tenant = tenant_oid(&user)?;
    let conversation_oid = oid_from_str(&body.conversation_id)?;

    if body.amount_minor < 0 {
        return Err(ApiError::Validation(
            "`amountMinor` must be non-negative.".to_owned(),
        ));
    }
    if body.currency.trim().is_empty() {
        return Err(ApiError::Validation("`currency` is required.".to_owned()));
    }

    // ---- 1. Tenant-scoped conversation lookup ---------------------------
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let conversation = conversations
        .find_one(doc! {
            "_id": conversation_oid,
            "tenantId": tenant,
        })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))?;

    let contact_oid = conversation.get_object_id("contactId").ok();

    // ---- 2 / 3. Locate the most recent touch ---------------------------
    let touches = state.mongo.collection::<Document>(TOUCHES_COLL);
    let mut touch = touches
        .find_one(doc! {
            "tenantId": tenant,
            "conversationId": conversation_oid,
        })
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "_id": -1 })
                .build(),
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_ad_touches.find_one(conversation)"),
            )
        })?;

    if touch.is_none() {
        if let Some(c_oid) = contact_oid {
            touch = touches
                .find_one(doc! {
                    "tenantId": tenant,
                    "contactId": c_oid,
                })
                .with_options(
                    mongodb::options::FindOneOptions::builder()
                        .sort(doc! { "_id": -1 })
                        .build(),
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabchat_ad_touches.find_one(contact)"),
                    )
                })?;
        }
    }

    let touch_doc = touch.ok_or_else(|| {
        ApiError::NotFound(
            "No prior ad touch found for this conversation — nothing to attribute."
                .to_owned(),
        )
    })?;
    let touch_oid = touch_doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("touch missing _id")))?;

    // ---- 4. Insert attribution + bump counter --------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let source = normalise_revenue_source(body.source.as_deref());
    let attribution_oid = ObjectId::new();

    let attribution_doc = doc! {
        "_id": attribution_oid,
        "tenantId": tenant,
        "touchId": touch_oid,
        "conversationId": conversation_oid,
        "amountMinor": body.amount_minor,
        "currency": &body.currency,
        "source": source,
        "at": now,
    };

    let revenue = state.mongo.collection::<Document>(REVENUE_COLL);
    revenue.insert_one(attribution_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_ad_revenue_attributions.insert_one"),
        )
    })?;

    // Bump the rolling counter on the touch and bind it to the
    // conversation if it wasn't already (so the next attribution skips
    // the contact-fallback path).
    let mut touch_set = doc! { "updatedAt": now };
    if touch_doc.get_object_id("conversationId").ok() != Some(conversation_oid) {
        touch_set.insert("conversationId", conversation_oid);
    }
    if let Some(c_oid) = contact_oid {
        if touch_doc.get_object_id("contactId").ok() != Some(c_oid) {
            touch_set.insert("contactId", c_oid);
        }
    }
    touches
        .update_one(
            doc! { "_id": touch_oid },
            doc! {
                "$inc": { "attributedRevenueMinor": body.amount_minor },
                "$set": touch_set,
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_ad_touches.update_one(revenue)"),
            )
        })?;

    Ok(Json(AttributeRevenueResponse {
        attribution_id: attribution_oid.to_hex(),
        touch_id: touch_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /report — report
// ===========================================================================

/// `GET /v1/sabchat/ad-attribution/report` — aggregate revenue and
/// conversation counts by `source` / `campaign` / `ad`.
///
/// Conversation counts are computed as `count(distinct conversationId)`
/// to avoid double-counting touches when a single conversation collects
/// multiple touches (e.g. visitor lands twice from two different ads).
#[instrument(skip_all, fields(tenant = %user.tenant_id))]
pub async fn report(
    user: AuthUser,
    State(state): State<SabChatAdAttributionState>,
    Query(query): Query<ReportQuery>,
) -> Result<Json<ReportResponse>> {
    let tenant = tenant_oid(&user)?;
    let group_by = normalise_group_by(query.group_by.as_deref());
    let field = group_by_field(group_by);

    // ---- Build the match stage -----------------------------------------
    let mut match_doc = doc! { "tenantId": tenant };

    let mut captured_at = Document::new();
    if let Some(raw) = query.from.as_deref().filter(|s| !s.is_empty()) {
        captured_at.insert("$gte", parse_rfc3339("from", raw)?);
    }
    if let Some(raw) = query.to.as_deref().filter(|s| !s.is_empty()) {
        captured_at.insert("$lt", parse_rfc3339("to", raw)?);
    }
    if !captured_at.is_empty() {
        match_doc.insert("capturedAt", captured_at);
    }

    // Drop touches with no value in the chosen bucket — a `null`
    // `groupKey` is noise on the dashboard.
    match_doc.insert(field, doc! { "$ne": Bson::Null });

    // ---- Aggregation pipeline ------------------------------------------
    let pipeline = vec![
        doc! { "$match": match_doc },
        doc! {
            "$group": {
                "_id": format!("${field}"),
                "revenueMinor": { "$sum": { "$ifNull": ["$attributedRevenueMinor", 0i64] } },
                "conversationIds": { "$addToSet": "$conversationId" },
            }
        },
        doc! {
            "$project": {
                "_id": 0,
                "groupKey": "$_id",
                "revenueMinor": 1,
                "conversationCount": {
                    "$size": {
                        "$filter": {
                            "input": "$conversationIds",
                            "as": "c",
                            "cond": { "$ne": ["$$c", Bson::Null] },
                        }
                    }
                },
            }
        },
        doc! { "$sort": { "revenueMinor": -1 } },
    ];

    let coll = state.mongo.collection::<Document>(TOUCHES_COLL);
    let cursor = coll.aggregate(pipeline).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.aggregate"))
    })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.aggregate.collect"))
    })?;

    let entries: Vec<ReportEntry> = docs
        .into_iter()
        .map(|d| ReportEntry {
            group_key: d
                .get_str("groupKey")
                .map(str::to_owned)
                .unwrap_or_default(),
            conversation_count: doc_i64(&d, "conversationCount"),
            revenue_minor: doc_i64(&d, "revenueMinor"),
        })
        .collect();

    Ok(Json(ReportResponse {
        group_by: group_by.to_owned(),
        entries,
    }))
}

// ===========================================================================
// Internal helpers
// ===========================================================================

/// Tolerant `i64` extractor — Mongo returns `$sum` results as either
/// `Int32`, `Int64`, or `Double` depending on the input column, and
/// `$size` is always `Int32`. Coalesce them all.
fn doc_i64(d: &Document, key: &str) -> i64 {
    match d.get(key) {
        Some(Bson::Int32(n)) => i64::from(*n),
        Some(Bson::Int64(n)) => *n,
        Some(Bson::Double(n)) => *n as i64,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalise_revenue_source_defaults_to_payment_request() {
        assert_eq!(normalise_revenue_source(None), "payment_request");
        assert_eq!(
            normalise_revenue_source(Some("payment_request")),
            "payment_request",
        );
        assert_eq!(normalise_revenue_source(Some("manual")), "manual");
        assert_eq!(normalise_revenue_source(Some("garbage")), "manual");
    }

    #[test]
    fn normalise_group_by_defaults_to_source() {
        assert_eq!(normalise_group_by(None), "source");
        assert_eq!(normalise_group_by(Some("source")), "source");
        assert_eq!(normalise_group_by(Some("campaign")), "campaign");
        assert_eq!(normalise_group_by(Some("ad")), "ad");
        assert_eq!(normalise_group_by(Some("nonsense")), "source");
    }

    #[test]
    fn group_by_field_maps_to_mongo_path() {
        assert_eq!(group_by_field("source"), "source");
        assert_eq!(group_by_field("campaign"), "campaignId");
        assert_eq!(group_by_field("ad"), "adId");
    }
}
