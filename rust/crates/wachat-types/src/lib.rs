//! # wachat-types
//!
//! Shared **domain DTOs** for the wachat (WhatsApp Business) module of the
//! SabNode Rust port. These types mirror the documents stored in MongoDB by
//! the existing TypeScript implementation in `src/lib/definitions.ts` and the
//! `src/app/actions/*.actions.ts` server actions.
//!
//! ## Scope
//!
//! Wachat-only. CRM, SEO, billing, telegram, sabflow, sabchat, ad-manager and
//! other module-specific shapes live in their own crates. The types kept here
//! are the ones touched by wachat handlers/workers: [`Project`], [`WaContact`],
//! [`Template`], [`MessageLog`], [`Broadcast`], [`WhatsAppBusinessAccount`],
//! [`PhoneNumberSummary`], [`Conversation`].
//!
//! ## Distinction from `wachat-meta-dto`
//!
//! * `wachat-meta-dto` models **Meta API wire shapes** — exactly what the
//!   Cloud API sends/receives.
//! * `wachat-types` models **our database documents** — what we persist in
//!   Mongo, with our naming conventions and our enums. These are the DTOs
//!   that flow through every wachat handler boundary.
//!
//! ## Serde conventions
//!
//! Every struct derives `Serialize + Deserialize` with `rename_all =
//! "camelCase"` to round-trip to the camelCase document shape used in TS. The
//! `id` field is renamed to `_id` (Mongo's primary key convention) and uses
//! `bson::oid::ObjectId`. Foreign-key fields (`projectId`, `templateId`, …)
//! are also `ObjectId`. Timestamps use `chrono::DateTime<Utc>`; the
//! `bson` `chrono-0_4` feature provides the `bson::DateTime` interop the
//! Mongo driver needs.
//!
//! ## No logic
//!
//! This crate contains **no business logic**, no I/O, no async. It is a pure
//! types library. Adding behavior here is a layering violation — put it in
//! the consuming crate.

pub mod broadcast;
pub mod contact;
pub mod conversation;
pub mod message;
pub mod project;
pub mod template;
pub mod waba;

// Convenience re-exports so callers can `use wachat_types::Project;` without
// having to remember module paths.
pub use broadcast::{Broadcast, BroadcastStatus};
pub use contact::WaContact;
pub use conversation::Conversation;
pub use message::{Direction, MessageLog, MessageStatus};
pub use project::Project;
pub use template::{Template, TemplateCategory, TemplateStatus};
pub use waba::{PhoneNumberSummary, WhatsAppBusinessAccount};
