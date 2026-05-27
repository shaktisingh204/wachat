//! # sabshow-themes
//!
//! HTTP surface for SabShow Theme rows (palette, fonts, header/footer,
//! per-`SlideLayoutKind` master slide layout). Mounted under
//! `/v1/sabshow/themes`.
//!
//! ```ignore
//! .nest("/v1/sabshow/themes", sabshow_themes::router::<AppState>())
//! ```
//!
//! Built-in themes carry `builtIn: true` and `userId: null` — every
//! tenant can read them but only SabShow operators (seed migrations) may
//! mutate them. User-created themes are scoped by `userId`.
//!
//! Mongo collection: `sabshow_themes`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
