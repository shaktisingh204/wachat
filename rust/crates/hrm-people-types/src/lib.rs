//! # hrm-people-types
//!
//! DTOs for HRM People-Ops (`crm_function_plan.md` §10): recruitment,
//! onboarding, performance (OKR/360/recognition/surveys/one-on-ones),
//! learning (training/certifications/learning paths), documents +
//! assets, time + expenses, exit + comp.

pub mod docs_assets;
pub mod exit;
pub mod learning;
pub mod onboarding;
pub mod people_perf;
pub mod recruitment;
pub mod time_expenses;

pub use docs_assets::*;
pub use exit::*;
pub use learning::*;
pub use onboarding::*;
pub use people_perf::*;
pub use recruitment::*;
pub use time_expenses::*;
