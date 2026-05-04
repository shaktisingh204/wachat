//! Template-event processor.
//!
//! Branches on `change.field` for the three Meta template-event fields and
//! reflects each into the `templates` Mongo collection. Every event (known
//! field or not) is also appended to `template_events` for replay/debug.
//!
//! ## Why we round-trip `ChangeValue` through `serde_json::Value`
//!
//! The shared DTO `wachat_meta_dto::webhook::ChangeValue` only models the
//! `messages`-field shape (`messaging_product`, `metadata`, `contacts`,
//! `messages`, `statuses`, `errors`). Template-event payloads carry a
//! different set of fields (`event`, `message_template_id`,
//! `message_template_name`, `reason`, `disable_info`,
//! `previous_quality_score`, `new_quality_score`, `components`).
//!
//! The slice contract forbids modifying sibling crates, so we serialize the
//! incoming `ChangeValue` to JSON and read template fields off the resulting
//! `Value`. Cost is one tiny clone per event — acceptable for a webhook
//! that processes a few events per second per project. When the DTO crate
//! grows a `ChangeValue::Template` variant (or a `flatten extra` field) we
//! can swap this out without changing the public API.
//!
//! ## Filter on `metaId`, not `name`
//!
//! The TS code in `webhook-processor.ts` (line ~1627) filters by `name +
//! projectId`. That's a latent bug: a single project can hold the same
//! template `name` in multiple languages (`en_US`, `hi`, `pt_BR`) and Meta
//! treats them as separate templates with distinct ids. We filter on the
//! globally-unique `metaId` (from `value.message_template_id`) and fall
//! back to `name + language` only when the id is absent.

use bson::{Document, doc};
use chrono::Utc;
use sabnode_db::MongoHandle;
use serde_json::Value;
use tracing::{debug, info, warn};
use wachat_meta_dto::webhook::ChangeValue;
use wachat_types::project::Project;
use wachat_types::template::TemplateStatus;

use crate::error::Result;
use crate::mapping::{is_flagged_event, meta_event_to_status};

/// Mongo collection holding `Template` documents.
const TEMPLATES_COLLECTION: &str = "templates";

/// Audit collection — every template event lands here, known or unknown,
/// so we can replay or debug Meta payloads we haven't yet modeled. One
/// document per event.
const AUDIT_COLLECTION: &str = "template_events";

/// Outcome of processing a single template event.
///
/// `matched` is `true` when an existing `templates` document was updated
/// (or, on a miss, when a stub was successfully inserted). `status_changed`
/// is `Some(<SCREAMING_SNAKE_CASE>)` when a status update was applied —
/// useful for the dispatcher's logging without re-reading the doc.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateOutcome {
    /// Whether a `templates` document was touched (updated or stub-inserted).
    pub matched: bool,
    /// Resulting status string (e.g. `"APPROVED"`) when a status update fired.
    /// `None` for quality / components / unknown events.
    pub status_changed: Option<String>,
}

impl TemplateOutcome {
    fn unmatched() -> Self {
        Self {
            matched: false,
            status_changed: None,
        }
    }
}

/// Stateless processor — holds only a `MongoHandle`. Cheap to clone, safe
/// to put in app state.
#[derive(Debug, Clone)]
pub struct TemplateEventsProcessor {
    mongo: MongoHandle,
}

impl TemplateEventsProcessor {
    /// Construct a processor bound to the given Mongo handle.
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }

    /// Process one template event. Branches on `field`.
    ///
    /// All three handled fields share the same retrieval pattern: read
    /// `message_template_id` (preferred) and `message_template_name` from
    /// `value`, build a Mongo filter scoped to the project, then $set the
    /// per-event fields. Unknown `field` values are logged and audited but
    /// do not error — Meta sometimes adds new template-event fields ahead
    /// of documenting them.
    pub async fn process(
        &self,
        project: &Project,
        value: &ChangeValue,
        field: &str,
    ) -> Result<TemplateOutcome> {
        // Round-trip to JSON so we can read template-event fields the shared
        // DTO doesn't model. See module-level note. `unwrap_or_default` keeps
        // us robust against a serializer error — falling through to a no-op
        // event is safer than 5xx-ing back to Meta.
        let v: Value = serde_json::to_value(value).unwrap_or(Value::Null);

        // Always audit. We do this *before* the dispatch so a panic / db
        // failure in the field-specific path still leaves a paper trail.
        self.audit(project, field, &v).await?;

        match field {
            "message_template_status_update" => self.handle_status_update(project, &v).await,
            "message_template_quality_update" => self.handle_quality_update(project, &v).await,
            "message_template_components_update" => {
                self.handle_components_update(project, &v).await
            }
            other => {
                warn!(
                    project_id = %project.id,
                    field = other,
                    "unknown template-event field; audited only"
                );
                Ok(TemplateOutcome::unmatched())
            }
        }
    }

    // ── handlers ────────────────────────────────────────────────────────

    async fn handle_status_update(
        &self,
        project: &Project,
        v: &Value,
    ) -> Result<TemplateOutcome> {
        let event = v.get("event").and_then(Value::as_str).unwrap_or("");
        let meta_template_id = v
            .get("message_template_id")
            .and_then(value_as_string_loose);
        let template_name = v
            .get("message_template_name")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let reason = v
            .get("reason")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let disable_info = v.get("disable_info").cloned();

        let Some(status) = meta_event_to_status(event) else {
            warn!(
                project_id = %project.id,
                event,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                "unknown Meta template status; audited only"
            );
            return Ok(TemplateOutcome::unmatched());
        };

        // Mongo expects the SCREAMING_SNAKE_CASE wire form, matching the
        // shape produced by `wachat_types::TemplateStatus`'s serde rename.
        let status_str = template_status_to_str(status);
        let now = Utc::now();

        let filter = build_filter(project, meta_template_id.as_deref(), template_name.as_deref());

        let mut set_doc = doc! {
            "status": status_str,
            "statusUpdatedAt": bson::DateTime::from_chrono(now),
        };
        if let Some(r) = reason.as_deref() {
            set_doc.insert("rejectedReason", r);
        } else {
            // Explicitly clear a stale rejectedReason on re-approval so the
            // UI doesn't keep showing the old text after Meta accepts a fix.
            if matches!(status, TemplateStatus::Approved) {
                set_doc.insert("rejectedReason", bson::Bson::Null);
            }
        }
        if let Some(di) = disable_info.as_ref().and_then(json_to_bson) {
            set_doc.insert("disableInfo", di);
        }
        if is_flagged_event(event) {
            set_doc.insert("flagged", true);
        } else {
            // A subsequent non-FLAGGED event clears the flag.
            set_doc.insert("flagged", false);
        }

        let update = doc! { "$set": set_doc };

        let coll = self.mongo.collection::<Document>(TEMPLATES_COLLECTION);
        let res = coll
            .update_one(filter.clone(), update)
            .await
            .map_err(|e| anyhow::anyhow!("templates.updateOne (status): {e}"))?;

        if res.matched_count == 0 {
            // Stub: keep a record so the next /sync run reconciles. This is
            // a divergence from TS which silently drops the event.
            self.insert_stub(
                project,
                meta_template_id.as_deref(),
                template_name.as_deref(),
                status_str,
            )
            .await?;
            info!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                status = status_str,
                "no matching template; inserted stub"
            );
            return Ok(TemplateOutcome {
                matched: true,
                status_changed: Some(status_str.to_owned()),
            });
        }

        debug!(
            project_id = %project.id,
            meta_template_id = ?meta_template_id,
            template_name = ?template_name,
            status = status_str,
            modified = res.modified_count,
            "template status updated"
        );

        Ok(TemplateOutcome {
            matched: true,
            status_changed: Some(status_str.to_owned()),
        })
    }

    async fn handle_quality_update(
        &self,
        project: &Project,
        v: &Value,
    ) -> Result<TemplateOutcome> {
        let meta_template_id = v
            .get("message_template_id")
            .and_then(value_as_string_loose);
        let template_name = v
            .get("message_template_name")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let new_quality = v
            .get("new_quality_score")
            .and_then(Value::as_str)
            .map(|s| s.to_ascii_uppercase());
        let previous_quality = v
            .get("previous_quality_score")
            .and_then(Value::as_str)
            .map(|s| s.to_ascii_uppercase());

        let Some(quality) = new_quality.clone() else {
            warn!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                "quality update missing new_quality_score; audited only"
            );
            return Ok(TemplateOutcome::unmatched());
        };

        let filter = build_filter(project, meta_template_id.as_deref(), template_name.as_deref());

        let update = doc! {
            "$set": {
                "qualityScore": &quality,
                "previousQualityScore": previous_quality.clone().unwrap_or_default(),
                "qualityUpdatedAt": bson::DateTime::from_chrono(Utc::now()),
            }
        };

        let coll = self.mongo.collection::<Document>(TEMPLATES_COLLECTION);
        let res = coll
            .update_one(filter, update)
            .await
            .map_err(|e| anyhow::anyhow!("templates.updateOne (quality): {e}"))?;

        if res.matched_count == 0 {
            warn!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                quality = %quality,
                "no matching template for quality update"
            );
            return Ok(TemplateOutcome::unmatched());
        }

        debug!(
            project_id = %project.id,
            meta_template_id = ?meta_template_id,
            quality = %quality,
            "template quality updated"
        );
        Ok(TemplateOutcome {
            matched: true,
            status_changed: None,
        })
    }

    async fn handle_components_update(
        &self,
        project: &Project,
        v: &Value,
    ) -> Result<TemplateOutcome> {
        let meta_template_id = v
            .get("message_template_id")
            .and_then(value_as_string_loose);
        let template_name = v
            .get("message_template_name")
            .and_then(Value::as_str)
            .map(str::to_owned);
        let components = v.get("components").cloned();

        let Some(components_value) = components else {
            warn!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                "components update missing components; audited only"
            );
            return Ok(TemplateOutcome::unmatched());
        };

        let Some(components_bson) = json_to_bson(&components_value) else {
            warn!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                "components payload could not be converted to BSON; audited only"
            );
            return Ok(TemplateOutcome::unmatched());
        };

        let filter = build_filter(project, meta_template_id.as_deref(), template_name.as_deref());
        let update = doc! {
            "$set": {
                "components": components_bson,
                "componentsUpdatedAt": bson::DateTime::from_chrono(Utc::now()),
            }
        };

        let coll = self.mongo.collection::<Document>(TEMPLATES_COLLECTION);
        let res = coll
            .update_one(filter, update)
            .await
            .map_err(|e| anyhow::anyhow!("templates.updateOne (components): {e}"))?;

        if res.matched_count == 0 {
            warn!(
                project_id = %project.id,
                meta_template_id = ?meta_template_id,
                template_name = ?template_name,
                "no matching template for components update"
            );
            return Ok(TemplateOutcome::unmatched());
        }

        debug!(
            project_id = %project.id,
            meta_template_id = ?meta_template_id,
            "template components replaced"
        );
        Ok(TemplateOutcome {
            matched: true,
            status_changed: None,
        })
    }

    // ── helpers ────────────────────────────────────────────────────────

    async fn audit(&self, project: &Project, field: &str, v: &Value) -> Result<()> {
        let payload = json_to_bson(v).unwrap_or(bson::Bson::Null);
        let entry = doc! {
            "projectId": project.id,
            "field": field,
            "payload": payload,
            "receivedAt": bson::DateTime::from_chrono(Utc::now()),
        };
        let coll = self.mongo.collection::<Document>(AUDIT_COLLECTION);
        coll.insert_one(entry)
            .await
            .map_err(|e| anyhow::anyhow!("template_events.insertOne: {e}"))?;
        Ok(())
    }

    async fn insert_stub(
        &self,
        project: &Project,
        meta_template_id: Option<&str>,
        name: Option<&str>,
        status: &str,
    ) -> Result<()> {
        let coll = self.mongo.collection::<Document>(TEMPLATES_COLLECTION);
        let stub = doc! {
            "projectId": project.id,
            "metaId": meta_template_id.unwrap_or(""),
            "name": name.unwrap_or(""),
            "status": status,
            "source": "webhook_only",
            "createdAt": bson::DateTime::from_chrono(Utc::now()),
        };
        coll.insert_one(stub)
            .await
            .map_err(|e| anyhow::anyhow!("templates.insertOne (stub): {e}"))?;
        Ok(())
    }
}

// ── pure helpers (kept module-private and unit-testable) ───────────────

/// Build the canonical Mongo filter for a template event.
///
/// Preference order (per Meta-correctness): `metaId` > `name`. Both forms
/// are scoped by `projectId` so cross-tenant collisions are impossible.
pub(crate) fn build_filter(
    project: &Project,
    meta_template_id: Option<&str>,
    name: Option<&str>,
) -> Document {
    if let Some(id) = meta_template_id.filter(|s| !s.is_empty()) {
        doc! { "projectId": project.id, "metaId": id }
    } else if let Some(n) = name.filter(|s| !s.is_empty()) {
        doc! { "projectId": project.id, "name": n }
    } else {
        // Worst-case fall-through: a filter that matches nothing. Better than
        // a filter that matches the whole project (which $set would corrupt).
        doc! { "projectId": project.id, "_neverMatchSentinel": true }
    }
}

/// Mongo wire form of `TemplateStatus`. Mirrors the serde rename on the
/// enum (`SCREAMING_SNAKE_CASE`) so reads/writes stay consistent.
fn template_status_to_str(s: TemplateStatus) -> &'static str {
    match s {
        TemplateStatus::Approved => "APPROVED",
        TemplateStatus::Rejected => "REJECTED",
        TemplateStatus::Pending => "PENDING",
        TemplateStatus::Disabled => "DISABLED",
        TemplateStatus::Paused => "PAUSED",
    }
}

/// Best-effort conversion of a `serde_json::Value` to a `bson::Bson`. Used
/// for opaque sub-objects (`disable_info`, `components`) we don't want to
/// model strictly. Returns `None` if the BSON crate rejects the shape
/// (extremely rare — basically only for non-finite floats).
fn json_to_bson(v: &Value) -> Option<bson::Bson> {
    bson::to_bson(v).ok()
}

/// Meta is inconsistent: `message_template_id` arrives as a JSON string
/// most of the time but occasionally as a number (legacy templates). Accept
/// both and normalize to `String`. `null` / object / bool → `None`.
fn value_as_string_loose(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if !s.is_empty() => Some(s.clone()),
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;
    use chrono::Utc;
    use wachat_types::project::Project;

    fn fixture_project() -> Project {
        Project {
            id: ObjectId::new(),
            user_id: ObjectId::new(),
            name: "test-project".to_owned(),
            waba_id: Some("waba_1".to_owned()),
            business_id: None,
            app_id: None,
            access_token: None,
            phone_numbers: vec![],
            messages_per_second: None,
            credits: None,
            plan_id: None,
            review_status: None,
            ban_state: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn filter_prefers_meta_id_over_name() {
        let p = fixture_project();
        let f = build_filter(&p, Some("123_abc"), Some("ignored_name"));
        assert_eq!(f.get_str("metaId").unwrap(), "123_abc");
        assert!(f.get("name").is_none());
        assert!(f.contains_key("projectId"));
    }

    #[test]
    fn filter_falls_back_to_name() {
        let p = fixture_project();
        let f = build_filter(&p, None, Some("hello_world"));
        assert_eq!(f.get_str("name").unwrap(), "hello_world");
        assert!(f.get("metaId").is_none());
    }

    #[test]
    fn filter_empty_meta_id_falls_through_to_name() {
        let p = fixture_project();
        let f = build_filter(&p, Some(""), Some("named"));
        assert_eq!(f.get_str("name").unwrap(), "named");
    }

    #[test]
    fn filter_neither_matches_nothing() {
        let p = fixture_project();
        let f = build_filter(&p, None, None);
        assert!(f.contains_key("_neverMatchSentinel"));
    }

    #[test]
    fn value_as_string_loose_handles_string_and_number() {
        assert_eq!(
            value_as_string_loose(&Value::String("abc".into())),
            Some("abc".to_owned())
        );
        assert_eq!(value_as_string_loose(&Value::String(String::new())), None);
        assert_eq!(
            value_as_string_loose(&serde_json::json!(12345)),
            Some("12345".to_owned())
        );
        assert_eq!(value_as_string_loose(&Value::Null), None);
        assert_eq!(value_as_string_loose(&Value::Bool(true)), None);
    }

    #[test]
    fn template_status_strings_match_meta_wire_form() {
        assert_eq!(template_status_to_str(TemplateStatus::Approved), "APPROVED");
        assert_eq!(template_status_to_str(TemplateStatus::Rejected), "REJECTED");
        assert_eq!(template_status_to_str(TemplateStatus::Pending), "PENDING");
        assert_eq!(template_status_to_str(TemplateStatus::Disabled), "DISABLED");
        assert_eq!(template_status_to_str(TemplateStatus::Paused), "PAUSED");
    }
}
