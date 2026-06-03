//! Per-tenant `email_settings` document shape, as consumed by the sender
//! pipeline. The TypeScript side stores a polymorphic blob keyed by
//! provider name; we project the union shape into a single struct with
//! per-provider sub-objects so the factory can pattern-match without
//! re-parsing.
//!
//! Unknown / missing fields fall back to `None` — providers that need a
//! specific knob will error at send time with a clear message rather
//! than at deserialise time.

use bson::oid::ObjectId;
use email_types::EmailSenderProvider;
use serde::{Deserialize, Serialize};

/// Top-level `email_settings` document. The collection is keyed by
/// `userId` (one document per tenant).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSettingsDoc {
    #[serde(rename = "_id", default)]
    pub id: Option<ObjectId>,
    pub user_id: ObjectId,
    /// Provider selected by the tenant in `/settings/senders`.
    #[serde(default)]
    pub provider: Option<EmailSenderProvider>,
    /// Default sender identity used when a campaign doesn't override.
    #[serde(default)]
    pub default_from_email: Option<String>,
    #[serde(default)]
    pub default_from_name: Option<String>,
    /// Per-provider config sub-objects. All optional; the factory reads
    /// only the one matching `provider`.
    #[serde(default)]
    pub smtp: Option<SmtpConfig>,
    #[serde(default)]
    pub sendgrid: Option<SendgridConfig>,
    #[serde(default)]
    pub mailgun: Option<MailgunConfig>,
    #[serde(default)]
    pub ses: Option<SesConfig>,
    #[serde(default)]
    pub postmark: Option<PostmarkConfig>,
    #[serde(default)]
    pub brevo: Option<BrevoConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, Hash, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    #[serde(default = "default_smtp_port")]
    pub port: u16,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    /// `true` → implicit TLS on port 465; `false` → STARTTLS on 587.
    #[serde(default)]
    pub use_tls: Option<bool>,
}

fn default_smtp_port() -> u16 {
    587
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SendgridConfig {
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MailgunConfig {
    pub api_key: String,
    pub domain: String,
    /// EU vs US region (`https://api.mailgun.net` vs `https://api.eu.mailgun.net`).
    #[serde(default)]
    pub region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SesConfig {
    pub region: String,
    pub access_key_id: String,
    pub secret_access_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PostmarkConfig {
    pub server_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct BrevoConfig {
    pub api_key: String,
}
