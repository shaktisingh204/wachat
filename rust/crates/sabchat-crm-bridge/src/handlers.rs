//! HTTP handlers for the SabChat ↔ CRM bridge.
//!
//! Six endpoints split across two themes:
//!
//! | Endpoint                                              | Theme                  |
//! |-------------------------------------------------------|------------------------|
//! | `POST /link-contact/{sabChatContactId}`               | Two-way contact sync   |
//! | `POST /push-to-crm/{sabChatContactId}`                | Two-way contact sync   |
//! | `POST /pull-from-crm/{sabChatContactId}`              | Two-way contact sync   |
//! | `POST /conversation-to-deal/{conversationId}`         | Conversation shortcut  |
//! | `POST /conversation-to-ticket/{conversationId}`       | Conversation shortcut  |
//! | `POST /conversation-to-booking/{conversationId}`      | Conversation shortcut  |
//!
//! ## Tenancy
//!
//! SabChat collections scope by `tenantId`. CRM collections scope by
//! `userId` (legacy) **or** `tenantId` (newer §1.1 shape). Every CRM
//! filter is built via [`crm_tenant_filter`] which `$or`'s the two so
//! either dialect works.
//!
//! ## Best-effort
//!
//! The CRM schema is not stabilised, so we go through `bson::doc!`
//! directly rather than typed DTOs. Fields written to `crm_contacts`:
//! `name`, `emails`, `phones`, plus a `_sabchatContactId` back-link.
//! Anything else on the row is preserved via `$set`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    ConversationToBookingBody, ConversationToBookingResponse, ConversationToDealBody,
    ConversationToDealResponse, ConversationToTicketBody, ConversationToTicketResponse,
    LinkContactBody, LinkContactResponse,
};
use crate::state::SabChatCrmBridgeState;

/// SabChat collection names — kept inline so review against the legacy
/// TS migration stays trivial.
const SABCHAT_CONTACTS_COLL: &str = "sabchat_contacts";
const SABCHAT_CONVERSATIONS_COLL: &str = "sabchat_conversations";

/// CRM collection names. The names match the conventions in
/// `crm-contacts`, `crm-deals`, `crm-tickets`, and the bookings module.
const CRM_CONTACTS_COLL: &str = "crm_contacts";
const CRM_DEALS_COLL: &str = "crm_deals";
const CRM_TICKETS_COLL: &str = "crm_tickets";
const CRM_BOOKINGS_COLL: &str = "crm_bookings";

// ===========================================================================
// Tenancy helpers
// ===========================================================================

/// Parse the caller's user_id into a Mongo `ObjectId`. The AuthUser
/// extractor stores both as hex strings.
fn user_oid_from_auth(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Parse the caller's tenant_id into a Mongo `ObjectId`.
fn tenant_oid_from_auth(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

/// Build the `$or` tenancy filter used against every CRM collection.
///
/// The CRM module is mid-migration from `userId`-scoped (legacy) to
/// `tenantId`-scoped (§1.1) documents. Each handler runs reads/writes
/// through this filter so either dialect resolves.
fn crm_tenant_filter(user_oid: ObjectId, tenant_oid: ObjectId) -> Bson {
    Bson::Array(vec![
        Bson::Document(doc! { "userId": user_oid }),
        Bson::Document(doc! { "tenantId": tenant_oid }),
    ])
}

/// Load a SabChat contact under the caller's `tenantId`. Returns
/// `404` if the contact is missing or owned by another tenant — the
/// two cases are collapsed into one error to avoid leaking existence.
async fn load_sabchat_contact(
    mongo: &MongoHandle,
    contact_id_hex: &str,
    tenant_oid: ObjectId,
) -> Result<Document> {
    let contact_oid = oid_from_str(contact_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid sabchat contact id.".to_owned()))?;
    let coll = mongo.collection::<Document>(SABCHAT_CONTACTS_COLL);
    coll.find_one(doc! { "_id": contact_oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("SabChat contact not found.".to_owned()))
}

/// Load a SabChat conversation under the caller's `tenantId`.
async fn load_sabchat_conversation(
    mongo: &MongoHandle,
    conversation_id_hex: &str,
    tenant_oid: ObjectId,
) -> Result<Document> {
    let conversation_oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(SABCHAT_CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": conversation_oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

// ===========================================================================
// Contact-document field extractors
// ===========================================================================

/// Pull the `name`, `emails`, `phones` fields off a sabchat contact in a
/// shape suitable for handing straight to a `bson::doc!` `$set`.
struct SabChatContactSnapshot {
    name: Option<String>,
    emails: Vec<String>,
    phones: Vec<String>,
}

impl SabChatContactSnapshot {
    fn from_doc(d: &Document) -> Self {
        let name = d.get_str("name").ok().map(str::to_owned);
        let emails = string_array(d, "emails");
        let phones = string_array(d, "phones");
        Self {
            name,
            emails,
            phones,
        }
    }
}

/// Read a `Vec<String>` field off a Mongo document, tolerating both
/// missing and wrong-typed cells.
fn string_array(d: &Document, key: &str) -> Vec<String> {
    match d.get_array(key) {
        Ok(arr) => arr
            .iter()
            .filter_map(|b| match b {
                Bson::String(s) => Some(s.clone()),
                _ => None,
            })
            .collect(),
        Err(_) => Vec::new(),
    }
}

// ===========================================================================
// POST /link-contact/{sabChatContactId}
// ===========================================================================

/// `POST /link-contact/{sabChatContactId}` — link or auto-create a CRM
/// contact row and store the foreign key on the sabchat contact.
///
/// Resolution order:
///
/// 1. If the body carries `crmContactId`, validate it belongs to the
///    caller's tenant and link directly.
/// 2. Otherwise, search `crm_contacts` for any row sharing an email or
///    phone with the sabchat contact. First match wins.
/// 3. Otherwise, create a new `crm_contacts` row from the sabchat
///    contact and link.
#[instrument(skip_all, fields(sabchat_contact_id = %sabchat_contact_id))]
pub async fn link_contact(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(sabchat_contact_id): Path<String>,
    body: Option<Json<LinkContactBody>>,
) -> Result<Json<LinkContactResponse>> {
    let Json(body) = body.unwrap_or_default();
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let sabchat_doc = load_sabchat_contact(&state.mongo, &sabchat_contact_id, tenant_oid).await?;
    let sabchat_oid = sabchat_doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat contact missing _id")))?;
    let snapshot = SabChatContactSnapshot::from_doc(&sabchat_doc);

    let (crm_oid, created) = resolve_or_create_crm_contact(
        &state.mongo,
        user_oid,
        tenant_oid,
        body.crm_contact_id.as_deref(),
        &snapshot,
        sabchat_oid,
    )
    .await?;

    // Write the back-reference onto the sabchat contact regardless of
    // how we got the id — re-linking is idempotent.
    state
        .mongo
        .collection::<Document>(SABCHAT_CONTACTS_COLL)
        .update_one(
            doc! { "_id": sabchat_oid, "tenantId": tenant_oid },
            doc! {
                "$set": {
                    "crmContactId": crm_oid,
                    "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                }
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one(link)"))
        })?;

    Ok(Json(LinkContactResponse {
        sabchat_contact_id: sabchat_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        created,
    }))
}

/// Resolve the CRM contact id for a sabchat contact — pre-supplied,
/// matched by overlap, or freshly created. Returns `(crmOid, created)`.
async fn resolve_or_create_crm_contact(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    tenant_oid: ObjectId,
    explicit_id_hex: Option<&str>,
    snapshot: &SabChatContactSnapshot,
    sabchat_oid: ObjectId,
) -> Result<(ObjectId, bool)> {
    let coll = mongo.collection::<Document>(CRM_CONTACTS_COLL);

    // ---- (1) Caller passed an explicit id ------------------------------
    if let Some(hex) = explicit_id_hex.filter(|s| !s.is_empty()) {
        let crm_oid = oid_from_str(hex)
            .map_err(|_| ApiError::BadRequest("Invalid crm contact id.".to_owned()))?;
        let found = coll
            .find_one(doc! {
                "_id": crm_oid,
                "$or": crm_tenant_filter(user_oid, tenant_oid),
            })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find_one(explicit)"))
            })?
            .ok_or_else(|| ApiError::NotFound("CRM contact not found.".to_owned()))?;
        let _ = found;
        return Ok((crm_oid, false));
    }

    // ---- (2) Try to match by email or phone overlap --------------------
    let mut email_or_phone: Vec<Bson> = Vec::new();
    for email in &snapshot.emails {
        if !email.is_empty() {
            email_or_phone.push(Bson::Document(doc! { "email": email }));
            email_or_phone.push(Bson::Document(doc! { "emails": email }));
        }
    }
    for phone in &snapshot.phones {
        if !phone.is_empty() {
            email_or_phone.push(Bson::Document(doc! { "phone": phone }));
            email_or_phone.push(Bson::Document(doc! { "phones": phone }));
        }
    }

    if !email_or_phone.is_empty() {
        let match_filter = doc! {
            "$and": [
                { "$or": crm_tenant_filter(user_oid, tenant_oid) },
                { "$or": Bson::Array(email_or_phone) },
            ],
        };
        let matched = coll.find_one(match_filter).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find_one(match)"))
        })?;
        if let Some(matched_doc) = matched {
            let oid = matched_doc.get_object_id("_id").map_err(|_| {
                ApiError::Internal(anyhow::anyhow!("matched crm contact missing _id"))
            })?;
            return Ok((oid, false));
        }
    }

    // ---- (3) Create a fresh CRM row ------------------------------------
    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut new_doc = doc! {
        "_id": new_oid,
        "userId": user_oid,
        "tenantId": tenant_oid,
        "name": snapshot.name.clone().unwrap_or_default(),
        "emails": Bson::Array(snapshot.emails.iter().cloned().map(Bson::String).collect()),
        "phones": Bson::Array(snapshot.phones.iter().cloned().map(Bson::String).collect()),
        "_sabchatContactId": sabchat_oid,
        "createdAt": now,
        "updatedAt": now,
    };
    // Convenience scalar fields the legacy CRM UI reads.
    if let Some(first_email) = snapshot.emails.first() {
        new_doc.insert("email", first_email.clone());
    }
    if let Some(first_phone) = snapshot.phones.first() {
        new_doc.insert("phone", first_phone.clone());
    }

    coll.insert_one(new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.insert_one"))
    })?;

    Ok((new_oid, true))
}

// ===========================================================================
// POST /push-to-crm/{sabChatContactId}
// ===========================================================================

/// `POST /push-to-crm/{sabChatContactId}` — force-push the sabchat
/// contact's name/emails/phones into the linked `crm_contacts` row.
///
/// If the contact is not linked yet the bridge auto-links it (matching
/// the [`link_contact`] resolution order) before applying the push, so
/// callers never need to chain two requests.
#[instrument(skip_all, fields(sabchat_contact_id = %sabchat_contact_id))]
pub async fn push_to_crm(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(sabchat_contact_id): Path<String>,
) -> Result<Json<LinkContactResponse>> {
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let sabchat_doc = load_sabchat_contact(&state.mongo, &sabchat_contact_id, tenant_oid).await?;
    let sabchat_oid = sabchat_doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat contact missing _id")))?;
    let snapshot = SabChatContactSnapshot::from_doc(&sabchat_doc);

    let existing_link = sabchat_doc.get_object_id("crmContactId").ok();
    let (crm_oid, created) = match existing_link {
        Some(oid) => (oid, false),
        None => {
            resolve_or_create_crm_contact(
                &state.mongo,
                user_oid,
                tenant_oid,
                None,
                &snapshot,
                sabchat_oid,
            )
            .await?
        }
    };

    // Force-push: `$set` name + emails + phones on the CRM row.
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "emails": Bson::Array(snapshot.emails.iter().cloned().map(Bson::String).collect()),
        "phones": Bson::Array(snapshot.phones.iter().cloned().map(Bson::String).collect()),
        "_sabchatContactId": sabchat_oid,
        "updatedAt": now,
    };
    if let Some(name) = snapshot.name.as_deref().filter(|s| !s.is_empty()) {
        set_doc.insert("name", name);
    }
    if let Some(first_email) = snapshot.emails.first() {
        set_doc.insert("email", first_email.clone());
    }
    if let Some(first_phone) = snapshot.phones.first() {
        set_doc.insert("phone", first_phone.clone());
    }

    state
        .mongo
        .collection::<Document>(CRM_CONTACTS_COLL)
        .update_one(
            doc! {
                "_id": crm_oid,
                "$or": crm_tenant_filter(user_oid, tenant_oid),
            },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.update_one(push)"))
        })?;

    // Make sure the sabchat side has the link too (idempotent).
    state
        .mongo
        .collection::<Document>(SABCHAT_CONTACTS_COLL)
        .update_one(
            doc! { "_id": sabchat_oid, "tenantId": tenant_oid },
            doc! { "$set": { "crmContactId": crm_oid, "updatedAt": now } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one(push)"))
        })?;

    Ok(Json(LinkContactResponse {
        sabchat_contact_id: sabchat_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        created,
    }))
}

// ===========================================================================
// POST /pull-from-crm/{sabChatContactId}
// ===========================================================================

/// `POST /pull-from-crm/{sabChatContactId}` — copy the linked CRM
/// contact's name/emails/phones back onto the sabchat contact.
///
/// Errors with `409 Conflict` if the sabchat contact has no `crmContactId`
/// yet — the caller is expected to run `/link-contact` first.
#[instrument(skip_all, fields(sabchat_contact_id = %sabchat_contact_id))]
pub async fn pull_from_crm(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(sabchat_contact_id): Path<String>,
) -> Result<Json<LinkContactResponse>> {
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let sabchat_doc = load_sabchat_contact(&state.mongo, &sabchat_contact_id, tenant_oid).await?;
    let sabchat_oid = sabchat_doc
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("sabchat contact missing _id")))?;
    let crm_oid = sabchat_doc.get_object_id("crmContactId").map_err(|_| {
        ApiError::Conflict("SabChat contact is not linked to a CRM contact yet.".to_owned())
    })?;

    // Load CRM doc under either tenancy dialect.
    let crm_doc = state
        .mongo
        .collection::<Document>(CRM_CONTACTS_COLL)
        .find_one(doc! {
            "_id": crm_oid,
            "$or": crm_tenant_filter(user_oid, tenant_oid),
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_contacts.find_one(pull)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Linked CRM contact not found.".to_owned()))?;

    // Read the CRM-side fields. Both `email`/`phone` scalars and
    // `emails[]`/`phones[]` arrays are tolerated — array wins when both
    // are present.
    let mut emails = string_array(&crm_doc, "emails");
    if emails.is_empty() {
        if let Ok(e) = crm_doc.get_str("email") {
            if !e.is_empty() {
                emails.push(e.to_owned());
            }
        }
    }
    let mut phones = string_array(&crm_doc, "phones");
    if phones.is_empty() {
        if let Ok(p) = crm_doc.get_str("phone") {
            if !p.is_empty() {
                phones.push(p.to_owned());
            }
        }
    }
    let crm_name = crm_doc.get_str("name").ok().map(str::to_owned);

    let now = bson::DateTime::from_chrono(Utc::now());
    let mut set_doc = doc! {
        "emails": Bson::Array(emails.iter().cloned().map(Bson::String).collect()),
        "phones": Bson::Array(phones.iter().cloned().map(Bson::String).collect()),
        "updatedAt": now,
    };
    if let Some(name) = crm_name.as_deref().filter(|s| !s.is_empty()) {
        set_doc.insert("name", name);
    }

    state
        .mongo
        .collection::<Document>(SABCHAT_CONTACTS_COLL)
        .update_one(
            doc! { "_id": sabchat_oid, "tenantId": tenant_oid },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.update_one(pull)"))
        })?;

    Ok(Json(LinkContactResponse {
        sabchat_contact_id: sabchat_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        created: false,
    }))
}

// ===========================================================================
// Conversation → CRM record helpers
// ===========================================================================

/// Resolve the conversation's contact_id and ensure it's linked to a
/// CRM row, auto-linking if necessary. Returns `(conversationOid,
/// crmContactOid)`.
async fn resolve_conversation_crm_link(
    mongo: &MongoHandle,
    user_oid: ObjectId,
    tenant_oid: ObjectId,
    conversation_id_hex: &str,
) -> Result<(ObjectId, Document, ObjectId)> {
    let conversation = load_sabchat_conversation(mongo, conversation_id_hex, tenant_oid).await?;
    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Conflict("Conversation has no contact attached.".to_owned()))?;

    let sabchat_doc = mongo
        .collection::<Document>(SABCHAT_CONTACTS_COLL)
        .find_one(doc! { "_id": contact_oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_contacts.find_one(conv)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation contact not found.".to_owned()))?;

    let crm_oid = match sabchat_doc.get_object_id("crmContactId").ok() {
        Some(oid) => oid,
        None => {
            let snapshot = SabChatContactSnapshot::from_doc(&sabchat_doc);
            let (oid, _created) = resolve_or_create_crm_contact(
                mongo,
                user_oid,
                tenant_oid,
                None,
                &snapshot,
                contact_oid,
            )
            .await?;
            // Persist the back-link so subsequent conversations short-circuit.
            mongo
                .collection::<Document>(SABCHAT_CONTACTS_COLL)
                .update_one(
                    doc! { "_id": contact_oid, "tenantId": tenant_oid },
                    doc! {
                        "$set": {
                            "crmContactId": oid,
                            "updatedAt": bson::DateTime::from_chrono(Utc::now()),
                        }
                    },
                )
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabchat_contacts.update_one(auto-link)"),
                    )
                })?;
            oid
        }
    };

    Ok((conversation_oid, conversation, crm_oid))
}

/// `$push` a freshly-created id onto a conversation's
/// `customAttrs.<key>` array. Idempotent — `customAttrs` is created if
/// missing, the inner array is `$addToSet`'d so re-runs don't duplicate.
async fn push_conversation_custom_attr_id(
    mongo: &MongoHandle,
    conversation_oid: ObjectId,
    tenant_oid: ObjectId,
    key: &str,
    new_id: ObjectId,
) -> Result<()> {
    let path = format!("customAttrs.{key}");
    let now = bson::DateTime::from_chrono(Utc::now());
    mongo
        .collection::<Document>(SABCHAT_CONVERSATIONS_COLL)
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant_oid },
            doc! {
                "$addToSet": { &path: new_id },
                "$set": { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(customAttrs)"),
            )
        })?;
    Ok(())
}

// ===========================================================================
// POST /conversation-to-deal/{conversationId}
// ===========================================================================

/// `POST /conversation-to-deal/{conversationId}` — create a `crm_deals`
/// row from a SabChat conversation and write the deal id back onto
/// `conversation.customAttrs.dealIds[]`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn conversation_to_deal(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<ConversationToDealBody>,
) -> Result<Json<ConversationToDealResponse>> {
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let pipeline_oid = oid_from_str(&body.pipeline_id)
        .map_err(|_| ApiError::BadRequest("Invalid pipelineId.".to_owned()))?;
    let stage_oid = match body.stage_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => {
            Some(oid_from_str(s).map_err(|_| ApiError::BadRequest("Invalid stageId.".to_owned()))?)
        }
        None => None,
    };

    let (conversation_oid, conversation, crm_oid) =
        resolve_conversation_crm_link(&state.mongo, user_oid, tenant_oid, &conversation_id).await?;

    // Derive a sensible title — body wins, fall back to last preview, then
    // a generic constant.
    let title = body
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            conversation
                .get_str("lastMessagePreview")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_owned())
        })
        .unwrap_or_else(|| "New deal from chat".to_owned());

    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut new_doc = doc! {
        "_id": new_oid,
        "userId": user_oid,
        "tenantId": tenant_oid,
        "title": title,
        "pipelineId": pipeline_oid,
        "ownerId": user_oid,
        "status": "open",
        "party": { "primaryContactId": crm_oid },
        "primaryContactId": crm_oid,
        "_sourceConversationId": conversation_oid,
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(s) = stage_oid {
        new_doc.insert("stageId", s);
    }
    if let Some(amount) = body.amount {
        new_doc.insert("amount", amount);
    }

    state
        .mongo
        .collection::<Document>(CRM_DEALS_COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_deals.insert_one(bridge)"))
        })?;

    push_conversation_custom_attr_id(
        &state.mongo,
        conversation_oid,
        tenant_oid,
        "dealIds",
        new_oid,
    )
    .await?;

    Ok(Json(ConversationToDealResponse {
        conversation_id: conversation_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        deal_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /conversation-to-ticket/{conversationId}
// ===========================================================================

/// `POST /conversation-to-ticket/{conversationId}` — create a
/// `crm_tickets` row from a SabChat conversation and write the ticket id
/// back onto `conversation.customAttrs.ticketIds[]`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn conversation_to_ticket(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(conversation_id): Path<String>,
    body: Option<Json<ConversationToTicketBody>>,
) -> Result<Json<ConversationToTicketResponse>> {
    let Json(body) = body.unwrap_or_default();
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let (conversation_oid, conversation, crm_oid) =
        resolve_conversation_crm_link(&state.mongo, user_oid, tenant_oid, &conversation_id).await?;

    let subject = body
        .subject
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .or_else(|| {
            conversation
                .get_str("lastMessagePreview")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.to_owned())
        })
        .unwrap_or_else(|| "New ticket from chat".to_owned());

    let priority = body
        .priority
        .as_deref()
        .map(str::to_owned)
        .unwrap_or_else(|| "medium".to_owned());

    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_doc = doc! {
        "_id": new_oid,
        "userId": user_oid,
        "tenantId": tenant_oid,
        "subject": subject,
        "priority": priority,
        "status": "open",
        "requesterId": crm_oid,
        "primaryContactId": crm_oid,
        "_sourceConversationId": conversation_oid,
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(CRM_TICKETS_COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_tickets.insert_one(bridge)"))
        })?;

    push_conversation_custom_attr_id(
        &state.mongo,
        conversation_oid,
        tenant_oid,
        "ticketIds",
        new_oid,
    )
    .await?;

    Ok(Json(ConversationToTicketResponse {
        conversation_id: conversation_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        ticket_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /conversation-to-booking/{conversationId}
// ===========================================================================

/// `POST /conversation-to-booking/{conversationId}` — create a
/// `crm_bookings` row from a SabChat conversation and write the booking
/// id back onto `conversation.customAttrs.bookingIds[]`.
#[instrument(skip_all, fields(conversation_id = %conversation_id))]
pub async fn conversation_to_booking(
    user: AuthUser,
    State(state): State<SabChatCrmBridgeState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<ConversationToBookingBody>,
) -> Result<Json<ConversationToBookingResponse>> {
    let tenant_oid = tenant_oid_from_auth(&user)?;
    let user_oid = user_oid_from_auth(&user)?;

    let service_oid = oid_from_str(&body.service_id)
        .map_err(|_| ApiError::BadRequest("Invalid serviceId.".to_owned()))?;

    let (conversation_oid, _conversation, crm_oid) =
        resolve_conversation_crm_link(&state.mongo, user_oid, tenant_oid, &conversation_id).await?;

    let new_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_doc = doc! {
        "_id": new_oid,
        "userId": user_oid,
        "tenantId": tenant_oid,
        "serviceId": service_oid,
        "contactId": crm_oid,
        "primaryContactId": crm_oid,
        "startAt": bson::DateTime::from_chrono(body.start_at),
        "status": "pending",
        "_sourceConversationId": conversation_oid,
        "createdAt": now,
        "updatedAt": now,
    };

    state
        .mongo
        .collection::<Document>(CRM_BOOKINGS_COLL)
        .insert_one(new_doc)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("crm_bookings.insert_one(bridge)"))
        })?;

    push_conversation_custom_attr_id(
        &state.mongo,
        conversation_oid,
        tenant_oid,
        "bookingIds",
        new_oid,
    )
    .await?;

    Ok(Json(ConversationToBookingResponse {
        conversation_id: conversation_oid.to_hex(),
        crm_contact_id: crm_oid.to_hex(),
        booking_id: new_oid.to_hex(),
    }))
}
