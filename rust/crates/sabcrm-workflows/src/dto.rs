//! Wire-format DTOs for the SabCRM automation-workflows HTTP surface.
//!
//! A workflow document is:
//!
//! ```jsonc
//! {
//!   "_id", "projectId", "name", "description"?,
//!   "enabled": bool,
//!   "trigger": { "event": "record.created"|"record.updated"|"record.deleted"
//!                |"manual"|"cron"|"webhook", "object"?: "<slug>" },
//!   "steps": [ { "id", "type": "create_task"|"send_notification"|"update_field"
//!                |"webhook"|"filter"|"if_else"|"find_records"|"upsert_record",
//!                "config": { ... }, "enabled"?: bool } ],
//!   "currentVersion": 1,
//!   "versions": [ { "version", "status", "trigger", "steps", "createdAt" } ],
//!   "createdAt", "updatedAt", "lastRunAt"?
//! }
//! ```
//!
//! The [`WorkflowTrigger`], [`WorkflowStep`], [`WorkflowDraft`] and
//! [`WorkflowVersion`] types below are the strongly-typed mirror of that shape
//! (the exact thing the `AutomationBuilder` round-trips); the persisted
//! `trigger` / `steps` are still stored as opaque `Value` so the wire contract
//! is unchanged.
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use utoipa::ToSchema;

// ===========================================================================
// Typed AutomationBuilder shape (Twenty parity)
// ===========================================================================
//
// The HTTP surface still stores `trigger` / `steps` as opaque `Value` (so the
// engine round-trips whatever the `AutomationBuilder` emits verbatim, and the
// public wire contract is unchanged). The strongly-typed mirror below documents
// and validates that shape: a record-lifecycle (or manual / cron / webhook)
// trigger plus an ordered list of per-step configs, each with an `enabled`
// flag, threaded through immutable `versions`.
//
// Everything here is **additive** — new types + new optional fields only.
// Nothing in the existing `Create` / `Update` / response DTOs changed name or
// type, so `sabnode-api` and sibling crates keep compiling.

/// The lifecycle / manual / scheduled event that fires a workflow.
///
/// The three `record.*` events mirror the original engine contract; `manual`,
/// `cron` and `webhook` extend it toward Twenty's full trigger catalogue.
/// `#[serde(other)]` keeps deserialization forward-compatible: an unknown
/// event string round-trips as [`TriggerEvent::Other`] rather than failing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum TriggerEvent {
    #[serde(rename = "record.created")]
    RecordCreated,
    #[serde(rename = "record.updated")]
    RecordUpdated,
    #[serde(rename = "record.deleted")]
    RecordDeleted,
    /// The record's pipeline-stage field changed value (ported from the
    /// legacy CRM's `stage_changed`). The watched field defaults to
    /// `data.stage` (the pipelines board default); a trigger may override it
    /// via a flattened `field` key and narrow on `fromValue` / `toValue`.
    #[serde(rename = "record.stage_changed")]
    RecordStageChanged,
    /// The record's `status` field changed value (ported from the legacy
    /// CRM's `status_changed`). Mechanically identical to
    /// [`TriggerEvent::RecordStageChanged`] but watching `data.status` by
    /// default — in SabCRM "stage" (pipeline position) and "status" (a SELECT
    /// field) are distinct record fields, so both events are kept.
    #[serde(rename = "record.status_changed")]
    RecordStatusChanged,
    /// Time-based trigger (ported from the legacy CRM's `time_elapsed`):
    /// fires for records that have been idle for a configured duration.
    /// Definition-only on this surface — evaluation happens in the SabCRM
    /// scheduler tick (`src/lib/sabcrm/scheduler.ts`, `/api/cron/sabcrm-workflows`).
    /// Config rides as flattened trigger keys — see [`TimeElapsedConfig`].
    #[serde(rename = "time.elapsed")]
    TimeElapsed,
    #[serde(rename = "manual")]
    Manual,
    #[serde(rename = "cron")]
    Cron,
    #[serde(rename = "webhook")]
    Webhook,
    /// Any event slug the engine does not yet model.
    #[serde(other)]
    Other,
}

/// Typed view of a `time.elapsed` trigger's flattened config keys.
///
/// The persisted trigger is still a free-form `Value` (extra keys flow through
/// [`WorkflowTrigger::extra`]); this struct documents + parses the slice the
/// scheduler consumes. All keys are serde-defaulted so any historical trigger
/// (or one carrying only some of the duration units) deserializes fine. The
/// effective threshold is `afterMinutes + afterHours·60 + afterDays·1440`
/// minutes; a zero total disables the trigger.
#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TimeElapsedConfig {
    /// Minutes component of the idle threshold.
    #[serde(default)]
    pub after_minutes: Option<u64>,
    /// Hours component of the idle threshold.
    #[serde(default)]
    pub after_hours: Option<u64>,
    /// Days component of the idle threshold.
    #[serde(default)]
    pub after_days: Option<u64>,
    /// Which record timestamp anchors the elapsed check. `"updatedAt"`
    /// (default) and `"createdAt"` read the top-level record timestamps; any
    /// other value reads `data.<sinceField>` (expected to be RFC3339).
    #[serde(default)]
    pub since_field: Option<String>,
}

impl TimeElapsedConfig {
    /// Parse the config slice out of a raw trigger value. Unknown / malformed
    /// keys fall back to the default rather than failing the trigger.
    pub fn from_trigger(trigger: &Value) -> Self {
        serde_json::from_value(trigger.clone()).unwrap_or_default()
    }

    /// The total idle threshold in minutes (0 → trigger disabled).
    pub fn total_minutes(&self) -> u64 {
        self.after_minutes.unwrap_or(0)
            + self.after_hours.unwrap_or(0) * 60
            + self.after_days.unwrap_or(0) * 60 * 24
    }
}

/// A workflow trigger: the firing event coupled to the target object slug.
///
/// `object` is optional so manual / cron / webhook triggers (which are not
/// bound to one object) round-trip without a synthetic value. Unknown keys are
/// preserved in `extra` so the builder can attach trigger settings (e.g. cron
/// expression, webhook secret, field filters) without a schema change.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowTrigger {
    /// Firing event — `record.created` / `record.updated` / `record.deleted`
    /// / `manual` / `cron` / `webhook`.
    pub event: TriggerEvent,
    /// Target object slug. Absent for object-agnostic triggers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub object: Option<String>,
    /// Forward-compatible trigger settings (cron expr, webhook config, …).
    #[serde(flatten, default)]
    #[schema(value_type = Object)]
    pub extra: BTreeMap<String, Value>,
}

/// The kind of action a step performs.
///
/// Covers the eight step types the `AutomationBuilder` authors. `#[serde(other)]`
/// keeps it forward-compatible with engine-only step kinds (delay / code /
/// iterator / ai_agent / form) that the builder may emit later.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum StepType {
    CreateTask,
    SendNotification,
    UpdateField,
    Webhook,
    Filter,
    IfElse,
    FindRecords,
    UpsertRecord,
    /// Send a WhatsApp template message through the WaChat engine (ported
    /// from the legacy CRM's `send_whatsapp_template`). Config carries
    /// `{ templateId, to, variables?, mediaId? }`; execution lives in the TS
    /// runtime (`src/lib/sabcrm/runtime.ts`), which calls the existing
    /// `/v1/wachat/templates/{id}/send` surface.
    SendWhatsappTemplate,
    /// Any step kind the engine models but this enum does not yet name.
    #[serde(other)]
    Other,
}

/// One ordered step in a workflow pipeline.
///
/// `config` is intentionally a free-form object — each step type carries its
/// own keys (task title, notification recipient, field/value, webhook url,
/// filter conditions, if/else branches, find/upsert criteria). The typed
/// `StepType` discriminates which keys are expected; the engine validates the
/// per-type config at execution time. `enabled` lets a single step be muted
/// without removing it from the pipeline (defaults to `true`).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStep {
    /// Stable per-step id (the builder mints `step_<uuid>`).
    pub id: String,
    /// What the step does.
    #[serde(rename = "type")]
    pub step_type: StepType,
    /// Per-type configuration, stored and round-tripped verbatim.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub config: Value,
    /// Whether this step runs. Defaults to `true` when omitted.
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub enabled: bool,
    /// Forward-compatible per-step metadata (name, position, branch hints, …).
    #[serde(flatten, default)]
    #[schema(value_type = Object)]
    pub extra: BTreeMap<String, Value>,
}

/// The editable body of a workflow at one point in time — the exact shape the
/// `AutomationBuilder` round-trips (`trigger` + ordered `steps` + `enabled`).
///
/// Used to parse / re-emit a draft for validation; the persisted document still
/// stores `trigger` / `steps` as opaque `Value`, so this is a lens over that
/// data rather than a replacement for it.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowDraft {
    /// Human label.
    pub name: String,
    /// Optional free-text description.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Whether the workflow fires.
    #[serde(default)]
    pub enabled: bool,
    /// The firing trigger.
    pub trigger: WorkflowTrigger,
    /// Ordered step pipeline.
    #[serde(default)]
    pub steps: Vec<WorkflowStep>,
}

/// An immutable snapshot of a workflow's `{ trigger, steps }` at a given
/// revision. Twenty pins each run to a `workflowVersion`; storing versions lets
/// edits be non-destructive and runs reproducible.
///
/// `status` mirrors Twenty's `DRAFT` / `ACTIVE` / `DEACTIVATED` /
/// `ARCHIVED` lifecycle; the trigger + steps are kept as opaque `Value` so a
/// version round-trips byte-for-byte regardless of step-type evolution.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowVersion {
    /// Monotonic version number, starting at 1.
    pub version: u32,
    /// Lifecycle status — `draft` / `active` / `deactivated` / `archived`.
    #[serde(default = "default_version_status")]
    pub status: String,
    /// Trigger snapshot, verbatim.
    #[schema(value_type = Object)]
    pub trigger: Value,
    /// Steps snapshot, verbatim.
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub steps: Value,
    /// RFC3339 creation timestamp.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

fn default_true() -> bool {
    true
}

fn is_true(v: &bool) -> bool {
    *v
}

fn default_version_status() -> String {
    "draft".to_owned()
}

/// `GET /` query params — list the workflows for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a workflow. `projectId` scopes the row; `name` is
/// required. `trigger` is the `{ event, object }` shape; `steps` defaults to
/// an empty list, `enabled` to `false`. Server-set: `_id`, `createdAt`,
/// `updatedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkflowInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human label — required, non-empty.
    pub name: String,
    /// Optional free-text description.
    #[serde(default)]
    pub description: Option<String>,
    /// Record-lifecycle trigger: `{ event, object }`. Stored verbatim.
    #[schema(value_type = Object)]
    pub trigger: Value,
    /// Ordered step pipeline. Each entry is `{ id, type, config }`. Stored
    /// verbatim; defaults to `[]`.
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub steps: Option<Value>,
    /// Whether the workflow fires. Defaults to `false`.
    #[serde(default)]
    pub enabled: Option<bool>,
    /// Optional explicit starting version number. Defaults to `1`. Additive —
    /// lets a caller seed a workflow at a known revision (e.g. on import).
    #[serde(default)]
    pub current_version: Option<u32>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped. Covers enable/disable, trigger swaps and step edits.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkflowInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw workflow documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub workflows: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single raw
/// workflow document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowResponse {
    #[schema(value_type = Object)]
    pub workflow: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// tests — serde stays additive: legacy documents keep deserializing
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// The original three record-lifecycle events still round-trip verbatim.
    #[test]
    fn legacy_record_events_round_trip() {
        for slug in ["record.created", "record.updated", "record.deleted"] {
            let ev: TriggerEvent = serde_json::from_value(json!(slug)).expect("parse");
            assert_ne!(ev, TriggerEvent::Other, "{slug} must stay a named variant");
            assert_eq!(serde_json::to_value(&ev).expect("ser"), json!(slug));
        }
    }

    /// The ported legacy-CRM events parse to their new named variants and
    /// serialize back to the same slugs.
    #[test]
    fn ported_legacy_events_round_trip() {
        let cases = [
            ("record.stage_changed", TriggerEvent::RecordStageChanged),
            ("record.status_changed", TriggerEvent::RecordStatusChanged),
            ("time.elapsed", TriggerEvent::TimeElapsed),
        ];
        for (slug, expected) in cases {
            let ev: TriggerEvent = serde_json::from_value(json!(slug)).expect("parse");
            assert_eq!(ev, expected);
            assert_eq!(serde_json::to_value(&ev).expect("ser"), json!(slug));
        }
    }

    /// Unknown event slugs still fall through to `Other` (forward compat).
    #[test]
    fn unknown_event_is_other() {
        let ev: TriggerEvent =
            serde_json::from_value(json!("record.someday_event")).expect("parse");
        assert_eq!(ev, TriggerEvent::Other);
    }

    /// A `record.stage_changed` trigger with flattened from/to filters still
    /// validates as a [`WorkflowTrigger`] (extras flow into `extra`).
    #[test]
    fn stage_changed_trigger_validates_with_extras() {
        let t: WorkflowTrigger = serde_json::from_value(json!({
            "event": "record.stage_changed",
            "object": "opportunities",
            "field": "stage",
            "fromValue": "qualified",
            "toValue": "won"
        }))
        .expect("trigger parses");
        assert_eq!(t.event, TriggerEvent::RecordStageChanged);
        assert_eq!(t.object.as_deref(), Some("opportunities"));
        assert_eq!(t.extra.get("fromValue"), Some(&json!("qualified")));
    }

    /// The new step type parses; legacy step docs keep deserializing.
    #[test]
    fn send_whatsapp_template_step_parses() {
        let s: WorkflowStep = serde_json::from_value(json!({
            "id": "step_1",
            "type": "send_whatsapp_template",
            "config": { "templateId": "tpl1", "to": "{{trigger.phone}}" }
        }))
        .expect("step parses");
        assert_eq!(s.step_type, StepType::SendWhatsappTemplate);
        assert!(s.enabled, "enabled defaults true");

        let legacy: WorkflowStep = serde_json::from_value(json!({
            "id": "step_2",
            "type": "create_task",
            "config": { "title": "Follow up" }
        }))
        .expect("legacy step parses");
        assert_eq!(legacy.step_type, StepType::CreateTask);
    }

    /// `TimeElapsedConfig` is fully serde-defaulted: a bare trigger parses to
    /// the disabled baseline; duration units compose into total minutes.
    #[test]
    fn time_elapsed_config_defaults_and_totals() {
        let bare = TimeElapsedConfig::from_trigger(&json!({ "event": "time.elapsed" }));
        assert_eq!(bare, TimeElapsedConfig::default());
        assert_eq!(bare.total_minutes(), 0, "no duration → disabled");

        let cfg = TimeElapsedConfig::from_trigger(&json!({
            "event": "time.elapsed",
            "object": "leads",
            "afterMinutes": 30,
            "afterHours": 2,
            "afterDays": 1,
            "sinceField": "updatedAt"
        }));
        assert_eq!(cfg.total_minutes(), 30 + 120 + 1440);
        assert_eq!(cfg.since_field.as_deref(), Some("updatedAt"));
    }

    /// Malformed duration keys fall back to the default rather than erroring.
    #[test]
    fn malformed_time_elapsed_config_falls_back() {
        let cfg = TimeElapsedConfig::from_trigger(&json!({
            "event": "time.elapsed",
            "afterMinutes": "not-a-number"
        }));
        assert_eq!(cfg, TimeElapsedConfig::default());
    }
}
