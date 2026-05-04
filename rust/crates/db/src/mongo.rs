//! MongoDB client wrapper.
//!
//! Wraps the official `mongodb` driver with sensible defaults for the SabNode
//! backend: bounded connection pool, named app for server-side observability,
//! and a `ping` health check that mirrors `db.runCommand({ping: 1})`.
//!
//! `MongoHandle` is `Clone` (the underlying `mongodb::Client` is internally
//! reference-counted), so it is safe to store in Axum app state and hand out
//! to every request handler.

use anyhow::{Context, Result};
use bson::{Document, doc};
use mongodb::{Client, Collection, options::ClientOptions};

/// Cheap, cloneable handle that owns a configured Mongo client and remembers
/// which logical database the service should talk to.
#[derive(Debug, Clone)]
pub struct MongoHandle {
    /// The underlying driver client. Cloning is cheap (Arc inside).
    pub client: Client,
    /// Name of the database this handle targets (matches `MONGODB_DB`).
    pub db_name: String,
}

impl MongoHandle {
    /// Connect to MongoDB at `uri` and pin this handle to `db_name`.
    ///
    /// Pool sizing matches the Phase 0 plan:
    /// - `min_pool_size = 5` to keep warm connections during quiet periods.
    /// - `max_pool_size = 50` as a safety ceiling per process.
    /// - `app_name = "sabnode-rust"` shows up in MongoDB server logs and Atlas
    ///   so we can distinguish the Rust service from the legacy Node app.
    pub async fn connect(uri: &str, db_name: &str) -> Result<Self> {
        let mut options = ClientOptions::parse(uri)
            .await
            .with_context(|| format!("parsing MongoDB URI for database `{db_name}`"))?;

        options.app_name = Some("sabnode-rust".to_owned());
        options.max_pool_size = Some(50);
        options.min_pool_size = Some(5);

        let client = Client::with_options(options).context("constructing MongoDB client")?;

        Ok(Self {
            client,
            db_name: db_name.to_owned(),
        })
    }

    /// Typed handle to a collection inside the configured database.
    ///
    /// `T` is the document shape used for serde — pass `bson::Document` if you
    /// want a schemaless view.
    pub fn collection<T: Send + Sync>(&self, name: &str) -> Collection<T> {
        self.client.database(&self.db_name).collection::<T>(name)
    }

    /// Lightweight liveness probe. Issues `{ ping: 1 }` against the configured
    /// database; returns `Ok(())` on success or surfaces the driver error.
    pub async fn ping(&self) -> Result<()> {
        self.client
            .database(&self.db_name)
            .run_command(doc! { "ping": 1i32 })
            .await
            .map(|_: Document| ())
            .with_context(|| format!("MongoDB ping against `{}` failed", self.db_name))
    }
}
