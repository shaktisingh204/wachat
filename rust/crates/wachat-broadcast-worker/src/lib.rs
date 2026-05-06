//! # wachat-broadcast-worker
//!
//! Phase 7 of the SabNode wachat → Rust port. Replaces the BullMQ
//! worker processes in `src/workers/broadcast/` with native Rust
//! consumers built on `wachat-queue::consumer` (Agent 1's deliverable).
//!
//! Two queues are drained:
//!
//!   * `broadcast-control` — one job per broadcast.  Streams the
//!     `broadcast_contacts` cursor, fans batches onto `broadcast-send`,
//!     handles checkpoint resume + cancellation. See [`ControlJobHandler`].
//!   * `broadcast-send`    — one job per contact batch (size 200 default).
//!     Fans out parallel sends with per-broadcast Redis token-bucket
//!     rate limiting, classifies Meta errors, bulk-writes results,
//!     re-enqueues retryable contacts, and finalises the broadcast.
//!     See [`SendJobHandler`].
//!
//! ## What this crate ships
//!
//! * Two `JobHandler` impls (control + send).
//! * Pure helpers extracted into `interpolate`, `classify`, and `media`
//!   modules so they can be unit-tested without Mongo / Redis / Meta.
//! * A `[[bin]]` (`broadcast-worker`) that wires Mongo + Redis + a
//!   `BullProducer` + a `BroadcastLimiter` and runs both handlers
//!   concurrently with graceful SIGTERM / SIGINT shutdown.
//!
//! ## What this crate is NOT
//!
//! * The producer side. Producers (HTTP handlers, Next.js shims) keep
//!   using `wachat_queue::BullProducer`. This crate only consumes.
//! * A Meta media uploader for the chat-side send path. The header
//!   media one-shot upload here is bespoke for broadcasts; ad-hoc chat
//!   sends still go through `wachat_send::MessageSender`.
//!
//! ## Public surface
//!
//! ```ignore
//! use wachat_broadcast_worker::{
//!     ControlConfig, ControlJobHandler,
//!     SendConfig, SendJobHandler,
//! };
//! ```
//!
//! See `src/bin/broadcast-worker.rs` for an end-to-end runtime wiring.

#![forbid(unsafe_code)]

pub mod classify;
pub mod control;
pub mod interpolate;
pub mod media;
pub mod queue_compat;
pub mod send;

pub use classify::{ErrorKind, classify_error, permanent_codes, rate_limit_codes};
pub use control::{ControlConfig, ControlJobHandler};
pub use interpolate::{
    ContactRef, FlowContext, TemplateContext, build_flow_payload, build_template_payload,
    interpolate_text,
};
pub use media::{MediaUploadResult, upload_header_media_if_needed};
pub use send::{SendConfig, SendJobHandler};
