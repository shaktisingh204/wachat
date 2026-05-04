//! `ContactsUpserter` — turns a parsed `change.value` into one Mongo upsert
//! per inbound message sender.
//!
//! ## Mongo collection
//! `contacts` — same name the TS uses (`db.collection<Contact>('contacts')`,
//! `webhook-processor.ts` ~line 1475 and every other handler in
//! `contact.actions.ts`).
//!
//! ## Filter shape
//! `{ projectId: <ObjectId>, waId: <String> }` — the natural identity key
//! for a wachat contact. The TS includes `phoneNumberId` too because the
//! conversation view is per-(project, phoneNumberId, waId), but for contact
//! identity refresh we deliberately drop it (see lib.rs note).
//!
//! ## Update doc layout
//! ```text
//! $set         { name?, lastMessageTimestamp, updatedAt }
//! $setOnInsert { _id, projectId, waId, phone, createdAt }
//! ```
//!
//! ### Why split `name` between branches?
//! MongoDB rejects an update where the same field appears in both `$set`
//! and `$setOnInsert`. We only want to overwrite `name` when the webhook
//! actually carries a non-empty profile name (otherwise we'd clobber a good
//! name with the empty string Meta sometimes sends). So:
//! - profile.name present + non-empty → `$set { name }`
//! - profile.name absent / empty      → no `name` key at all (existing
//!                                       contact's name is preserved; new
//!                                       contact gets `null` by default)

use std::collections::HashMap;

use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_common::ApiError;
use wachat_meta_dto::webhook::ChangeValue;
use wachat_phone::normalize_e164;
use wachat_types::project::Project;

use sabnode_db::mongo::MongoHandle;

/// Mongo collection name. Matches the TS `'contacts'` collection used in
/// both `webhook-processor.ts` and `contact.actions.ts`.
const CONTACTS_COLLECTION: &str = "contacts";

/// Result of a batch upsert pass.
///
/// `upserted + matched` equals the number of inbound messages we attempted
/// to upsert a contact for (after de-duplication of repeated `from` values
/// in the same batch is **not** done here — each message produces one
/// `update_one` call, and Mongo's upsert idempotency handles the
/// repetition).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct UpsertOutcome {
    /// Number of brand-new contact documents created during this batch.
    pub upserted: usize,
    /// Number of existing contact documents matched (and possibly updated).
    pub matched: usize,
}

/// Stateless upserter. Holds only a cheap, cloneable Mongo handle.
#[derive(Debug, Clone)]
pub struct ContactsUpserter {
    mongo: MongoHandle,
}

impl ContactsUpserter {
    /// Construct a new upserter wrapping the given Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Upsert a `WaContact` for every inbound message in `value.messages`.
    ///
    /// Joins each message's `from` with `value.contacts[]` (the sender
    /// profile array) by `wa_id` to recover the display name. If a profile
    /// is missing or has an empty name, the existing contact's name is
    /// preserved.
    ///
    /// Returns counts so the caller can emit metrics; never errors on a
    /// per-row failure (driver errors propagate as `ApiError::Internal`).
    pub async fn upsert_from_inbound(
        &self,
        project: &Project,
        value: &ChangeValue,
    ) -> Result<UpsertOutcome, ApiError> {
        // Build a lookup table from the optional sender-profile array.
        // The TS reads `contactProfile?.profile?.name` per message; we
        // pre-index for O(1) lookups in the message loop.
        let wa_id_to_name: HashMap<String, Option<String>> = value
            .contacts
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .map(|c| (c.wa_id.clone(), c.profile.name.clone()))
            .collect();

        let messages = value.messages.as_deref().unwrap_or(&[]);
        if messages.is_empty() {
            // Fast path — webhooks for status-only batches will hit this
            // every time.
            return Ok(UpsertOutcome::default());
        }

        let coll = self
            .mongo
            .collection::<Document>(CONTACTS_COLLECTION);

        let mut outcome = UpsertOutcome::default();

        for msg in messages {
            let wa_id = &msg.from;

            // Lookup profile name. Only treat it as a "real" name if the
            // string is present AND non-empty after trim — the TS guard
            // is `senderName && senderName !== 'Unknown User'`; ours is
            // stricter (no fake placeholder substitution) but the intent
            // is the same: don't write garbage to the `name` field.
            let profile_name: Option<String> = wa_id_to_name
                .get(wa_id)
                .and_then(|n| n.as_ref())
                .map(|s| s.trim().to_owned())
                .filter(|s| !s.is_empty());

            // Best-effort phone normalization. WhatsApp's `wa_id` is
            // *always* digits-only E.164 (e.g. "919876543210"), so adding
            // a `+` and validating with our normalizer is essentially
            // a sanity-check — but we still fall back to the raw `wa_id`
            // on any error so a libphonenumber rejection never breaks the
            // webhook pipeline. (Spec: "store the raw wa_id in the phone
            // field — never error".)
            let phone = match normalize_e164(wa_id, None) {
                Ok(canonical) => canonical,
                Err(e) => {
                    tracing::debug!(
                        wa_id = %wa_id,
                        error = %e,
                        "phone normalization failed for inbound wa_id; storing raw value",
                    );
                    wa_id.clone()
                }
            };

            let now = Utc::now();

            // $set goes here. `name` is conditionally added so we never
            // clobber an existing good name with an empty string and never
            // collide with `$setOnInsert.name` (Mongo rejects same-field
            // in both).
            let mut set_doc = doc! {
                "lastMessageTimestamp": now,
                "updatedAt": now,
            };
            if let Some(ref n) = profile_name {
                set_doc.insert("name", n.clone());
            }

            // $setOnInsert — fields that should only be written on initial
            // insert. We mint a fresh `_id` here (matches Mongo's default
            // behaviour but lets us return it deterministically if a
            // future caller wants it).
            let set_on_insert = doc! {
                "_id": ObjectId::new(),
                "projectId": project.id,
                "waId": wa_id,
                "phone": &phone,
                "createdAt": now,
            };

            let update = doc! {
                "$set": set_doc,
                "$setOnInsert": set_on_insert,
            };

            let filter = doc! {
                "projectId": project.id,
                "waId": wa_id,
            };

            // `update_one` with `upsert: true` — same primitive the TS uses
            // for the bulk-import path in `contact.actions.ts:131`.
            let result = coll
                .update_one(filter, update)
                .with_options(UpdateOptions::builder().upsert(true).build())
                .await
                .map_err(|e| {
                    ApiError::Internal(anyhow::anyhow!(
                        "contacts upsert failed for wa_id {wa_id}: {e}"
                    ))
                })?;

            if result.upserted_id.is_some() {
                outcome.upserted += 1;
            } else {
                // Matched — count whether the document changed or not.
                // `matched_count` is u64 in the driver; cast is safe for
                // any realistic batch size (<< 2^32).
                outcome.matched += result.matched_count as usize;
            }
        }

        Ok(outcome)
    }
}
