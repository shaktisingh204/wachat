//! Public visitor / storefront-snippet handlers for the SabChat
//! cart-recovery domain.
//!
//! These handlers are mounted on [`crate::public_router`] and do **not**
//! consume the [`AuthUser`](sabnode_auth::AuthUser) extractor — they're
//! called by the storefront JS snippet from anywhere on the public web,
//! so there is no tenant JWT available. Instead we resolve the tenant
//! from the inbox row the visitor's widget is connected to.
//!
//! ## Contract recap
//!
//! - `POST /events` — upsert the visitor cart row keyed by
//!   `(inboxId, visitorToken)`. Returns `{ cartId }`.
//! - `POST /events/recover` — mark a cart as `status = "recovered"`
//!   once the visitor has checked out. Returns `{ ok: true }`.
//!
//! ## Why no AuthUser
//!
//! The widget cannot mint a tenant-scoped JWT — it ships as a public
//! script tag on the customer's storefront. Authenticity is established
//! by the inbox being well-known (the customer wired their inbox id
//! into the snippet at install time) and by the visitor's opaque
//! token, which is bound to a session row owned by `sabchat-widget`.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_common::{ApiError, Result};
use sabnode_db::bson_helpers::oid_from_str;
use tracing::instrument;

use crate::dto::{CartEventBody, CartEventResponse, CartItem, CartRecoverBody, OkResponse};
use crate::state::SabChatCartRecoveryState;
use crate::{CARTS_COLL, INBOXES_COLL};

// ===========================================================================
// POST /events — cart upsert
// ===========================================================================

/// Resolve the inbox's tenant id, returning `404` if the inbox does not
/// exist. The inbox row is otherwise read-only here; we only need it
/// for its `tenantId`.
async fn tenant_for_inbox(
    state: &SabChatCartRecoveryState,
    inbox_id_hex: &str,
) -> Result<(ObjectId, ObjectId)> {
    let inbox_oid = oid_from_str(inbox_id_hex)?;
    let inbox = state
        .mongo
        .collection::<Document>(INBOXES_COLL)
        .find_one(doc! { "_id": inbox_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_inboxes.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Unknown inbox.".to_owned()))?;
    let tenant_oid = inbox
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("inbox missing tenantId")))?;
    Ok((tenant_oid, inbox_oid))
}

/// Convert a [`CartItem`] DTO into the BSON sub-document the storage
/// layer keeps on `sabchat_carts.items[]`.
fn item_to_bson(it: &CartItem) -> Bson {
    Bson::Document(doc! {
        "productId": &it.product_id,
        "name": &it.name,
        "quantity": it.quantity,
        "priceMinor": it.price_minor,
        "currency": &it.currency,
    })
}

/// `POST /events` — visitor cart event from the storefront snippet.
///
/// Upserts a row in `sabchat_carts` keyed by
/// `(inboxId, visitorToken)`. On every event we `$set` the latest cart
/// snapshot (`items`, `totalMinor`, `currency`), bump `lastEventAt =
/// now`, and mark the cart `status = "active"`. If a `contactId` is
/// included (the visitor signed in mid-session) we attach it as well.
#[instrument(skip_all, fields(inbox_id = %body.inbox_id, visitor = %body.visitor_token))]
pub async fn cart_event(
    State(state): State<SabChatCartRecoveryState>,
    Json(body): Json<CartEventBody>,
) -> Result<Json<CartEventResponse>> {
    // ---- Validate ------------------------------------------------------
    if body.visitor_token.trim().is_empty() {
        return Err(ApiError::Validation("visitorToken is required.".to_owned()));
    }
    if body.currency.trim().is_empty() {
        return Err(ApiError::Validation("currency is required.".to_owned()));
    }
    if body.total_minor < 0 {
        return Err(ApiError::Validation(
            "totalMinor must be non-negative.".to_owned(),
        ));
    }

    // ---- Resolve tenant from inbox -------------------------------------
    let (tenant_oid, inbox_oid) = tenant_for_inbox(&state, &body.inbox_id).await?;

    // ---- Build the upsert payload --------------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let items_bson = Bson::Array(body.items.iter().map(item_to_bson).collect());

    // `$set` carries every mutable field. `$setOnInsert` carries the
    // immutable bootstrap fields plus `createdAt`. We do not write the
    // tenant id from `$set` because it's already part of the filter on
    // existing rows (and `$setOnInsert` handles the insert case).
    let mut set_doc = doc! {
        "items": items_bson,
        "totalMinor": body.total_minor,
        "currency": &body.currency,
        "lastEventAt": now,
        "updatedAt": now,
        "status": "active",
    };
    if let Some(contact_id) = body.contact_id.as_deref().filter(|s| !s.is_empty()) {
        set_doc.insert("contactId", oid_from_str(contact_id)?);
    }

    let set_on_insert = doc! {
        "tenantId": tenant_oid,
        "inboxId": inbox_oid,
        "visitorToken": &body.visitor_token,
        "createdAt": now,
    };

    let filter = doc! {
        "inboxId": inbox_oid,
        "visitorToken": &body.visitor_token,
    };
    let update = doc! {
        "$set": set_doc,
        "$setOnInsert": set_on_insert,
    };

    // ---- Run the upsert -----------------------------------------------
    let coll = state.mongo.collection::<Document>(CARTS_COLL);
    let res = coll
        .update_one(filter.clone(), update)
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.update_one"))
        })?;

    // Recover the cart id — `upserted_id` is set on insert, otherwise
    // we re-read by the (inboxId, visitorToken) filter. The extra
    // round-trip on the update branch is cheap (covered by the
    // compound index the schema migration creates).
    let cart_oid: ObjectId = if let Some(Bson::ObjectId(oid)) = res.upserted_id {
        oid
    } else {
        let existing = coll
            .find_one(filter)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.find_one"))
            })?
            .ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!("cart vanished between upsert and read"))
            })?;
        existing
            .get_object_id("_id")
            .map_err(|_| ApiError::Internal(anyhow::anyhow!("cart row missing _id")))?
    };

    Ok(Json(CartEventResponse {
        cart_id: cart_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /events/recover — cart converted
// ===========================================================================

/// `POST /events/recover` — the visitor completed checkout. Marks the
/// cart `status = "recovered"`. Idempotent: re-calling on an already
/// recovered cart is a no-op success.
///
/// We do **not** validate the visitor token here — the cart id is
/// itself an opaque, hard-to-guess `ObjectId` that the visitor only
/// learned about because they previously hit `/events`. Re-using the
/// same identity model as the rest of the public widget surface.
#[instrument(skip_all, fields(cart_id = %body.cart_id))]
pub async fn cart_recover(
    State(state): State<SabChatCartRecoveryState>,
    Json(body): Json<CartRecoverBody>,
) -> Result<Json<OkResponse>> {
    let cart_oid = oid_from_str(&body.cart_id)?;
    let now = bson::DateTime::from_chrono(Utc::now());

    let coll = state.mongo.collection::<Document>(CARTS_COLL);
    let res = coll
        .update_one(
            doc! { "_id": cart_oid },
            doc! {
                "$set": {
                    "status": "recovered",
                    "updatedAt": now,
                },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_carts.update_one(recover)"))
        })?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Cart not found.".to_owned()));
    }

    Ok(Json(OkResponse::yes()))
}
