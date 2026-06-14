//! # wachat-phone-register
//!
//! **Phase 5, slice 4** of the SabNode TS-to-Rust port.
//!
//! Ports the five admin-facing **phone-number lifecycle** endpoints from
//! `src/app/actions/whatsapp.actions.ts` into a single typed handle:
//!
//! | Crate API                                     | TS source                                | Meta endpoint (v23.0)                                            |
//! | --------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
//! | [`PhoneRegistrar::register`]                  | `registerPhoneNumber`            (~819)  | `POST /{phone-number-id}/register`                               |
//! | [`PhoneRegistrar::request_verification_code`] | `handleRequestVerificationCode`  (~844)  | `POST /{phone-number-id}/request_code`                           |
//! | [`PhoneRegistrar::verify_code`]               | `handleVerifyCode`               (~866)  | `POST /{phone-number-id}/verify_code`                            |
//! | [`PhoneRegistrar::deregister`]                | `deregisterPhoneNumber`          (~888)  | `POST /{phone-number-id}/deregister`                             |
//! | [`PhoneRegistrar::set_two_step_pin`]          | `handleSetTwoStepVerificationPin` (~912) | `POST /{phone-number-id}` with body `{ pin }`                    |
//!
//! ## Meta API version
//!
//! Pinned at **v23.0**, exposed as the const [`META_API_VERSION`]. The
//! [`wachat_meta_client::MetaClient`] passed in by the caller carries the
//! version it was constructed with — this crate does not override it, but
//! tests use the same constant so the wiremock paths match what the TS
//! does.
//!
//! ## What this crate is **not**
//!
//! * No HTTP routing, no session lookup, no `revalidatePath` —
//!   the caller (HTTP handler crate) owns that.
//! * No project lookup. Callers pass an already-loaded
//!   [`wachat_types::project::Project`] so the access token is on hand.
//! * No Mongo writes. `MongoHandle` sits on the constructor for parity
//!   with sibling crates and so that future flows can persist
//!   per-phone-number state without breaking the public API.
//! * No `pin` / `code` logging — see the redaction note on
//!   [`registrar`].

pub mod dto;
pub mod registrar;

pub use dto::VerificationMethod;
pub use registrar::PhoneRegistrar;

/// Meta Graph API version this crate targets.
///
/// Mirrors the legacy TS `API_VERSION = 'v23.0'` constant used by every
/// `axios.post('https://graph.facebook.com/${API_VERSION}/...')` call in
/// `whatsapp.actions.ts`.
pub const META_API_VERSION: &str = "v25.0";
