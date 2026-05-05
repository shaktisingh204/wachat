//! [`ContactResolver`] — the slice's public actor.
//!
//! Issues an idempotent `update_one` upsert against the `contacts`
//! collection. Concurrent callers (two simultaneous webhook deliveries for
//! the same `wa_id`, two broadcast workers picking up adjacent rows for
//! the same recipient) all converge on a single document because Mongo
//! serializes upserts under the unique-on-filter contract.
//!
//! The TS uses `findOneAndUpdate({ returnDocument: 'after' })` so it can
//! return the full `Contact`. Send paths only ever consume `_id`, so we
//! split into `update_one` (the write) plus a follow-up `find_one`
//! (read-back). The follow-up read happens on the same primary because
//! the upsert just wrote there.

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_common::error::ApiError;
use sabnode_db::mongo::MongoHandle;
use serde::{Deserialize, Serialize};
use tracing::instrument;

use wachat_types::project::Project;

use crate::CONTACTS_COLL;

/// Resolved contact handle returned to callers.
///
/// The `created` flag mirrors the driver's `upserted_id` — `true` when this
/// call inserted a new document, `false` when it matched an existing one.
/// Useful for telemetry (`first_seen` events) without needing a second
/// query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedContact {
    pub id: ObjectId,
    pub project_id: ObjectId,
    pub phone_number_id: String,
    pub wa_id: String,
    pub created: bool,
}

/// The wachat find-or-create contact resolver.
///
/// Cheap to clone — the underlying `MongoHandle` is `Arc`-backed.
#[derive(Debug, Clone)]
pub struct ContactResolver {
    mongo: MongoHandle,
}

impl ContactResolver {
    /// Construct a resolver bound to the given Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Find or create the contact identified by
    /// `(project, phone_number_id, wa_id)`.
    ///
    /// Returns a [`ResolvedContact`] containing the document `_id` and a
    /// `created` flag. Idempotent under concurrent calls — see the module
    /// docs for the upsert filter / `$setOnInsert` shape.
    #[instrument(
        skip(self, project),
        fields(
            project_id = %project.id,
            phone_number_id = %phone_number_id,
            wa_id = %wa_id,
        )
    )]
    pub async fn find_or_create(
        &self,
        project: &Project,
        phone_number_id: &str,
        wa_id: &str,
    ) -> Result<ResolvedContact, ApiError> {
        // Match the TS guard at lines 511-513: "Missing required information."
        if phone_number_id.is_empty() || wa_id.is_empty() {
            return Err(ApiError::BadRequest(
                "Missing required information.".to_owned(),
            ));
        }

        let coll = self.mongo.collection::<Document>(CONTACTS_COLL);

        let filter = build_filter(project.id, phone_number_id, wa_id);
        let update = build_update(project, phone_number_id, wa_id);
        let opts = UpdateOptions::builder().upsert(true).build();

        let result = coll
            .update_one(filter.clone(), update)
            .with_options(opts)
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("contacts.update_one"))
            })?;

        // The driver returns `upserted_id` only when this call created a
        // document. Use it directly when present; otherwise re-read by the
        // composite key to learn the existing `_id`.
        let (id, created) = if let Some(bson_id) = result.upserted_id {
            let oid = bson_id.as_object_id().ok_or_else(|| {
                ApiError::Internal(anyhow::anyhow!(
                    "contacts.upserted_id was not an ObjectId; got {bson_id:?}"
                ))
            })?;
            (oid, true)
        } else {
            let existing = coll
                .find_one(filter)
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::Error::new(e).context("contacts.find_one"))
                })?
                .ok_or_else(|| {
                    // Should never happen: we just upserted under this
                    // filter. If we get here something raced or the write
                    // concern silently dropped the upsert.
                    ApiError::Internal(anyhow::anyhow!(
                        "contacts upsert reported match but no document found"
                    ))
                })?;
            let oid = existing.get_object_id("_id").map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("contacts._id missing"))
            })?;
            (oid, false)
        };

        Ok(ResolvedContact {
            id,
            project_id: project.id,
            phone_number_id: phone_number_id.to_owned(),
            wa_id: wa_id.to_owned(),
            created,
        })
    }
}

/// Build the upsert filter. Matches the TS exactly (line 521):
/// `{ waId, projectId: new ObjectId(projectId), phoneNumberId }`.
fn build_filter(project_id: ObjectId, phone_number_id: &str, wa_id: &str) -> Document {
    doc! {
        "waId": wa_id,
        "projectId": project_id,
        "phoneNumberId": phone_number_id,
    }
}

/// Build the upsert update document. Matches the TS exactly
/// (lines 522-533):
///
/// ```text
/// {
///   $set: { phoneNumberId },
///   $setOnInsert: {
///     waId,
///     projectId: new ObjectId(projectId),
///     userId: project.userId,
///     name: `User (${waId.slice(-4)})`,
///     createdAt: new Date(),
///     status: 'new',
///     tagIds: [],
///   }
/// }
/// ```
fn build_update(project: &Project, phone_number_id: &str, wa_id: &str) -> Document {
    let now = bson::DateTime::from_chrono(Utc::now());
    let default_name = format!("User ({})", wa_id_suffix(wa_id));

    doc! {
        "$set": { "phoneNumberId": phone_number_id },
        "$setOnInsert": {
            "waId": wa_id,
            "projectId": project.id,
            "userId": project.user_id,
            "name": default_name,
            "createdAt": now,
            "status": "new",
            "tagIds": [],
        },
    }
}

/// JS `waId.slice(-4)` semantics — last four **chars** of the string,
/// or the whole string if it's shorter than four chars. We treat ASCII
/// digit phone numbers byte-by-byte; non-ASCII would still slice on a
/// char boundary thanks to `chars().rev().take(4)`.
fn wa_id_suffix(wa_id: &str) -> String {
    let mut tail: Vec<char> = wa_id.chars().rev().take(4).collect();
    tail.reverse();
    tail.into_iter().collect()
}

// -------------------------------------------------------------------------
// Unit tests — assert the filter + setOnInsert doc shape matches the TS
// without needing a live Mongo. Round-trip coverage with a real DB lives
// in the orchestrator's integration tests.
// -------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use wachat_types::waba::PhoneNumberSummary;

    fn make_project() -> Project {
        Project {
            id: ObjectId::new(),
            user_id: ObjectId::new(),
            name: "test".to_owned(),
            waba_id: None,
            business_id: None,
            app_id: None,
            access_token: None,
            phone_numbers: Vec::<PhoneNumberSummary>::new(),
            messages_per_second: None,
            credits: None,
            plan_id: None,
            review_status: None,
            ban_state: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn filter_uses_three_field_composite_key() {
        let pid = ObjectId::new();
        let f = build_filter(pid, "PHONE_42", "919876543210");
        assert_eq!(f.get_str("waId").unwrap(), "919876543210");
        assert_eq!(f.get_str("phoneNumberId").unwrap(), "PHONE_42");
        assert_eq!(f.get_object_id("projectId").unwrap(), pid);
        // No other keys — the TS filter has exactly these three.
        assert_eq!(f.len(), 3);
    }

    #[test]
    fn update_sets_phone_number_id_outside_set_on_insert() {
        let project = make_project();
        let u = build_update(&project, "PHONE_42", "919876543210");

        // $set keeps phoneNumberId current on every call (TS line 523).
        let set = u.get_document("$set").unwrap();
        assert_eq!(set.get_str("phoneNumberId").unwrap(), "PHONE_42");
        assert_eq!(set.len(), 1);
    }

    #[test]
    fn set_on_insert_matches_ts_field_set() {
        let project = make_project();
        let u = build_update(&project, "PHONE_42", "919876543210");

        let soi = u.get_document("$setOnInsert").unwrap();
        // TS lines 524-532: waId, projectId, userId, name, createdAt,
        // status, tagIds — exactly seven fields.
        assert_eq!(soi.get_str("waId").unwrap(), "919876543210");
        assert_eq!(soi.get_object_id("projectId").unwrap(), project.id);
        assert_eq!(soi.get_object_id("userId").unwrap(), project.user_id);
        assert_eq!(soi.get_str("name").unwrap(), "User (3210)");
        assert!(soi.get_datetime("createdAt").is_ok());
        assert_eq!(soi.get_str("status").unwrap(), "new");
        let tag_ids = soi.get_array("tagIds").unwrap();
        assert!(tag_ids.is_empty());
        assert_eq!(soi.len(), 7);
    }

    #[test]
    fn update_has_only_set_and_set_on_insert() {
        let project = make_project();
        let u = build_update(&project, "PHONE_42", "919876543210");
        // The TS update has exactly these two operators.
        assert!(u.contains_key("$set"));
        assert!(u.contains_key("$setOnInsert"));
        assert_eq!(u.len(), 2);
    }

    #[test]
    fn wa_id_suffix_takes_last_four_chars() {
        assert_eq!(wa_id_suffix("919876543210"), "3210");
        assert_eq!(wa_id_suffix("1234"), "1234");
        assert_eq!(wa_id_suffix("12"), "12");
        assert_eq!(wa_id_suffix(""), "");
    }

    #[test]
    fn collection_name_matches_ts() {
        // Source of truth: whatsapp.actions.ts line 520.
        assert_eq!(crate::CONTACTS_COLL, "contacts");
    }
}
