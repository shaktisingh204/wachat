//! Wire-format request DTOs for the lead endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_crm_types::Lead`] DTO — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Lead model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-leads.actions.ts` and the `Lead` struct in
//! `crm-sales-crm-types::lead`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/leads` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a lead at a glance: `firstName`,
/// `lastName`, `email`, `company`, and `title`. The TS action used
/// `title` + `contactName` + `email` + `company`; we expand to
/// `firstName`/`lastName` because the Rust [`Lead`] struct splits
/// `contactName` into the two columns (see `lead.rs` lines 81-83).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page (matches TS). Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search.
    #[serde(default)]
    pub q: Option<String>,
}

/// `POST /v1/crm/leads` body. The endpoint accepts a curated subset of
/// the full [`crm_sales_crm_types::Lead`] fields — enough to drive the
/// existing "Add Lead" UI without exposing the heavy attribution / UTM
/// / activity-log surface. Those are populated by domain workflows
/// (capture forms, ad pixel webhooks) rather than direct user entry.
///
/// **Exposed:** identity (firstName, lastName, optional projectId),
/// contact (email, phone, company, title), workflow (status, source,
/// subSource, leadScore, ownerId, assignedTo), money
/// (estimatedValue, currency, probabilityPct, expectedClose),
/// profile (industry), bag (description / notes are not modeled
/// here — use the Note endpoints instead).
///
/// **Deferred:** UTM tracking, referrerId, campaignId, attachments,
/// custom_fields, tags, address (the §5.1 spec exposes them but the TS
/// action never accepted them on create either; they get patched in via
/// dedicated downstream endpoints once those land).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeadInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- name (★ required) ----- */
    pub first_name: String,
    pub last_name: String,

    /* ----- contact ----- */
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub company: Option<String>,
    #[serde(default)]
    pub title: Option<String>,

    /* ----- workflow ----- */
    /// First-party source — "Website", "Referral", "Cold Call", … Stored
    /// on `attribution.source` to keep parity with the §0 fragment.
    #[serde(default)]
    pub source: Option<String>,
    /// Sub-classification under `source` (e.g. source = "Referral",
    /// subSource = "Existing Customer"). Not modeled by `Attribution`
    /// so it lives on `Lead` directly (see `lead.rs` lines 95-100).
    #[serde(default)]
    pub sub_source: Option<String>,
    /// Tenant-configurable status string ("new", "qualified",
    /// "converted", …). Not validated here — the action layer is the
    /// source of truth for legal transitions.
    #[serde(default)]
    pub status: Option<String>,
    /// 0-100 score (signed so disqualifying rules can drive negative).
    #[serde(default)]
    pub lead_score: Option<i32>,
    /// Lead owner (24-char hex). Distinct from `assignedTo` — owner =
    /// SDR who logged the lead, assignedTo = AE the lead was routed to.
    #[serde(default)]
    pub owner_id: Option<String>,
    /// Pipeline-side owner (24-char hex). Stored on the flattened
    /// `Assignment.assigned_to`.
    #[serde(default)]
    pub assigned_to: Option<String>,

    /* ----- money ----- */
    #[serde(default)]
    pub estimated_value: Option<f64>,
    /// ISO-4217 code. Defaults to `"INR"` if absent (matches the TS
    /// behaviour at `crm-leads.actions.ts:113`).
    #[serde(default)]
    pub currency: Option<String>,
    /// Win probability as a 0-100 percentage.
    #[serde(default)]
    pub probability_pct: Option<f32>,
    /// ISO-8601 datetime. Parsed by serde via the `chrono` feature.
    #[serde(default)]
    pub expected_close: Option<chrono::DateTime<chrono::Utc>>,

    /* ----- profile ----- */
    #[serde(default)]
    pub industry: Option<String>,

    /* ----- forward-compat lineage hooks ----- */
    /// Logical kind of a parent record this lead was created FROM
    /// ("contact", "form", …). Not yet persisted — see the comment in
    /// [`crate::handlers::create_lead`] for why.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record. Not yet persisted.
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/leads/:leadId` body. Every field is optional; only
/// the fields explicitly sent are modified on the document. The handler
/// always refreshes `updatedAt` regardless of which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeadInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_score: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub probability_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_close: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
}

impl UpdateLeadInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.first_name.is_none()
            && self.last_name.is_none()
            && self.email.is_none()
            && self.phone.is_none()
            && self.company.is_none()
            && self.title.is_none()
            && self.source.is_none()
            && self.sub_source.is_none()
            && self.status.is_none()
            && self.lead_score.is_none()
            && self.owner_id.is_none()
            && self.assigned_to.is_none()
            && self.estimated_value.is_none()
            && self.currency.is_none()
            && self.probability_pct.is_none()
            && self.expected_close.is_none()
            && self.industry.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "firstName": "Asha",
            "lastName": "Iyer",
            "email": "asha@acme.example",
            "subSource": "Existing Customer",
            "leadScore": 72,
            "estimatedValue": 125000.0,
            "probabilityPct": 40.0,
        });
        let input: CreateLeadInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.first_name, "Asha");
        assert_eq!(input.last_name, "Iyer");
        assert_eq!(input.email.as_deref(), Some("asha@acme.example"));
        assert_eq!(input.sub_source.as_deref(), Some("Existing Customer"));
        assert_eq!(input.lead_score, Some(72));
        assert_eq!(input.estimated_value, Some(125_000.0));
        assert_eq!(input.probability_pct, Some(40.0));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateLeadInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateLeadInput {
            status: Some("qualified".into()),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
    }
}
