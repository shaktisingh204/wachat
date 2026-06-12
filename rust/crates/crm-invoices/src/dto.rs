//! Wire-format request DTOs for the invoice endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_sales_types::Invoice`] DTO — we deliberately do not redeclare
//! it here. The shapes below describe only what callers send IN
//! (create-input, update-input, list-query); they are intentionally
//! narrower than the full Invoice model so the API surface stays
//! controlled.
//!
//! Field naming matches the existing TS server action
//! `src/app/actions/crm-invoices.actions.ts` and the `Invoice` struct in
//! `crm_sales_types::invoice`. All structs use
//! `#[serde(rename_all = "camelCase")]` so JSON requests round-trip with
//! the TS clients.
//!
//! ## Curated subset
//!
//! Required: `invoice_no`, `client_id`, `currency`, `date`, `due_date`,
//! `items[]`, `totals`. Optional: `place_of_supply`, `gst_treatment`,
//! `tcs_pct`, `tds_pct`, `payment_terms`, `customer_notes`,
//! `terms_and_conditions`, `recurring`.
//!
//! Deferred (not user-editable on create/update; populated by domain
//! workflows): `e_invoice` envelope (IRP webhook seeds it post-issue),
//! `bank_details` (tenant default; injected at PDF render),
//! `whatsapp_send_log` (dispatch handlers append to it), `pdf_status` /
//! thumbnail / signature ids (render pipeline owns them), `amount_paid`
//! / `balance` (managed by `applyPaymentReceipt`). The `email_log` is
//! append-only via [`UpdateInvoiceInput::email_log_append`] — the
//! email-invoice flow records each send; the array can never be
//! replaced or truncated through the API.

use crm_core::Attachment;
use crm_sales_types::{DeliveryOutcome, GstTreatment, LineItem, RecurringConfig, Totals};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/invoices` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify an invoice at a glance:
/// `invoiceNo`, `customerNotes`, `paymentTerms`. The TS action filtered
/// only by month/year on `invoiceDate`; we add the substring search to
/// match the sibling `crm-leads` UX.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project` (the
    /// `/v1/sabcrm/finance/invoices` mount); ignored on the legacy
    /// `userId`-scoped `/v1/crm/invoices` mount.
    #[serde(default)]
    pub project_id: Option<String>,
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
    /// Optional client-id filter (24-char hex). Mirrors the TS
    /// `getUnpaidInvoicesByAccount` shortcut on the list surface.
    #[serde(default)]
    pub client_id: Option<String>,
    /// Optional status filter ("draft", "sent", "paid", …). Stringly
    /// typed on the wire to match the snake_case enum serde rep on the
    /// stored doc.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter on `date` month (1-12). Requires `year` to also be set;
    /// otherwise ignored. Matches the TS list filter shape.
    #[serde(default)]
    pub month: Option<u32>,
    /// Filter on `date` year (e.g. 2026). Required for `month` to take
    /// effect.
    #[serde(default)]
    pub year: Option<i32>,
}

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{invoiceId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

/// `POST /v1/crm/invoices` body — curated subset of the full
/// [`crm_sales_types::Invoice`] surface. Required identity / parties /
/// money fields plus optional doc-body and recurring config.
///
/// **Lineage:** the optional `from_kind` + `from_id` pair seeds the new
/// invoice's `lineage[]` via [`crm_core::build_lineage_from_parent`].
/// Allowed parent kinds: `quotation`, `salesOrder`, `proforma`, `deal`,
/// `lead` (mirrors the TS `ALLOWED_PARENT_KINDS` whitelist in
/// `saveInvoice`).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- doc number + dates (★ required) ----- */
    pub invoice_no: String,
    pub date: chrono::DateTime<chrono::Utc>,
    pub due_date: chrono::DateTime<chrono::Utc>,

    /* ----- parties (★ required) ----- */
    /// 24-char hex `ObjectId` of the buyer client / account.
    pub client_id: String,
    #[serde(default)]
    pub place_of_supply: Option<String>,
    /// GST treatment for the buyer. Defaults to `Registered` when
    /// absent (matches the §1.6 enum default).
    #[serde(default)]
    pub gst_treatment: Option<GstTreatment>,

    /* ----- money (★ required: currency) ----- */
    /// ISO-4217 code (e.g. "INR", "USD").
    pub currency: String,

    /* ----- line items + totals (★ required) ----- */
    pub items: Vec<LineItem>,
    pub totals: Totals,

    /* ----- TCS / TDS ----- */
    #[serde(default)]
    pub tcs_pct: Option<f32>,
    #[serde(default)]
    pub tds_pct: Option<f32>,

    /* ----- doc body ----- */
    #[serde(default)]
    pub payment_terms: Option<String>,
    #[serde(default)]
    pub customer_notes: Option<String>,
    #[serde(default)]
    pub terms_and_conditions: Option<String>,

    /* ----- attachments (SabFiles pointers; §crm-core policy) ----- */
    /// Optional SabFiles attachments captured at create time. Each entry
    /// is a `crm_core::Attachment` (`fileId` + cached name/mime/size).
    /// Absent ⇒ the document starts with no attachments (unchanged
    /// legacy behaviour).
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,

    /* ----- recurring config ----- */
    #[serde(default)]
    pub recurring: Option<RecurringConfig>,

    /* ----- §13.5 lineage seeding ----- */
    /// Allowed values: `"quotation"`, `"salesOrder"`, `"proforma"`,
    /// `"deal"`, `"lead"`. Anything else is ignored. Matches the TS
    /// `ALLOWED_PARENT_KINDS` whitelist.
    #[serde(default)]
    pub from_kind: Option<String>,
    /// 24-char hex of the parent record.
    #[serde(default)]
    pub from_id: Option<String>,

    /* ----- design ----- */
    #[serde(default)]
    pub design_metadata: Option<serde_json::Value>,
}

/// One email-send audit entry on the PATCH wire. Mirrors
/// [`crm_sales_types::EmailLog`] but takes `sent_at` as a plain RFC3339
/// instant (the canonical struct's BSON-datetime serde helper can't
/// deserialize JSON request bodies); the handler converts it to the
/// stored `EmailLog` shape before `$push`-ing.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailLogEntryInput {
    /// When the email went out (RFC3339).
    pub sent_at: chrono::DateTime<chrono::Utc>,
    /// Recipient address.
    pub to: String,
    /// Transport outcome: `queued` / `sent` / `delivered` / `failed` /
    /// `bounced`.
    pub status: DeliveryOutcome,
    /// Provider message id (SES, Resend, …) for cross-referencing.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_message_id: Option<String>,
    /// Failure detail — only meaningful for `failed` / `bounced`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// `PATCH /v1/crm/invoices/:invoiceId` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set.
///
/// `items` and `totals` re-write the full arrays/document atomically
/// when sent — partial line-item edits go through dedicated endpoints
/// (not modeled here) so the totals stay consistent.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInvoiceInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invoice_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gst_treatment: Option<GstTreatment>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<LineItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub totals: Option<Totals>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tcs_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tds_pct: Option<f32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_notes: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub terms_and_conditions: Option<String>,

    /// Full replacement of the attachments array (SabFiles pointers).
    /// Like `items`, the array is re-written atomically when sent.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,

    /// Cumulative amount received against this invoice. Sent by the
    /// payment-recording flow (which also creates the matching payment
    /// receipt). When set — or when `totals` changes — the handler
    /// re-derives the denormalized `balance` as
    /// `totals.total - amount_paid`. Must be finite and ≥ 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_paid: Option<f64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<RecurringConfig>,

    /// Append-only email-send audit entries. `$push`-ed onto the
    /// document's `emailLog` (never replaces existing entries) so
    /// concurrent sends can't clobber each other. Sent by the
    /// email-invoice flow after a successful dispatch.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email_log_append: Option<Vec<EmailLogEntryInput>>,

    /// Workflow status string (e.g. `"draft"`, `"sent"`, `"paid"`,
    /// `"partially_paid"`, `"overdue"`, `"cancelled"`). Validated in the
    /// handler against [`crm_sales_types::InvoiceStatus`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub design_metadata: Option<serde_json::Value>,
}

impl UpdateInvoiceInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.invoice_no.is_none()
            && self.date.is_none()
            && self.due_date.is_none()
            && self.client_id.is_none()
            && self.place_of_supply.is_none()
            && self.gst_treatment.is_none()
            && self.currency.is_none()
            && self.items.is_none()
            && self.totals.is_none()
            && self.tcs_pct.is_none()
            && self.tds_pct.is_none()
            && self.payment_terms.is_none()
            && self.customer_notes.is_none()
            && self.terms_and_conditions.is_none()
            && self.attachments.is_none()
            && self.amount_paid.is_none()
            && self.recurring.is_none()
            && self.email_log_append.is_none()
            && self.status.is_none()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_input_round_trips_camel_case() {
        let json = serde_json::json!({
            "invoiceNo": "INV-2026-0001",
            "clientId": "65f00000000000000000abcd",
            "currency": "INR",
            "date": "2026-05-07T00:00:00Z",
            "dueDate": "2026-06-06T00:00:00Z",
            "placeOfSupply": "29-Karnataka",
            "gstTreatment": "registered",
            "items": [{
                "qty": 2.0,
                "rate": 500.0,
                "total": 1000.0,
            }],
            "totals": { "subTotal": 1000.0, "total": 1000.0 },
            "tcsPct": 0.1,
            "tdsPct": 2.0,
            "paymentTerms": "Net 30",
            "customerNotes": "Thanks for your business.",
            "termsAndConditions": "Late fee 1.5%/mo.",
            "fromKind": "quotation",
            "fromId": "65f00000000000000000beef",
        });
        let input: CreateInvoiceInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.invoice_no, "INV-2026-0001");
        assert_eq!(input.client_id, "65f00000000000000000abcd");
        assert_eq!(input.currency, "INR");
        assert_eq!(input.place_of_supply.as_deref(), Some("29-Karnataka"));
        assert!(matches!(
            input.gst_treatment,
            Some(GstTreatment::Registered)
        ));
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.totals.total, 1000.0);
        assert_eq!(input.tcs_pct, Some(0.1));
        assert_eq!(input.tds_pct, Some(2.0));
        assert_eq!(input.payment_terms.as_deref(), Some("Net 30"));
        assert_eq!(input.from_kind.as_deref(), Some("quotation"));
    }

    #[test]
    fn create_input_round_trips_attachments() {
        let json = serde_json::json!({
            "invoiceNo": "INV-2026-0002",
            "clientId": "65f00000000000000000abcd",
            "currency": "INR",
            "date": "2026-06-12T00:00:00Z",
            "dueDate": "2026-07-12T00:00:00Z",
            "items": [{ "qty": 1.0, "rate": 100.0, "total": 100.0 }],
            "totals": { "subTotal": 100.0, "total": 100.0 },
            "attachments": [{
                "fileId": "65f00000000000000000cafe",
                "name": "po-scan.pdf",
                "mimeType": "application/pdf",
                "size": 1024,
            }],
        });
        let input: CreateInvoiceInput = serde_json::from_value(json).unwrap();
        let atts = input.attachments.expect("attachments parsed");
        assert_eq!(atts.len(), 1);
        assert_eq!(atts[0].file_id.to_hex(), "65f00000000000000000cafe");
        assert_eq!(atts[0].name.as_deref(), Some("po-scan.pdf"));
        assert_eq!(atts[0].mime_type.as_deref(), Some("application/pdf"));
        assert_eq!(atts[0].size, Some(1024));

        // Absent ⇒ None (legacy bodies stay valid).
        let bare: CreateInvoiceInput = serde_json::from_value(serde_json::json!({
            "invoiceNo": "INV-2026-0003",
            "clientId": "65f00000000000000000abcd",
            "currency": "INR",
            "date": "2026-06-12T00:00:00Z",
            "dueDate": "2026-07-12T00:00:00Z",
            "items": [{ "qty": 1.0, "rate": 100.0, "total": 100.0 }],
            "totals": { "subTotal": 100.0, "total": 100.0 },
        }))
        .unwrap();
        assert!(bare.attachments.is_none());
    }

    #[test]
    fn update_input_round_trips_amount_paid_and_attachments() {
        let json = serde_json::json!({
            "amountPaid": 450.5,
            "attachments": [{ "fileId": "65f00000000000000000cafe" }],
        });
        let input: UpdateInvoiceInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.amount_paid, Some(450.5));
        assert_eq!(input.attachments.as_ref().map(Vec::len), Some(1));
        assert!(!input.is_empty());

        // amountPaid alone is a valid (non-empty) patch.
        let paid_only = UpdateInvoiceInput {
            amount_paid: Some(0.0),
            ..Default::default()
        };
        assert!(!paid_only.is_empty());

        // attachments alone is a valid (non-empty) patch — including the
        // clear-all `[]` form.
        let atts_only = UpdateInvoiceInput {
            attachments: Some(Vec::new()),
            ..Default::default()
        };
        assert!(!atts_only.is_empty());
    }

    #[test]
    fn update_input_round_trips_email_log_append() {
        let json = serde_json::json!({
            "emailLogAppend": [{
                "sentAt": "2026-06-12T10:30:00Z",
                "to": "buyer@example.com",
                "status": "sent",
                "providerMessageId": "ses-abc-123",
            }],
        });
        let input: UpdateInvoiceInput = serde_json::from_value(json).unwrap();
        let entries = input.email_log_append.as_ref().expect("entries parsed");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].to, "buyer@example.com");
        assert!(matches!(entries[0].status, DeliveryOutcome::Sent));
        assert_eq!(
            entries[0].provider_message_id.as_deref(),
            Some("ses-abc-123")
        );
        assert!(entries[0].error.is_none());
        // emailLogAppend alone is a valid (non-empty) patch.
        assert!(!input.is_empty());
    }

    #[test]
    fn email_log_entry_rejects_unknown_status() {
        let json = serde_json::json!({
            "sentAt": "2026-06-12T10:30:00Z",
            "to": "buyer@example.com",
            "status": "exploded",
        });
        assert!(serde_json::from_value::<EmailLogEntryInput>(json).is_err());
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateInvoiceInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateInvoiceInput {
            status: Some("paid".into()),
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
        assert!(q.client_id.is_none());
        assert!(q.status.is_none());
        assert!(q.month.is_none());
        assert!(q.year.is_none());
    }

    #[test]
    fn list_query_round_trips_filters() {
        let json = serde_json::json!({
            "page": 2,
            "limit": 50,
            "q": "INV-2026",
            "clientId": "65f00000000000000000abcd",
            "status": "sent",
            "month": 5,
            "year": 2026,
        });
        let q: ListQuery = serde_json::from_value(json).unwrap();
        assert_eq!(q.page, Some(2));
        assert_eq!(q.limit, Some(50));
        assert_eq!(q.q.as_deref(), Some("INV-2026"));
        assert_eq!(q.status.as_deref(), Some("sent"));
        assert_eq!(q.month, Some(5));
        assert_eq!(q.year, Some(2026));
    }
}
