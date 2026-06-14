//! # wachat-carousel
//!
//! WhatsApp **interactive media carousels + carousel templates** for the WaChat
//! rewrite.
//!
//! - **Create carousel template** — `POST /{waba-id}/message_templates` with a
//!   `CAROUSEL` component (up to 10 cards). Caller passes the full Meta
//!   `components` array (assembled by the frontend carousel builder).
//! - **Send carousel** — `POST /{phone-number-id}/messages` template send that
//!   binds each card's media/params; logged to `wa_carousels`.
//! - **Sent log** — last-100 read for the carousels page.
//!
//! Mounted at `/v1/wachat/carousel` by the API crate. Auth = shared `AuthUser`
//! bearer + `load_project_for` tenancy check (mirrors `wachat-marketing`).

#![forbid(unsafe_code)]

pub mod list;
pub mod router;
pub mod send;
pub mod state;
pub mod templates;

pub use router::router;
pub use state::WachatCarouselState;
