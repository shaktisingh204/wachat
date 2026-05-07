//! # crm-sales-crm-types
//!
//! DTOs for the Sales-CRM module (`crm_function_plan.md` §5): leads,
//! contacts, deals, tasks, automations, lead-capture forms, and analytics
//! request envelopes.

pub mod analytics;
pub mod automation;
pub mod contact;
pub mod deal;
pub mod form;
pub mod lead;
pub mod task;

// Explicit re-exports — modules duplicate `ActivityLogEntry` locally
// (deal.rs and lead.rs each declare their own variant), so a glob
// re-export would collide. Lead's `ActivityLogEntry` is the canonical
// timeline shape for now and is re-exported below; deal's variant is
// reachable via `crm_sales_crm_types::deal::ActivityLogEntry`.
pub use analytics::*;
pub use automation::*;
pub use contact::*;
pub use deal::{Deal, DealParty, DealProduct, DealStatus};
pub use form::*;
pub use lead::*;
pub use task::*;
