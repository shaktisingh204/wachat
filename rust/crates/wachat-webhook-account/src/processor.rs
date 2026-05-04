//! Core account-webhook processor.
//!
//! All state is owned by [`AccountProcessor`], which holds a [`MongoHandle`]
//! and exposes a single async entry point: [`AccountProcessor::process`].
//!
//! ## Branching on `field`
//!
//! See the per-arm documentation in `process()` for the exact Mongo update
//! that each Meta field maps to. The Project field names used here mirror
//! the TS `projects` document schema (camelCase) plus a few new fields the
//! Rust port introduces:
//! - `accountAlerts: Array<{...alert, receivedAt}>` — appended (cap 100).
//! - `quality_history: Array<{phoneNumberId, qualityRating, receivedAt}>`
//!   — appended (cap 100).
//! - existing TS fields reused: `reviewStatus`, `banState`, `violationType`,
//!   `phoneNumbers.$.quality_rating`, `phoneNumbers.$.verified_name`,
//!   `phoneNumbers.$.name_status`, `capabilities.<cap>`.
//!
//! ## Audit log
//!
//! Every call appends one document to `account_events`:
//! `{ projectId, field, value, receivedAt }`. This is the only write that
//! uses `upsert: true` — the rest of the Project mutations all use
//! `update_one` with `upsert: false` per the slice contract.

use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_common::{ApiError, Result};
use sabnode_db::MongoHandle;
use serde_json::Value;
use tracing::{debug, warn};
use wachat_meta_dto::ChangeValue;
use wachat_types::Project;

use crate::error::mongo_err;

/// Mongo collection where every account event is appended. New collection
/// introduced by this crate; the TS doesn't write here yet.
const ACCOUNT_EVENTS_COLL: &str = "account_events";

/// Mongo collection where projects live (TS-shared).
const PROJECTS_COLL: &str = "projects";

/// Cap on `accountAlerts` and `quality_history` arrays. Slice contract
/// specifies last-100 retention via `$push: { $each, $slice: -100 }`.
const HISTORY_CAP: i32 = -100;

/// Outcome of one `process()` call. Useful for tests and for the parent
/// dispatcher to assert behaviour without re-querying Mongo.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct AccountOutcome {
    /// `true` when an entry was appended to `account_events`. We try to
    /// always write the audit row, even for unknown fields, so this is
    /// almost always `true` on success.
    pub recorded: bool,

    /// `true` when the `projects` document was modified. Some events (e.g.
    /// `security`, unknown fields) are audit-only.
    pub project_updated: bool,
}

/// Processor for account-level Meta webhook fields.
///
/// `Clone` so it can sit in Axum app state and be handed out per-request
/// without further wrapping (the inner `MongoHandle` is already cheap to
/// clone).
#[derive(Debug, Clone)]
pub struct AccountProcessor {
    mongo: MongoHandle,
}

impl AccountProcessor {
    /// Construct a processor bound to a Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Branch on `field` and apply the right Mongo update.
    ///
    /// Always writes an `account_events` audit row first (best-effort: a
    /// Mongo failure here aborts processing with `ApiError::Internal`).
    /// Then dispatches to the field-specific handler. Unknown fields are
    /// logged at `warn` and treated as audit-only — never errors.
    pub async fn process(
        &self,
        project: &Project,
        value: &ChangeValue,
        field: &str,
    ) -> Result<AccountOutcome> {
        // Re-serialize the typed `ChangeValue` to a JSON `Value` for
        // open-schema field access. `ChangeValue` only types the keys the
        // `messages` field uses; account fields carry their own keys
        // (`alert_type`, `phone_number_id`, `quality_rating`, etc.) that
        // surface only via raw JSON. Round-trip is cheap and safe — the
        // struct is `serde(default)` so missing fields stay as `null`.
        let raw = serde_json::to_value(value).map_err(|e| {
            ApiError::Internal(anyhow::anyhow!(
                "failed to re-serialize ChangeValue for account field `{}`: {}",
                field,
                e
            ))
        })?;

        // 1. Always record the audit row first.
        self.record_event(project.id, field, &raw).await?;

        // 2. Branch on the field name. `project_updated` is `true` only when
        // the field-specific handler mutated the `projects` document.
        let project_updated = match field {
            "account_alerts" => self.handle_account_alerts(project, &raw).await?,
            "account_update" | "account_review_update" => {
                self.handle_account_update(project, &raw).await?
            }
            "business_capability_update" => {
                self.handle_business_capability_update(project, &raw).await?
            }
            "phone_number_quality_update" => {
                self.handle_phone_number_quality_update(project, &raw).await?
            }
            "phone_number_name_update" => {
                self.handle_phone_number_name_update(project, &raw).await?
            }
            "security" => {
                // Audit-only by spec: admin must investigate. No project
                // mutation — just the trace log so ops can see it landed.
                debug!(
                    project_id = %project.id,
                    "security webhook recorded; admin must investigate"
                );
                false
            }
            other => {
                // Unknown account-bucket field. Slice contract: log at warn,
                // still record (already done above), never error.
                warn!(
                    project_id = %project.id,
                    field = other,
                    "unknown account-webhook field; recorded to account_events but no project update applied"
                );
                false
            }
        };

        Ok(AccountOutcome {
            recorded: true,
            project_updated,
        })
    }

    // ── Audit log ────────────────────────────────────────────────────────

    /// Append `{ projectId, field, value, receivedAt }` to `account_events`.
    /// This is the only write in this crate that uses `upsert: true` — every
    /// other update is `upsert: false` per the slice contract. We use
    /// `update_one` with an empty filter that can never match so the upsert
    /// always inserts a new document (equivalent to `insert_one` but matches
    /// the slice's "all writes go through update_one" framing).
    async fn record_event(
        &self,
        project_id: ObjectId,
        field: &str,
        value: &Value,
    ) -> Result<()> {
        let value_bson = bson::to_bson(value).map_err(mongo_err)?;
        let now = bson::DateTime::from_chrono(Utc::now());

        let coll = self
            .mongo
            .collection::<Document>(ACCOUNT_EVENTS_COLL);

        // Filter targets a never-existing sentinel id so the upsert always
        // inserts a new audit row. Equivalent to insert_one but expressed as
        // an upsert per the slice contract.
        let filter = doc! { "_id": ObjectId::new() };
        let update = doc! {
            "$setOnInsert": {
                "projectId": project_id,
                "field": field,
                "value": value_bson,
                "receivedAt": now,
            }
        };
        let opts = UpdateOptions::builder().upsert(true).build();

        coll.update_one(filter, update)
            .with_options(opts)
            .await
            .map_err(mongo_err)?;

        Ok(())
    }

    // ── Field handlers ───────────────────────────────────────────────────

    /// `account_alerts` — append the alert payload onto `Project.accountAlerts`,
    /// capped to the last `HISTORY_CAP` entries.
    async fn handle_account_alerts(&self, project: &Project, raw: &Value) -> Result<bool> {
        let alert = build_alert_doc(raw);

        let update = doc! {
            "$push": {
                "accountAlerts": {
                    "$each": [alert],
                    "$slice": HISTORY_CAP,
                }
            }
        };

        self.update_project(project.id, update).await
    }

    /// `account_update` / `account_review_update` — flat `accountStatus` +
    /// `reviewStatus` fields, plus a row appended to `quality_history` so we
    /// preserve the change reasoning. Mirrors the existing TS shape (`banState`,
    /// `violationType`, `restrictionType`, `reviewStatus`) *and* introduces the
    /// `accountStatus` / `reviewStatus` pair the slice spec calls for.
    async fn handle_account_update(&self, project: &Project, raw: &Value) -> Result<bool> {
        let now = bson::DateTime::from_chrono(Utc::now());

        // Build the `$set` doc dynamically — we only set keys the payload
        // actually carries, so we don't clobber unrelated project fields.
        let mut set_doc = Document::new();

        if let Some(s) = raw.get("event").and_then(Value::as_str) {
            set_doc.insert("accountStatus", s);
        }
        if let Some(s) = raw.get("review_status").and_then(Value::as_str) {
            set_doc.insert("reviewStatus", s);
        }
        if let Some(s) = raw
            .get("ban_info")
            .and_then(|b| b.get("waba_ban_state"))
            .and_then(Value::as_str)
        {
            set_doc.insert("banState", s);
        }
        if let Some(s) = raw
            .get("violation_info")
            .and_then(|b| b.get("violation_type"))
            .and_then(Value::as_str)
        {
            set_doc.insert("violationType", s);
            set_doc.insert("violationTimestamp", now);
        }
        if let Some(s) = raw
            .get("restriction_info")
            .and_then(|b| b.get("restriction_type"))
            .and_then(Value::as_str)
        {
            set_doc.insert("restrictionType", s);
            set_doc.insert("restrictionTimestamp", now);
        }

        set_doc.insert("accountStatusUpdatedAt", now);

        // History row capturing the reason for this change. Capped to last
        // 100 entries via `$push: { $each, $slice: -100 }` per slice contract.
        let history_entry = doc! {
            "field": raw.get("event").and_then(Value::as_str).unwrap_or(""),
            "reviewStatus": raw.get("review_status").and_then(Value::as_str).unwrap_or(""),
            "raw": bson::to_bson(raw).map_err(mongo_err)?,
            "receivedAt": now,
        };

        let update = doc! {
            "$set": set_doc,
            "$push": {
                "quality_history": {
                    "$each": [history_entry],
                    "$slice": HISTORY_CAP,
                }
            }
        };

        self.update_project(project.id, update).await
    }

    /// `business_capability_update` — replace the `businessCapabilities`
    /// field with the new value (Meta sends the full effective set).
    async fn handle_business_capability_update(
        &self,
        project: &Project,
        raw: &Value,
    ) -> Result<bool> {
        // Meta's payload nests the new capability set under `business_capabilities`
        // (per Cloud API docs); fall back to the whole `value` so we don't drop
        // the data on schema drift.
        let caps = raw
            .get("business_capabilities")
            .or_else(|| raw.get("capabilities"))
            .cloned()
            .unwrap_or_else(|| raw.clone());

        let caps_bson = bson::to_bson(&caps).map_err(mongo_err)?;
        let now = bson::DateTime::from_chrono(Utc::now());

        let update = doc! {
            "$set": {
                "businessCapabilities": caps_bson,
                "businessCapabilitiesUpdatedAt": now,
            }
        };

        self.update_project(project.id, update).await
    }

    /// `phone_number_quality_update` — set the `qualityRating` on the matching
    /// entry inside `Project.phoneNumbers[]` using a positional array filter.
    async fn handle_phone_number_quality_update(
        &self,
        project: &Project,
        raw: &Value,
    ) -> Result<bool> {
        let Some(phone_id) = raw.get("phone_number_id").and_then(Value::as_str) else {
            warn!(
                project_id = %project.id,
                "phone_number_quality_update missing phone_number_id; skipping project mutation"
            );
            return Ok(false);
        };

        // Quality ratings can come in as `quality_rating` (Cloud API) or
        // `event` (legacy webhook). Accept either; bail without mutation if
        // neither key is present.
        let Some(quality) = raw
            .get("quality_rating")
            .and_then(Value::as_str)
            .or_else(|| raw.get("event").and_then(Value::as_str))
        else {
            warn!(
                project_id = %project.id,
                phone_id = phone_id,
                "phone_number_quality_update missing quality_rating; skipping"
            );
            return Ok(false);
        };

        let filter = doc! { "_id": project.id };
        let update = doc! {
            "$set": {
                "phoneNumbers.$[pn].qualityRating": quality,
            }
        };
        let array_filters = vec![doc! { "pn.id": phone_id }];

        self.update_project_with_array_filters(filter, update, array_filters)
            .await
    }

    /// `phone_number_name_update` — update the `verifiedName` and `nameStatus`
    /// on the matching `Project.phoneNumbers[]` entry.
    async fn handle_phone_number_name_update(
        &self,
        project: &Project,
        raw: &Value,
    ) -> Result<bool> {
        let Some(phone_id) = raw.get("phone_number_id").and_then(Value::as_str) else {
            warn!(
                project_id = %project.id,
                "phone_number_name_update missing phone_number_id; skipping project mutation"
            );
            return Ok(false);
        };

        let mut set_doc = Document::new();
        if let Some(s) = raw.get("verified_name").and_then(Value::as_str) {
            set_doc.insert("phoneNumbers.$[pn].verifiedName", s);
        }
        if let Some(s) = raw.get("decision").and_then(Value::as_str) {
            set_doc.insert("phoneNumbers.$[pn].nameStatus", s);
        } else if let Some(s) = raw.get("name_status").and_then(Value::as_str) {
            set_doc.insert("phoneNumbers.$[pn].nameStatus", s);
        }

        if set_doc.is_empty() {
            warn!(
                project_id = %project.id,
                phone_id = phone_id,
                "phone_number_name_update carried no verified_name/decision; skipping"
            );
            return Ok(false);
        }

        let filter = doc! { "_id": project.id };
        let update = doc! { "$set": set_doc };
        let array_filters = vec![doc! { "pn.id": phone_id }];

        self.update_project_with_array_filters(filter, update, array_filters)
            .await
    }

    // ── Mongo helpers ────────────────────────────────────────────────────

    /// Issue an `update_one` against `projects` keyed by `_id`. Always
    /// `upsert: false` per the slice contract — we never create projects
    /// from a webhook.
    async fn update_project(&self, project_id: ObjectId, update: Document) -> Result<bool> {
        let coll = self.mongo.collection::<Document>(PROJECTS_COLL);
        let filter = doc! { "_id": project_id };

        let opts = UpdateOptions::builder().upsert(false).build();
        let res = coll
            .update_one(filter, update)
            .with_options(opts)
            .await
            .map_err(mongo_err)?;

        Ok(res.modified_count > 0 || res.matched_count > 0)
    }

    /// Same as `update_project` but threads `array_filters` through for the
    /// `phoneNumbers.$[pn].…` positional updates. Still `upsert: false`.
    async fn update_project_with_array_filters(
        &self,
        filter: Document,
        update: Document,
        array_filters: Vec<Document>,
    ) -> Result<bool> {
        let coll = self.mongo.collection::<Document>(PROJECTS_COLL);

        let opts = UpdateOptions::builder()
            .upsert(false)
            .array_filters(array_filters)
            .build();

        let res = coll
            .update_one(filter, update)
            .with_options(opts)
            .await
            .map_err(mongo_err)?;

        Ok(res.modified_count > 0 || res.matched_count > 0)
    }
}

/// Build the `(filter, update, array_filters?)` triple this crate would
/// hand to Mongo for a given account-webhook field, without actually
/// hitting Mongo. Used by the integration tests in `tests/processor.rs`
/// to assert the exact wire shape of every update.
///
/// Returns `None` for fields that are audit-only (no project mutation) —
/// `security` and unknown fields. Also returns `None` when the payload is
/// missing the keys we'd need to safely build the update (mirrors the
/// runtime `warn` + skip behaviour).
pub fn build_project_update(
    project_id: ObjectId,
    field: &str,
    value: &Value,
) -> Option<(Document, Document, Option<Vec<Document>>)> {
    match field {
        "account_alerts" => {
            let alert = build_alert_doc(value);
            let update = doc! {
                "$push": {
                    "accountAlerts": {
                        "$each": [alert],
                        "$slice": HISTORY_CAP,
                    }
                }
            };
            Some((doc! { "_id": project_id }, update, None))
        }
        "account_update" | "account_review_update" => {
            let now = bson::DateTime::from_chrono(Utc::now());
            let mut set_doc = Document::new();

            if let Some(s) = value.get("event").and_then(Value::as_str) {
                set_doc.insert("accountStatus", s);
            }
            if let Some(s) = value.get("review_status").and_then(Value::as_str) {
                set_doc.insert("reviewStatus", s);
            }
            if let Some(s) = value
                .get("ban_info")
                .and_then(|b| b.get("waba_ban_state"))
                .and_then(Value::as_str)
            {
                set_doc.insert("banState", s);
            }
            if let Some(s) = value
                .get("violation_info")
                .and_then(|b| b.get("violation_type"))
                .and_then(Value::as_str)
            {
                set_doc.insert("violationType", s);
                set_doc.insert("violationTimestamp", now);
            }
            if let Some(s) = value
                .get("restriction_info")
                .and_then(|b| b.get("restriction_type"))
                .and_then(Value::as_str)
            {
                set_doc.insert("restrictionType", s);
                set_doc.insert("restrictionTimestamp", now);
            }
            set_doc.insert("accountStatusUpdatedAt", now);

            let history_entry = doc! {
                "field": value.get("event").and_then(Value::as_str).unwrap_or(""),
                "reviewStatus": value.get("review_status").and_then(Value::as_str).unwrap_or(""),
                "raw": bson::to_bson(value).ok().unwrap_or(Bson::Null),
                "receivedAt": now,
            };

            let update = doc! {
                "$set": set_doc,
                "$push": {
                    "quality_history": {
                        "$each": [history_entry],
                        "$slice": HISTORY_CAP,
                    }
                }
            };
            Some((doc! { "_id": project_id }, update, None))
        }
        "business_capability_update" => {
            let caps = value
                .get("business_capabilities")
                .or_else(|| value.get("capabilities"))
                .cloned()
                .unwrap_or_else(|| value.clone());

            let caps_bson = bson::to_bson(&caps).ok()?;
            let now = bson::DateTime::from_chrono(Utc::now());

            let update = doc! {
                "$set": {
                    "businessCapabilities": caps_bson,
                    "businessCapabilitiesUpdatedAt": now,
                }
            };
            Some((doc! { "_id": project_id }, update, None))
        }
        "phone_number_quality_update" => {
            let phone_id = value.get("phone_number_id").and_then(Value::as_str)?;
            let quality = value
                .get("quality_rating")
                .and_then(Value::as_str)
                .or_else(|| value.get("event").and_then(Value::as_str))?;

            let update = doc! {
                "$set": {
                    "phoneNumbers.$[pn].qualityRating": quality,
                }
            };
            let array_filters = vec![doc! { "pn.id": phone_id }];

            Some((doc! { "_id": project_id }, update, Some(array_filters)))
        }
        "phone_number_name_update" => {
            let phone_id = value.get("phone_number_id").and_then(Value::as_str)?;

            let mut set_doc = Document::new();
            if let Some(s) = value.get("verified_name").and_then(Value::as_str) {
                set_doc.insert("phoneNumbers.$[pn].verifiedName", s);
            }
            if let Some(s) = value.get("decision").and_then(Value::as_str) {
                set_doc.insert("phoneNumbers.$[pn].nameStatus", s);
            } else if let Some(s) = value.get("name_status").and_then(Value::as_str) {
                set_doc.insert("phoneNumbers.$[pn].nameStatus", s);
            }
            if set_doc.is_empty() {
                return None;
            }

            let update = doc! { "$set": set_doc };
            let array_filters = vec![doc! { "pn.id": phone_id }];

            Some((doc! { "_id": project_id }, update, Some(array_filters)))
        }
        // Audit-only fields and unknown fields produce no project update.
        _ => None,
    }
}

/// Build the document we push onto `accountAlerts`. Stamps `receivedAt` so
/// the entry is self-describing; copies the raw payload verbatim so we
/// don't drop fields when Meta's schema drifts.
fn build_alert_doc(raw: &Value) -> Bson {
    let now = bson::DateTime::from_chrono(Utc::now());
    let raw_bson = bson::to_bson(raw).unwrap_or(Bson::Null);

    Bson::Document(doc! {
        "alertType": raw.get("alert_type").and_then(Value::as_str).unwrap_or(""),
        "event": raw.get("event").and_then(Value::as_str).unwrap_or(""),
        "raw": raw_bson,
        "receivedAt": now,
    })
}

#[cfg(test)]
mod unit {
    use super::*;
    use serde_json::json;

    #[test]
    fn build_alert_doc_carries_alert_type_and_event() {
        let raw = json!({"alert_type": "QUALITY_DROP", "event": "WARN"});
        let alert = build_alert_doc(&raw);
        let Bson::Document(d) = alert else {
            panic!("expected document");
        };
        assert_eq!(d.get_str("alertType").unwrap(), "QUALITY_DROP");
        assert_eq!(d.get_str("event").unwrap(), "WARN");
        assert!(d.get("receivedAt").is_some());
        assert!(d.get("raw").is_some());
    }

    #[test]
    fn build_alert_doc_handles_missing_keys() {
        let raw = json!({});
        let Bson::Document(d) = build_alert_doc(&raw) else {
            panic!("expected document");
        };
        // Empty strings, not panics.
        assert_eq!(d.get_str("alertType").unwrap(), "");
        assert_eq!(d.get_str("event").unwrap(), "");
    }
}
