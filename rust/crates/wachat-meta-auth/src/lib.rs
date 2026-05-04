//! # wachat-meta-auth
//!
//! Storage and rotation of Meta access tokens (WhatsApp Business Account
//! system-user tokens, long-lived user tokens, and short-lived OAuth tokens)
//! for the SabNode wachat Rust port.
//!
//! ## Mongo source-of-truth
//!
//! In the legacy Next.js codebase, tokens are stored *on the project document*
//! itself — there is no dedicated `meta_tokens` collection. Specifically:
//!
//! - Collection: `projects`
//! - Lookup key: `wabaId` (string)
//! - Token field: `accessToken` (string)
//! - Phone-number mapping: `phoneNumbers: [{ id, ... }]` (array)
//! - Refresh marker: `tokenRefreshedAt` (BSON datetime, set by
//!   `refreshProjectToken` in `meta-token.actions.ts`)
//!
//! [`store::TokenStore`] therefore reads/writes the same fields on the
//! `projects` collection so the Rust service stays interoperable with the TS
//! actions during the migration window.
//!
//! ## Refresh
//!
//! [`refresh::debug_token`] wraps Meta's `GET /v23.0/debug_token` endpoint —
//! the same call used by `inspectToken` in `meta-token.actions.ts`. Long-lived
//! exchange (`fb_exchange_token`) is handled by callers that already have the
//! short-lived token; this crate intentionally does not own the OAuth flow.

pub mod error;
pub mod refresh;
pub mod store;
pub mod types;

pub use refresh::{TokenIntrospection, debug_token};
pub use store::TokenStore;
pub use types::{TokenRecord, TokenType};
