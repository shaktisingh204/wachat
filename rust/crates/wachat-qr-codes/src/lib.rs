//! # wachat-qr-codes
//!
//! WhatsApp **QR code** (`message_qrdls`) CRUD against the Meta Cloud
//! API. A QR code (a.k.a. "click-to-chat" code) is a phone-number-
//! scoped resource that, when scanned, opens a WhatsApp chat with a
//! pre-filled message.
//!
//! This crate is the Rust port of the QR-code admin handlers in
//! `src/app/actions/whatsapp.actions.ts`:
//!
//! | TS function           | TS line ~ | Rust API           |
//! | --------------------- | --------- | ------------------ |
//! | `getQrCodes`          |   941     | [`QrCodes::list`]  |
//! | `handleCreateQrCode`  |   961     | [`QrCodes::create`]|
//! | `handleUpdateQrCode`  |   987     | [`QrCodes::update`]|
//! | `handleDeleteQrCode`  |  1009     | [`QrCodes::delete`]|
//!
//! ## Meta API surface
//!
//! All four endpoints sit under a phone-number node. The wire URLs
//! emitted by this crate (Meta version pinned via [`MetaClient::new`]):
//!
//! ```text
//! GET    {version}/{phone_number_id}/message_qrdls
//! POST   {version}/{phone_number_id}/message_qrdls
//! POST   {version}/{phone_number_id}/message_qrdls/{code}
//! DELETE {version}/{phone_number_id}/message_qrdls/{code}
//! ```
//!
//! The TS handlers for update / delete (lines 999 and 1020) actually
//! address the QR by its bare `code` (a globally-unique node id) rather
//! than the nested `/{phone}/message_qrdls/{code}` form. Both work
//! against Meta — we standardize on the nested form for self-describing
//! request logs.
//!
//! ## Token policy
//!
//! Token-agnostic: every method takes a `&Project` so the caller can
//! reuse a project lookup across multiple QR ops. The access token is
//! read from `project.access_token`; if missing we surface a
//! `BadRequest` (mirrors the TS guards at lines 946 / 967 / 993 /
//! 1014).
//!
//! ## What this crate is NOT
//!
//! * It does **not** load `Project` from Mongo — the caller passes a
//!   borrowed `&Project`.
//! * It does **not** persist anything; QR codes are stored on Meta and
//!   are listed live on every read. This matches the TS handlers, none
//!   of which touch Mongo for QR codes.
//! * It does **not** call `revalidatePath` (Next-only concern).

#![forbid(unsafe_code)]

pub mod dto;
pub mod qr;

pub use dto::{CreateQrReq, ImageFormat, QrCode, UpdateQrReq};
pub use qr::QrCodes;
