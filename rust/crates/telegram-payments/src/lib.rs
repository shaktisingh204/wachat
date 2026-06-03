//! # telegram-payments
//!
//! Multi-tenant Telegram Payments BFF: provider tokens, invoice
//! templates, sent-invoice tracking, payment records, refunds,
//! analytics, and CSV export.
//!
//! Mounted at `/v1/telegram/payments` by the API gateway.
//!
//! ## Collections
//!
//! - `telegram_payment_providers` — saved provider tokens per bot.
//! - `telegram_payment_invoice_templates` — reusable invoice payloads.
//! - `telegram_payment_invoices` — sent invoices + created invoice
//!   links, keyed by an internal id and the bot's payload.
//! - `telegram_payments` — completed payments (one per
//!   `successful_payment` update). Refund state lives here too.
//!
//! ## Webhook entry points
//!
//! `webhook::answer_pre_checkout`, `webhook::answer_shipping`, and
//! `webhook::mark_successful_payment` are public helpers the
//! `telegram-webhooks` crate (or any update dispatcher) can call when
//! the matching update type arrives. They are deliberately not routed
//! here — the Telegram webhook surface is owned by another crate.

pub mod handlers;
pub mod state;
pub mod webhook;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post, put},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramPaymentsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramPaymentsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Payments list + CSV + analytics
        .route("/", get(handlers::list_payments))
        .route("/export", get(handlers::export_csv))
        .route("/analytics", get(handlers::analytics))
        // Provider tokens
        .route(
            "/providers",
            get(handlers::list_providers).post(handlers::create_provider),
        )
        .route(
            "/providers/{provider_id}",
            put(handlers::update_provider).delete(handlers::delete_provider),
        )
        .route(
            "/providers/{provider_id}/test",
            post(handlers::test_provider),
        )
        // Invoice templates
        .route(
            "/templates",
            get(handlers::list_templates).post(handlers::create_template),
        )
        .route(
            "/templates/{template_id}",
            put(handlers::update_template).delete(handlers::delete_template),
        )
        // Sent invoices & invoice links
        .route("/invoices", get(handlers::list_invoices))
        .route("/invoices/send", post(handlers::send_invoice))
        .route("/invoices/link", post(handlers::create_invoice_link))
        // Single payment + refund — placed last so static prefixes match first.
        .route("/{payment_id}", get(handlers::get_payment))
        .route("/{payment_id}/refund", post(handlers::refund_payment))
}
