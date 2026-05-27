//! HTTP handlers for the **public visitor** SabChat ad-attribution
//! surface.
//!
//! Mounted under `/v1/sabchat/ad-attribution-public`. No
//! [`AuthUser`](sabnode_auth::AuthUser) is consumed by any handler in
//! this module — the visitor is anonymous when the touch row is first
//! written.
//!
//! ## Tenant resolution
//!
//! The tenant is **never** taken from the request body. Instead the
//! inbox id (which is public — it's embedded in the widget snippet) is
//! looked up in `sabchat_inboxes` and `inbox.tenantId` is read from the
//! authoritative side. Any attempt to spoof a different `tenantId` from
//! the client is dropped on the floor.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use tracing::instrument;

use crate::dto::{PublicTouchBody, PublicTouchResponse, UtmParams};
use crate::state::SabChatAdAttributionState;
use crate::{INBOXES_COLL, TOUCHES_COLL};

// ===========================================================================
// POST /touch — public_touch
// ===========================================================================

/// `POST /v1/sabchat/ad-attribution-public/touch` — record a fresh
/// visitor touch.
///
/// Steps:
/// 1. Validate the inbox id parses + exists. The lookup hydrates the
///    authoritative `tenantId` so the row can be tagged correctly.
/// 2. Normalise the `source` discriminant. Unknown values fold to
///    `other` so the report aggregations always render a clean bucket
///    list.
/// 3. Build the touch document. Empty UTM blobs and empty optional
///    string fields are skipped so Mongo doesn't accumulate `null` /
///    `{}` litter.
/// 4. Insert and return the new `touchId`.
#[instrument(skip_all, fields(inbox = %body.inbox_id))]
pub async fn public_touch(
    State(state): State<SabChatAdAttributionState>,
    Json(body): Json<PublicTouchBody>,
) -> Result<Json<PublicTouchResponse>> {
    // ---- 1. Inbox -> tenant join ---------------------------------------
    if body.visitor_token.trim().is_empty() {
        return Err(ApiError::Validation(
            "`visitorToken` is required.".to_owned(),
        ));
    }
    let inbox_oid = oid_from_str(&body.inbox_id)?;

    let inboxes = state.mongo.collection::<Document>(INBOXES_COLL);
    let inbox = inboxes
        .find_one(doc! { "_id": inbox_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Inbox not found.".to_owned()))?;

    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;

    // ---- 2. Normalise the source bucket --------------------------------
    let source = normalise_source(body.source.as_deref());

    // ---- 3. Build the touch document -----------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let touch_oid = ObjectId::new();

    let mut touch = doc! {
        "_id": touch_oid,
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "visitorToken": &body.visitor_token,
        "source": source,
        "capturedAt": now,
        "attributedRevenueMinor": 0_i64,
    };

    insert_optional_str(&mut touch, "campaignId", body.campaign_id.as_deref());
    insert_optional_str(&mut touch, "adsetId", body.adset_id.as_deref());
    insert_optional_str(&mut touch, "adId", body.ad_id.as_deref());
    insert_optional_str(&mut touch, "ctwaClid", body.ctwa_clid.as_deref());
    insert_optional_str(&mut touch, "gclid", body.gclid.as_deref());
    insert_optional_str(&mut touch, "fbclid", body.fbclid.as_deref());
    insert_optional_str(&mut touch, "landingUrl", body.landing_url.as_deref());

    if let Some(utm) = body.utm.as_ref().filter(|u| !u.is_empty()) {
        touch.insert("utm", utm_to_bson(utm));
    }

    // ---- 4. Insert ------------------------------------------------------
    let touches = state.mongo.collection::<Document>(TOUCHES_COLL);
    touches.insert_one(touch).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_ad_touches.insert_one"))
    })?;

    Ok(Json(PublicTouchResponse {
        touch_id: touch_oid.to_hex(),
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Whitelist of accepted `source` discriminants. Anything else is
/// folded to `other`.
fn normalise_source(raw: Option<&str>) -> &'static str {
    match raw.unwrap_or("other") {
        "meta" => "meta",
        "google" => "google",
        "organic" => "organic",
        "direct" => "direct",
        _ => "other",
    }
}

/// Append a string field to a document iff the value is `Some` and
/// non-empty. Avoids writing `null` / `""` litter to Mongo, which keeps
/// the BSON small and the queries cheap (no `$ne: null` everywhere).
fn insert_optional_str(doc: &mut Document, key: &str, value: Option<&str>) {
    if let Some(v) = value.filter(|s| !s.is_empty()) {
        doc.insert(key, v);
    }
}

/// Encode a [`UtmParams`] into a BSON sub-document. Empty fields are
/// elided.
fn utm_to_bson(utm: &UtmParams) -> Bson {
    let mut d = Document::new();
    if let Some(v) = utm.source.as_deref().filter(|s| !s.is_empty()) {
        d.insert("source", v);
    }
    if let Some(v) = utm.medium.as_deref().filter(|s| !s.is_empty()) {
        d.insert("medium", v);
    }
    if let Some(v) = utm.campaign.as_deref().filter(|s| !s.is_empty()) {
        d.insert("campaign", v);
    }
    if let Some(v) = utm.content.as_deref().filter(|s| !s.is_empty()) {
        d.insert("content", v);
    }
    if let Some(v) = utm.term.as_deref().filter(|s| !s.is_empty()) {
        d.insert("term", v);
    }
    Bson::Document(d)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalise_source_folds_unknown_values() {
        assert_eq!(normalise_source(None), "other");
        assert_eq!(normalise_source(Some("meta")), "meta");
        assert_eq!(normalise_source(Some("google")), "google");
        assert_eq!(normalise_source(Some("organic")), "organic");
        assert_eq!(normalise_source(Some("direct")), "direct");
        assert_eq!(normalise_source(Some("tiktok")), "other");
        assert_eq!(normalise_source(Some("")), "other");
    }

    #[test]
    fn insert_optional_str_skips_empty() {
        let mut d = Document::new();
        insert_optional_str(&mut d, "a", Some("x"));
        insert_optional_str(&mut d, "b", Some(""));
        insert_optional_str(&mut d, "c", None);
        assert!(d.contains_key("a"));
        assert!(!d.contains_key("b"));
        assert!(!d.contains_key("c"));
    }

    #[test]
    fn utm_to_bson_elides_empty_fields() {
        let utm = UtmParams {
            source: Some("meta".into()),
            medium: None,
            campaign: Some("".into()),
            content: None,
            term: Some("brand".into()),
        };
        let bson = utm_to_bson(&utm);
        let doc = bson.as_document().expect("document");
        assert!(doc.contains_key("source"));
        assert!(!doc.contains_key("medium"));
        assert!(!doc.contains_key("campaign"));
        assert!(!doc.contains_key("content"));
        assert!(doc.contains_key("term"));
    }
}
