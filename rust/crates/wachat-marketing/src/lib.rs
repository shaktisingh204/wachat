//! # wachat-marketing
//!
//! WhatsApp **Marketing Messages API / MM Lite** port for the WaChat rewrite.
//!
//! MM Lite is Meta's dedicated marketing-traffic connection: WABAs enabled for
//! it get higher deliverability and AI-optimized delivery for MARKETING-category
//! template sends, with optional per-message TTL and tracking. This crate:
//!
//! 1. **Send** — builds a marketing template payload (template + optional TTL +
//!    `biz_opaque_callback_data` tracking) and posts it on the phone-number node
//!    (`POST /{phone-number-id}/messages`); Meta routes it over the marketing
//!    connection based on MM Lite enablement + the template category.
//! 2. **Campaign log** — records each send in `wa_marketing_campaigns` and
//!    serves the last-100 read for the campaigns page.
//!
//! Mounted at `/v1/wachat/marketing` by the API crate. Auth is the shared
//! `AuthUser` bearer + `load_project_for` tenancy check (mirrors
//! `wachat-calling` and `wachat-pay`).

#![forbid(unsafe_code)]

pub mod campaigns;
pub mod router;
pub mod send;
pub mod state;

pub use router::router;
pub use state::WachatMarketingState;
