//! Provider abstraction.
//!
//! Every concrete provider (SMTP, Sendgrid, Mailgun, SES, Postmark,
//! Brevo) implements [`EmailProvider`] and is dispatched dynamically
//! based on the tenant's `email_settings.provider` field. The factory
//! lives in [`factory::for_settings`].

use async_trait::async_trait;

pub mod brevo;
pub mod factory;
pub mod mailgun;
pub mod postmark;
pub mod sendgrid;
pub mod ses;
pub mod smtp;

pub use factory::for_settings;

/// A single outbound message handed to a provider. Multi-recipient sends
/// go through one [`OutboundMessage`] per address — providers that
/// support batching (Sendgrid, Mailgun) can collapse internally; we keep
/// the trait simple.
#[derive(Debug, Clone)]
pub struct OutboundMessage {
    pub from_email: String,
    pub from_name: String,
    pub to_email: String,
    pub to_name: Option<String>,
    pub subject: String,
    /// Rendered HTML body. Plain-text fallback is derived by stripping
    /// tags inside each provider's `send` if the upstream API wants it.
    pub html: String,
    /// Optional `Reply-To`. Tenants typically set this in
    /// `email_settings.defaults`.
    pub reply_to: Option<String>,
    /// Custom headers (X-Campaign-ID, etc.) for trace correlation.
    pub headers: Vec<(String, String)>,
}

/// Provider response — `message_id` is whatever id the upstream API
/// returns (provider-specific) and is stored on the event row for
/// later reconciliation with webhook events.
#[derive(Debug, Clone)]
pub struct ProviderReceipt {
    pub provider: &'static str,
    pub message_id: Option<String>,
}

/// Provider trait. Every adapter is `Send + Sync` because the consumer
/// dispatches across worker tasks.
#[async_trait]
pub trait EmailProvider: Send + Sync {
    async fn send(&self, msg: OutboundMessage) -> Result<ProviderReceipt, anyhow::Error>;
}
