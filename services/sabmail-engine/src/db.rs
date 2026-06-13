use anyhow::{Context, Result};
use mongodb::{options::ClientOptions, Client, Database};

use crate::config::Config;

// SabMail collections — same names as src/lib/sabmail/db/collections.ts so the
// Rust engine and the Next.js layer share one store.
pub const COL_ACCOUNTS: &str = "sabmail_accounts";
pub const COL_MESSAGES: &str = "sabmail_messages";
pub const COL_CONTACTS: &str = "sabmail_contacts";
pub const COL_CAMPAIGNS: &str = "sabmail_campaigns";
pub const COL_JOURNEYS: &str = "sabmail_journeys";
pub const COL_JOURNEY_RUNS: &str = "sabmail_journey_runs";
pub const COL_DOMAINS: &str = "sabmail_domains";
pub const COL_SUPPRESSIONS: &str = "sabmail_suppressions";
pub const COL_EVENTS: &str = "sabmail_events";
pub const COL_CONVERSATIONS: &str = "sabmail_conversations";
pub const COL_SCREENER: &str = "sabmail_screener";
pub const COL_RULES: &str = "sabmail_rules";

/// True when a Mongo error is an E11000 duplicate-key write error.
pub fn is_duplicate_key_error(e: &mongodb::error::Error) -> bool {
    matches!(
        *e.kind,
        mongodb::error::ErrorKind::Write(mongodb::error::WriteFailure::WriteError(ref we))
            if we.code == 11000
    )
}

pub async fn connect(cfg: &Config) -> Result<Database> {
    let mut opts = ClientOptions::parse(&cfg.mongo_uri)
        .await
        .context("parsing MongoDB URI")?;
    opts.app_name = Some("sabmail-engine".to_string());
    let client = Client::with_options(opts).context("building Mongo client")?;
    Ok(client.database(&cfg.mongo_db))
}
