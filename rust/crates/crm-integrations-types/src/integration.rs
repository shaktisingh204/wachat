//! §8 Integrations — third-party connector configuration.
//!
//! Mongo collection: `crm_integrations`. One document per (project, provider)
//! tuple represents the user's connection to an external system. The struct
//! flattens the `crm-core` `Identity` and `Audit` fragments so the document
//! root carries §0 ownership / audit fields directly.
//!
//! Secret material (API keys, OAuth tokens, basic-auth passwords) is **not**
//! stored inline; instead the credential variants hold `*_ref` strings that
//! resolve into the project's secrets manager. This keeps the Mongo doc
//! safe to log / dump / replicate without leaking credentials.

use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[cfg(test)]
use bson::oid::ObjectId;

/// Catalogue of supported third-party providers. Adding a new connector
/// is a one-line append here plus the matching settings shape on the
/// caller side (kept opaque in `Integration::settings`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntegrationProvider {
    // --- Accounting / books ---------------------------------------
    Tally,
    ZohoBooks,
    QuickBooks,
    // --- Payment gateways -----------------------------------------
    Razorpay,
    Stripe,
    PayU,
    Paytm,
    Cashfree,
    // --- Logistics ------------------------------------------------
    Shiprocket,
    Delhivery,
    // --- Indian compliance ----------------------------------------
    Gstn,
    EInvoice,
    EWayBill,
    // --- Calendar / mail ------------------------------------------
    GoogleCalendar,
    Outlook,
    Gmail,
    // --- Messaging ------------------------------------------------
    Slack,
    Telegram,
    WhatsAppCloud,
    Twilio,
    // --- Generic automation ---------------------------------------
    Webhook,
    Zapier,
    MakeCom,
}

/// Live state of the connection. `Connected` means credentials were
/// last validated successfully; `Error` means the most recent sync /
/// auth attempt failed and `last_error` carries the reason; `Disabled`
/// is a user-flagged pause (credentials may still be valid).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IntegrationStatus {
    #[default]
    Disconnected,
    Connected,
    Error,
    Disabled,
}

/// Tagged-union of credential shapes. The `kind` discriminator lets
/// the persisted document remain self-describing even as new auth
/// styles are added. All secret values are stored by reference into
/// the secrets manager — the Mongo doc never carries plaintext.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum IntegrationCredentials {
    /// No auth required (e.g. inbound webhook receivers configured purely
    /// by URL secret, or a stub draft entry).
    None,

    /// Static API key style (Razorpay, Stripe-secret-key style, Tally
    /// auth-token, etc.). `key_ref` resolves into the secrets manager.
    ApiKey { key_ref: String },

    /// OAuth2 authorization code / refresh-token flow (Google, Outlook,
    /// Slack, Zoho Books, QuickBooks). Both token refs resolve into the
    /// secrets manager; `expires_at` is the cached access-token expiry
    /// so the worker knows when to refresh proactively.
    OAuth2 {
        access_token_ref: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        refresh_token_ref: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expires_at: Option<DateTime<Utc>>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        scope: Option<String>,
    },

    /// HTTP Basic auth (some on-prem Tally connectors, legacy webhook
    /// receivers). Username is plaintext, password is by reference.
    BasicAuth {
        username: String,
        password_ref: String,
    },

    /// Provider-specific catch-all. Use for connectors that need a small
    /// handful of named secrets (e.g. Twilio's `account_sid` + `auth_token`,
    /// or GSTN's GSP-issued client_id + client_secret + sandbox_url). Each
    /// value should be a `*_ref` into the secrets manager — never plaintext.
    Custom { params: BTreeMap<String, String> },
}

/// One configured third-party integration for a (project, user) tenant.
///
/// `settings` is an opaque JSON bag because each provider has its own
/// configuration shape (Stripe wants account id + webhook secret;
/// Shiprocket wants pickup pincode + warehouse id; GSTN wants GSTIN +
/// place-of-business). Keeping it as `serde_json::Value` lets each
/// connector evolve independently without churning this DTO.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Integration {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- connector identity ------------------------------------ */
    pub provider: IntegrationProvider,
    /// Optional user-facing nickname — useful when a project has two
    /// connections of the same kind (e.g. live + sandbox Stripe).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,

    /* ----- live state ------------------------------------------- */
    #[serde(default)]
    pub status: IntegrationStatus,
    pub credentials: IntegrationCredentials,
    /// Provider-specific opaque configuration bag (see struct doc).
    #[serde(default)]
    pub settings: serde_json::Value,

    /* ----- runtime metadata ------------------------------------- */
    /// Inbound webhook URL the project advertises to the provider
    /// (signed receiver URL). `None` until the integration provisions
    /// its receiver.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webhook_url: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_sync_at: Option<DateTime<Utc>>,
    /// Most-recent error message (auth failure, 4xx from provider, etc.).
    /// Cleared on the next successful sync.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn sample_audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments_and_oauth2() {
        let expires = Utc::now();
        let integration = Integration {
            identity: sample_identity(),
            audit: sample_audit(),
            provider: IntegrationProvider::GoogleCalendar,
            label: Some("Primary Google Calendar".to_string()),
            status: IntegrationStatus::Connected,
            credentials: IntegrationCredentials::OAuth2 {
                access_token_ref: "secret://google/access/abc".to_string(),
                refresh_token_ref: Some("secret://google/refresh/abc".to_string()),
                expires_at: Some(expires),
                scope: Some("https://www.googleapis.com/auth/calendar".to_string()),
            },
            settings: serde_json::json!({ "calendarId": "primary" }),
            webhook_url: None,
            last_sync_at: None,
            last_error: None,
        };

        let json = serde_json::to_value(&integration).unwrap();

        // Flattened fragments live at the document root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // Nested fragment names must NOT exist as keys.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // camelCase and enum casing.
        assert_eq!(
            json.get("provider").and_then(|v| v.as_str()),
            Some("google_calendar")
        );
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("connected")
        );

        // Tagged credential shape. Variant tag uses enum-level
        // snake_case ("o_auth2"); inner fields keep Rust's default
        // (snake_case identifiers serialize verbatim) since no inner
        // rename_all is set on the variant.
        let creds = json.get("credentials").expect("credentials key");
        assert_eq!(creds.get("kind").and_then(|v| v.as_str()), Some("o_auth2"));
        assert!(creds.get("access_token_ref").is_some());
        assert!(creds.get("refresh_token_ref").is_some());
        assert!(creds.get("expires_at").is_some());

        // Round-trip back into Rust.
        let decoded: Integration = serde_json::from_value(json).unwrap();
        assert_eq!(decoded.provider, IntegrationProvider::GoogleCalendar);
        assert_eq!(decoded.status, IntegrationStatus::Connected);
        match decoded.credentials {
            IntegrationCredentials::OAuth2 {
                access_token_ref,
                refresh_token_ref,
                scope,
                ..
            } => {
                assert_eq!(access_token_ref, "secret://google/access/abc");
                assert_eq!(
                    refresh_token_ref.as_deref(),
                    Some("secret://google/refresh/abc")
                );
                assert_eq!(
                    scope.as_deref(),
                    Some("https://www.googleapis.com/auth/calendar")
                );
            }
            other => panic!("expected OAuth2 variant, got {other:?}"),
        }
    }
}
