//! `wachat-phone` — E.164 phone-number normalization, validation, and
//! country-dialing helpers used by every wachat endpoint that touches a
//! phone number (contacts, broadcasts, send-template, webhook routing).
//!
//! Ported from `src/app/actions/contact.actions.ts` and the
//! `src/lib/country-codes.ts` table. The TS code uses a very loose rule
//! (`phone.replace(/\D/g, '')` — strip non-digits) and concatenates a
//! country code separately. We keep that liberal stripping but additionally
//! validate length per E.164 (8–15 digits) and emit a canonical `+CCNNN…`
//! string so downstream Rust code never has to wonder about prefix shape.
//!
//! Hand-rolled (no `phonenumber` crate) because the TS source itself does
//! no carrier/region-rule validation — porting libphonenumber would change
//! behaviour. See the module-level docs in `normalize.rs` for the rules.

pub mod dialing;
pub mod error;
pub mod normalize;
pub mod validate;

pub use dialing::country_code_for_region;
pub use error::PhoneError;
pub use normalize::normalize_e164;
pub use validate::{PhoneParts, is_valid_e164, parts};
