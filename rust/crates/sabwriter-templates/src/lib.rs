//! # sabwriter-templates
//!
//! Reusable SabWriter document starters. A template carries a name,
//! category, and the seed TipTap contentJson; `public` templates are
//! visible to every user, private ones only to the owner.
//!
//! Collection: `sabwriter_templates`. Instantiation (template → fresh
//! document) is handled at the TS action layer.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
