//! # wachat-chat-read
//!
//! Phase 4 slice 6 of the wachat → Rust port: **read-only** queries that
//! back the wachat chat UI.
//!
//! Two TS server actions are mirrored here, both from
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! * [`ChatReader::initial_chat_data`] mirrors `getInitialChatData`
//!   (line ~548): bootstraps the chat sidebar with the 30 most recently
//!   active contacts and (optionally) the conversation history for the
//!   contact the user is opening.
//! * [`ChatReader::get_conversation`] mirrors `getConversation` (line ~626):
//!   merges the per-contact rows from `incoming_messages` and
//!   `outgoing_messages`, sorts them deterministically, and returns the
//!   merged list to the chat window.
//!
//! ## DTO contract
//!
//! The shapes returned by this crate are camelCase / `_id`-keyed and keep
//! the original raw `content` blob intact, because the React chat client
//! consumes the same documents the TS server actions emit
//! (`JSON.parse(JSON.stringify(...))` of raw Mongo docs). See
//! [`mod@dto`] for the per-field rationale.
//!
//! ## Auth boundary
//!
//! The TS code does session + project-membership checks via
//! `getProjectById` / `resolveContactForSession`. This crate trusts the
//! `project_id` / `contact_id` it's handed — auth is enforced one layer up
//! by the HTTP handler that owns the request session. Within
//! [`ChatReader::initial_chat_data`] we still scope the contact lookup by
//! `projectId` so a malformed caller can't accidentally read a contact
//! from a different project.
//!
//! ## What's intentionally out of scope
//!
//! * **Project / template fetch.** The TS `getInitialChatData` also returns
//!   the project document and the templates list; those have their own
//!   crates and the HTTP composer joins them.
//! * **Write paths.** `markConversationAsRead`,
//!   `markConversationAsUnread`, `findOrCreateContact`, etc. are write
//!   actions and live in their own slice.
//! * **The future `conversations` materialized view.** That collection
//!   (built by `wachat-webhook-conversations`) is an additive rollup; this
//!   crate keeps reading from `incoming_messages` + `outgoing_messages` so
//!   it stays bug-for-bug compatible with the TS UI today. A follow-up
//!   slice will switch to the materialized view once the TS UI is migrated.

pub mod dto;
pub mod reader;

pub use dto::{ChatContactSummary, ChatMessage, InitialChatData};
pub use reader::ChatReader;
