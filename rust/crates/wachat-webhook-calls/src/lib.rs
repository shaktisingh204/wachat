//! # wachat-webhook-calls
//!
//! WhatsApp Business **Calling** webhook processing for the WaChat rewrite.
//!
//! - [`process::process`] — library entry the webhook receiver calls with a
//!   `calls` change `value`; appends each ring/accept/reject/terminate/
//!   permission event to `wa_calls`.
//! - **Call-log read** — `GET /v1/wachat/webhook-calls/projects/{id}/calls`
//!   serves the last-100 events for the Calling UI.
//!
//! Mounted at `/v1/wachat/webhook-calls` by the API crate. Read path uses the
//! shared `AuthUser` bearer + `load_project_for` tenancy check; the processor is
//! a plain async fn (no auth — the webhook receiver already verified the Meta
//! signature).

#![forbid(unsafe_code)]

pub mod list;
pub mod process;
pub mod router;
pub mod state;

pub use process::process;
pub use router::router;
pub use state::WachatWebhookCallsState;
