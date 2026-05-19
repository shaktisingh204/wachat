//! # email-sender
//!
//! Phase 3 (worker half) of the SabNode Email Suite Rust port. Drains
//! the BullMQ `"email-send"` queue produced by `email-campaigns` and
//! delivers email via the tenant's configured provider (SMTP, Sendgrid,
//! Mailgun, SES, Postmark, or Brevo).
//!
//! ## Public surface
//!
//! ```ignore
//! use email_sender::{EmailSenderState, run};
//!
//! # async fn boot(mongo: sabnode_db::mongo::MongoHandle,
//! #               bull: wachat_queue::BullProducer,
//! #               redis: sabnode_db::redis::RedisHandle) -> anyhow::Result<()> {
//! let state = EmailSenderState {
//!     mongo,
//!     bull,
//!     redis,
//!     base_url: "https://app.sabnode.com".to_owned(),
//!     tracking_secret: std::env::var("EMAIL_TRACKING_SECRET")?.into_bytes(),
//! };
//! email_sender::run(state).await?;
//! # Ok(()) }
//! ```
//!
//! The library exposes [`run`] (not `run_worker -> !` — `!` makes the
//! type impossible to compose with the binary's `tokio::signal` shutdown
//! path; we return `Result<()>` and let the binary decide how to react to
//! a clean exit vs. a fatal Redis failure).
//!
//! ## Job model
//!
//! Every job on `"email-send"` carries a `kind` discriminator:
//!
//!   * `test-send`     — fields `{ campaignId, tenantId, toEmails[] }`.
//!     Renders the campaign and delivers to each address; emits a `send`
//!     event per delivery.
//!   * `start-campaign` — fields `{ campaignId, tenantId }`. Resolves
//!     `listIds + segmentIds - suppressions` and fans out N `deliver`
//!     child jobs at 1k subscribers per chunk.
//!   * `deliver`       — fields `{ campaignId, tenantId, subscriberIds[] }`.
//!     Renders per-subscriber, sends, records `send` (and synchronous
//!     `bounce_*` / `complaint` if the provider reports inline).

#![forbid(unsafe_code)]

pub mod providers;
pub mod queue;
pub mod render;
pub mod settings;
pub mod tracking;

pub use providers::{EmailProvider, OutboundMessage, ProviderReceipt};
pub use queue::{EmailSenderState, run};
pub use render::render_for_subscriber;
pub use settings::EmailSettingsDoc;
