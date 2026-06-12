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
pub const COL_KEYWORD_RULES: &str = "sabsms_keyword_rules";
pub const COL_CAMPAIGNS: &str = "sabsms_campaigns";
pub const COL_CAMPAIGN_RECIPIENTS: &str = "sabsms_campaign_recipients";
pub const COL_ROUTING_POLICIES: &str = "sabsms_routing_policies";
pub const COL_OTP_CONFIGS: &str = "sabsms_otp_configs";
pub const COL_FRAUD_BLOCKS: &str = "sabsms_fraud_blocks";
pub const COL_DLT_ENTITIES: &str = "sabsms_dlt_entities";
pub const COL_DLT_HEADERS: &str = "sabsms_dlt_headers";
pub const COL_DLT_TEMPLATES: &str = "sabsms_dlt_templates";
pub const COL_DLT_CHAINS: &str = "sabsms_dlt_chains";

/// True when a Mongo error is an E11000 duplicate-key write error —
/// used to detect idempotent re-deliveries (webhook retries) and
/// concurrent suppression upserts.
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

    // consent log — latest-event lookup per (workspace, phoneHash)
    let consent_log = db.collection::<mongodb::bson::Document>(COL_CONSENT_LOG);
    consent_log
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "phoneHash": 1, "createdAt": -1 })
            .build()])
        .await
        .context("creating consent log indexes")?;

    // campaigns — the ticker scans running + due-scheduled docs
    let campaigns = db.collection::<mongodb::bson::Document>(COL_CAMPAIGNS);
    campaigns
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "status": 1, "scheduledAt": 1 })
            .build()])
        .await
        .context("creating campaign indexes")?;

    // campaign recipients — claim scans + the idempotency double-send
    // guard (unique key `{campaignId}:{contactIdOrPhone}`)
    let recipients = db.collection::<mongodb::bson::Document>(COL_CAMPAIGN_RECIPIENTS);
    recipients
        .create_indexes(vec![
            IndexModel::builder()
                .keys(doc! { "campaignId": 1, "chunk": 1, "status": 1 })
                .build(),
            IndexModel::builder()
                .keys(doc! { "idempotencyKey": 1 })
                .options(IndexOptions::builder().unique(true).build())
                .build(),
        ])
        .await
        .context("creating campaign recipient indexes")?;

    // keyword rules — single doc per workspace
    let keyword_rules = db.collection::<mongodb::bson::Document>(COL_KEYWORD_RULES);
    keyword_rules
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating keyword rules indexes")?;

    // routing policies — single doc per workspace (V2.6 router)
    let routing_policies = db.collection::<mongodb::bson::Document>(COL_ROUTING_POLICIES);
    routing_policies
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating routing policy indexes")?;

    // OTP configs — single doc per workspace (V2.7)
    let otp_configs = db.collection::<mongodb::bson::Document>(COL_OTP_CONFIGS);
    otp_configs
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating otp config indexes")?;

    // fraud blocks — prefix lookup on every OTP send + Mongo TTL expiry
    // (expireAfterSeconds = 0 → docs die exactly at their `expiresAt`).
    let fraud_blocks = db.collection::<mongodb::bson::Document>(COL_FRAUD_BLOCKS);
    fraud_blocks
        .create_indexes(vec![
            IndexModel::builder()
                .keys(doc! { "workspaceId": 1, "prefix": 1 })
                .build(),
            IndexModel::builder()
                .keys(doc! { "expiresAt": 1 })
                .options(
                    IndexOptions::builder()
                        .expire_after(std::time::Duration::from_secs(0))
                        .partial_filter_expression(doc! { "expiresAt": { "$type": "date" } })
                        .build(),
                )
                .build(),
        ])
        .await
        .context("creating fraud block indexes")?;

    // DLT registries (V2.8) — headers unique per (workspace, header
    // string); templates unique per (workspace, templateId); entities
    // unique per (workspace, peId); chains single doc per workspace.
    let dlt_headers = db.collection::<mongodb::bson::Document>(COL_DLT_HEADERS);
    dlt_headers
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "header": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating dlt header indexes")?;

    let dlt_templates = db.collection::<mongodb::bson::Document>(COL_DLT_TEMPLATES);
    dlt_templates
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "templateId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating dlt template indexes")?;

    let dlt_entities = db.collection::<mongodb::bson::Document>(COL_DLT_ENTITIES);
    dlt_entities
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1, "peId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating dlt entity indexes")?;

    let dlt_chains = db.collection::<mongodb::bson::Document>(COL_DLT_CHAINS);
    dlt_chains
        .create_indexes(vec![IndexModel::builder()
            .keys(doc! { "workspaceId": 1 })
            .options(IndexOptions::builder().unique(true).build())
            .build()])
        .await
        .context("creating dlt chain indexes")?;

    Ok(())
}
