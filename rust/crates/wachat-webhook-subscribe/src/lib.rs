//! `wachat-webhook-subscribe` — Phase 5 slice 3 of the wachat → Rust port.
//!
//! Mirrors the **webhook subscription** half of
//! `src/app/actions/whatsapp.actions.ts` (lines 339–402):
//!
//! | TS function | Rust equivalent |
//! |---|---|
//! | `getWebhookSubscriptionStatus(wabaId, accessToken)` (line 341) | [`WebhookSubscriber::status`] |
//! | `handleSubscribeProjectWebhook(wabaId, appId, userAccessToken)` (line 382) | [`WebhookSubscriber::subscribe_one`] |
//! | `handleSubscribeAllProjects()` (line 364) | [`WebhookSubscriber::subscribe_all`] |
//!
//! All three call the Meta Graph API endpoint
//! `{wabaId}/subscribed_apps`:
//!
//! - `GET https://graph.facebook.com/v23.0/{waba_id}/subscribed_apps`
//!   returns `{ data: [...] }` — non-empty `data` means the WABA is
//!   subscribed to the configured app.
//! - `POST https://graph.facebook.com/v23.0/{waba_id}/subscribed_apps`
//!   with the user/system access token attaches the WABA to the app.
//!   The TS sends `{ access_token: <token> }` as a JSON body; this crate
//!   passes the same token via the `Authorization: Bearer …` header that
//!   `MetaClient` injects, which Meta accepts equivalently.
//!
//! ## Bulk subscribe
//!
//! `subscribe_all` walks the `projects` Mongo collection, filters out
//! projects missing a `wabaId` / `appId` / `accessToken` (these have not
//! finished embedded signup yet — the TS just propagates the `undefined`
//! and Meta 400s), and attempts a subscribe per project. Per-project
//! failures are collected into [`SubscribeFailure`] and returned in the
//! [`SubscribeAllOutcome`] so the caller can surface a "succeeded N /
//! failed M" toast and a clickable error list.
//!
//! ## Public API
//!
//! ```ignore
//! use wachat_webhook_subscribe::WebhookSubscriber;
//!
//! let subscriber = WebhookSubscriber::new(mongo, meta);
//! let status = subscriber.status(&waba_id, &access_token).await?;
//! subscriber.subscribe_one(&waba_id, &app_id, &user_access_token).await?;
//! let outcome = subscriber.subscribe_all().await?;
//! ```

pub mod dto;
pub mod subscriber;

pub use dto::{SubscribeAllOutcome, SubscribeFailure, SubscriptionStatus};
pub use subscriber::WebhookSubscriber;
