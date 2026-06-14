//! # sabsign-templates
//!
//! Reusable signing blueprints. A template snapshots a source document
//! (`docId`), a set of recipient *slots* (role + label + order), and the
//! fields pre-placed on the document. Instantiating a template binds concrete
//! signers to the slots and produces a fresh envelope in `esign_envelopes`.
//!
//! Persisted in `esign_templates`, tenant-scoped by the JWT `tid`. Wire shape
//! matches the TS `SabSignTemplateDoc` contract.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
