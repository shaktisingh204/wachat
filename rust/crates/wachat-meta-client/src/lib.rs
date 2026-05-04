//! # wachat-meta-client
//!
//! Thin, retry-aware HTTP wrapper around the **Meta Cloud API**
//! (`graph.facebook.com`). This crate is the lowest-level transport in the
//! SabNode wachat stack — every higher-level WhatsApp module (templates,
//! messages, media, profile, payments, …) builds on top of it.
//!
//! ## Token policy
//!
//! This client is **token-agnostic**: every request method takes a Meta
//! access token as a `&str` parameter. We do **not** read tokens from
//! environment variables, refresh them, persist them, or cache them.
//!
//! Token *storage* and *refresh* are the responsibility of the sibling
//! crate **`wachat-meta-auth`** (built in parallel as part of Phase 1).
//! That crate exposes higher-level "give me a valid token for project X"
//! APIs and uses this client for the underlying HTTP calls.
//!
//! Keeping the two concerns split lets us:
//! * Test the transport in isolation against `wiremock` without any auth
//!   plumbing.
//! * Swap the token source (DB, KMS, env, in-memory test double) without
//!   ever touching the HTTP layer.
//!
//! ## What this crate handles
//!
//! * Versioned base URL (`https://graph.facebook.com/v{N}.0/`) with the
//!   Meta Graph API version supplied at construction time.
//! * `Bearer` authentication header injection (skipped when the caller
//!   passes an empty token, e.g. for unauthenticated debug pings).
//! * Connection pool reuse via a single `reqwest::Client` per
//!   `MetaClient`.
//! * 30 s default per-request timeout.
//! * Exponential-backoff retry (3 attempts, ~250 ms → 500 ms → 1 s with
//!   ±25 % jitter) for `5xx` and `429`. Honors `Retry-After` on 429.
//! * Parsing of Meta's standard error envelope into a structured
//!   `MetaError::Api { code, subcode, fbtrace_id, message, status }`.
//! * Conversion `MetaError -> sabnode_common::ApiError` so HTTP handlers
//!   can `?`-bubble Meta failures into the SabNode response envelope.

pub mod client;
pub mod error;
pub mod meta_api_error;

pub use client::MetaClient;
pub use error::MetaError;
pub use meta_api_error::{MetaApiError, MetaApiErrorEnvelope};
