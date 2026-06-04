//! Wire-format DTOs for the SabCRM settings HTTP surface.
//!
//! There is one document per project — `{ _id, projectId, data, updatedAt }` —
//! where `data` is a free-form key/value map. Responses always return just the
//! merged `data` map under a `{ data }` envelope.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use utoipa::ToSchema;

/// `GET /` query params — read the project's settings.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GetQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `PUT /` query params — the tenant scope for the upsert.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateQuery {
    /// Tenant scope — required (mirrors the body `projectId`).
    pub project_id: String,
}

/// `PUT /` body — merge these keys into the project's settings `data`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Free-form key/value patch; each key is `$set` onto `data`.
    #[schema(value_type = Object)]
    pub data: Map<String, Value>,
}

/// Response body for `GET /` and `PUT /` — the project's settings `data`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SettingsResponse {
    /// The free-form settings map (`{}` when the project has none yet).
    #[schema(value_type = Object)]
    pub data: Map<String, Value>,
}

// ===========================================================================
// Typed per-domain sections
// ===========================================================================
//
// Each section is stored under its own key inside the same per-project
// settings document (`data.<section>`), so the typed endpoints are wire-
// compatible with the free-form blob and with how the front-end
// `useSettingsSync` hook already namespaces slices by key (`general`,
// `appearance`, `notifications`, `localization`, `lab`, `security`).
//
// Every field is optional + `skip_serializing_if = None`, so a `PUT` only
// `$set`s the keys the caller actually sent — PATCH semantics, no clobbering
// of unrelated keys. Each struct carries a `validate()` that the handler runs
// before persisting, returning a human-readable message for `400`.

/// `?projectId=` query shared by every typed section endpoint.
pub use GetQuery as SectionQuery;

/// Hex-colour guard shared by a couple of sections (`#rgb` / `#rrggbb`).
fn is_hex_color(s: &str) -> bool {
    let body = s.strip_prefix('#').unwrap_or(s);
    (body.len() == 3 || body.len() == 6) && body.chars().all(|c| c.is_ascii_hexdigit())
}

/// **General** — workspace identity & defaults (`data.general`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct GeneralSettings {
    /// Workspace display name (1..=120 chars when present).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_name: Option<String>,
    /// Single-emoji / short icon hint for the workspace.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_emoji: Option<String>,
    /// Default record currency as a 3-letter ISO-4217 code (e.g. `USD`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_currency: Option<String>,
    /// Preferred date format token (e.g. `DD/MM/YYYY`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_format: Option<String>,
    /// IANA time-zone id (e.g. `Asia/Kolkata`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
    /// Default landing object slug for the workspace (e.g. `company`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_object: Option<String>,
}

impl GeneralSettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if let Some(name) = &self.workspace_name {
            let t = name.trim();
            if t.is_empty() {
                return Err("workspaceName cannot be empty.".to_owned());
            }
            if t.chars().count() > 120 {
                return Err("workspaceName must be 120 characters or fewer.".to_owned());
            }
        }
        if let Some(cur) = &self.default_currency {
            if !cur.is_empty()
                && (cur.len() != 3 || !cur.chars().all(|c| c.is_ascii_alphabetic()))
            {
                return Err("defaultCurrency must be a 3-letter ISO-4217 code.".to_owned());
            }
        }
        Ok(())
    }
}

/// **Appearance** — theme & display density (`data.appearance`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct AppearanceSettings {
    /// `light` | `dark` | `system`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    /// Accent colour as a hex string (`#rgb` / `#rrggbb`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accent_color: Option<String>,
    /// `comfortable` | `compact`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub density: Option<String>,
    /// UI language (BCP-47 tag) — the appearance-scoped copy the theme page
    /// edits alongside theme + density.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// Whether the navigation sidebar starts collapsed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sidebar_collapsed: Option<bool>,
}

impl AppearanceSettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if let Some(t) = &self.theme {
            if !matches!(t.as_str(), "light" | "dark" | "system") {
                return Err("theme must be one of: light, dark, system.".to_owned());
            }
        }
        if let Some(c) = &self.accent_color {
            if !c.is_empty() && !is_hex_color(c) {
                return Err("accentColor must be a hex colour (#rgb or #rrggbb).".to_owned());
            }
        }
        if let Some(d) = &self.density {
            if !matches!(d.as_str(), "comfortable" | "compact") {
                return Err("density must be one of: comfortable, compact.".to_owned());
            }
        }
        if let Some(l) = &self.language {
            if l.trim().is_empty() {
                return Err("language cannot be empty.".to_owned());
            }
        }
        Ok(())
    }
}

/// **Notifications** — master mute + per-event channel preferences
/// (`data.notifications`). Mirrors the front-end `NotifPrefs` shape:
/// `{ muteAll, events: { <eventKey>: { inApp, email, … } } }`.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct NotificationSettings {
    /// Master mute — silences every event regardless of per-event toggles.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mute_all: Option<bool>,
    /// Per-event channel-state map. Each value is a channel-state object
    /// (`{ inApp: bool, email: bool, … }`); stored as-is so the catalogue can
    /// evolve without a schema change.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub events: Option<Map<String, Value>>,
}

impl NotificationSettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if let Some(events) = &self.events {
            for (k, v) in events {
                if !v.is_object() {
                    return Err(format!(
                        "notification event '{k}' must be a channel-state object."
                    ));
                }
            }
        }
        Ok(())
    }
}

/// **Localization** — language, time-zone & formats (`data.localization`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct LocalizationSettings {
    /// BCP-47 language tag (e.g. `en`, `en-GB`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_zone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date_format: Option<String>,
    /// `12h` | `24h`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_format: Option<String>,
    /// 0 (Sunday) .. 6 (Saturday).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_day_of_week: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub number_format: Option<String>,
    /// ISO-4217 currency code (e.g. `USD`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

impl LocalizationSettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if let Some(f) = &self.time_format {
            if !matches!(f.as_str(), "12h" | "24h") {
                return Err("timeFormat must be one of: 12h, 24h.".to_owned());
            }
        }
        if let Some(d) = self.first_day_of_week {
            if d > 6 {
                return Err("firstDayOfWeek must be between 0 and 6.".to_owned());
            }
        }
        if let Some(cur) = &self.currency {
            if !cur.is_empty()
                && (cur.len() != 3 || !cur.chars().all(|c| c.is_ascii_alphabetic()))
            {
                return Err("currency must be a 3-letter ISO-4217 code.".to_owned());
            }
        }
        Ok(())
    }
}

/// **Lab** — experimental feature flags (`data.lab`). Free-form boolean map.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct LabSettings {
    /// `{ <flagKey>: bool }` — every value must be a boolean.
    #[schema(value_type = Object)]
    pub flags: Map<String, Value>,
}

impl LabSettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        for (k, v) in &self.flags {
            if !v.is_boolean() {
                return Err(format!("lab flag '{k}' must be a boolean."));
            }
        }
        Ok(())
    }
}

/// **Security** — workspace security *preferences* (`data.security`).
///
/// NOTE: this is preference metadata only (session policy hints, MFA opt-in,
/// IP allow-list) — it is NOT the auth engine. Enforcement lives in the
/// SabNode auth layer; these values are surfaced/edited from the CRM settings
/// UI and persisted alongside the rest of the workspace config.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct SecuritySettings {
    /// Idle session timeout in minutes (5 .. 43200 = 30 days).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_timeout_minutes: Option<u32>,
    /// Whether members are asked to enable two-factor auth.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub require_mfa: Option<bool>,
    /// Optional IP allow-list (CIDR / plain IPs, validated by the auth layer).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip_allowlist: Option<Vec<String>>,
    /// Optional approved sign-up email domains (e.g. `acme.com`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email_domains: Option<Vec<String>>,
}

impl SecuritySettings {
    pub fn validate(&self) -> std::result::Result<(), String> {
        if let Some(m) = self.session_timeout_minutes {
            if !(5..=43_200).contains(&m) {
                return Err(
                    "sessionTimeoutMinutes must be between 5 and 43200.".to_owned(),
                );
            }
        }
        if let Some(list) = &self.ip_allowlist {
            if list.len() > 256 {
                return Err("ipAllowlist cannot exceed 256 entries.".to_owned());
            }
            if list.iter().any(|e| e.trim().is_empty()) {
                return Err("ipAllowlist entries cannot be empty.".to_owned());
            }
        }
        if let Some(domains) = &self.email_domains {
            if domains.len() > 256 {
                return Err("emailDomains cannot exceed 256 entries.".to_owned());
            }
            if domains.iter().any(|d| d.trim().is_empty() || d.contains('@')) {
                return Err(
                    "emailDomains entries must be bare domains (no '@'), non-empty."
                        .to_owned(),
                );
            }
        }
        Ok(())
    }
}
