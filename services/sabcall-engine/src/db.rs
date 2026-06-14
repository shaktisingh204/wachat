//! Mongo connection.

use anyhow::Context;
use mongodb::{Client, Database};

use crate::config::EngineConfig;

pub async fn connect(cfg: &EngineConfig) -> anyhow::Result<Database> {
    let client = Client::with_uri_str(&cfg.mongodb_uri)
        .await
        .context("connect to mongodb")?;
    Ok(client.database(&cfg.mongodb_db))
}
