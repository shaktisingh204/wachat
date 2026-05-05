//! # wachat-project-config
//!
//! Read + manual setup of a wachat **Project**. Phase 5 slice 1 of the
//! wachat → Rust port.
//!
//! ## TS counterparts
//!
//! Mirrors two Server Actions in `src/app/actions/whatsapp.actions.ts`:
//!
//! * [`ProjectConfig::get_public`] mirrors `getPublicProjectById`
//!   (line 19). The TS does `JSON.parse(JSON.stringify(project))` to
//!   strip Mongo-internal types; we additionally **redact every
//!   sensitive token** (`accessToken`, plus any future `appSecret` /
//!   token field) before the document crosses the trust boundary. The
//!   public read path on the Node side leaks the access token today —
//!   the Rust port closes that gap on day one.
//!
//! * [`ProjectConfig::manual_setup`] mirrors `handleManualWachatSetup`
//!   (line 143) which delegates to `_createProjectFromWaba` (line 33).
//!   The TS path is `findOne({wabaId, userId}) → insertOne(...)`; the
//!   Rust API upgrades that to a single atomic
//!   `update_one({wabaId, userId}, {$set, $setOnInsert: {createdAt}},
//!   upsert: true)` to remove the read-then-write race.
//!
//! ## Mongo collection
//!
//! `projects` — same as TS (`db.collection<Project>('projects')`).
//!
//! ## Scope
//!
//! No Meta API calls, no plan lookup, no phone-number sync, no webhook
//! subscription. Those live in their own slices and are composed by the
//! API layer. This crate owns *only* the read + write of the Project
//! document.

pub mod config;
pub mod dto;

pub use config::ProjectConfig;
pub use dto::{ManualSetupReq, PublicProject};
