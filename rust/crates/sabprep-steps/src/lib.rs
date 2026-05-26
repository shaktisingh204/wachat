//! # sabprep-steps
//!
//! Typed step DTOs and the bounded in-memory execution engine that powers
//! the SabNode SabPrep module. The engine applies an ordered list of
//! `Step` ops to `Vec<HashMap<String, Value>>` (rows) and returns the
//! transformed rows plus a `StepRunSummary` with rowsIn / rowsOut / errors.
//!
//! **Scope.** Bounded — built for small / medium datasets (tens of
//! thousands of rows, single-process). Streaming / out-of-core execution
//! is explicitly out of scope; large-dataset support is a future migration.
//!
//! ## Supported step ops
//! - `filter`        — keep rows matching a predicate
//! - `rename`        — rename column
//! - `derive`        — compute a new column from an expression
//! - `split`         — split one column into many by delimiter
//! - `replace`       — find / replace string values in a column
//! - `deduplicate`   — drop duplicate rows (optionally by subset)
//! - `fillNulls`     — fill null/missing values in a column
//! - `typeCast`      — coerce a column to a primitive type
//! - `join`          — inner / left / right / outer join with another row-set
//! - `union`         — append rows of another set
//! - `aggregate`     — group-by + aggregate (count/sum/avg/min/max)
//! - `pivot`         — wide form
//! - `unpivot`       — long form
//!
//! Other crates depend on these DTOs (`sabprep-recipes`, `sabprep-runs`).
//! The DTOs are pure — no I/O, no async.

pub mod ops;
pub mod step;
pub mod engine;

pub use step::{Step, StepKind, StepRunSummary, StepError, Row};
pub use engine::{apply_steps, ExecutionResult};
