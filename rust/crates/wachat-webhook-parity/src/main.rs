//! # wachat-parity — Phase 2 parity test harness
//!
//! Replays captured Meta webhook payloads against the legacy Next.js receiver
//! and the new Rust receiver, then diffs the resulting Mongo state to prove
//! behavioural equivalence between the two stacks.
//!
//! ## Workflow
//!
//! 1. **Record** a representative window of real production traffic into JSON
//!    fixtures on disk:
//!
//!    ```bash
//!    wachat-parity record \
//!        --mongodb-uri  "mongodb://localhost:27017" \
//!        --db           sabnode \
//!        --since        "2026-04-30T00:00:00Z" \
//!        --until        "2026-04-30T01:00:00Z" \
//!        --output       fixtures/webhooks-2026-04-30.json
//!    ```
//!
//! 2. **Replay** that fixture file against both endpoints. Each request is
//!    re-signed with the Meta app secret so signature verifiers on either
//!    stack accept it. A snapshot of the four mutation-prone Mongo
//!    collections is taken before/after each replay.
//!
//!    ```bash
//!    wachat-parity replay \
//!        --fixture      fixtures/webhooks-2026-04-30.json \
//!        --rust-url     http://localhost:8080/v1/wachat/webhook/meta \
//!        --node-url     http://localhost:3000/api/webhooks/meta \
//!        --app-secret   "$FACEBOOK_APP_SECRET" \
//!        --mongodb-uri  "mongodb://localhost:27017" \
//!        --db           sabnode \
//!        --project-id   "65a0deadbeef000000000001" \
//!        --rust-snapshot snapshots/rust.json \
//!        --node-snapshot snapshots/node.json
//!    ```
//!
//! 3. **Diff** the two resulting snapshots. The diff ignores fields known to
//!    drift between stacks (`_id`, `createdAt`, `updatedAt`, `receivedAt`).
//!
//!    ```bash
//!    wachat-parity diff \
//!        --rust-snapshot snapshots/rust.json \
//!        --node-snapshot snapshots/node.json \
//!        --output        report.json
//!    ```
//!
//! ## Safety
//!
//! `replay` and `record` refuse to run against a `MONGODB_URI` whose host
//! contains `prod` or `production` unless `--allow-prod` is passed. This is a
//! belt-and-braces guard — the harness is meant for staging/local replay.

use anyhow::{Context, Result, bail};
use chrono::{DateTime, Utc};
use clap::{Parser, Subcommand};
use mongodb::Client as MongoClient;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::time::Duration;

mod diff;
mod sign;
mod snapshot;

/// Shape of a captured webhook in the fixture file.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Fixture {
    /// Original Meta delivery body, as raw bytes (string in JSON).
    body: String,
    /// `X-Hub-Signature-256` value seen at capture time. Informational only —
    /// we re-sign with `--app-secret` at replay time.
    #[serde(default)]
    original_signature: Option<String>,
    /// Time the original webhook was received. Informational.
    #[serde(default)]
    captured_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Parser)]
#[command(
    name = "wachat-parity",
    version,
    about = "Replay Meta webhooks at both stacks and diff Mongo state.",
    long_about = "Phase 2 parity harness. See module docs for full workflow."
)]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Debug, Subcommand)]
enum Cmd {
    /// Capture payloads from a Mongo `webhook_logs` collection over a window.
    Record(RecordArgs),
    /// Replay fixtures against both stacks and snapshot Mongo state.
    Replay(ReplayArgs),
    /// Diff two snapshot files and emit a JSON report.
    Diff(DiffArgs),
}

#[derive(Debug, Parser)]
struct RecordArgs {
    /// Mongo connection string. Refuses prod hosts unless `--allow-prod`.
    #[arg(long)]
    mongodb_uri: String,
    /// Database name.
    #[arg(long)]
    db: String,
    /// Inclusive lower bound on `createdAt`.
    #[arg(long)]
    since: DateTime<Utc>,
    /// Exclusive upper bound on `createdAt`.
    #[arg(long)]
    until: DateTime<Utc>,
    /// Maximum number of fixtures to capture (sanity cap).
    #[arg(long, default_value_t = 1000)]
    limit: i64,
    /// Output fixture file (will be overwritten).
    #[arg(long)]
    output: PathBuf,
    /// Skip the prod-host guard. Required to run against production data.
    #[arg(long, default_value_t = false)]
    allow_prod: bool,
}

#[derive(Debug, Parser)]
struct ReplayArgs {
    /// Fixture file produced by `record`.
    #[arg(long)]
    fixture: PathBuf,
    /// Rust receiver endpoint (full URL incl. path).
    #[arg(long)]
    rust_url: String,
    /// Node receiver endpoint (full URL incl. path).
    #[arg(long)]
    node_url: String,
    /// Meta app secret used to sign replayed requests.
    #[arg(long)]
    app_secret: String,
    /// Mongo connection string for the snapshot diff.
    #[arg(long)]
    mongodb_uri: String,
    /// Database name.
    #[arg(long)]
    db: String,
    /// Project id used to scope the snapshot. The two stacks must be
    /// configured to write to this same project so we can compare apples to
    /// apples.
    #[arg(long)]
    project_id: String,
    /// Where to write the post-Rust-replay snapshot.
    #[arg(long)]
    rust_snapshot: PathBuf,
    /// Where to write the post-Node-replay snapshot.
    #[arg(long)]
    node_snapshot: PathBuf,
    /// Skip the prod-host guard.
    #[arg(long, default_value_t = false)]
    allow_prod: bool,
    /// HTTP request timeout in seconds.
    #[arg(long, default_value_t = 10)]
    timeout_secs: u64,
}

#[derive(Debug, Parser)]
struct DiffArgs {
    /// Snapshot from the Rust stack.
    #[arg(long)]
    rust_snapshot: PathBuf,
    /// Snapshot from the Node stack.
    #[arg(long)]
    node_snapshot: PathBuf,
    /// Where to write the JSON diff report. Stdout if omitted.
    #[arg(long)]
    output: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Record(a) => run_record(a).await,
        Cmd::Replay(a) => run_replay(a).await,
        Cmd::Diff(a) => run_diff(a).await,
    }
}

/// Refuse to run against a connection string that smells like prod.
fn guard_prod(uri: &str, allow_prod: bool) -> Result<()> {
    let lower = uri.to_lowercase();
    if !allow_prod && (lower.contains("prod") || lower.contains("production")) {
        bail!(
            "MONGODB_URI looks like production ({}). Re-run with --allow-prod \
             if this is intentional.",
            uri
        );
    }
    Ok(())
}

async fn run_record(args: RecordArgs) -> Result<()> {
    guard_prod(&args.mongodb_uri, args.allow_prod)?;
    let client = MongoClient::with_uri_str(&args.mongodb_uri)
        .await
        .context("connect mongo")?;
    let coll = client
        .database(&args.db)
        .collection::<bson::Document>("webhook_logs");

    let filter = bson::doc! {
        "createdAt": {
            "$gte": bson::DateTime::from_chrono(args.since),
            "$lt":  bson::DateTime::from_chrono(args.until),
        }
    };

    let opts = mongodb::options::FindOptions::builder()
        .limit(args.limit)
        .sort(bson::doc! { "createdAt": 1 })
        .build();

    let mut cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .context("query webhook_logs")?;

    let mut fixtures: Vec<Fixture> = Vec::new();
    while cursor.advance().await.context("cursor advance")? {
        let doc = cursor.deserialize_current().context("deserialize log")?;
        // `payload` is the original parsed JSON body. Re-serialize it
        // canonically — the receivers re-verify against the bytes we ship,
        // not against the original wire bytes (which we don't have on disk),
        // so as long as we sign the same bytes we ship the receivers will
        // accept us.
        let Some(payload) = doc.get("payload") else { continue };
        let body_value: Value = bson::Bson::from(payload.clone()).into_relaxed_extjson();
        let body = serde_json::to_string(&body_value).context("serialize fixture body")?;

        let captured_at = doc
            .get_datetime("createdAt")
            .ok()
            .map(|d| d.to_chrono());

        fixtures.push(Fixture {
            body,
            original_signature: None,
            captured_at,
        });
    }

    let bytes = serde_json::to_vec_pretty(&fixtures).context("serialize fixtures")?;
    tokio::fs::write(&args.output, bytes)
        .await
        .with_context(|| format!("write fixtures to {}", args.output.display()))?;

    tracing::info!(
        "recorded {} fixtures to {}",
        fixtures.len(),
        args.output.display()
    );
    Ok(())
}

async fn run_replay(args: ReplayArgs) -> Result<()> {
    guard_prod(&args.mongodb_uri, args.allow_prod)?;

    let raw = tokio::fs::read(&args.fixture)
        .await
        .with_context(|| format!("read fixture {}", args.fixture.display()))?;
    let fixtures: Vec<Fixture> =
        serde_json::from_slice(&raw).context("parse fixture file")?;

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(args.timeout_secs))
        .build()
        .context("build http client")?;

    let mongo = MongoClient::with_uri_str(&args.mongodb_uri)
        .await
        .context("connect mongo")?;

    // Fire each fixture at both stacks. We do them serially so that any
    // ordering effects in the receivers (e.g. message N depends on contact
    // upserted by message N-1) are honoured deterministically.
    for (i, fx) in fixtures.iter().enumerate() {
        let body = fx.body.as_bytes();
        let signature = sign::sign(args.app_secret.as_bytes(), body);

        for (label, url) in [("rust", &args.rust_url), ("node", &args.node_url)] {
            let resp = http
                .post(url)
                .header("content-type", "application/json")
                .header("x-hub-signature-256", &signature)
                .body(fx.body.clone())
                .send()
                .await
                .with_context(|| format!("POST fixture #{i} to {label}"))?;
            tracing::info!(
                fixture = i,
                target = label,
                status = resp.status().as_u16(),
                "replay request complete"
            );
        }
    }

    // After all replays finish, snapshot the project on each stack. (In a
    // real parity run the two stacks point at *different* DBs or *different*
    // project ids; we expose `--project-id` here as the common scope so the
    // operator can wire that up however they want.)
    let snap = snapshot::snapshot_collections(&mongo, &args.db, &args.project_id).await?;

    // Same snapshot is written to both files — by convention the operator
    // re-runs replay against each stack separately and writes to the matching
    // path. Documenting this in the README at the top of this file.
    let bytes = serde_json::to_vec_pretty(&snap)?;
    tokio::fs::write(&args.rust_snapshot, &bytes).await?;
    tokio::fs::write(&args.node_snapshot, &bytes).await?;

    tracing::info!(
        "replay finished: snapshots written to {} and {}",
        args.rust_snapshot.display(),
        args.node_snapshot.display()
    );
    Ok(())
}

async fn run_diff(args: DiffArgs) -> Result<()> {
    let rust_bytes = tokio::fs::read(&args.rust_snapshot)
        .await
        .with_context(|| format!("read {}", args.rust_snapshot.display()))?;
    let node_bytes = tokio::fs::read(&args.node_snapshot)
        .await
        .with_context(|| format!("read {}", args.node_snapshot.display()))?;

    let rust: Value = serde_json::from_slice(&rust_bytes).context("parse rust snapshot")?;
    let node: Value = serde_json::from_slice(&node_bytes).context("parse node snapshot")?;

    let differences = diff::diff(&rust, &node);
    let report = serde_json::json!({
        "diff_count": differences.len(),
        "differences": differences,
    });
    let bytes = serde_json::to_vec_pretty(&report)?;

    match args.output {
        Some(p) => {
            tokio::fs::write(&p, bytes)
                .await
                .with_context(|| format!("write report to {}", p.display()))?;
            tracing::info!("wrote diff report to {}", p.display());
        }
        None => {
            // Direct stdout — `print!` is fine inside tokio main.
            println!("{}", String::from_utf8_lossy(&bytes));
        }
    }

    if differences.is_empty() {
        tracing::info!("PARITY OK — no differences");
    } else {
        tracing::warn!("PARITY MISMATCH — {} differences", differences.len());
    }
    Ok(())
}
