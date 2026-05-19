//! Pick the right provider adapter for a tenant's `email_settings` doc.

use anyhow::{Context, Result, anyhow};
use email_types::EmailSenderProvider;

use crate::providers::{
    EmailProvider, brevo::BrevoProvider, mailgun::MailgunProvider, postmark::PostmarkProvider,
    sendgrid::SendgridProvider, ses::SesProvider, smtp::SmtpProvider,
};
use crate::settings::EmailSettingsDoc;

/// Build a boxed provider adapter from the tenant's settings doc.
///
/// Returns `Err` if the doc selects a provider but the corresponding
/// sub-object is missing — callers should surface that as a config
/// problem (the UI should never let this state reach Mongo).
pub fn for_settings(settings: &EmailSettingsDoc) -> Result<Box<dyn EmailProvider>> {
    let provider = settings
        .provider
        .ok_or_else(|| anyhow!("email_settings.provider is unset for this tenant"))?;
    match provider {
        EmailSenderProvider::Smtp => {
            let cfg = settings
                .smtp
                .clone()
                .context("email_settings.smtp is missing")?;
            Ok(Box::new(SmtpProvider::new(cfg)))
        }
        EmailSenderProvider::Sendgrid => {
            let cfg = settings
                .sendgrid
                .clone()
                .context("email_settings.sendgrid is missing")?;
            Ok(Box::new(SendgridProvider::new(cfg)))
        }
        EmailSenderProvider::Mailgun => {
            let cfg = settings
                .mailgun
                .clone()
                .context("email_settings.mailgun is missing")?;
            Ok(Box::new(MailgunProvider::new(cfg)))
        }
        EmailSenderProvider::Ses => {
            let cfg = settings
                .ses
                .clone()
                .context("email_settings.ses is missing")?;
            Ok(Box::new(SesProvider::new(cfg)))
        }
        EmailSenderProvider::Postmark => {
            let cfg = settings
                .postmark
                .clone()
                .context("email_settings.postmark is missing")?;
            Ok(Box::new(PostmarkProvider::new(cfg)))
        }
        EmailSenderProvider::Brevo => {
            let cfg = settings
                .brevo
                .clone()
                .context("email_settings.brevo is missing")?;
            Ok(Box::new(BrevoProvider::new(cfg)))
        }
        EmailSenderProvider::Google | EmailSenderProvider::Outlook => Err(anyhow!(
            "OAuth providers (google / outlook) are not implemented yet"
        )),
    }
}
