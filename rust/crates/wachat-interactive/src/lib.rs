//! # wachat-interactive
//!
//! Interactive message sends for the WaChat rewrite — `POST
//! /{phone-number-id}/messages` with `type:"interactive"`.
//!
//! - **CTA-URL** — a tappable button mapped to a URL (no raw link in the body).
//! - **Location request** — prompts the user with a "Send location" button.
//! - **Passthrough** — any interactive object (list, reply buttons, flow,
//!   webview) the frontend assembles.
//!
//! Mounted at `/v1/wachat/interactive` by the API crate. Auth = shared
//! `AuthUser` bearer + `load_project_for` tenancy check.

#![forbid(unsafe_code)]

pub mod router;
pub mod send;
pub mod state;

pub use router::router;
pub use state::WachatInteractiveState;
