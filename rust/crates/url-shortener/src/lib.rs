//! User-scoped URL shortener — backs `/dashboard/url-shortener` and the
//! root `/[shortCode]` redirect handler. Two storage shapes:
//!
//! - `short_urls` collection — one row per short link.
//! - `users.customDomains[]` — array of CustomDomain subdocs on the user
//!   doc, used for vanity hostnames pointing at the redirect.
//!
//! All endpoints (except the public redirect resolver) are user-scoped via
//! `AuthUser.user_id`. The redirect resolver is public — it has to be,
//! since the browser hitting `https://short.example.com/abc123` carries no
//! session cookie.

pub mod from_form;
pub mod redirect;
pub mod router;
pub mod state;
pub mod store;

pub use router::router;
pub use state::UrlShortenerState;
