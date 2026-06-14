//! # wachat-identity
//!
//! **BSUID** (Business-Scoped User ID) contact resolution for the WaChat
//! rewrite — readiness for mid-2026 WhatsApp username privacy, where a user can
//! hide their phone number and a business receives a stable BSUID instead.
//!
//! Resolves a contact in `contacts` by BSUID first, phone (`waId`) as a legacy
//! fallback, creating one if missing — with the phone number **optional**.
//!
//! Mounted at `/v1/wachat/identity` by the API crate. Auth = shared `AuthUser`
//! bearer + `load_project_for` tenancy check. DB-only (no Meta calls).

#![forbid(unsafe_code)]

pub mod resolve;
pub mod router;
pub mod state;

pub use router::router;
pub use state::WachatIdentityState;
