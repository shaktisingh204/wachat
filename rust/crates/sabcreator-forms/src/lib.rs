//! # sabcreator-forms
//!
//! Form entity for SabCreator. A Form belongs to a SabCreator App, targets
//! a single SabTables table for record storage, and carries a `fieldsJson`
//! schema describing per-field labels, validations, and conditional logic.
//!
//! Mongo collection: `sabcreator_forms`. Mount under
//! `/v1/sabcreator/forms`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
