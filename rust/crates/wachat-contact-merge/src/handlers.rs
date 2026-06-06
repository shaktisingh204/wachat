//! HTTP handler for the wachat contact-merge domain.
//!
//! | Endpoint                          | Action                       |
//! |-----------------------------------|------------------------------|
//! | `POST /v1/wachat/contact-merge`   | merge two contacts (destructive) |
//!
//! ## What "merge" does
//!
//! Given `{ projectId, primaryId, secondaryId }`, all scoped to one
//! project:
//!
//! 1. **Tenancy guard** — load the project with the owner-or-agent guard
//!    (mirrors `wachat-contacts::load_project_with_membership`). Both
//!    contacts must also belong to that project.
//! 2. **Field-level union** — for each of `name` / `waId` / `phoneNumberId`
//!    / `variables` / `tagIds`, the primary's value wins when present and
//!    non-empty; otherwise the secondary's value fills the gap. `tagIds`
//!    are unioned (dedup, order-stable: primary tags first).
//! 3. **Re-point FKs** — `incoming_messages` and `outgoing_messages` rows
//!    whose `{ contactId: secondaryId, projectId }` are updated to point
//!    at the primary.
//! 4. **Drop stale conversation rows** — `conversations` carries a UNIQUE
//!    `{ projectId, contactId }` index, so we cannot simply re-point the
//!    secondary's conversation onto the primary (it would collide with the
//!    primary's own row). We delete the secondary's `conversations` rows;
//!    the materialised view is rebuilt by `wachat-webhook-conversations`
//!    on the next inbound/outbound message.
//! 5. **Delete the secondary** contact, then return the merged primary.
//!
//! Collections (`contacts`, `projects`, `incoming_messages`,
//! `outgoing_messages`, `conversations`) are the REAL ones used by the
//! existing wachat crates — see `wachat-contacts`, `wachat-chat-read`,
//! `wachat-chat-mark`, `wachat-webhook-conversations`.

use axum::{Json, extract::State};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{MergeBody, MergeResponse};
use crate::state::WachatContactMergeState;

/// Real collection names — confirmed against the sibling wachat crates.
const CONTACTS_COLL: &str = "contacts";
const PROJECTS_COLL: &str = "projects";
const INCOMING_MESSAGES_COLL: &str = "incoming_messages";
const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";
const CONVERSATIONS_COLL: &str = "conversations";

/// Fields we treat as scalar "winner-takes-non-null" during the merge.
const SCALAR_FIELDS: [&str; 3] = ["name", "waId", "phoneNumberId"];

// ===========================================================================
// Tenancy guard
// ===========================================================================

/// Load a project enforcing **owner-or-agent** access for the caller.
/// Returns `404` if no matching project exists (mirrors the
/// `wachat-contacts` guard, which collapses not-found and forbidden into
/// one message to avoid leaking project existence).
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

// ===========================================================================
// POST /v1/wachat/contact-merge
// ===========================================================================

/// `POST /v1/wachat/contact-merge` — merge `secondaryId` into `primaryId`.
///
/// Destructive: deletes the secondary contact and re-points its message
/// FKs. Guarded by owner-or-agent project membership and scoped to a
/// single project.
#[instrument(skip_all, fields(project_id = %body.project_id))]
pub async fn merge_contacts(
    user: AuthUser,
    State(state): State<WachatContactMergeState>,
    Json(body): Json<MergeBody>,
) -> Result<Json<MergeResponse>> {
    // ---- Validate ids ---------------------------------------------------
    if body.project_id.trim().is_empty()
        || body.primary_id.trim().is_empty()
        || body.secondary_id.trim().is_empty()
    {
        return Err(ApiError::Validation(
            "projectId, primaryId, and secondaryId are required.".to_owned(),
        ));
    }
    let primary_oid = oid_from_str(&body.primary_id)
        .map_err(|_| ApiError::BadRequest("Invalid primary contact id.".to_owned()))?;
    let secondary_oid = oid_from_str(&body.secondary_id)
        .map_err(|_| ApiError::BadRequest("Invalid secondary contact id.".to_owned()))?;
    if primary_oid == secondary_oid {
        return Err(ApiError::Validation(
            "primaryId and secondaryId must be different contacts.".to_owned(),
        ));
    }

    // ---- Tenancy guard --------------------------------------------------
    let project = load_project_with_membership(&user, &state.mongo, &body.project_id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    // ---- Load both contacts (scoped to the project) ---------------------
    let contacts = state.mongo.collection::<Document>(CONTACTS_COLL);

    let primary = contacts
        .find_one(doc! { "_id": primary_oid, "projectId": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(primary)")))?
        .ok_or_else(|| ApiError::NotFound("Primary contact not found.".to_owned()))?;

    let secondary = contacts
        .find_one(doc! { "_id": secondary_oid, "projectId": project_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(secondary)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Secondary contact not found.".to_owned()))?;

    // ---- Build the field-level union ------------------------------------
    let set_doc = build_merged_set(&primary, &secondary);

    // ---- Apply the merge to the primary ---------------------------------
    contacts
        .update_one(
            doc! { "_id": primary_oid, "projectId": project_oid },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one(primary)")))?;

    // ---- Re-point message FKs (scoped by project) -----------------------
    let incoming_repointed = repoint_fk(
        &state.mongo,
        INCOMING_MESSAGES_COLL,
        project_oid,
        secondary_oid,
        primary_oid,
    )
    .await?;
    let outgoing_repointed = repoint_fk(
        &state.mongo,
        OUTGOING_MESSAGES_COLL,
        project_oid,
        secondary_oid,
        primary_oid,
    )
    .await?;

    // ---- Drop the secondary's stale conversation rows -------------------
    // `conversations` has a UNIQUE { projectId, contactId } index, so we
    // can't re-point onto the primary without risking a duplicate-key
    // collision against the primary's own row. Delete the secondary's
    // rows; the materialised view is rebuilt by wachat-webhook-conversations.
    let conversations_removed = state
        .mongo
        .collection::<Document>(CONVERSATIONS_COLL)
        .delete_many(doc! { "projectId": project_oid, "contactId": secondary_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("conversations.delete_many")))?
        .deleted_count;

    // ---- Delete the secondary contact -----------------------------------
    contacts
        .delete_one(doc! { "_id": secondary_oid, "projectId": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.delete_one(secondary)")))?;

    // ---- Re-read the merged primary for the response --------------------
    let merged = contacts
        .find_one(doc! { "_id": primary_oid, "projectId": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one(merged)")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("merged primary contact vanished")))?;

    Ok(Json(MergeResponse {
        success: true,
        contact: document_to_clean_json(merged),
        incoming_repointed,
        outgoing_repointed,
        conversations_removed,
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Build the `$set` document for the merged primary: scalar fields keep
/// the primary's value unless it is missing/null/empty (then the
/// secondary's fills in); `variables` are shallow-merged (primary keys
/// win); `tagIds` are unioned (primary first, dedup). Always bumps
/// `updatedAt`.
fn build_merged_set(primary: &Document, secondary: &Document) -> Document {
    let mut set_doc = doc! {
        "updatedAt": bson::DateTime::from_chrono(Utc::now()),
    };

    // Scalar string fields: primary wins when present & non-empty.
    for field in SCALAR_FIELDS {
        if is_blank(primary.get(field)) {
            if let Some(v) = present(secondary.get(field)) {
                set_doc.insert(field, v.clone());
            }
        }
    }

    // variables: shallow object merge (primary keys win).
    let merged_vars = merge_variables(
        primary.get_document("variables").ok(),
        secondary.get_document("variables").ok(),
    );
    if let Some(vars) = merged_vars {
        set_doc.insert("variables", vars);
    }

    // tagIds: union, primary first, dedup (preserves any BSON type).
    let merged_tags = merge_tag_ids(
        primary.get_array("tagIds").ok(),
        secondary.get_array("tagIds").ok(),
    );
    if let Some(tags) = merged_tags {
        set_doc.insert("tagIds", Bson::Array(tags));
    }

    set_doc
}

/// `true` when a BSON value is absent, null, or an empty/whitespace string.
fn is_blank(v: Option<&Bson>) -> bool {
    match v {
        None | Some(Bson::Null) => true,
        Some(Bson::String(s)) => s.trim().is_empty(),
        Some(_) => false,
    }
}

/// Return the value only if it is present and non-blank (so we never copy
/// a null/empty secondary field over a missing primary one).
fn present(v: Option<&Bson>) -> Option<&Bson> {
    v.filter(|inner| !is_blank(Some(inner)))
}

/// Shallow-merge two optional `variables` sub-documents. Primary keys win.
/// Returns `None` when neither side has any variables (so we don't write
/// an empty object the legacy data wouldn't have had).
fn merge_variables(primary: Option<&Document>, secondary: Option<&Document>) -> Option<Document> {
    if primary.is_none() && secondary.is_none() {
        return None;
    }
    let mut out = Document::new();
    if let Some(sec) = secondary {
        for (k, v) in sec {
            out.insert(k.clone(), v.clone());
        }
    }
    if let Some(prim) = primary {
        for (k, v) in prim {
            out.insert(k.clone(), v.clone());
        }
    }
    Some(out)
}

/// Union two optional `tagIds` arrays, primary entries first, dropping
/// duplicates (by BSON equality, so ObjectId and string tag ids are both
/// handled). Returns `None` when both sides are empty/absent.
fn merge_tag_ids(primary: Option<&Vec<Bson>>, secondary: Option<&Vec<Bson>>) -> Option<Vec<Bson>> {
    let prim = primary.map(Vec::as_slice).unwrap_or(&[]);
    let sec = secondary.map(Vec::as_slice).unwrap_or(&[]);
    if prim.is_empty() && sec.is_empty() {
        return None;
    }
    let mut out: Vec<Bson> = Vec::with_capacity(prim.len() + sec.len());
    for tag in prim.iter().chain(sec.iter()) {
        if !out.contains(tag) {
            out.push(tag.clone());
        }
    }
    Some(out)
}

/// Re-point every `contactId == from` row (within `project_oid`) in
/// `coll` to `to`. Returns the number of rows updated.
async fn repoint_fk(
    mongo: &MongoHandle,
    coll: &str,
    project_oid: ObjectId,
    from: ObjectId,
    to: ObjectId,
) -> Result<u64> {
    let collection = mongo.collection::<Document>(coll);
    let res = collection
        .update_many(
            doc! { "projectId": project_oid, "contactId": from },
            doc! { "$set": { "contactId": to } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context(format!("{coll}.update_many(repoint)")))
        })?;
    Ok(res.modified_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scalar_winner_keeps_primary_when_present() {
        let primary = doc! { "name": "Alice", "waId": "" };
        let secondary = doc! { "name": "Bob", "waId": "919999", "phoneNumberId": "pn1" };
        let set = build_merged_set(&primary, &secondary);
        // Primary's non-empty name kept → not overwritten (so absent from $set).
        assert!(!set.contains_key("name"));
        // Primary's blank waId filled from secondary.
        assert_eq!(set.get_str("waId").unwrap(), "919999");
        // Primary missing phoneNumberId → filled from secondary.
        assert_eq!(set.get_str("phoneNumberId").unwrap(), "pn1");
        assert!(set.contains_key("updatedAt"));
    }

    #[test]
    fn tag_ids_union_dedups_primary_first() {
        let a = ObjectId::new();
        let b = ObjectId::new();
        let c = ObjectId::new();
        let primary = doc! { "tagIds": [a, b] };
        let secondary = doc! { "tagIds": [b, c] };
        let set = build_merged_set(&primary, &secondary);
        let tags = set.get_array("tagIds").unwrap();
        let oids: Vec<ObjectId> = tags
            .iter()
            .map(|t| t.as_object_id().unwrap())
            .collect();
        assert_eq!(oids, vec![a, b, c]);
    }

    #[test]
    fn variables_shallow_merge_primary_wins() {
        let primary = doc! { "variables": { "city": "NYC", "tier": "gold" } };
        let secondary = doc! { "variables": { "city": "LA", "lang": "en" } };
        let set = build_merged_set(&primary, &secondary);
        let vars = set.get_document("variables").unwrap();
        assert_eq!(vars.get_str("city").unwrap(), "NYC"); // primary wins
        assert_eq!(vars.get_str("tier").unwrap(), "gold");
        assert_eq!(vars.get_str("lang").unwrap(), "en"); // secondary fills gap
    }

    #[test]
    fn no_variables_or_tags_means_no_keys() {
        let primary = doc! { "name": "A" };
        let secondary = doc! { "name": "B" };
        let set = build_merged_set(&primary, &secondary);
        assert!(!set.contains_key("variables"));
        assert!(!set.contains_key("tagIds"));
    }
}
