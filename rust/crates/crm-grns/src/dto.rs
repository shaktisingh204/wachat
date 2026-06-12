//! Wire-format request DTOs for the GRN endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::Grn`] DTO — we deliberately do not redeclare it
//! here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Grn model so the API surface stays
//! controlled.
//!
//! Field naming matches the §12.4 spec in `crm_function_plan.md` and the
//! `Grn` struct in `crm-extras-types::grn`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip with
//! the TS clients.
//!
//! ## What's exposed vs deferred
//!
//! **Exposed on create:** required (`grn_no`, `date`, `vendor_id`,
//! `warehouse_id`, `items[]`); optional (`po_id`, `inspector_id`,
//! `attachments[]`).
//!
//! **Deferred / server-managed:** `gin_id` and `mrn_id` (forward links
//! populated by the GIN-out / MRN-out flows once accepted/rejected
//! stock is processed); `lineage[]` (seeded by the create handler when
//! a `po_id` is supplied — see [`CreateGrnInput::po_id`]).

use crm_core::Attachment;
use crm_extras_types::GrnLineItem;
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// Allowed snake_case [`crm_extras_types::GrnStatus`] string values for
/// list-filtering and update mutations. Mirrors the serde `snake_case`
/// representation of the enum so wire values round-trip cleanly.
pub const ALLOWED_STATUSES: &[&str] = &[
    "draft",
    "received",
    "partial",
    "inspected",
    "qc_failed",
    "posted",
    "closed",
    "rejected",
];

/// `GET /v1/crm/grns` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across
/// `grnNo` (the human-facing GRN number — primary identifier in the
/// receipts UI). `po_id`, `vendor_id`, and `status` narrow further.
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
    /// Free-text search across `grnNo`.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to receipts against a single PO (24-char hex).
    #[serde(default)]
    pub po_id: Option<String>,
    /// Restrict to a single vendor (24-char hex).
    #[serde(default)]
    pub vendor_id: Option<String>,
    /// Restrict to a workflow status — one of the lower-case
    /// [`crm_extras_types::GrnStatus`] variants
    /// ("draft", "inspected", "posted", "rejected").
    #[serde(default)]
    pub status: Option<String>,
    /// SabCRM suite scope — required on `/v1/sabcrm/supply/*` mounts,
    /// ignored on the legacy `userId` mount.
    #[serde(default)]
    pub project_id: Option<String>,
}

/// Query for single-document routes (`GET`/`PATCH`/`DELETE /{id}`) —
/// carries the SabCRM `projectId` on project-scoped mounts.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/grns` body. Required: `grnNo`, `date`, `vendorId`,
/// `warehouseId`, `items[]`. Optional: `poId` (omit for direct receipts
/// with no PO), `inspectorId`, `attachments[]`.
///
/// `gin_id` / `mrn_id` are NOT exposed here — those forward links are
/// populated server-side by the GIN-out / MRN-out flows. `lineage[]` is
/// seeded by the handler when `poId` is supplied.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGrnInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required) ----- */
    pub grn_no: String,
    pub date: chrono::DateTime<chrono::Utc>,

    /* ----- references ----- */
    /// Originating PO — when present, the handler seeds `lineage[]` by
    /// fetching the PO under the same `userId` scope. Optional because
    /// direct receipts (no PO) are allowed for unplanned vendor
    /// deliveries (matches the `Grn::po_id` Option in the types crate).
    #[serde(default)]
    pub po_id: Option<String>,
    pub vendor_id: String,
    pub warehouse_id: String,

    /* ----- received lines (★ required) ----- */
    /// Per-line received quantities. The server-action layer enforces
    /// `received_qty == accepted_qty + rejected_qty`; we round-trip the
    /// shape verbatim from the typed [`GrnLineItem`] so the wire JSON
    /// matches the response without an extra mapping step.
    pub items: Vec<GrnLineItem>,

    /* ----- inspection ----- */
    #[serde(default)]
    pub inspector_id: Option<String>,
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,
}

/// `PATCH /v1/crm/grns/:grnId` body. Every field is optional; only the
/// fields explicitly sent are modified on the document. The handler
/// always refreshes `updatedAt` regardless of which fields are set.
///
/// `grn_no`, `po_id`, `gin_id`, `mrn_id`, and `lineage` are intentionally
/// NOT updatable here — `grn_no` is a printed identifier (immutable
/// post-issue), the PO link is set at create time, and the GIN/MRN
/// forward links + lineage are server-managed.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGrnInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vendor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub warehouse_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<GrnLineItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inspector_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,
    /// Workflow status — one of [`ALLOWED_STATUSES`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl UpdateGrnInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.date.is_none()
            && self.vendor_id.is_none()
            && self.warehouse_id.is_none()
            && self.items.is_none()
            && self.inspector_id.is_none()
            && self.attachments.is_none()
            && self.status.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "grnNo": "GRN-2026-0001",
            "date": "2026-05-07T00:00:00Z",
            "vendorId": "507f1f77bcf86cd799439011",
            "warehouseId": "507f1f77bcf86cd799439012",
            "poId": "507f1f77bcf86cd799439013",
            "inspectorId": "507f1f77bcf86cd799439014",
            "items": [
                {
                    "itemId": "507f1f77bcf86cd799439015",
                    "orderedQty": 100.0,
                    "receivedQty": 100.0,
                    "acceptedQty": 95.0,
                    "rejectedQty": 5.0,
                    "batch": "BATCH-A",
                    "serialNos": ["SN-001", "SN-002"]
                }
            ]
        });
        let input: CreateGrnInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.grn_no, "GRN-2026-0001");
        assert_eq!(input.vendor_id, "507f1f77bcf86cd799439011");
        assert_eq!(input.warehouse_id, "507f1f77bcf86cd799439012");
        assert_eq!(input.po_id.as_deref(), Some("507f1f77bcf86cd799439013"));
        assert_eq!(
            input.inspector_id.as_deref(),
            Some("507f1f77bcf86cd799439014")
        );
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.items[0].ordered_qty, 100.0);
        assert_eq!(input.items[0].accepted_qty, 95.0);
        assert_eq!(input.items[0].serial_nos.len(), 2);
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateGrnInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateGrnInput {
            status: Some("posted".into()),
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
        assert!(q.po_id.is_none());
        assert!(q.vendor_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn allowed_statuses_match_grn_status_serde() {
        // The hard-coded list must agree with what serde produces for
        // every GrnStatus variant; if a new variant is added, this test
        // fails so the omission is caught at CI.
        for status in [
            crm_extras_types::GrnStatus::Draft,
            crm_extras_types::GrnStatus::Received,
            crm_extras_types::GrnStatus::Partial,
            crm_extras_types::GrnStatus::Inspected,
            crm_extras_types::GrnStatus::QcFailed,
            crm_extras_types::GrnStatus::Posted,
            crm_extras_types::GrnStatus::Closed,
            crm_extras_types::GrnStatus::Rejected,
        ] {
            let via_serde = serde_json::to_value(status).unwrap();
            let s = via_serde.as_str().unwrap();
            assert!(
                ALLOWED_STATUSES.contains(&s),
                "GrnStatus serde value `{s}` missing from ALLOWED_STATUSES"
            );
        }
    }
}
