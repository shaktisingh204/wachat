//! Generic user-scoped QR-code maker — backs the `/dashboard/qr-code-maker`
//! UI. Stores arbitrary QR payloads (URL/text/email/phone/sms/wifi) in the
//! `qr_codes` collection plus an optional short-URL row in `short_urls` for
//! dynamic URL QR codes.
//!
//! NOT to be confused with `wachat-config::qr` which manages Meta WhatsApp
//! `/message_qrdls` — that's a different system bound to a phone number.

pub mod from_form;
pub mod router;
pub mod state;
pub mod store;

pub use router::router;
pub use state::QrCodesState;
