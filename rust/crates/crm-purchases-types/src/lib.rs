//! # crm-purchases-types
//!
//! Domain DTOs for the CRM Purchases module (`crm_function_plan.md`
//! §2). Each entity flattens `crm-core` cross-cutting fragments and
//! reuses shared sales building blocks (`Address`, `LineItem`,
//! `Totals`, `RecurringConfig`, `ContactBook`, comm-log shapes) from
//! `crm-sales-types`.
//!
//! ## Modules
//! - [`vendor`] — §2.1 Vendors & Suppliers
//! - [`purchase_order`] — §2.2 Purchase Orders
//! - [`bill`] — §2.3 Purchases & Expenses (Bills)
//! - [`debit_note`] — §2.4 Debit Notes
//! - [`payout_receipt`] — §2.5 Payout Receipts
//! - [`purchase_lead`] — §2.6 Purchase Leads / Hire & Services

pub mod bill;
pub mod debit_note;
pub mod payout_receipt;
pub mod purchase_lead;
pub mod purchase_order;
pub mod vendor;

pub use bill::{Bill, BillStatus, ExpenseLine};
pub use debit_note::{DebitNote, DebitNoteReason, DebitNoteStatus};
pub use payout_receipt::{BillApplication, PayoutReceipt, PayoutStatus};
pub use purchase_lead::{PurchaseLead, PurchaseLeadStage};
pub use purchase_order::{ApprovalWorkflow, PurchaseOrder, PurchaseOrderStatus};
pub use vendor::{Vendor, VendorType};
