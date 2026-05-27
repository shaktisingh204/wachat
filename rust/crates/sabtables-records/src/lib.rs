//! # sabtables-records
//!
//! Record entity for SabTables. Each record stores a free-form
//! field-id → value map (`fieldsJson`) plus standard audit metadata.
//!
//! The crate also ships [`formula`] — a tiny, safe expression evaluator
//! used by `formula` field-type computations. It is exposed as a public
//! POST endpoint (`/v1/sabtables/records/evaluate-formula`) so the
//! Next.js side can preview formulas before committing them.
//!
//! Mongo collection: `sabtables_records`. Mount under
//! `/v1/sabtables/records`.

pub mod dto;
pub mod formula;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
