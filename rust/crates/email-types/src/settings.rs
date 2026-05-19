use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EmailSenderProvider {
    Smtp,
    Sendgrid,
    Mailgun,
    Ses,
    Postmark,
    Brevo,
    Google,
    Outlook,
}
