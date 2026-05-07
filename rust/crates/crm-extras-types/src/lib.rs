//! # crm-extras-types
//!
//! DTOs for the §12 advanced-features cluster of `crm_function_plan.md`.
//! Each module flattens `crm-core` cross-cutting fragments and reuses
//! shared sales building blocks (Address / LineItem / Totals / etc.)
//! from `crm-sales-types`.

pub mod audit_log;
pub mod background_job;
pub mod bom;
pub mod booking;
pub mod budget;
pub mod contract;
pub mod dashboard;
pub mod field_service;
pub mod fixed_asset;
pub mod fx;
pub mod grn;
pub mod hr_cases;
pub mod import_export;
pub mod india_tax;
pub mod knowledge_base;
pub mod loan;
pub mod multi_branch;
pub mod nps_referral;
pub mod petty_cash;
pub mod portal;
pub mod pos;
pub mod promotions;
pub mod rfq;
pub mod saved_view;
pub mod subscription;
pub mod templates;
pub mod ticket;
pub mod workflow;

pub use audit_log::*;
pub use background_job::*;
pub use bom::*;
pub use booking::*;
pub use budget::*;
pub use contract::*;
pub use dashboard::*;
pub use field_service::*;
pub use fixed_asset::*;
pub use fx::*;
pub use grn::*;
pub use hr_cases::*;
pub use import_export::*;
pub use india_tax::*;
pub use knowledge_base::*;
pub use loan::*;
pub use multi_branch::*;
pub use nps_referral::*;
pub use petty_cash::*;
pub use portal::*;
pub use pos::*;
pub use promotions::*;
pub use rfq::*;
pub use saved_view::*;
pub use subscription::*;
pub use templates::*;
pub use ticket::*;
pub use workflow::*;
