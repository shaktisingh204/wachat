//! # wachat-calling
//!
//! WhatsApp Business **Calling API** port of `src/app/actions/calling.actions.ts`.
//!
//! Three concerns under one crate:
//!
//! 1. **Calling settings** — per-phone-number `calling` envelope on Meta
//!    (`GET/POST {phone-number-id}` with `fields=calling`). Supports the
//!    quick enable/disable toggle (status only) and the full settings save
//!    (call hours, call icons, callback permission, SIP servers).
//! 2. **Call logs** — the `crm_call_logs` Mongo collection populated by the
//!    inbound webhook processor. Read-only, last-100 list scoped to a
//!    project.
//!
//! Mounted at `/v1/wachat/calling` by the API crate. Auth is the shared
//! `AuthUser` bearer + `load_project_for` tenancy check (mirrors
//! `wachat-config` and `wachat-pay`).
//!
//! ## Meta calling-API quirks
//!
//! - Meta uses the same phone-number-id endpoint for the read (`?fields=calling`)
//!   and the write — the write payload is wrapped under `calling: { ... }`.
//! - The legacy TS hit `v24.0`. We defer to the caller's `MetaClient`
//!   (the API crate constructs `v23.0`); Meta accepts calling on either.
//! - `messaging_product: "whatsapp"` is required on every write.

#![forbid(unsafe_code)]

pub mod logs;
pub mod router;
pub mod settings;
pub mod state;

pub use router::router;
pub use state::WachatCallingState;
