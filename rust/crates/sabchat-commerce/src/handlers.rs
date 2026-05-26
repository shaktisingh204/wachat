//! HTTP handlers for the SabChat **conversational commerce** router.
//!
//! Each handler maps to one route. The agent-facing handlers all
//! require an [`AuthUser`] and scope every read / write against the
//! caller's tenant. The webhook handler ([`payment_callback`]) takes no
//! auth — tenancy is re-derived from the persisted
//! `sabchat_payment_requests` row so a hostile caller cannot reach
//! into another tenant by quoting their `paymentRequestId`.
//!
//! | Endpoint                                          | Handler                  |
//! |---------------------------------------------------|--------------------------|
//! | `POST /v1/sabchat/commerce/send-product/{id}`     | [`send_product`]         |
//! | `POST /v1/sabchat/commerce/send-catalog/{id}`     | [`send_catalog`]         |
//! | `POST /v1/sabchat/commerce/payment-link/{id}`     | [`payment_link`]         |
//! | `GET  /v1/sabchat/commerce/payment-requests`      | [`list_payment_requests`]|
//! | `POST /v1/sabchat/commerce/webhooks/payment-callback` | [`payment_callback`] |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use rand::RngCore;
use sabchat_types::{CardButton, CarouselCard, ContentBlock};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{document_to_clean_json, mongo::MongoHandle, oid_from_str};
use tracing::instrument;

use crate::dto::{
    ListPaymentRequestsQuery, ListPaymentRequestsResponse, PaymentCallbackBody, PaymentLinkBody,
    PaymentLinkResponse, SendCatalogBody, SendCatalogResponse, SendProductBody,
    SendProductResponse, SuccessResponse,
};
use crate::state::SabChatCommerceState;

// ===========================================================================
// Collection names
// ===========================================================================

const MESSAGES_COLL: &str = "sabchat_messages";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const AUDIT_COLL: &str = "sabchat_audit_log";
const PAYMENT_REQUESTS_COLL: &str = "sabchat_payment_requests";
const CRM_ITEMS_COLL: &str = "crm_items";
const SHOP_COLL: &str = "products";

/// Allowed values for `PaymentLinkBody.provider`.
const ALLOWED_PROVIDERS: &[&str] = &["razorpay", "stripe", "upi"];

/// Allowed values for `PaymentCallbackBody.status`.
const ALLOWED_CALLBACK_STATUS: &[&str] = &["paid", "failed", "expired"];

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Generate a 32-character lowercase-hex token. Backed by the OS RNG —
/// good enough as an opaque dummy until a real provider client lands.
fn random_hex_token() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Load a conversation by id under the caller's tenant. Returns 404 if
/// the conversation does not exist, lives under a different tenant, or
/// the id is malformed.
async fn load_conversation_for_tenant(
    mongo: &MongoHandle,
    conversation_id_hex: &str,
    tenant_oid: ObjectId,
) -> Result<Document> {
    let oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Best-effort `ContentBlock` → `Bson` conversion via `serde_json`. The
/// content enum is fully serde-friendly so this always round-trips
/// cleanly.
fn content_to_bson(content: &ContentBlock) -> Bson {
    let value = serde_json::to_value(content).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

/// Build a short preview string for the conversation rollup. Mirrors
/// the shape produced by `sabchat-messages::preview` for the variants
/// commerce actually emits.
fn preview_for(content: &ContentBlock) -> String {
    match content {
        ContentBlock::Card { title, .. } => format!("[product] {title}"),
        ContentBlock::Carousel { cards } => {
            format!("[catalog] {} product(s)", cards.len())
        }
        ContentBlock::Payment {
            amount_minor,
            currency,
            ..
        } => format!(
            "[payment link] {} {:.2}",
            currency,
            (*amount_minor as f64) / 100.0
        ),
        ContentBlock::System { text } => text.clone(),
        _ => "[message]".to_owned(),
    }
}

/// Append one row to `sabchat_audit_log`. Errors are logged but never
/// propagated — audit failures must not fail the user-facing write
/// they were meant to record.
async fn write_audit(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    contact_oid: ObjectId,
    inbox_oid: ObjectId,
    action: &str,
    actor_type: &str,
    actor_id: Option<ObjectId>,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_oid,
        "conversationId": conversation_oid,
        "contactId": contact_oid,
        "inboxId": inbox_oid,
        "action": action,
        "actorType": actor_type,
        "createdAt": now,
    };
    if let Some(actor) = actor_id {
        doc.insert("actorId", actor);
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    if let Err(err) = coll.insert_one(doc).await {
        tracing::warn!(
            audit.action = action,
            error.detail = %err,
            "failed to write sabchat audit event",
        );
    }
}

/// Append a bot outbound message to a conversation, patch the
/// conversation rollup, and write a `message_sent` audit event. Returns
/// the new message's `ObjectId`.
async fn append_bot_message(
    mongo: &MongoHandle,
    tenant: ObjectId,
    conversation: &Document,
    content: &ContentBlock,
) -> Result<ObjectId> {
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let new_oid = ObjectId::new();

    let new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "senderType": "bot",
        "direction": "outbound",
        "content": content_to_bson(content),
        "attachments": Bson::Array(vec![]),
        "providerMetadata": Bson::Null,
        "private": false,
        "createdAt": now_bson,
    };

    let messages = mongo.collection::<Document>(MESSAGES_COLL);
    messages.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    // Conversation rollup. Always bump lastMessageAt + preview;
    // first_response_at fires on the first outbound write only.
    let conversations = mongo.collection::<Document>(CONVERSATIONS_COLL);
    let mut set_doc = doc! {
        "lastMessageAt": now_bson,
        "updatedAt": now_bson,
        "lastMessagePreview": preview_for(content),
    };
    let already_set = conversation
        .get("firstResponseAt")
        .and_then(|b| match b {
            Bson::Null => None,
            other => Some(other),
        })
        .is_some();
    if !already_set {
        set_doc.insert("firstResponseAt", now_bson);
    }

    conversations
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(commerce)"),
            )
        })?;

    write_audit(
        mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
        "bot",
        None,
    )
    .await;

    Ok(new_oid)
}

/// Look up one product in `crm_items` first, falling back to `shop`.
/// Tenancy matches either `tenant_id` or `userId` (legacy collections
/// use both shapes). Returns `None` if neither collection has a hit.
async fn load_product(
    mongo: &MongoHandle,
    product_id_hex: &str,
    tenant: ObjectId,
) -> Result<Option<Document>> {
    let oid = oid_from_str(product_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid product id.".to_owned()))?;

    // Tenancy clause: `tenantId == tenant` OR `userId == tenant`.
    let tenant_clause = doc! {
        "$or": [
            { "tenantId": tenant },
            { "userId": tenant },
        ],
    };
    let filter = doc! {
        "_id": oid,
        "$and": [tenant_clause.clone()],
    };

    let crm = mongo.collection::<Document>(CRM_ITEMS_COLL);
    if let Some(found) = crm.find_one(filter.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_items.find_one"))
    })? {
        return Ok(Some(found));
    }

    let shop = mongo.collection::<Document>(SHOP_COLL);
    let found = shop.find_one(filter).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("products.find_one"))
    })?;
    Ok(found)
}

/// Extract the first non-empty string at any of the candidate keys.
fn pick_str<'a>(doc: &'a Document, keys: &[&str]) -> Option<&'a str> {
    for k in keys {
        if let Ok(s) = doc.get_str(k) {
            if !s.is_empty() {
                return Some(s);
            }
        }
    }
    None
}

/// Render a product document into a Card content block.
fn product_to_card(product: &Document) -> ContentBlock {
    let title = pick_str(product, &["name", "title"])
        .unwrap_or("Product")
        .to_owned();

    // Price + currency: best-effort across both schemas.
    let price = product
        .get_f64("price")
        .ok()
        .or_else(|| product.get_i32("price").ok().map(|v| v as f64))
        .or_else(|| product.get_i64("price").ok().map(|v| v as f64));
    let currency = pick_str(product, &["currency", "currencyCode"]).unwrap_or("");
    let subtitle = match (price, currency) {
        (Some(p), c) if !c.is_empty() => Some(format!("{} {:.2}", c, p)),
        (Some(p), _) => Some(format!("{:.2}", p)),
        _ => pick_str(product, &["description", "subtitle"]).map(str::to_owned),
    };

    let image_url = pick_str(product, &["imageUrl", "image", "thumbnail"]).map(str::to_owned);
    let url = pick_str(product, &["url", "publicUrl", "link"])
        .unwrap_or("")
        .to_owned();

    let buttons = if url.is_empty() {
        vec![]
    } else {
        vec![CardButton {
            label: "View".to_owned(),
            kind: "link".to_owned(),
            value: url,
        }]
    };

    ContentBlock::Card {
        title,
        subtitle,
        image_url,
        buttons,
    }
}

/// Render a product document into a CarouselCard.
fn product_to_carousel_card(product: &Document) -> CarouselCard {
    match product_to_card(product) {
        ContentBlock::Card {
            title,
            subtitle,
            image_url,
            buttons,
        } => CarouselCard {
            title,
            subtitle,
            image_url,
            buttons,
        },
        _ => unreachable!("product_to_card always returns Card"),
    }
}

// ===========================================================================
// POST /send-product/{conversationId} — send_product
// ===========================================================================

/// `POST /v1/sabchat/commerce/send-product/{conversation_id}` —
/// resolve a single product and append a card message to the
/// conversation.
#[instrument(skip_all, fields(conversation_id = %conversation_id, product_id = %body.product_id))]
pub async fn send_product(
    auth: AuthUser,
    State(state): State<SabChatCommerceState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<SendProductBody>,
) -> Result<Json<SendProductResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &conversation_id, tenant).await?;

    let product = load_product(&state.mongo, &body.product_id, tenant)
        .await?
        .ok_or_else(|| ApiError::NotFound("Product not found.".to_owned()))?;

    let content = product_to_card(&product);
    let message_oid =
        append_bot_message(&state.mongo, tenant, &conversation, &content).await?;

    Ok(Json(SendProductResponse {
        message_id: message_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /send-catalog/{conversationId} — send_catalog
// ===========================================================================

/// `POST /v1/sabchat/commerce/send-catalog/{conversation_id}` —
/// resolve every product id, drop the misses, and append a carousel
/// message to the conversation.
#[instrument(skip_all, fields(conversation_id = %conversation_id, n_products = body.product_ids.len()))]
pub async fn send_catalog(
    auth: AuthUser,
    State(state): State<SabChatCommerceState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<SendCatalogBody>,
) -> Result<Json<SendCatalogResponse>> {
    if body.product_ids.is_empty() {
        return Err(ApiError::BadRequest(
            "productIds must contain at least one product.".to_owned(),
        ));
    }

    let tenant = tenant_oid(&auth)?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &conversation_id, tenant).await?;

    // Resolve in order, drop misses silently.
    let mut cards: Vec<CarouselCard> = Vec::with_capacity(body.product_ids.len());
    for pid in &body.product_ids {
        if let Some(product) = load_product(&state.mongo, pid, tenant).await? {
            cards.push(product_to_carousel_card(&product));
        }
    }

    if cards.is_empty() {
        return Err(ApiError::NotFound(
            "None of the requested products were found.".to_owned(),
        ));
    }

    let count = cards.len() as u64;
    let content = ContentBlock::Carousel { cards };
    let message_oid =
        append_bot_message(&state.mongo, tenant, &conversation, &content).await?;

    Ok(Json(SendCatalogResponse {
        message_id: message_oid.to_hex(),
        count,
    }))
}

// ===========================================================================
// POST /payment-link/{conversationId} — payment_link
// ===========================================================================

/// `POST /v1/sabchat/commerce/payment-link/{conversation_id}` — mint a
/// dummy checkout URL, persist a `sabchat_payment_requests` row, and
/// append a [`ContentBlock::Payment`] message so the visitor sees a
/// tap-to-pay button.
#[instrument(skip_all, fields(conversation_id = %conversation_id, amount = body.amount_minor, currency = %body.currency))]
pub async fn payment_link(
    auth: AuthUser,
    State(state): State<SabChatCommerceState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<PaymentLinkBody>,
) -> Result<Json<PaymentLinkResponse>> {
    if body.amount_minor <= 0 {
        return Err(ApiError::BadRequest(
            "amountMinor must be greater than zero.".to_owned(),
        ));
    }
    if body.currency.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "currency is required.".to_owned(),
        ));
    }
    let provider = body.provider.clone().unwrap_or_else(|| "razorpay".to_owned());
    if !ALLOWED_PROVIDERS.contains(&provider.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Unsupported payment provider: {provider}.",
        )));
    }

    let tenant = tenant_oid(&auth)?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &conversation_id, tenant).await?;
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;

    // Mint the dummy URL.
    let token = random_hex_token();
    let link_url = format!(
        "https://pay.example.com/{}?amount={}",
        token, body.amount_minor
    );

    // Persist the payment-request row.
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let request_oid = ObjectId::new();

    let mut request_doc = doc! {
        "_id": request_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "provider": provider.clone(),
        "amountMinor": body.amount_minor,
        "currency": body.currency.clone(),
        "linkUrl": link_url.clone(),
        "status": "pending",
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    if let Some(label) = body.label.as_ref() {
        request_doc.insert("label", label.clone());
    }
    if let Some(secs) = body.expires_in {
        let expires_at = bson::DateTime::from_chrono(now + Duration::seconds(secs as i64));
        request_doc.insert("expiresAt", expires_at);
    }
    if let Ok(actor) = ObjectId::parse_str(&auth.user_id) {
        request_doc.insert("createdBy", actor);
    }

    let coll = state.mongo.collection::<Document>(PAYMENT_REQUESTS_COLL);
    coll.insert_one(request_doc).await.map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_payment_requests.insert_one"),
        )
    })?;

    // Append the Payment content block.
    let content = ContentBlock::Payment {
        currency: body.currency.clone(),
        amount_minor: body.amount_minor,
        link_url: link_url.clone(),
        provider: Some(provider),
    };
    let _ = append_bot_message(&state.mongo, tenant, &conversation, &content).await?;

    Ok(Json(PaymentLinkResponse {
        payment_request_id: request_oid.to_hex(),
        link_url,
    }))
}

// ===========================================================================
// GET /payment-requests — list_payment_requests
// ===========================================================================

/// `GET /v1/sabchat/commerce/payment-requests?conversationId=` —
/// tenant-scoped list of every payment request minted for a
/// conversation, newest first.
#[instrument(skip_all, fields(conversation_id = %query.conversation_id))]
pub async fn list_payment_requests(
    auth: AuthUser,
    State(state): State<SabChatCommerceState>,
    Query(query): Query<ListPaymentRequestsQuery>,
) -> Result<Json<ListPaymentRequestsResponse>> {
    let tenant = tenant_oid(&auth)?;
    // Tenant-scoped conversation existence check.
    let _ = load_conversation_for_tenant(&state.mongo, &query.conversation_id, tenant).await?;

    let conversation_oid = oid_from_str(&query.conversation_id)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;

    let filter = doc! {
        "tenantId": tenant,
        "conversationId": conversation_oid,
    };
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).build();

    let coll = state.mongo.collection::<Document>(PAYMENT_REQUESTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_payment_requests.find"),
            )
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_payment_requests.collect"))
    })?;

    let total = docs.len() as u64;
    let payment_requests = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListPaymentRequestsResponse {
        payment_requests,
        total,
    }))
}

// ===========================================================================
// POST /payment-callback — payment_callback (PUBLIC)
// ===========================================================================

/// `POST /v1/sabchat/commerce/webhooks/payment-callback` — public
/// provider callback. No `AuthUser` — tenancy is re-derived from the
/// stored `sabchat_payment_requests` row, never trusted from the
/// caller. On `paid` we append a [`ContentBlock::System`] receipt note
/// to the parent conversation.
#[instrument(skip_all, fields(payment_request_id = %body.payment_request_id, status = %body.status))]
pub async fn payment_callback(
    State(state): State<SabChatCommerceState>,
    Json(body): Json<PaymentCallbackBody>,
) -> Result<Json<SuccessResponse>> {
    if !ALLOWED_CALLBACK_STATUS.contains(&body.status.as_str()) {
        return Err(ApiError::BadRequest(format!(
            "Unsupported callback status: {}.",
            body.status
        )));
    }

    let request_oid = oid_from_str(&body.payment_request_id)
        .map_err(|_| ApiError::BadRequest("Invalid payment request id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(PAYMENT_REQUESTS_COLL);
    let existing = coll
        .find_one(doc! { "_id": request_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_payment_requests.find_one"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("Payment request not found.".to_owned()))?;

    // Re-derive tenancy + conversation from the persisted row.
    let tenant = existing
        .get_object_id("tenantId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment request missing tenantId")))?;
    let conversation_oid = existing
        .get_object_id("conversationId")
        .map_err(|_| {
            ApiError::Internal(anyhow::anyhow!("payment request missing conversationId"))
        })?;
    let contact_oid = existing
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment request missing contactId")))?;
    let inbox_oid = existing
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("payment request missing inboxId")))?;
    let amount_minor = existing.get_i64("amountMinor").unwrap_or(0);
    let currency = existing
        .get_str("currency")
        .unwrap_or("")
        .to_owned();

    // Flip status (+ external ref + updatedAt).
    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "status": body.status.clone(),
        "updatedAt": now_bson,
    };
    if let Some(ext) = body.external_ref.as_ref() {
        set_doc.insert("externalRef", ext.clone());
    }
    if body.status == "paid" {
        set_doc.insert("paidAt", now_bson);
    }

    coll.update_one(
        doc! { "_id": request_oid },
        doc! { "$set": set_doc },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(
            anyhow::Error::new(e).context("sabchat_payment_requests.update_one(callback)"),
        )
    })?;

    // On `paid`, append a system receipt note to the conversation.
    if body.status == "paid" {
        let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
        let conversation = conversations
            .find_one(doc! { "_id": conversation_oid, "tenantId": tenant })
            .await
            .map_err(|e| {
                ApiError::Internal(
                    anyhow::Error::new(e)
                        .context("sabchat_conversations.find_one(callback)"),
                )
            })?;

        if let Some(conversation) = conversation {
            let receipt = ContentBlock::System {
                text: format!(
                    "Payment received: {} {:.2}",
                    currency,
                    (amount_minor as f64) / 100.0
                ),
            };
            let _ = append_bot_message(&state.mongo, tenant, &conversation, &receipt).await?;
        }
    }

    // Audit the callback itself.
    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        &format!("payment_{}", body.status),
        "system",
        None,
    )
    .await;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// Inline smoke tests — pure helpers only, no Mongo.
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_hex_token_is_32_lowercase_hex() {
        let t = random_hex_token();
        assert_eq!(t.len(), 32);
        assert!(t.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
    }

    #[test]
    fn product_to_card_uses_name_and_price() {
        let mut d = Document::new();
        d.insert("name", "Widget");
        d.insert("price", 1999i64);
        d.insert("currency", "INR");
        d.insert("imageUrl", "https://img/x.png");
        d.insert("url", "https://shop/x");
        match product_to_card(&d) {
            ContentBlock::Card {
                title,
                subtitle,
                image_url,
                buttons,
            } => {
                assert_eq!(title, "Widget");
                assert_eq!(subtitle.as_deref(), Some("INR 1999.00"));
                assert_eq!(image_url.as_deref(), Some("https://img/x.png"));
                assert_eq!(buttons.len(), 1);
                assert_eq!(buttons[0].kind, "link");
                assert_eq!(buttons[0].value, "https://shop/x");
            }
            _ => panic!("expected Card"),
        }
    }

    #[test]
    fn preview_for_payment_renders_currency_and_amount() {
        let c = ContentBlock::Payment {
            currency: "INR".to_owned(),
            amount_minor: 12345,
            link_url: "https://pay/x".to_owned(),
            provider: None,
        };
        assert_eq!(preview_for(&c), "[payment link] INR 123.45");
    }
}
