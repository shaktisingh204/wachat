//! Wire-format request DTOs for the RFQ endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::Rfq`] DTO — we deliberately do not redeclare it
//! here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Rfq model so the API surface stays
//! controlled.
//!
//! Field naming matches the canonical `Rfq` struct in
//! `crm-extras-types::rfq`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip
//! with the TS clients.

use chrono::{DateTime, Utc};
use crm_core::Attachment;
use crm_extras_types::RfqLineItem;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/rfqs` query string.
///
/// `q` is a free-text substring searched (case-insensitive) on `title`
/// and `terms`. `status` narrows by RFQ workflow status (`draft`,
/// `open`, `closed`, `awarded`, `cancelled`).
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
    /// Restrict by workflow status (`draft`, `open`, `closed`, `awarded`,
    /// `cancelled`).
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /v1/crm/rfqs` body. The endpoint accepts a curated subset of
/// the full [`crm_extras_types::Rfq`] fields — enough to drive the
/// "Create RFQ" UI without exposing the heavy lineage / audit surface.
///
/// **Exposed:** identity (optional `projectId`), header (`title`,
/// `requiredBy`), `items[]` (full `RfqLineItem` round-trip),
/// `vendorsInvited[]` (hex-encoded `ObjectId`s), free-form `terms`,
/// `deadline`, `attachments[]` (SabFile pointers), and the lineage
/// hooks (`fromKind` + `fromId`).
///
/// **Deferred:** `status` / `lineage[]` are server-controlled state and
/// patched via dedicated workflows.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRfqInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- header (★ required) ----- */
    /// Short headline visible to invited vendors.
    pub title: String,
    /// At least one line item is required — an empty RFQ would not give
    /// vendors anything to bid against.
    #[serde(default)]
    pub items: Vec<RfqLineItem>,

    /* ----- header (optional) ----- */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub required_by: Option<DateTime<Utc>>,
    /// Hex-encoded `ObjectId`s of `crm_vendors` rows broadcast on issue.
    #[serde(default)]
    pub vendors_invited: Vec<String>,
    #[serde(default)]
    pub terms: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub deadline: Option<DateTime<Utc>>,

    /* ----- attachments ----- */
    /// SabFile references — adheres to the project-wide "every file
    /// lives in SabFiles" policy (no raw URLs).
    #[serde(default)]
    pub attachments: Vec<Attachment>,

    /* ----- lineage hooks ----- */
    /// Logical kind of a parent record this RFQ was created FROM
    /// (`"lead"` or `"deal"`). When paired with `fromId`, the handler
    /// seeds `lineage[]` via [`crm_core::build_lineage_from_parent`] and
    /// pushes a best-effort back-link onto the parent's `lineage[]`.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record. See [`Self::from_kind`].
    #[serde(default)]
    pub from_id: Option<String>,
}

/// `PATCH /v1/crm/rfqs/:rfqId` body. Every field is optional; only the
/// fields explicitly sent are modified on the document. The handler
/// always refreshes `updatedAt` regardless of which fields are set.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRfqInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// Replace the entire `items[]` array. Sending an empty array is
    /// rejected (an RFQ with no lines doesn't make sense).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<RfqLineItem>>,

    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub required_by: Option<DateTime<Utc>>,

    /// Replace the entire `vendorsInvited[]` array (hex-encoded ids).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendors_invited: Option<Vec<String>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms: Option<String>,

    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub deadline: Option<DateTime<Utc>>,

    /// Workflow status — one of `draft` / `open` / `closed` / `awarded`
    /// / `cancelled`. Validated by the handler.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    /// Replace the entire `attachments[]` array.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
}

impl UpdateRfqInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.title.is_none()
            && self.items.is_none()
            && self.required_by.is_none()
            && self.vendors_invited.is_none()
            && self.terms.is_none()
            && self.deadline.is_none()
            && self.status.is_none()
            && self.attachments.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "title": "Q3 stationery sourcing",
            "items": [
                {
                    "itemId": "507f1f77bcf86cd799439033",
                    "qty": 100.0,
                    "unit": "box",
                    "specs": "FSC certified",
                }
            ],
            "requiredBy": "2026-06-01T00:00:00Z",
            "vendorsInvited": [
                "507f1f77bcf86cd799439011",
                "507f1f77bcf86cd799439022",
            ],
            "terms": "Net-30, FOB warehouse",
            "deadline": "2026-05-25T00:00:00Z",
            "fromKind": "deal",
            "fromId": "507f1f77bcf86cd799439044",
        });
        let input: CreateRfqInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.title, "Q3 stationery sourcing");
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.items[0].qty, 100.0);
        assert_eq!(input.vendors_invited.len(), 2);
        assert_eq!(input.terms.as_deref(), Some("Net-30, FOB warehouse"));
        assert!(input.deadline.is_some());
        assert_eq!(input.from_kind.as_deref(), Some("deal"));
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateRfqInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateRfqInput {
            status: Some("open".into()),
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
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_parses_status() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({ "status": "open" })).unwrap();
        assert_eq!(q.status.as_deref(), Some("open"));
    }
}
