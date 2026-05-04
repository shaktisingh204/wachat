//! WhatsApp template variable substitution engine.
//!
//! Replicates the substitution semantics implemented across three TS files:
//!
//! - `src/app/actions/send-template.actions.ts` — single-recipient send time.
//! - `src/app/actions/broadcast.actions.ts` — bulk per-recipient mapping.
//! - `src/workers/broadcast/send-message.js` — runtime substitution in the
//!   PM2 worker (the regex `/\{\{\s*([\w\d._]+)\s*\}\}/g` and the empty-value
//!   handling come from there).
//!
//! Two layers:
//!
//! 1. [`parser`] — finds and orders `{{X}}` placeholders. Both positional
//!    (`{{1}}`) and named (`{{first_name}}`) are supported in the same regex,
//!    matching the TS implementation.
//! 2. [`substitute`] — a pure, synchronous string replacer.
//! 3. [`meta_components`] — produces the JSON shape Meta's `messages` API
//!    expects (`{"type": "body", "parameters": [{"type": "text", "text": "..."}]}`).
//!
//! Empty-string variables are an **error** (Meta error #100 rejects them at
//! send time anyway). The TS code papers over this with a U+200B zero-width
//! space; in Rust we surface it loudly so callers can decide.

#![forbid(unsafe_code)]

pub mod error;
pub mod meta_components;
pub mod parser;
pub mod substitute;

pub use error::SubstituteError;
pub use meta_components::{
    MetaComponent, MetaParameter, TemplateButton, TemplateSpec, build_components,
};
pub use parser::{Placeholder, extract_placeholders};
pub use substitute::{Variables, substitute};
