//! §12.20 Templates + Reminder/Notification Rules.
//!
//! Mongo collections: `crm_templates` + `crm_notification_rules`.
//!
//! `Template` is the universal template record across channels (email,
//! SMS, WhatsApp, PDF, portal). It carries the parameterised body, the
//! catalogue of allowed merge variables (with descriptors so the editor
//! can show "what does `{{client.name}}` map to?"), an optional A/B
//! variant set with weights, and a `last_used_at` so the UI can surface
//! recently-used templates first.
//!
//! `NotificationRule` is the trigger pairing — given an event, an
//! audience, and a channel, fire the resolved template with a lead time
//! (negative = before the event, positive = after) honouring an
//! optional throttle window and a per-day mute window.
//!
//! Spec verbatim: Universal template store: type (email/SMS/WhatsApp/
//! PDF/portal), category, language, variables (merge tokens with
//! descriptors), preview, locked variants, A/B variants, last used,
//! owner. Reminder/Notification rules: event, audience, channel,
//! lead-time, frequency, throttle, mute window.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Channel kind a template renders for. The wire format is the lower-case
/// channel name (`email` / `sms` / `whatsapp` / `pdf` / `portal`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateKind {
    #[default]
    Email,
    Sms,
    Whatsapp,
    Pdf,
    Portal,
}

/// One merge token the template body can reference. `token` is the raw
/// placeholder as it appears in the body (`{{client.name}}`); `label`
/// is the editor-friendly caption (`Client Name`); `description`
/// explains the lookup; `sample_value` powers the preview pane so
/// designers see realistic content while editing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeVariable {
    /// e.g. `"{{client.name}}"`.
    pub token: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sample_value: Option<String>,
}

/// One variant of the template body. The base template always has at
/// least one variant; multi-variant templates are A/B tested by
/// `weight` (the renderer normalises across all unlocked variants).
/// `locked = true` pins a variant for legal / brand-approved copy that
/// must never be auto-mutated by an experiment.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateVariant {
    /// Stable identifier (string, not ObjectId, so editors can use
    /// human-readable slugs like `"v1-formal"`).
    pub id: String,
    pub label: String,
    pub body: String,
    #[serde(default)]
    pub locked: bool,
    /// Weight for A/B sampling. `None` excludes the variant from
    /// rotation (effectively a draft).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Template {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- classification ---------------------------------------- */
    pub kind: TemplateKind,
    /// Free-form bucket the user organises templates by (e.g.
    /// `"Onboarding"`, `"Renewal"`, `"Past-due"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    /// IETF BCP 47 tag (e.g. `"en-US"`, `"hi-IN"`).
    pub language: String,

    /* ----- name + body ------------------------------------------- */
    pub name: String,
    /// Email subject / push title / WhatsApp preview line — `None` for
    /// channels (SMS, PDF) that don't carry a header.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Default body. A/B variants in `variants[]` override this when
    /// present.
    pub body: String,

    /* ----- merge tokens + variants ------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<MergeVariable>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variants: Vec<TemplateVariant>,

    /* ----- usage telemetry --------------------------------------- */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_used_at: Option<DateTime<Utc>>,

    /* ----- ownership + lifecycle --------------------------------- */
    /// Specific user the template belongs to (for personal templates).
    /// `None` = workspace-wide.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,
    #[serde(default = "default_true")]
    pub active: bool,
}

fn default_true() -> bool {
    true
}

/// Cadence the rule fires at after the trigger condition is satisfied.
/// `Custom` lets the rule reference an external schedule expression
/// (cron / RRULE) stored in `throttle_window_minutes` semantics is too
/// limited for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NotificationFrequency {
    #[default]
    Once,
    Daily,
    Weekly,
    Custom,
}

/// Quiet-hours window. Minutes are wall-clock minutes since midnight
/// in the workspace timezone (`0..=1440`); `days` is the ISO weekday
/// set the window applies to (`1` = Monday, `7` = Sunday).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MuteWindow {
    pub start_minute: u16,
    pub end_minute: u16,
    /// ISO weekday numbers (`1..=7`). Empty means every day.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub days: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationRule {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- trigger ----------------------------------------------- */
    /// Domain event id (e.g. `"invoice.due"`, `"lead.assigned"`).
    pub event: String,
    /// Recipient bucket (e.g. `"owner"`, `"client"`, `"team:ar"`).
    pub audience: String,
    /// Channel handle (`"email"` / `"sms"` / `"whatsapp"` / `"push"` /
    /// `"webhook"` / ...). Free-form so new channels can be wired
    /// without a schema migration.
    pub channel: String,

    /* ----- payload + cadence ------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
    /// Offset in minutes from the trigger event. Negative = fire
    /// before, positive = fire after, zero = on the dot.
    pub lead_time_minutes: i64,
    #[serde(default)]
    pub frequency: NotificationFrequency,
    /// Suppress repeated firings within this many minutes (per
    /// recipient + event tuple). `None` = no throttle.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub throttle_window_minutes: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mute_window: Option<MuteWindow>,

    /* ----- lifecycle --------------------------------------------- */
    #[serde(default = "default_true")]
    pub active: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn id() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn template_round_trips_with_flattened_fragments() {
        let t = Template {
            identity: id(),
            audit: Audit::new(None),
            kind: TemplateKind::Whatsapp,
            category: Some("Onboarding".into()),
            language: "en-US".into(),
            name: "Welcome message".into(),
            subject: Some("Welcome aboard".into()),
            body: "Hi {{client.name}}, welcome!".into(),
            variables: vec![MergeVariable {
                token: "{{client.name}}".into(),
                label: "Client Name".into(),
                description: Some("The primary contact name on the client record.".into()),
                sample_value: Some("Asha Iyer".into()),
            }],
            variants: vec![
                TemplateVariant {
                    id: "v1-formal".into(),
                    label: "Formal".into(),
                    body: "Dear {{client.name}}, welcome.".into(),
                    locked: true,
                    weight: Some(0.4),
                },
                TemplateVariant {
                    id: "v2-casual".into(),
                    label: "Casual".into(),
                    body: "Hey {{client.name}}!".into(),
                    locked: false,
                    weight: Some(0.6),
                },
            ],
            last_used_at: Some(Utc::now()),
            owner_id: Some(ObjectId::new()),
            active: true,
        };

        let json = serde_json::to_value(&t).unwrap();
        // Flattened fragments at root.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        // camelCase fields.
        assert!(json.get("lastUsedAt").is_some());
        assert!(json.get("ownerId").is_some());
        // Enum lowercase.
        assert_eq!(json.get("kind").and_then(|v| v.as_str()), Some("whatsapp"));
        // Variant nested camelCase.
        let first_variant = json
            .get("variants")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .unwrap();
        assert_eq!(
            first_variant.get("locked").and_then(|v| v.as_bool()),
            Some(true)
        );

        let back: Template = serde_json::from_value(json).unwrap();
        assert!(matches!(back.kind, TemplateKind::Whatsapp));
        assert_eq!(back.variants.len(), 2);
        assert_eq!(back.variables[0].token, "{{client.name}}");
    }

    #[test]
    fn notification_rule_round_trips_with_flattened_fragments() {
        let r = NotificationRule {
            identity: id(),
            audit: Audit::new(None),
            event: "invoice.due".into(),
            audience: "client".into(),
            channel: "email".into(),
            template_id: Some(ObjectId::new()),
            lead_time_minutes: -1440, // 1 day before
            frequency: NotificationFrequency::Daily,
            throttle_window_minutes: Some(720),
            mute_window: Some(MuteWindow {
                start_minute: 22 * 60,
                end_minute: 7 * 60,
                days: vec![6, 7],
            }),
            active: true,
        };

        let json = serde_json::to_value(&r).unwrap();
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("leadTimeMinutes").is_some());
        assert!(json.get("throttleWindowMinutes").is_some());
        assert!(json.get("muteWindow").is_some());
        assert_eq!(
            json.get("frequency").and_then(|v| v.as_str()),
            Some("daily")
        );
        assert_eq!(
            json.get("leadTimeMinutes").and_then(|v| v.as_i64()),
            Some(-1440)
        );
        // muteWindow itself uses camelCase.
        let mw = json.get("muteWindow").unwrap();
        assert!(mw.get("startMinute").is_some());
        assert!(mw.get("endMinute").is_some());

        let back: NotificationRule = serde_json::from_value(json).unwrap();
        assert!(matches!(back.frequency, NotificationFrequency::Daily));
        assert_eq!(back.lead_time_minutes, -1440);
        assert_eq!(back.mute_window.as_ref().unwrap().days, vec![6, 7]);
    }
}
