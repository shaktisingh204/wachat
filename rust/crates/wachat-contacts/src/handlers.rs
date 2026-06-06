//! HTTP handlers for the wachat contacts domain.
//!
//! Each handler maps 1:1 to a function in
//! `src/app/actions/contact.actions.ts`:
//!
//! | Endpoint                                | TS source                              |
//! |-----------------------------------------|----------------------------------------|
//! | `POST   /v1/contacts`                   | `handleAddNewContact`                  |
//! | `GET    /v1/contacts`                   | `getContactsPageData`                  |
//! | `POST   /v1/contacts/import`            | `handleImportContacts`                 |
//! | `PATCH  /v1/contacts/:id`               | `handleUpdateContactDetails`           |
//! | `PATCH  /v1/contacts/:id/status`        | `handleUpdateContactStatus`            |
//! | `PATCH  /v1/contacts/:id/tags`          | `updateContactTags`                    |
//! | `DELETE /v1/contacts/:id`               | `deleteContact`                        |
//!
//! ## Tenancy guards
//!
//! The TS code uses an "owner-or-agent" guard for the project-scoped
//! mutations (add and delete). We mirror that exactly via
//! [`load_project_with_membership`]. The remaining mutations
//! (update-details, update-status, update-tags) deliberately do **not**
//! re-check project access — that matches the legacy behaviour, which
//! relied on the calling UI surface having already verified access.
//! The import endpoint additionally enforces strict ownership (TS
//! checked `project.userId.toString() === session.user._id`).

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AddContactBody, AddContactResponse, CONTACTS_PER_PAGE, ImportContactsBody,
    ImportContactsResponse, KanbanColumn, KanbanQuery, KanbanResponse, ListContactsQuery,
    ListContactsResponse, SaveKanbanStatusesBody, SuccessResponse, UpdateContactDetailsBody,
    UpdateContactStatusBody, UpdateContactTagsBody,
};
use crate::state::WachatContactsState;

/// Mongo collection names — kept inline (not in a separate `consts`
/// module) because they're only used here and matching the TS literal
/// strings 1:1 makes review against the legacy code trivial.
const CONTACTS_COLL: &str = "contacts";
const PROJECTS_COLL: &str = "projects";

/// Bulk-upsert batch size for the import path. Mirrors the legacy TS
/// behaviour, which built one big `bulkWrite` array — we slice it into
/// 1k chunks to keep individual round trips bounded.
const IMPORT_BATCH_SIZE: usize = 1_000;

/// Default kanban column slugs, mirroring the native
/// `getKanbanData`/`saveKanbanStatuses` `defaultStatuses` array exactly.
/// These three are always present (and never persisted into
/// `projects.kanbanStatuses`); any extra columns the user adds are
/// appended from `project.kanbanStatuses`, deduped, in saved order.
const DEFAULT_KANBAN_STATUSES: [&str; 3] = ["new", "open", "resolved"];

// ===========================================================================
// Tenancy guards
// ===========================================================================

/// Load a project and enforce **owner-or-agent** access for the calling
/// user. Returns `404` if no matching project exists (matches the TS
/// "Project not found or you do not have permission." error path,
/// which collapsed both not-found and forbidden into a single message
/// to avoid leaking project existence).
///
/// Mirrors the TS query at lines 48-54 / 336-342:
///
/// ```text
/// db.collection<Project>('projects').findOne({
///   _id: new ObjectId(projectId),
///   $or: [
///     { userId: new ObjectId(session.user._id) },
///     { 'agents.userId': new ObjectId(session.user._id) },
///   ],
/// });
/// ```
async fn load_project_with_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let filter = doc! {
        "_id": project_oid,
        "$or": [
            { "userId": user_oid },
            { "agents.userId": user_oid },
        ],
    };
    coll.find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| {
            ApiError::NotFound("Project not found or you do not have permission.".to_owned())
        })
}

/// Strict-ownership guard — used by the import endpoint to mirror the
/// TS check `project.userId.toString() === session.user._id`. Returns
/// `403 Forbidden` on mismatch.
async fn load_project_strict_owner(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    let project = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
        .ok_or_else(|| ApiError::Forbidden("Permission denied.".to_owned()))?;

    let owner = project.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err(ApiError::Forbidden("Permission denied.".to_owned()));
    }
    Ok(project)
}

// ===========================================================================
// POST /v1/contacts — handleAddNewContact
// ===========================================================================

/// `POST /v1/contacts` — add a new contact under the caller's project.
///
/// Validates input, runs the owner-or-agent guard, rejects duplicates
/// on `{ waId, projectId }`, then inserts the new document. Mirrors
/// `handleAddNewContact` lines 17-88.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn add_contact(
    user: AuthUser,
    State(state): State<WachatContactsState>,
    Json(body): Json<AddContactBody>,
) -> Result<Json<AddContactResponse>> {
    // ---- Input validation ----------------------------------------------
    if body.country_code.trim().is_empty() || body.phone.trim().is_empty() {
        return Err(ApiError::Validation(
            "Country code and phone number are required.".to_owned(),
        ));
    }
    if body.project_id.trim().is_empty()
        || body.phone_number_id.trim().is_empty()
        || body.name.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "Project, Phone Number, and Name are required.".to_owned(),
        ));
    }

    // Sanitize and combine — TS line 39: `${cc.replace(/\D/g,'')}${ph.replace(/\D/g,'')}`.
    let wa_id = format!(
        "{}{}",
        digits_only(&body.country_code),
        digits_only(&body.phone),
    );

    // ---- Tenancy guard --------------------------------------------------
    let project = load_project_with_membership(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    // ---- Duplicate check ------------------------------------------------
    let contacts = state.mongo.collection::<Document>(CONTACTS_COLL);
    let existing = contacts
        .find_one(doc! { "waId": &wa_id, "projectId": project_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(duplicate)"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Conflict(
            "A contact with this WhatsApp ID already exists in this project.".to_owned(),
        ));
    }

    // ---- Insert ---------------------------------------------------------
    let now = bson::DateTime::from_chrono(Utc::now());
    let tag_oids: Vec<ObjectId> = body
        .tag_ids
        .iter()
        .map(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .collect::<Result<Vec<_>>>()?;

    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "projectId": project_oid,
        "phoneNumberId": &body.phone_number_id,
        "name": &body.name,
        "waId": &wa_id,
        "userId": user_oid,
        "status": "new",
        "createdAt": now,
        "updatedAt": now,
        "tagIds": Bson::Array(tag_oids.into_iter().map(Bson::ObjectId).collect()),
    };
    contacts
        .insert_one(new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.insert_one")))?;

    Ok(Json(AddContactResponse {
        message: format!("Contact \"{}\" added successfully.", body.name),
        contact_id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /v1/contacts — getContactsPageData
// ===========================================================================

/// `GET /v1/contacts` — paginated contact list with optional filters.
///
/// Mirrors `getContactsPageData` lines 168-227. The TS code returned an
/// empty list on auth failure; we surface a proper 401 instead because
/// the [`AuthUser`] extractor enforces presence at the router edge.
#[instrument(skip_all, fields(project_id = %query.project_id))]
pub async fn list_contacts(
    _user: AuthUser,
    State(state): State<WachatContactsState>,
    Query(query): Query<ListContactsQuery>,
) -> Result<Json<ListContactsResponse>> {
    let project_oid = oid_from_str(&query.project_id)?;

    // ---- Build filter ---------------------------------------------------
    let mut filter = doc! { "projectId": project_oid };

    if let Some(pn) = query.phone_number_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("phoneNumberId", pn);
    }

    if let Some(search) = query.search.as_deref().filter(|s| !s.is_empty()) {
        // TS: `$or: [{ name: regex }, { waId: regex }]`.
        let regex = doc! { "$regex": search, "$options": "i" };
        filter.insert(
            "$or",
            Bson::Array(vec![
                Bson::Document(doc! { "name": regex.clone() }),
                Bson::Document(doc! { "waId": regex }),
            ]),
        );
    }

    if let Some(tag_csv) = query.tag_ids.as_deref().filter(|s| !s.is_empty()) {
        let oids: Vec<ObjectId> = tag_csv
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(oid_from_str)
            .collect::<Result<Vec<_>>>()?;
        if !oids.is_empty() {
            filter.insert(
                "tagIds",
                doc! {
                    "$in": Bson::Array(oids.into_iter().map(Bson::ObjectId).collect()),
                },
            );
        }
    }

    // ---- Pagination -----------------------------------------------------
    let limit = CONTACTS_PER_PAGE;
    let skip = (query.page.saturating_sub(1) as i64) * limit;

    let opts = FindOptions::builder()
        // TS: `.sort({ lastMessageTimestamp: -1, updatedAt: -1 })`.
        .sort(doc! { "lastMessageTimestamp": -1, "updatedAt": -1 })
        .skip(skip.max(0) as u64)
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);

    let cursor = coll
        .find(filter.clone())
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.collect")))?;

    let total = coll
        .count_documents(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.count")))?;

    let contacts: Vec<Value> = docs.into_iter().map(document_to_clean_json).collect();

    Ok(Json(ListContactsResponse { contacts, total }))
}

// ===========================================================================
// POST /v1/contacts/import — handleImportContacts
// ===========================================================================

/// `POST /v1/contacts/import` — bulk upsert pre-parsed contact rows.
///
/// Mirrors `handleImportContacts` lines 90-165. CSV parsing happens in
/// the TS shim; we accept a JSON array of rows (each row is a free-
/// form object — `phone` and `name` are special, every other column
/// flows into `variables`).
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn import_contacts(
    user: AuthUser,
    State(state): State<WachatContactsState>,
    Json(body): Json<ImportContactsBody>,
) -> Result<Json<ImportContactsResponse>> {
    if body.project_id.trim().is_empty() || body.phone_number_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "Project and Phone Number ID are required.".to_owned(),
        ));
    }

    // The TS code rejects empty file uploads with "No file uploaded.";
    // we echo that same message when no rows arrive so the shim's
    // existing error wording stays accurate.
    if body.contacts.is_empty() {
        return Err(ApiError::Validation("No file uploaded.".to_owned()));
    }

    let project = load_project_strict_owner(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    // ---- Build bulk-write ops ------------------------------------------
    //
    // Each row is shape `{ phone, name, ...variables }`. Rows missing
    // either field are skipped (matches TS line 122-125).
    let mut ops: Vec<Document> = Vec::with_capacity(body.contacts.len());
    let mut skipped: u64 = 0;

    for row in &body.contacts {
        let obj = match row.as_object() {
            Some(o) => o,
            None => {
                skipped += 1;
                continue;
            }
        };

        let phone = obj
            .get("phone")
            .and_then(|v| v.as_str())
            .map(str::to_owned)
            .unwrap_or_default();
        let name = obj
            .get("name")
            .and_then(|v| v.as_str())
            .map(str::to_owned)
            .unwrap_or_default();
        if phone.is_empty() || name.is_empty() {
            skipped += 1;
            continue;
        }

        let wa_id = digits_only(&phone);

        // Strip phone + name from the variables map (TS:
        // `const { phone, name, ...variables } = contactRow;`).
        let mut variables = serde_json::Map::with_capacity(obj.len().saturating_sub(2));
        for (k, v) in obj {
            if k == "phone" || k == "name" {
                continue;
            }
            variables.insert(k.clone(), v.clone());
        }
        let variables_bson = serde_value_to_bson(&Value::Object(variables));
        let now = bson::DateTime::from_chrono(Utc::now());

        let op = doc! {
            "filter": { "waId": &wa_id, "projectId": project_oid },
            "update": {
                "$setOnInsert": {
                    "projectId": project_oid,
                    "phoneNumberId": &body.phone_number_id,
                    "name": &name,
                    "waId": &wa_id,
                    "userId": user_oid,
                    "status": "imported",
                    "createdAt": now,
                },
                "$set": {
                    "variables": variables_bson,
                    "updatedAt": now,
                },
            },
        };
        ops.push(op);
    }

    // ---- Execute in batches --------------------------------------------
    //
    // The official `mongodb` Rust driver does not yet expose a typed
    // `bulk_write` builder for mixed `update_one` operations on stable
    // 3.x without a feature flag, so we emulate the legacy behaviour
    // with N parallel `update_one(upsert)` calls, batched to bound
    // concurrency.
    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let mut imported: u64 = 0;
    for chunk in ops.chunks(IMPORT_BATCH_SIZE) {
        for op in chunk {
            let filter = op
                .get_document("filter")
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("import.filter")))?
                .clone();
            let update = op
                .get_document("update")
                .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("import.update")))?
                .clone();
            let res = coll
                .update_one(filter, update)
                .upsert(true)
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one"))
                })?;
            if res.upserted_id.is_some() || res.modified_count > 0 {
                imported += 1;
            }
        }
    }

    let message =
        format!("Import complete. {imported} contacts imported/updated. {skipped} rows skipped.");
    Ok(Json(ImportContactsResponse {
        message,
        imported,
        skipped,
    }))
}

// ===========================================================================
// PATCH /v1/contacts/:id — handleUpdateContactDetails
// ===========================================================================

/// `PATCH /v1/contacts/:id` — partial update of name + variables.
///
/// Mirrors `handleUpdateContactDetails` lines 229-261. The TS code did
/// not enforce project membership here (it relied on the calling UI),
/// and we keep that contract.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn update_contact_details(
    _user: AuthUser,
    State(state): State<WachatContactsState>,
    Path(contact_id): Path<String>,
    Json(body): Json<UpdateContactDetailsBody>,
) -> Result<Json<SuccessResponse>> {
    let contact_oid = oid_from_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("Invalid contact ID.".to_owned()))?;

    let mut update = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(variables) = body.variables.as_ref() {
        update.insert("variables", serde_value_to_bson(variables));
    }
    if let Some(name) = body.name.as_deref().filter(|s| !s.is_empty()) {
        update.insert("name", name);
    }

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    coll.update_one(doc! { "_id": contact_oid }, doc! { "$set": update })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one(details)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PATCH /v1/contacts/:id/status — handleUpdateContactStatus
// ===========================================================================

/// `PATCH /v1/contacts/:id/status` — `$set` status + assignedAgentId.
///
/// Mirrors `handleUpdateContactStatus` lines 263-293. When
/// `assignedAgentId` is absent the field is explicitly set to `null`
/// (matches the TS `else { updateDoc.assignedAgentId = null; }`
/// branch).
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn update_contact_status(
    _user: AuthUser,
    State(state): State<WachatContactsState>,
    Path(contact_id): Path<String>,
    Json(body): Json<UpdateContactStatusBody>,
) -> Result<Json<SuccessResponse>> {
    let contact_oid = oid_from_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("Invalid data provided.".to_owned()))?;
    if body.status.trim().is_empty() {
        return Err(ApiError::Validation("Invalid data provided.".to_owned()));
    }

    let assigned: Bson = match body.assigned_agent_id.as_deref().filter(|s| !s.is_empty()) {
        Some(id) => Bson::ObjectId(oid_from_str(id)?),
        None => Bson::Null,
    };

    let update = doc! {
        "$set": {
            "status": &body.status,
            "assignedAgentId": assigned,
        },
    };

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    coll.update_one(doc! { "_id": contact_oid }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one(status)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// PATCH /v1/contacts/:id/tags — updateContactTags
// ===========================================================================

/// `PATCH /v1/contacts/:id/tags` — replace the contact's tag set.
///
/// Mirrors `updateContactTags` lines 295-316. The TS cast each string
/// id to an `ObjectId` before writing; we do the same and surface a
/// 400 if any id is malformed.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn update_contact_tags(
    _user: AuthUser,
    State(state): State<WachatContactsState>,
    Path(contact_id): Path<String>,
    Json(body): Json<UpdateContactTagsBody>,
) -> Result<Json<SuccessResponse>> {
    let contact_oid = oid_from_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("Invalid data provided.".to_owned()))?;
    let tag_oids: Vec<ObjectId> = body
        .tag_ids
        .iter()
        .map(|s| s.as_str())
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .collect::<Result<Vec<_>>>()?;

    let update = doc! {
        "$set": {
            "tagIds": Bson::Array(tag_oids.into_iter().map(Bson::ObjectId).collect()),
        },
    };

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    coll.update_one(doc! { "_id": contact_oid }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one(tags)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/contacts/:id — deleteContact
// ===========================================================================

/// `DELETE /v1/contacts/:id` — owner-or-agent guarded contact delete.
///
/// Mirrors `deleteContact` lines 319-362. Steps:
/// 1. Load the contact to learn its `projectId`.
/// 2. Run the owner-or-agent project guard.
/// 3. Delete by `_id`.
#[instrument(skip_all, fields(contact_id = %contact_id))]
pub async fn delete_contact(
    user: AuthUser,
    State(state): State<WachatContactsState>,
    Path(contact_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let contact_oid = oid_from_str(&contact_id)
        .map_err(|_| ApiError::BadRequest("Invalid contact ID.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let contact = coll
        .find_one(doc! { "_id": contact_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Contact not found.".to_owned()))?;

    let project_oid = contact
        .get_object_id("projectId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("contact missing projectId")))?;

    // Re-run the owner-or-agent guard via the same helper. Note the TS
    // returned "You do not have permission to delete this contact." for
    // both not-found and forbidden — we keep that message but render
    // the error as 403 (more accurate; the contact already proved the
    // project exists).
    let user_oid = ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;
    let projects = state.mongo.collection::<Document>(PROJECTS_COLL);
    let project = projects
        .find_one(doc! {
            "_id": project_oid,
            "$or": [
                { "userId": user_oid },
                { "agents.userId": user_oid },
            ],
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.find_one(delete)"))
        })?;
    if project.is_none() {
        return Err(ApiError::Forbidden(
            "You do not have permission to delete this contact.".to_owned(),
        ));
    }

    let result = coll
        .delete_one(doc! { "_id": contact_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.delete_one")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::Internal(anyhow::anyhow!(
            "Failed to delete contact."
        )));
    }

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/contacts/kanban — getKanbanData (contacts-domain board)
// ===========================================================================

/// `GET /v1/contacts/kanban` — group a project's contacts into status
/// columns for the chat-kanban board.
///
/// This is the contacts-domain replacement for the native-mongo
/// `getKanbanData` (`project.actions.ts`). It deliberately does **not**
/// reuse the Facebook-domain `/v1/facebook/crm/.../kanban` endpoint,
/// which returns Messenger *subscribers* keyed on PSID — a different
/// shape from the `waId`-keyed `Contact` documents this board renders.
///
/// Column set mirrors the native action 1:1: the three
/// [`DEFAULT_KANBAN_STATUSES`] first, then any custom `kanbanStatuses`
/// saved on the project, deduped in order. Each contact lands in the
/// column matching `status || "new"` (the same fallback the native code
/// used), so contacts with no explicit status group under `new`.
///
/// Tenancy: the owner-or-agent [`load_project_with_membership`] guard —
/// the same one the project-scoped mutations use — so an agent on the
/// project sees the board but an unrelated user gets a 404.
#[instrument(skip_all, fields(project_id = %query.project_id))]
pub async fn get_kanban(
    user: AuthUser,
    State(state): State<WachatContactsState>,
    Query(query): Query<KanbanQuery>,
) -> Result<Json<KanbanResponse>> {
    if query.project_id.trim().is_empty() {
        return Err(ApiError::Validation("Project ID is required.".to_owned()));
    }

    // ---- Tenancy guard (owner-or-agent) --------------------------------
    let project = load_project_with_membership(&user, &state.mongo, &query.project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    // ---- Resolve the column order (defaults + custom, deduped) ---------
    let mut statuses: Vec<String> =
        DEFAULT_KANBAN_STATUSES.iter().map(|s| (*s).to_owned()).collect();
    if let Ok(custom) = project.get_array("kanbanStatuses") {
        for entry in custom {
            if let Bson::String(s) = entry {
                let s = s.trim();
                if !s.is_empty() && !statuses.iter().any(|existing| existing == s) {
                    statuses.push(s.to_owned());
                }
            }
        }
    }

    // ---- Load the project's contacts (optionally number-scoped) --------
    let mut filter = doc! { "projectId": project_oid };
    if let Some(pn) = query.phone_number_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("phoneNumberId", pn);
    }

    let opts = FindOptions::builder()
        // Match the native sort so the most-recent conversation surfaces
        // first inside each column.
        .sort(doc! { "lastMessageTimestamp": -1, "updatedAt": -1 })
        .build();

    let coll = state.mongo.collection::<Document>(CONTACTS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find(kanban)")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.collect(kanban)")))?;

    // ---- Bucket contacts by status -------------------------------------
    //
    // Pre-seed every known column so empty lists still render, then drop
    // each contact into its bucket. A contact whose status is unknown
    // (not one of the resolved columns) falls back to `new`, mirroring
    // the native `(c.status || 'new')` behaviour for the common case and
    // avoiding a contact silently vanishing from the board.
    let mut buckets: Vec<(String, Vec<Value>)> =
        statuses.iter().map(|s| (s.clone(), Vec::new())).collect();

    for doc in docs {
        let status = doc
            .get_str("status")
            .ok()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("new")
            .to_owned();
        let clean = document_to_clean_json(doc);
        // Resolve the destination index with an immutable scan first
        // (matching status → else the `new` fallback column), then take
        // a single mutable borrow to push.
        let idx = buckets
            .iter()
            .position(|(name, _)| *name == status)
            .or_else(|| buckets.iter().position(|(name, _)| name == "new"));
        if let Some(i) = idx {
            buckets[i].1.push(clean);
        }
    }

    let columns: Vec<KanbanColumn> = buckets
        .into_iter()
        .map(|(name, contacts)| KanbanColumn {
            id: name.clone(),
            title: name,
            contacts,
        })
        .collect();

    Ok(Json(KanbanResponse { columns }))
}

// ===========================================================================
// POST /v1/contacts/kanban/statuses — saveKanbanStatuses
// ===========================================================================

/// `POST /v1/contacts/kanban/statuses` — persist the board's custom
/// column list onto `projects.kanbanStatuses`.
///
/// Mirrors the native `saveKanbanStatuses`: the caller posts the full
/// set of column names currently on the board; the three
/// [`DEFAULT_KANBAN_STATUSES`] are stripped before writing so only the
/// user-added lists are stored (and order/dedup is preserved). The
/// per-card *status moves* are NOT handled here — those persist via the
/// existing `PATCH /{id}/status`.
///
/// Tenancy: owner-or-agent [`load_project_with_membership`], matching
/// the read path so anyone who can see the board can rename/reorder it.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn save_kanban_statuses(
    user: AuthUser,
    State(state): State<WachatContactsState>,
    Json(body): Json<SaveKanbanStatusesBody>,
) -> Result<Json<SuccessResponse>> {
    if body.project_id.trim().is_empty() {
        return Err(ApiError::Validation("Project ID is required.".to_owned()));
    }

    let project = load_project_with_membership(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    // Strip defaults; preserve order and drop duplicates / blanks.
    let mut custom: Vec<String> = Vec::with_capacity(body.statuses.len());
    for raw in &body.statuses {
        let s = raw.trim();
        if s.is_empty() || DEFAULT_KANBAN_STATUSES.contains(&s) {
            continue;
        }
        if !custom.iter().any(|existing| existing == s) {
            custom.push(s.to_owned());
        }
    }

    let projects = state.mongo.collection::<Document>(PROJECTS_COLL);
    projects
        .update_one(
            doc! { "_id": project_oid },
            doc! { "$set": { "kanbanStatuses": Bson::Array(custom.into_iter().map(Bson::String).collect()) } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(kanbanStatuses)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Strip every non-digit character from `s`. Mirrors the TS regex
/// `s.replace(/\D/g, '')`.
fn digits_only(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_digit()).collect()
}

/// Best-effort `serde_json::Value` → `bson::Bson` conversion. Falls
/// back to `Bson::Null` if the value cannot be represented (in
/// practice it always can — `Value` and `Bson` are isomorphic for the
/// shapes we handle).
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digits_only_strips_non_ascii_digits() {
        assert_eq!(digits_only("+91 98765-43210"), "919876543210");
        assert_eq!(digits_only(""), "");
        assert_eq!(digits_only("abc"), "");
    }
}
