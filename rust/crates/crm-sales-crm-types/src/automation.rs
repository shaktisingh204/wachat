//! §5.5 Automations.
//!
//! Mongo collection: `crm_automations`. An automation is a
//! trigger → conditions → actions pipeline scoped to a project / user.
//! The trigger fires the rule, every condition must pass, then each
//! action runs in order. Throttle caps how often a single rule may fire
//! inside a sliding window; logs capture per-run outcomes.
//!
//! Triggers, actions, conditions are intentionally tagged enums so new
//! variants can be added without breaking older documents — Mongo just
//! sees `{ "kind": "..." }` discriminators on each doc.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// `true` is the natural default for `active`, so we serialize it with a
/// helper that flips the usual `Option::is_none`-style skip.
fn default_true() -> bool {
    true
}

fn is_true(b: &bool) -> bool {
    *b
}

fn default_post() -> String {
    "POST".to_string()
}

/// What fires the automation. Tagged on `kind` so each variant carries
/// its own params at the document root level under `trigger`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Trigger {
    /// A new lead document was inserted.
    LeadCreated,
    /// A deal / lead moved between pipeline stages. Any of the
    /// optional filters narrow the rule to a specific board / stage.
    StageChange {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        pipeline_id: Option<ObjectId>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        from_stage_id: Option<ObjectId>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        to_stage_id: Option<ObjectId>,
    },
    /// Cron-driven — the worker schedules these on a project-wide tick.
    TimeBased {
        cron: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        timezone: Option<String>,
    },
    /// A specific public form was submitted.
    FormSubmit { form_id: ObjectId },
    /// An invoice has been overdue for `days` days.
    InvoiceOverdue { days: u32 },
    /// Triggered by hand from the UI / a button on a record.
    Manual,
    /// Escape hatch for module-specific triggers we haven't promoted to
    /// first-class variants yet. Inner `name` distinguishes the
    /// concrete trigger family within the `Custom` bucket; renaming to
    /// avoid collision with the enum's `kind` discriminator tag.
    Custom {
        #[serde(rename = "name")]
        custom_name: String,
        params: serde_json::Value,
    },
}

/// Comparison operator inside a `Condition`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConditionOp {
    Eq,
    Neq,
    Gt,
    Gte,
    Lt,
    Lte,
    Contains,
    NotContains,
    In,
    NotIn,
    IsEmpty,
    IsNotEmpty,
}

/// A single guard evaluated against the trigger payload / record.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Condition {
    /// Dotted field path on the trigger payload (e.g. `"lead.source"`).
    pub field: String,
    pub op: ConditionOp,
    /// Right-hand value; arbitrary JSON so list operators (`In`) and
    /// existence operators (`IsEmpty`) coexist cleanly.
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub value: serde_json::Value,
}

/// Who an `Action` targets. Tagged on `to` so the serialized form looks
/// like `{ "to": "owner" }` or `{ "to": "specific", "id": "..." }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "to", rename_all = "snake_case")]
pub enum ActionRecipient {
    /// The record's owner / assignee.
    Owner,
    /// The customer / contact on the record.
    Customer,
    /// A hard-coded user.
    Specific(ObjectId),
    /// Free-form address (email / phone). Used when the recipient is
    /// neither a CRM user nor the customer.
    Address(String),
}

/// One step the automation runs. Tagged on `kind`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Action {
    SendEmail {
        template_id: ObjectId,
        to: ActionRecipient,
    },
    SendWhatsApp {
        template_id: ObjectId,
        to: ActionRecipient,
    },
    SendSms {
        template_id: ObjectId,
        to: ActionRecipient,
    },
    /// Re-assign the record to a CRM user.
    Assign { assignee_id: ObjectId },
    /// Spawn a follow-up task. `title_template` is a handlebars-ish
    /// string evaluated against the trigger payload.
    CreateTask {
        title_template: String,
        /// Renamed because `type` is a Rust keyword.
        #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
        type_: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        due_in_days: Option<u32>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        assignee_id: Option<ObjectId>,
    },
    /// Outbound HTTP call. `method` defaults to "POST" on deserialize so
    /// older documents that omit it stay valid.
    Webhook {
        url: String,
        #[serde(default = "default_post")]
        method: String,
        #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
        headers: BTreeMap<String, String>,
    },
    /// Patch a field on the trigger record in place.
    UpdateField {
        field: String,
        #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
        value: serde_json::Value,
    },
    /// Pause the pipeline for a fixed delay before running the next
    /// action. Long sleeps are persisted by the worker.
    Wait { seconds: u64 },
}

/// Sliding-window rate limit. With `window_seconds = 3600` and
/// `max_runs = 5`, the rule fires at most 5x per rolling hour.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Throttle {
    pub window_seconds: u64,
    pub max_runs: u32,
}

/// One historical run of the automation. Capped Vec on the parent — the
/// worker trims old entries to keep the doc size bounded.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationLog {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub success: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Short, human-readable summary of what was acted on. Full payload
    /// is logged externally — we only keep a teaser inline.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Automation {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- definition -------------------------------------------- */
    pub name: String,
    /// On/off switch. Workers skip rules where `active = false`.
    /// Defaults to `true` when missing on a stored doc.
    #[serde(default = "default_true", skip_serializing_if = "is_true")]
    pub active: bool,

    pub trigger: Trigger,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conditions: Vec<Condition>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub actions: Vec<Action>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub throttle: Option<Throttle>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub logs: Vec<AutomationLog>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let pid = ObjectId::new();
        let uid = ObjectId::new();
        let template_id = ObjectId::new();

        let auto = Automation {
            identity: Identity {
                id: ObjectId::new(),
                project_id: pid,
                user_id: uid,
                tenant_id: None,
            },
            audit: Audit {
                created_at: now,
                updated_at: now,
                created_by: Some(uid),
                updated_by: Some(uid),
            },
            name: "Welcome new leads".into(),
            active: true,
            trigger: Trigger::LeadCreated,
            conditions: vec![Condition {
                field: "lead.source".into(),
                op: ConditionOp::Eq,
                value: serde_json::json!("website"),
            }],
            actions: vec![
                Action::SendEmail {
                    template_id,
                    to: ActionRecipient::Customer,
                },
                Action::Wait { seconds: 3600 },
                Action::Webhook {
                    url: "https://hooks.example.com/x".into(),
                    method: "POST".into(),
                    headers: {
                        let mut m = BTreeMap::new();
                        m.insert("X-Trace".into(), "auto".into());
                        m
                    },
                },
            ],
            throttle: Some(Throttle {
                window_seconds: 3600,
                max_runs: 5,
            }),
            logs: vec![AutomationLog {
                at: now,
                success: true,
                error: None,
                payload_summary: Some("ok".into()),
            }],
        };

        let json = serde_json::to_value(&auto).unwrap();

        // Flattened identity / audit at root, no nested keys.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("name").is_some());
        assert!(json.get("trigger").is_some());

        // Tagged-enum discriminators serialize snake_case.
        assert_eq!(json["trigger"]["kind"], "lead_created");
        assert_eq!(json["actions"][0]["kind"], "send_email");
        assert_eq!(json["actions"][0]["to"]["to"], "customer");
        assert_eq!(json["actions"][1]["kind"], "wait");
        assert_eq!(json["actions"][2]["kind"], "webhook");
        assert_eq!(json["conditions"][0]["op"], "eq");

        // ActionRecipient::Specific serializes as a tagged variant too.
        let r = ActionRecipient::Specific(ObjectId::new());
        let rj = serde_json::to_value(&r).unwrap();
        assert_eq!(rj["to"], "specific");

        // Round-trip back.
        let back: Automation = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Welcome new leads");
        assert!(back.active);
        assert!(matches!(back.trigger, Trigger::LeadCreated));
        assert_eq!(back.actions.len(), 3);
        assert!(matches!(back.actions[1], Action::Wait { seconds: 3600 }));
    }

    #[test]
    fn stage_change_trigger_carries_optional_filters() {
        let to_stage = ObjectId::new();
        let trig = Trigger::StageChange {
            pipeline_id: None,
            from_stage_id: None,
            to_stage_id: Some(to_stage),
        };
        let v = serde_json::to_value(&trig).unwrap();
        assert_eq!(v["kind"], "stage_change");
        // Inner variant fields keep Rust default serialization
        // (snake_case) since the enum's `rename_all = "snake_case"`
        // applies to variant tags, not nested field names.
        // bson::ObjectId serializes through serde_json as
        // `{"$oid": "<hex>"}` (extjson form) rather than a bare hex
        // string — that's the BSON serde contract.
        assert_eq!(
            v["to_stage_id"]["$oid"].as_str(),
            Some(to_stage.to_hex().as_str())
        );
        assert!(v.get("pipeline_id").is_none(), "None must skip-serialize");
    }
}
