//! # crm-sales-types
//!
//! Domain DTOs for the CRM Sales module (`crm_function_plan.md` §1).
//! Each entity flattens the cross-cutting fragments from `crm-core` (§0)
//! and adds its own entity-specific fields.
//!
//! ## Scope
//!
//! Sales-only. Purchases / inventory / accounting / sales-CRM (leads,
//! deals, tasks) live in their own crates. Adding a §1 entity here is
//! the right home; adding anything else is a layering violation.
//!
//! ## Modules
//! - [`address`] — postal-address shape shared by every doc
//! - [`client`] — §1.1 Clients & Prospects
//! - [`quotation`] — §1.2 Quotations / Estimates
//! - [`proforma`] — §1.3 Proforma Invoices
//! - [`sales_order`] — §1.4 Sales Orders
//! - [`delivery_challan`] — §1.5 Delivery Challans
//! - [`line_item`] — shared `LineItem` + `Totals` (used by §1.2 / §1.3 /
//!   §1.4 and the not-yet-ported §1.6 Invoice)
//! - [`comm_log`] — `EmailLog`, `WhatsAppSendLog`, `PdfStatus`
//!   attachable to outbound docs
//!
//! Subsequent runs will add §1.6 Invoices, §1.7 Payment Receipts, §1.8
//! Credit Notes, §1.9 Pipelines / Forms / Analytics shapes.
//!
//! ## Conventions
//!
//! - All structs derive `Serialize + Deserialize` with
//!   `rename_all = "camelCase"` so they round-trip with TS document
//!   shapes in `src/lib/definitions.ts`.
//! - Money fields are `f64` to match the TS `Number` JSON shape; a
//!   future migration to `rust_decimal` can happen once the wider port
//!   stabilizes.
//! - Identity / audit / lifecycle / assignment / attribution / tags /
//!   notes / attachments / custom-fields / lineage are NEVER redefined
//!   here — always flatten the corresponding `crm-core` struct.

pub mod address;
pub mod client;
pub mod comm_log;
pub mod credit_note;
pub mod delivery_challan;
pub mod invoice;
pub mod line_item;
pub mod payment_receipt;
pub mod pipeline;
pub mod proforma;
pub mod quotation;
pub mod sales_order;

pub use address::Address;
pub use client::{Client, ClientType, ContactBook, ContactChannel, OpeningBalance, TaxPreference};
pub use comm_log::{DeliveryOutcome, EmailLog, PdfStatus, WhatsAppSendLog};
pub use credit_note::{CreditNote, CreditNoteReason, CreditNoteStatus, RefundMode};
pub use delivery_challan::{
    ChallanLineItem, ChallanReason, DeliveryChallan, DeliveryChallanStatus, ModeOfTransport,
};
pub use invoice::{
    BankDetails, EInvoiceEnvelope, GstTreatment, Invoice, InvoiceStatus, RecurringConfig,
    RecurringFrequency,
};
pub use line_item::{LineItem, Totals};
pub use payment_receipt::{InvoiceApplication, PaymentMode, PaymentReceipt, ReceiptStatus};
pub use pipeline::{
    CaptchaProvider, FormField, FormFieldType, FormTheme, LeadForm, Pipeline, PipelineVisibility,
    Stage,
};
pub use proforma::{ProformaInvoice, ProformaStatus};
pub use quotation::{Quotation, QuotationRevision, QuotationStatus};
pub use sales_order::{DeliveryMethod, SalesOrder, SalesOrderStatus};
