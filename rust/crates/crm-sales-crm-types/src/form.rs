//! §5.6 Sales-CRM Forms.
//!
//! Mongo collection: `crm_sales_forms`. Top struct: [`SalesForm`].
//!
//! This is the §5.6 sales-CRM-specific form — richer than the
//! [`crm_sales_types::pipeline::LeadForm`] DTO already in `crm-sales-types`.
//! Both shapes coexist: this one adds Map-to (entity created on submit),
//! Default owner, Tags applied, honeypot + reCAPTCHA, success webhook,
//! and a denormalized embed snippet for fast copy-paste from the UI.
//!
//! Spec verbatim (§5.6):
//! > Name, Description, Fields[] (label, type, required, options,
//! > validation), Theme, Redirect URL, Submit message, Success webhook,
//! > Honeypot, reCAPTCHA, Map-to entity, Default owner, Tags applied,
//! > Embed snippet ⚙.
//!
//! `embed_snippet` is system-generated (⚙) — denormalized so the dashboard
//! can show a Copy button without re-rendering the snippet from a template
//! on every page load.

use bson::oid::ObjectId;
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Public-form field types. Snake-case so multi-word variants
/// (`multi_select`) round-trip cleanly via JSON.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FormFieldKind {
    Text,
    Textarea,
    Email,
    Phone,
    Number,
    Date,
    Select,
    MultiSelect,
    Checkbox,
    Url,
    File,
}

/// Per-field validation envelope. All fields optional — the renderer
/// only enforces what's set.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldValidation {
    /// Min length / numeric min / earliest date (caller-interpreted).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    /// Max length / numeric max / latest date (caller-interpreted).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
    /// Regex applied as-is. The form runtime is responsible for compiling
    /// safely (e.g. `regex::Regex::new` with a size cap).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pattern: Option<String>,
    /// Override the default validation message shown on failure.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

/// One configurable field on the form.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormField {
    /// Stable key used in submission payloads. Must be unique within
    /// the form.
    pub key: String,
    pub label: String,
    pub kind: FormFieldKind,
    #[serde(default, skip_serializing_if = "is_false")]
    pub required: bool,
    /// Options for `Select` / `MultiSelect`. Ignored for other kinds.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub options: Vec<String>,
    #[serde(default)]
    pub validation: FieldValidation,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub placeholder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub help_text: Option<String>,
}

/// Theming knobs for the public-facing form page.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormTheme {
    /// Tailwind / CSS color token. Free-form so brands can introduce new
    /// tokens without a crate edit ("zinc-500", "#22c55e", …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub brand_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background_file_id: Option<ObjectId>,
    /// "light" / "dark" / "system". Free-form so brands can ship custom
    /// modes (e.g. "high-contrast").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
}

/// Entity created when the form is submitted. Drives which collection
/// the seeded record lands in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MapTo {
    #[default]
    Lead,
    Contact,
    Deal,
}

/// reCAPTCHA configuration. The secret is **not** stored inline — only a
/// reference (env-var name or secrets-manager handle) so DB dumps never
/// leak the signing key.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecaptchaConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub site_key: Option<String>,
    /// Reference (env-var name or secrets-manager id) — never the raw key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secret_key_ref: Option<String>,
}

/// §5.6 Sales-CRM form (`crm_sales_forms`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SalesForm {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- identity ---------------------------------------------- */
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /* ----- shape ------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fields: Vec<FormField>,
    #[serde(default)]
    pub theme: FormTheme,

    /* ----- post-submit behaviour --------------------------------- */
    /// Where to send the visitor after a successful submit.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redirect_url: Option<String>,
    /// Inline confirmation message rendered when no `redirect_url` is set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub submit_message: Option<String>,
    /// Outbound webhook URL — fired for every successful submission.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub success_webhook: Option<String>,

    /* ----- spam protection --------------------------------------- */
    /// Honeypot field name. When set, that field's submitted value MUST
    /// be empty (bots fill every input). Kept off the rendered form
    /// visually via CSS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub honeypot_field_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recaptcha: Option<RecaptchaConfig>,

    /* ----- mapping / ownership / tagging ------------------------- */
    /// Which CRM entity to create on submit.
    #[serde(default)]
    pub map_to: MapTo,
    /// User who owns records seeded by this form. Falls back to the
    /// form's `userId` when `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_owner_id: Option<ObjectId>,
    /// Tags stamped onto every record this form creates.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applied_tags: Vec<String>,

    /* ----- system-generated denormalization ---------------------- */
    /// HTML embed snippet (⚙ system-generated). Denormalized so the UI
    /// can offer a Copy button without re-rendering on every load.
    pub embed_snippet: String,
}

fn is_false(b: &bool) -> bool {
    !*b
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn sales_form_round_trips_with_flattened_fragments() {
        let form = SalesForm {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit {
                created_at: Utc::now(),
                updated_at: Utc::now(),
                created_by: None,
                updated_by: None,
            },
            name: "Contact Us".to_string(),
            description: Some("Top-of-funnel form".to_string()),
            fields: vec![FormField {
                key: "email".to_string(),
                label: "Work email".to_string(),
                kind: FormFieldKind::Email,
                required: true,
                options: vec![],
                validation: FieldValidation {
                    pattern: Some(r"^[^@]+@[^@]+$".to_string()),
                    ..Default::default()
                },
                placeholder: Some("you@company.com".to_string()),
                help_text: None,
            }],
            theme: FormTheme::default(),
            redirect_url: None,
            submit_message: Some("Thanks — we'll be in touch.".to_string()),
            success_webhook: Some("https://example.com/hooks/form".to_string()),
            honeypot_field_name: Some("nickname".to_string()),
            recaptcha: Some(RecaptchaConfig {
                site_key: Some("6Lc...".to_string()),
                secret_key_ref: Some("env:RECAPTCHA_SECRET".to_string()),
            }),
            map_to: MapTo::Lead,
            default_owner_id: Some(ObjectId::new()),
            applied_tags: vec!["website".to_string(), "inbound".to_string()],
            embed_snippet: "<iframe src=\"…\"></iframe>".to_string(),
        };

        let json = serde_json::to_value(&form).unwrap();

        // Flattened fragments at root, no nested keys.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase entity fields.
        assert!(json.get("embedSnippet").is_some());
        assert!(json.get("honeypotFieldName").is_some());
        assert!(json.get("appliedTags").is_some());
        assert!(json.get("defaultOwnerId").is_some());
        assert!(json.get("successWebhook").is_some());

        // Enum lowercase.
        assert_eq!(json.get("mapTo").and_then(|v| v.as_str()), Some("lead"));

        // Field kind snake_case ("email" still lowercase but check shape).
        let kind = json
            .pointer("/fields/0/kind")
            .and_then(|v| v.as_str())
            .unwrap();
        assert_eq!(kind, "email");

        // Round-trip back.
        let back: SalesForm = serde_json::from_value(json).unwrap();
        assert_eq!(back.name, "Contact Us");
        assert_eq!(back.applied_tags, vec!["website", "inbound"]);
        assert!(matches!(back.map_to, MapTo::Lead));
        assert!(matches!(back.fields[0].kind, FormFieldKind::Email));
    }
}
