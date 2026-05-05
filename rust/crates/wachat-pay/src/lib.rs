//! # wachat-pay
//!
//! WhatsApp **Pay** payment-configuration management — Phase 6 port of
//! `src/app/actions/whatsapp-pay.actions.ts` (7 server actions).
//!
//! Distinct from [`wachat_payment_request`], which sends payment-request
//! *messages* (a runtime concern). This crate covers payment-configuration
//! *setup* — the WABA-scoped `payment_configurations` resource on Meta
//! (Razorpay/PayU/UPI VPA providers), data-endpoint plumbing for
//! data-collection flows, OAuth onboarding link regeneration, and the
//! local `projects.paymentConfiguration[]` mirror used by the WhatsApp
//! Pay settings UI.
//!
//! ## Endpoints (mounted at `/v1/wachat/pay` by the API crate)
//!
//! | Method | Path                                  | TS source fn                          |
//! |--------|---------------------------------------|---------------------------------------|
//! | GET    | /projects/{id}/configurations         | `getPaymentConfigurations`            |
//! | GET    | /projects/{id}/configurations/{name}  | `getPaymentConfigurationByName`       |
//! | POST   | /projects/{id}/configurations         | `handleCreatePaymentConfiguration`    |
//! | POST   | /projects/{id}/configurations/{name}/data-endpoint | `handleUpdateDataEndpoint`  |
//! | POST   | /projects/{id}/configurations/{name}/regenerate-oauth | `handleRegenerateOauthLink` |
//! | DELETE | /projects/{id}/configurations/{name}  | `handleDeletePaymentConfiguration`    |
//! | POST   | /projects/{id}/configurations/{name}/sync-local    | `handlePaymentConfigurationUpdate` |
//!
//! ## Notes on `revalidatePath`
//!
//! The TS code calls `revalidatePath('/wachat/whatsapp-pay/settings')` on
//! every successful mutation. The Rust handlers do **not** issue Next.js
//! cache invalidations — that concern stays at the TS shim layer (the
//! caller of `rustClient.wachatPay.*`).

#![forbid(unsafe_code)]

pub mod config;
pub mod router;
pub mod state;
pub mod transactions;

pub use router::router;
pub use state::WachatPayState;
