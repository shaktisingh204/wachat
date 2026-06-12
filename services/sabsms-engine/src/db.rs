use anyhow::{Context, Result};
use mongodb::{
    bson::doc,
    options::{ClientOptions, IndexOptions},
    Client, Database, IndexModel,
};

use crate::config::Config;

pub const COL_NUMBERS: &str = "sabsms_numbers";
pub const COL_PROVIDER_ACCOUNTS: &str = "sabsms_provider_accounts";
pub const COL_MESSAGES: &str = "sabsms_messages";
pub const COL_CONVERSATIONS: &str = "sabsms_conversations";
pub const COL_TEMPLATES: &str = "sabsms_templates";
pub const COL_SUPPRESSIONS: &str = "sabsms_suppressions";
pub const COL_CONSENT_LOG: &str = "sabsms_consent_log";

pub async fn connect(cfg: &Config) -> Result<Database> {
    let mut opts = ClientOptions::parse(&cfg.mongo_uri)
        .await
        .context("parsing MongoDB URI")?;
    opts.app_name = Some("sabsms-engine".to_string());
    let client = Client::with_options(opts).context("building Mongo client")?;
    Ok(client.database(&cfg.mongo_db))
}

/// Idempotent — Mongo silently skips an existing index with the same
/// definition. The TS side declares the same set in
/// `src/lib/sabsms/db/collections.ts`; we re-declare here so the Rust
/// engine can boot standalone.
pub async fn ensure_indexes(db: &Database) -> Result<()> {
    // messages
    let messages = db.collection::<mongodb::bson::Document>(COL_MESSAGES);
    messages
        .create_indexes(vec![
            IndexModel::builder()
                .keys(doc! { "workspaceId": 1, "status": 1, "queuedAt": -1 })
                .build(),
            IndexModel::builder()
                .keys(doc! { "idempotencyKey": 1 })
                .options(
                    IndexOptions::builder()
                        .unique(true)
                        .partial_filter_expression(doc! { "idempotencyKey": { "$type": "string" } })
                        .build(),
                )
                .build(),
            IndexModel::builder()
                .keys(doc! { "provider": 1, "providerMessageId": 1 })
                .options(
                    IndexOptions::builder()
                        .unique(true)
                        .partial_filter_expression(
                            doc! { "providerMessageId": { "$type": "string" } },
                        )
                        .build(),
                )
                .build(),
        ])
        .await
        .context("creating message indexes")?;

    // suppressions
    let suppressions = db.collection::<mongodb::bson::Document>(COL_SUPPRESSIONS);
    suppressions
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "phoneHash": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating suppression indexes")?;

    // conversations — one thread per (workspace, peer phone, channel)
    let conversations = db.collection::<mongodb::bson::Document>(COL_CONVERSATIONS);
    conversations
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "phone": 1, "channel": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating conversation indexes")?;

    // numbers — inbound webhooks resolve workspace by destination e164
    let numbers = db.collection::<mongodb::bson::Document>(COL_NUMBERS);
    numbers
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "e164": 1 })
            .build()])
        .await
        .context("creating number indexes")?;

    // provider accounts — default-account resolution per workspace
    let provider_accounts = db.collection::<mongodb::bson::Document>(COL_PROVIDER_ACCOUNTS);
    provider_accounts
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "provider": 1, "isDefault": 1 })
            .build()])
        .await
        .context("creating provider account indexes")?;

    Ok(())
}
