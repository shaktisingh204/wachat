//! HTTP handlers for the wachat send-path surface.
//!
//! Conventions (mirrored from the sibling `wachat-templates-router`):
//!
//! - Every handler returns `Result<Json<T>, ApiError>`. The `ApiError`
//!   `IntoResponse` impl in `sabnode-common` renders a uniform
//!   `{ ok: false, error: ... }` envelope.
//! - Every handler takes [`AuthUser`] — there is no anonymous access.
//! - Per-project endpoints additionally enforce
//!   `user.tenant_id == project.userId.to_hex()` after loading the
//!   project from Mongo via [`load_project_for`]. (More granular
//!   per-project membership lands in a follow-up alongside
//!   `sabnode-tenancy`.)
//! - Engine calls use the typed handles in [`WachatSendState`]. This
//!   crate owns no business logic; it is purely a wire adapter.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;
use wachat_types::Project;

use crate::dto::{
    ConversationQuery, InitialChatQuery, PaymentRequestBody, PaymentRequestListQuery,
    ResolveContactBody, SendAddressBody, SendCatalogBody, SendCtaUrlBody, SendLocationRequestBody,
    SendMessageBody, SendOrderDetailsBody, SendOrderStatusBody, SendResponse, oid_hex,
};
use crate::state::WachatSendState;

/// Mongo collection name for projects (matches the TS `projects`).
const PROJECTS_COLL: &str = "projects";

// ===========================================================================
// Project loading + tenancy guard
// ===========================================================================

/// Load a project by hex id and enforce that `user.tenant_id` matches
/// its `userId`.
///
/// Returns `404 NOT_FOUND` if the project doesn't exist (rather than
/// 403, which would leak project existence) and `403 FORBIDDEN` if the
/// caller is not its owner.
#[instrument(skip_all, fields(project_id = %project_id_hex))]
async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Project> {
    let oid = oid_from_str(project_id_hex)?;
    let coll = mongo.collection::<Project>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("project {project_id_hex}")))?;

    // Per-project tenancy check. The follow-up `sabnode-tenancy` slice
    // will swap this for a membership lookup against `project_members`;
    // for now we trust `userId` as the single source of ownership.
    if user.tenant_id != project.user_id.to_hex() {
        return Err(ApiError::Forbidden(
            "user does not have access to this project".to_owned(),
        ));
    }
    Ok(project)
}

/// Load a contact's project id and enforce tenancy. Used by the chat
/// mark-read / mark-unread endpoints, which take only a `contact_id` on
/// the wire (the engine is project-agnostic, but the API gate is not).
///
/// Returns `404 NOT_FOUND` if the contact doesn't exist.
#[instrument(skip_all, fields(contact_id = %contact_id_hex))]
async fn ensure_contact_access(
    user: &AuthUser,
    mongo: &MongoHandle,
    contact_id_hex: &str,
) -> Result<ObjectId> {
    let oid = oid_from_str(contact_id_hex)?;
    let coll = mongo.collection::<bson::Document>("contacts");
    let contact = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one")))?
        .ok_or_else(|| ApiError::NotFound(format!("contact {contact_id_hex}")))?;

    let project_oid = contact
        .get_object_id("projectId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing projectId")))?;
    let _project = load_project_for(user, mongo, &project_oid.to_hex()).await?;
    Ok(oid)
}

// ===========================================================================
// POST /messages/send — generic discriminated send
// ===========================================================================

/// `POST /messages/send` — text or media message. Body is discriminated
/// by `kind` (`text` | `image` | `video` | `document` | `audio`).
pub async fn send_message(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendMessageBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, body.project_id()).await?;
    let req = body.into_engine();
    let outcome = state.message.send(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/catalog — interactive product_list
// ===========================================================================

/// `POST /messages/catalog` — interactive `product_list` send.
pub async fn send_catalog(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendCatalogBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_cta::SendCatalogReq {
        to: body.to,
        catalog_id: body.catalog_id,
        product_retailer_id: body.product_retailer_id,
        body_text: body.body_text,
        footer_text: body.footer_text,
    };
    let outcome = state.cta.send_catalog(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/cta-url — interactive cta_url
// ===========================================================================

/// `POST /messages/cta-url` — interactive `cta_url` send.
pub async fn send_cta_url(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendCtaUrlBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_cta::SendCtaUrlReq {
        to: body.to,
        display_text: body.display_text,
        url: body.url,
        body_text: body.body_text,
        header_text: body.header_text,
        footer_text: body.footer_text,
    };
    let outcome = state.cta.send_cta_url(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/location-request — interactive location_request_message
// ===========================================================================

/// `POST /messages/location-request` — interactive
/// `location_request_message` send.
pub async fn send_location_request(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendLocationRequestBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_flows::SendLocationReq {
        to: body.to,
        body_text: body.body_text,
    };
    let outcome = state.flows.send_location_request(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/address — interactive address_message
// ===========================================================================

/// `POST /messages/address` — interactive `address_message` send.
pub async fn send_address(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendAddressBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_flows::SendAddressReq {
        to: body.to,
        body_text: body.body_text,
        country: body.country,
        values: body.values,
    };
    let outcome = state.flows.send_address(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/order-details — interactive order_details
// ===========================================================================

/// `POST /messages/order-details` — interactive `order_details` send.
pub async fn send_order_details(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendOrderDetailsBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_orders::SendOrderDetailsReq {
        to: body.to,
        reference_id: body.reference_id,
        items: body
            .items
            .into_iter()
            .map(|i| wachat_send_orders::OrderItem {
                retailer_id: i.retailer_id,
                name: i.name,
                amount_minor: i.amount_minor,
                quantity: i.quantity,
            })
            .collect(),
        subtotal_minor: body.subtotal_minor,
        tax_minor: body.tax_minor,
        shipping_minor: body.shipping_minor,
        discount_minor: body.discount_minor,
        currency: body.currency,
        payment_settings: body.payment_settings,
        body_text: body.body_text,
        footer_text: body.footer_text,
    };
    let outcome = state.orders.send_order_details(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /messages/order-status — interactive order_status
// ===========================================================================

/// `POST /messages/order-status` — interactive `order_status` send.
pub async fn send_order_status(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<SendOrderStatusBody>,
) -> Result<Json<SendResponse>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_send_orders::SendOrderStatusReq {
        to: body.to,
        reference_id: body.reference_id,
        status: body.status,
        body_text: body.body_text,
    };
    let outcome = state.orders.send_order_status(&project, req).await?;
    Ok(Json(SendResponse {
        message_log_id: oid_hex(&outcome.message_log_id),
        wamid: outcome.wamid,
    }))
}

// ===========================================================================
// POST /contacts/resolve — find_or_create
// ===========================================================================

/// `POST /contacts/resolve` — upsert a `contacts` row keyed on
/// `(projectId, phoneNumberId, waId)` and return the resulting contact.
pub async fn resolve_contact(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<ResolveContactBody>,
) -> Result<Json<wachat_contacts_resolve::ResolvedContact>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let resolved = state
        .contacts
        .find_or_create(&project, &body.phone_number_id, &body.wa_id)
        .await?;
    Ok(Json(resolved))
}

// ===========================================================================
// GET /chat/initial — initial bootstrap
// ===========================================================================

/// `GET /chat/initial` — initial chat bootstrap (project, contacts list,
/// possibly-selected conversation). Mirrors the TS
/// `getInitialChatData(projectId, phoneNumberId?, contactId?, waId?)`.
pub async fn chat_initial(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Query(q): Query<InitialChatQuery>,
) -> Result<Json<serde_json::Value>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    let contact_oid = match q.contact_id.as_deref() {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let data = state
        .chat_read
        .initial_chat_data(
            &project.id,
            q.phone_number_id.as_deref(),
            contact_oid.as_ref(),
            q.wa_id.as_deref(),
        )
        .await?;
    Ok(Json(serde_json::to_value(data).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("serialize initial_chat_data"))
    })?))
}

// ===========================================================================
// GET /chat/conversation/:contact_id — paginated history
// ===========================================================================

/// `GET /chat/conversation/:contact_id?limit=` — paginated message
/// history for a single contact.
pub async fn chat_conversation(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Path(contact_id): Path<String>,
    Query(q): Query<ConversationQuery>,
) -> Result<Json<serde_json::Value>> {
    let oid = ensure_contact_access(&user, &state.mongo, &contact_id).await?;
    let convo = state
        .chat_read
        .get_conversation(&oid, q.limit.map(|n| n as i64))
        .await?;
    Ok(Json(serde_json::to_value(convo).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("serialize conversation"))
    })?))
}

// ===========================================================================
// POST /chat/mark-read/:contact_id
// ===========================================================================

/// `POST /chat/mark-read/:contact_id` — mark every unread inbound
/// message for the contact read and zero its `unreadCount`.
pub async fn chat_mark_read(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Path(contact_id): Path<String>,
) -> Result<Json<wachat_chat_mark::MarkOutcome>> {
    let oid = ensure_contact_access(&user, &state.mongo, &contact_id).await?;
    let outcome = state.chat_mark.mark_read(&oid).await?;
    Ok(Json(outcome))
}

// ===========================================================================
// POST /chat/mark-unread/:contact_id
// ===========================================================================

/// `POST /chat/mark-unread/:contact_id` — set the contact's
/// `unreadCount` to 1 (badge-only — does not touch per-message state).
pub async fn chat_mark_unread(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Path(contact_id): Path<String>,
) -> Result<Json<wachat_chat_mark::MarkOutcome>> {
    let oid = ensure_contact_access(&user, &state.mongo, &contact_id).await?;
    let outcome = state.chat_mark.mark_unread(&oid).await?;
    Ok(Json(outcome))
}

// ===========================================================================
// POST /payment-requests/send
// ===========================================================================

/// `POST /payment-requests/send` — create + send a payment request.
///
/// The wire payload is opaque (`serde_json::Value`) — we deserialize it
/// into the engine's typed input inside the handler so the router stays
/// stable when the engine adds optional fields.
pub async fn payment_request_send(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Json(body): Json<PaymentRequestBody>,
) -> Result<Json<serde_json::Value>> {
    let project = load_project_for(&user, &state.mongo, &body.project_id).await?;
    let req = wachat_payment_request::SendPaymentReq {
        to: body.to,
        reference_id: body.reference_id,
        amount_minor: body.amount_minor,
        currency: body.currency,
        items: body
            .items
            .into_iter()
            .map(|i| wachat_payment_request::PaymentItem {
                name: i.name,
                amount_minor: i.amount_minor,
                quantity: i.quantity,
            })
            .collect(),
        configuration_name: body.configuration_name,
        body_text: body.body_text,
    };
    let outcome = state.payment.send(&project, req).await?;
    Ok(Json(serde_json::json!({
        "paymentRequestId": outcome.payment_request_id.to_hex(),
        "wamid": outcome.wamid,
    })))
}

// ===========================================================================
// GET /payment-requests/by-reference/:reference_id
// ===========================================================================

/// `GET /payment-requests/by-reference/:reference_id` — look up a single
/// payment request by its merchant-side reference id.
pub async fn payment_request_status(
    _user: AuthUser,
    State(state): State<WachatSendState>,
    Path(reference_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let row = state.payment.get_status(&reference_id).await?;
    Ok(Json(match row {
        Some(s) => serde_json::json!({
            "referenceId": s.reference_id,
            "status": s.status,
            "paidAt": s.paid_at,
        }),
        None => serde_json::Value::Null,
    }))
}

// ===========================================================================
// GET /payment-requests
// ===========================================================================

/// `GET /payment-requests?project_id=` — list every payment request for
/// a project. Tenancy gate runs on the project, not on individual rows.
pub async fn payment_request_list(
    user: AuthUser,
    State(state): State<WachatSendState>,
    Query(q): Query<PaymentRequestListQuery>,
) -> Result<Json<serde_json::Value>> {
    let project = load_project_for(&user, &state.mongo, &q.project_id).await?;
    let rows = state.payment.list_for_project(&project.id).await?;
    Ok(Json(serde_json::to_value(rows).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("serialize payment list"))
    })?))
}
