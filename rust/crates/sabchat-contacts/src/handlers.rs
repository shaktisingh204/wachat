//! HTTP handlers for the SabChat contacts domain.
//!
//! Each handler maps to one route on the router:
//!
//! | Endpoint                                       | Handler            |
//! |------------------------------------------------|--------------------|
//! | `POST   /v1/sabchat/contacts`                  | `create_contact`   |
//! | `GET    /v1/sabchat/contacts`                  | `list_contacts`    |
//! | `POST   /v1/sabchat/contacts/resolve`          | `resolve_contact`  |
//! | `GET    /v1/sabchat/contacts/{id}`             | `get_contact`      |
//! | `PATCH  /v1/sabchat/contacts/{id}`             | `update_contact`   |
//! | `POST   /v1/sabchat/contacts/{id}/merge`       | `merge_contact`    |
//! | `DELETE /v1/sabchat/contacts/{id}`             | `delete_contact`   |
//!
//! ## Tenancy
//!
//! Every query carries `tenant_id == auth.tenant_id`. The tenant id
//! comes off the JWT claims as a hex string; we parse it to an
//! `ObjectId` per request via [`tenant_oid`] and surface
//! [`ApiError::Unauthorized`] when the claim is malformed.
//!
//! ## Audit
//!
//! Writes append a `sabchat_audit_log` doc directly via `bson::doc!`
//! rather than going through a sibling crate — there is no
//! `sabchat-audit` Rust crate yet. The audit insert is best-effort: if
//! it fails we log and continue (the primary mutation already
//! succeeded).
//!
//! ## Normalisation
//!
//! - Emails are lowercased and deduped on write.
//! - Phones are stripped to digits only (`+`, spaces, dashes removed)
//!   then deduped.
//! - Identifier-less contacts are rejected with `BadRequest`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::{SabChatContact, SocialIdentity};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    ContactResp, CreateContactReq, ListContactsQuery, ListContactsResp, MAX_LIMIT,
    MergeContactReq, ResolveContactReq, ResolveContactResp, SuccessResp, UpdateContactReq,
};
use crate::state::SabChatContactsState;

/// Mongo collection names — kept inline (not in a separate `consts`
/// module) because they're only used here.
const CONTACTS_COLL: &str = "sabchat_contacts";
const AUDIT_COLL: &str = "sabchat_audit_log";

// ===========================================================================
// Tenancy helper
// ===========================================================================

/// Parse the JWT's `tenant_id` claim into an `ObjectId`. The claim is
/// shipped as a hex string; a malformed value indicates either a stale
/// token or tampering, so we surface `401 Unauthorized` rather than
/// `400 BadRequest` so middleware can refresh the session.
fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id).map_err(|_| {
        ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned())
    })
}

/// Parse the JWT's `user_id` claim into an `ObjectId` for audit
/// `actorId`. Returns `None` if the claim isn't a valid hex (older
/// tokens may carry email-style subjects); audit rows then carry a
/// null actor id, which the audit schema already allows.
fn user_oid(user: &AuthUser) -> Option<ObjectId> {
    ObjectId::parse_str(&user.user_id).ok()
}

// ===========================================================================
// Normalisation helpers
// ===========================================================================

/// Lower-case + trim + dedupe a list of emails, preserving first-seen
/// order. Empty strings are dropped.
fn normalize_emails(input: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(input.len());
    for raw in input {
        let v = raw.trim().to_ascii_lowercase();
        if v.is_empty() {
            continue;
        }
        if !out.iter().any(|existing| existing == &v) {
            out.push(v);
        }
    }
    out
}

/// Strip every non-digit char from each phone, dedupe, drop empties.
/// Mirrors the TS regex `s.replace(/\D/g, '')`.
fn normalize_phones(input: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(input.len());
    for raw in input {
        let v: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
        if v.is_empty() {
            continue;
        }
        if !out.iter().any(|existing| existing == &v) {
            out.push(v);
        }
    }
    out
}

/// Dedupe a list of `SocialIdentity` by `(provider, externalId)`.
fn dedupe_socials(input: &[SocialIdentity]) -> Vec<SocialIdentity> {
    let mut out: Vec<SocialIdentity> = Vec::with_capacity(input.len());
    for s in input {
        if s.provider.trim().is_empty() || s.external_id.trim().is_empty() {
            continue;
        }
        let dup = out
            .iter()
            .any(|e| e.provider == s.provider && e.external_id == s.external_id);
        if !dup {
            out.push(s.clone());
        }
    }
    out
}

/// Trim + dedupe a list of tag names, preserving first-seen order.
fn dedupe_tags(input: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(input.len());
    for raw in input {
        let v = raw.trim().to_owned();
        if v.is_empty() {
            continue;
        }
        if !out.iter().any(|existing| existing == &v) {
            out.push(v);
        }
    }
    out
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value cannot be represented (in
/// practice `Value` and `Bson` are isomorphic for the shapes we
/// handle).
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

/// Pull a `SabChatContact` out of a raw BSON document.
fn doc_to_contact(d: Document) -> Result<SabChatContact> {
    bson::from_document::<SabChatContact>(d)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contact deserialize")))
}

/// Convert a [`SocialIdentity`] into BSON for direct `doc!` use.
fn social_to_bson(s: &SocialIdentity) -> Bson {
    let mut d = doc! {
        "provider": &s.provider,
        "externalId": &s.external_id,
    };
    if let Some(h) = &s.handle {
        d.insert("handle", h);
    }
    Bson::Document(d)
}

/// Fire-and-log audit insert. Failures never propagate; the primary
/// mutation already committed when this runs.
async fn append_audit(
    mongo: &MongoHandle,
    tenant: ObjectId,
    actor: Option<ObjectId>,
    contact: ObjectId,
    action: &str,
    before: Value,
    after: Value,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut d = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "contactId": contact,
        "action": action,
        "actorType": "agent",
        "before": serde_value_to_bson(&before),
        "after": serde_value_to_bson(&after),
        "createdAt": now,
    };
    if let Some(a) = actor {
        d.insert("actorId", a);
    }
    if let Err(e) = mongo
        .collection::<Document>(AUDIT_COLL)
        .insert_one(d)
        .await
    {
        tracing::warn!(
            error = %e,
            "sabchat_audit_log insert failed (non-fatal)",
        );
    }
}

// ===========================================================================
// POST /v1/sabchat/contacts — create_contact
// ===========================================================================

/// `POST /v1/sabchat/contacts` — create a new SabChat contact.
///
/// Rejects identifier-less contacts (no email, no phone, no social id)
/// with `BadRequest`. Emails are lowercased, phones stripped to digits,
/// and every list is deduped before write.
#[instrument(skip_all)]
pub async fn create_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Json(body): Json<CreateContactReq>,
) -> Result<Json<ContactResp>> {
    let tenant = tenant_oid(&user)?;

    let emails = normalize_emails(&body.emails);
    let phones = normalize_phones(&body.phones);
    let socials = dedupe_socials(&body.social_ids);
    let tags = dedupe_tags(&body.tags);

    if emails.is_empty() && phones.is_empty() && socials.is_empty() {
        return Err(ApiError::BadRequest(
            "Contact requires at least one identifier (email, phone, or socialId).".to_owned(),
        ));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "emails": &emails,
        "phones": &phones,
        "socialIds": Bson::Array(socials.iter().map(social_to_bson).collect()),
        "tags": &tags,
        "attrs": serde_value_to_bson(body.attrs.as_ref().unwrap_or(&Value::Object(Default::default()))),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(name) = body.name.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }
    if let Some(avatar) = body.avatar_url.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("avatarUrl", avatar);
    }

    let contacts = state.mongo.collection::<Document>(CONTACTS_COLL);
    contacts
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.insert_one")))?;

    let stored = contacts
        .find_one(doc! { "_id": new_oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(post-insert)"))
        })?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("contact disappeared after insert")))?;
    let contact = doc_to_contact(stored)?;

    append_audit(
        &state.mongo,
        tenant,
        user_oid(&user),
        new_oid,
        "contact_created",
        Value::Null,
        serde_json::to_value(&contact).unwrap_or(Value::Null),
    )
    .await;

    Ok(Json(ContactResp { contact }))
}

// ===========================================================================
// GET /v1/sabchat/contacts — list_contacts
// ===========================================================================

/// `GET /v1/sabchat/contacts` — paginated tenant-scoped contact list.
///
/// Pagination is `_id`-descending; the cursor is the hex of the last
/// `_id` seen on the previous page. `limit` defaults to
/// [`DEFAULT_LIMIT`](crate::dto::DEFAULT_LIMIT) and is clamped to
/// [`MAX_LIMIT`].
#[instrument(skip_all)]
pub async fn list_contacts(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Query(query): Query<ListContactsQuery>,
) -> Result<Json<ListContactsResp>> {
    let tenant = tenant_oid(&user)?;
    let limit = query.limit.clamp(1, MAX_LIMIT) as i64;

    let mut filter = doc! { "tenantId": tenant };

    if let Some(q) = query.q.as_deref().filter(|s| !s.is_empty()) {
        let regex = doc! { "$regex": q, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "emails": regex.clone() }),
                Bson::Document(doc! { "phones": regex }),
            ]),
        );
    }

    if let Some(tag) = query.tag.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("tags", tag);
    }

    if let Some(cursor) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let oid = ObjectId::parse_str(cursor)
            .map_err(|_| ApiError::BadRequest("invalid cursor".to_owned()))?;
        filter.insert("_id", doc! { "$lt": oid });
    }

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.collect")))?;

    let items: Vec<SabChatContact> = docs
        .into_iter()
        .map(doc_to_contact)
        .collect::<Result<Vec<_>>>()?;

    let next_cursor = if (items.len() as i64) < limit {
        None
    } else {
        items.last().map(|c| c.id.to_hex())
    };

    Ok(Json(ListContactsResp { items, next_cursor }))
}

// ===========================================================================
// GET /v1/sabchat/contacts/{id} — get_contact
// ===========================================================================

/// `GET /v1/sabchat/contacts/{id}` — fetch one tenant-scoped contact.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn get_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Path(contact_id): Path<String>,
) -> Result<Json<ContactResp>> {
    let tenant = tenant_oid(&user)?;
    let oid = ObjectId::parse_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("invalid contact id".to_owned()))?;

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let d = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("contact not found".to_owned()))?;

    Ok(Json(ContactResp {
        contact: doc_to_contact(d)?,
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/contacts/{id} — update_contact
// ===========================================================================

/// `PATCH /v1/sabchat/contacts/{id}` — partial update.
///
/// Every field is optional. Lists, when supplied, fully replace the
/// stored array (no implicit merge). Use
/// [`merge_contact`] for identifier unioning.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn update_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Path(contact_id): Path<String>,
    Json(body): Json<UpdateContactReq>,
) -> Result<Json<ContactResp>> {
    let tenant = tenant_oid(&user)?;
    let oid = ObjectId::parse_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("invalid contact id".to_owned()))?;

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let before = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(pre)")))?
        .ok_or_else(|| ApiError::NotFound("contact not found".to_owned()))?;
    let before_contact = doc_to_contact(before)?;

    let mut update = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(name) = body.name.as_deref() {
        update.insert("name", name);
    }
    if let Some(avatar) = body.avatar_url.as_deref() {
        update.insert("avatarUrl", avatar);
    }
    if let Some(emails) = body.emails.as_ref() {
        update.insert("emails", normalize_emails(emails));
    }
    if let Some(phones) = body.phones.as_ref() {
        update.insert("phones", normalize_phones(phones));
    }
    if let Some(socials) = body.social_ids.as_ref() {
        let normed = dedupe_socials(socials);
        update.insert(
            "socialIds",
            Bson::Array(normed.iter().map(social_to_bson).collect()),
        );
    }
    if let Some(tags) = body.tags.as_ref() {
        update.insert("tags", dedupe_tags(tags));
    }
    if let Some(attrs) = body.attrs.as_ref() {
        update.insert("attrs", serde_value_to_bson(attrs));
    }

    coll.update_one(
        doc! { "_id": oid, "tenantId": tenant },
        doc! { "$set": update },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one")))?;

    let stored = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(post)")))?
        .ok_or_else(|| ApiError::NotFound("contact not found".to_owned()))?;
    let contact = doc_to_contact(stored)?;

    append_audit(
        &state.mongo,
        tenant,
        user_oid(&user),
        oid,
        "contact_updated",
        serde_json::to_value(&before_contact).unwrap_or(Value::Null),
        serde_json::to_value(&contact).unwrap_or(Value::Null),
    )
    .await;

    Ok(Json(ContactResp { contact }))
}

// ===========================================================================
// POST /v1/sabchat/contacts/{id}/merge — merge_contact
// ===========================================================================

/// `POST /v1/sabchat/contacts/{id}/merge` — union identifiers from
/// `sourceId` into the target contact, then delete the source.
///
/// Both contacts must belong to the calling tenant. The merge is
/// best-effort sequential: we read both, compute the unioned arrays,
/// `$set` them on the target, then delete the source. If the source
/// delete fails the target still has the unioned data — callers can
/// retry safely (idempotent on the target).
#[instrument(skip_all, fields(target_id = %contact_id))]
pub async fn merge_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Path(contact_id): Path<String>,
    Json(body): Json<MergeContactReq>,
) -> Result<Json<ContactResp>> {
    let tenant = tenant_oid(&user)?;
    let target_oid = ObjectId::parse_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("invalid target contact id".to_owned()))?;
    let source_oid = ObjectId::parse_str(&body.source_id)
        .map_err(|_| ApiError::BadRequest("invalid source contact id".to_owned()))?;
    if source_oid == target_oid {
        return Err(ApiError::BadRequest(
            "sourceId must differ from target id".to_owned(),
        ));
    }

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);

    let target_doc = coll
        .find_one(doc! { "_id": target_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find(target)")))?
        .ok_or_else(|| ApiError::NotFound("target contact not found".to_owned()))?;
    let source_doc = coll
        .find_one(doc! { "_id": source_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find(source)")))?
        .ok_or_else(|| ApiError::NotFound("source contact not found".to_owned()))?;

    let target = doc_to_contact(target_doc)?;
    let source = doc_to_contact(source_doc)?;

    // Union + dedupe.
    let mut emails = target.emails.clone();
    emails.extend(source.emails.iter().cloned());
    let emails = normalize_emails(&emails);

    let mut phones = target.phones.clone();
    phones.extend(source.phones.iter().cloned());
    let phones = normalize_phones(&phones);

    let mut socials = target.social_ids.clone();
    socials.extend(source.social_ids.iter().cloned());
    let socials = dedupe_socials(&socials);

    let mut tags = target.tags.clone();
    tags.extend(source.tags.iter().cloned());
    let tags = dedupe_tags(&tags);

    let update = doc! {
        "$set": {
            "emails": &emails,
            "phones": &phones,
            "socialIds": Bson::Array(socials.iter().map(social_to_bson).collect()),
            "tags": &tags,
            "updatedAt": bson::DateTime::from_chrono(Utc::now()),
        },
    };

    coll.update_one(doc! { "_id": target_oid, "tenantId": tenant }, update)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.update(merge)")))?;

    let del = coll
        .delete_one(doc! { "_id": source_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.delete(source)")))?;
    if del.deleted_count == 0 {
        tracing::warn!(
            target = %target_oid,
            source = %source_oid,
            "merge: source delete reported 0 — possibly already removed",
        );
    }

    let stored = coll
        .find_one(doc! { "_id": target_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(post-merge)")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("target contact missing post-merge")))?;
    let contact = doc_to_contact(stored)?;

    append_audit(
        &state.mongo,
        tenant,
        user_oid(&user),
        target_oid,
        "contact_merged",
        serde_json::to_value(&source).unwrap_or(Value::Null),
        serde_json::to_value(&contact).unwrap_or(Value::Null),
    )
    .await;

    Ok(Json(ContactResp { contact }))
}

// ===========================================================================
// POST /v1/sabchat/contacts/resolve — resolve_contact
// ===========================================================================

/// `POST /v1/sabchat/contacts/resolve` — find-or-create.
///
/// Used by channel adapters and the web widget to map an inbound
/// identifier (email / phone / social id) to a single SabChat contact.
/// Returns the existing contact if any field matches; otherwise creates
/// a brand new one carrying just the inbound identifier and `name`.
///
/// At least one of `email`, `phone`, or `socialId` must be present —
/// resolving on nothing is a `BadRequest`.
#[instrument(skip_all)]
pub async fn resolve_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Json(body): Json<ResolveContactReq>,
) -> Result<Json<ResolveContactResp>> {
    let tenant = tenant_oid(&user)?;

    let email = body
        .email
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty());
    let phone = body.phone.as_deref().map(|s| {
        s.chars().filter(|c| c.is_ascii_digit()).collect::<String>()
    }).filter(|s| !s.is_empty());
    let social = body.social_id.clone().filter(|s| {
        !s.provider.trim().is_empty() && !s.external_id.trim().is_empty()
    });

    if email.is_none() && phone.is_none() && social.is_none() {
        return Err(ApiError::BadRequest(
            "resolve requires at least one of email, phone, or socialId".to_owned(),
        ));
    }

    // ---- Lookup ---------------------------------------------------------
    //
    // We OR every supplied identifier into a single `$or` filter rather
    // than running 1–3 sequential finds. Mongo handles the array `$in`
    // semantics natively for `emails` / `phones` (the stored fields are
    // arrays, so equality matches "any element equals").
    let mut or_terms: Vec<Bson> = Vec::new();
    if let Some(e) = email.as_ref() {
        or_terms.push(Bson::Document(doc! { "emails": e }));
    }
    if let Some(p) = phone.as_ref() {
        or_terms.push(Bson::Document(doc! { "phones": p }));
    }
    if let Some(s) = social.as_ref() {
        or_terms.push(Bson::Document(doc! {
            "socialIds": {
                "$elemMatch": {
                    "provider": &s.provider,
                    "externalId": &s.external_id,
                },
            },
        }));
    }

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let hit = coll
        .find_one(doc! {
            "tenantId": tenant,
            "$or": Bson::Array(or_terms),
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(resolve)")))?;

    if let Some(d) = hit {
        let contact = doc_to_contact(d)?;
        return Ok(Json(ResolveContactResp {
            contact,
            created: false,
        }));
    }

    // ---- Create ---------------------------------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let emails_vec: Vec<String> = email.iter().cloned().collect();
    let phones_vec: Vec<String> = phone.iter().cloned().collect();
    let socials_vec: Vec<SocialIdentity> = social.iter().cloned().collect();

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "emails": &emails_vec,
        "phones": &phones_vec,
        "socialIds": Bson::Array(socials_vec.iter().map(social_to_bson).collect()),
        "tags": Vec::<String>::new(),
        "attrs": Bson::Document(Document::new()),
        "createdAt": now,
        "updatedAt": now,
    };
    if let Some(name) = body.name.as_deref().filter(|s| !s.is_empty()) {
        new_doc.insert("name", name);
    }

    coll.insert_one(new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.insert_one(resolve)")))?;

    let stored = coll
        .find_one(doc! { "_id": new_oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(post-resolve)")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("contact disappeared after resolve insert")))?;
    let contact = doc_to_contact(stored)?;

    append_audit(
        &state.mongo,
        tenant,
        user_oid(&user),
        new_oid,
        "contact_created",
        Value::Null,
        serde_json::to_value(&contact).unwrap_or(Value::Null),
    )
    .await;

    Ok(Json(ResolveContactResp {
        contact,
        created: true,
    }))
}

// ===========================================================================
// DELETE /v1/sabchat/contacts/{id} — delete_contact
// ===========================================================================

/// `DELETE /v1/sabchat/contacts/{id}` — tenant-scoped hard delete.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn delete_contact(
    user: AuthUser,
    State(state): State<SabChatContactsState>,
    Path(contact_id): Path<String>,
) -> Result<Json<SuccessResp>> {
    let tenant = tenant_oid(&user)?;
    let oid = ObjectId::parse_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("invalid contact id".to_owned()))?;

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);

    let before = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(pre-del)")))?
        .ok_or_else(|| ApiError::NotFound("contact not found".to_owned()))?;
    let before_contact = doc_to_contact(before)?;

    let res = coll
        .delete_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("contact not found".to_owned()));
    }

    append_audit(
        &state.mongo,
        tenant,
        user_oid(&user),
        oid,
        "contact_deleted",
        serde_json::to_value(&before_contact).unwrap_or(Value::Null),
        Value::Null,
    )
    .await;

    Ok(Json(SuccessResp::ok()))
}
