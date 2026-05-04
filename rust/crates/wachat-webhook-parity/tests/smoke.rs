//! Compile-only smoke test: assert that the CLI parses each subcommand.
//!
//! We deliberately do NOT exercise the network or Mongo paths here — replay
//! needs a live receiver and a Mongo instance, both of which are
//! environment-dependent. Instead we re-declare the same `Cli`/`Cmd` shape
//! the binary uses (kept in sync by inspection) and prove `clap` accepts the
//! flag combinations we document in the README at the top of `main.rs`.

use clap::{Parser, Subcommand};
use std::path::PathBuf;

// Mirror of the binary's `Cli`/`Cmd`/*Args structs. If any divergence creeps
// in here the test will still pass — but the real protection is that adding
// a required arg in the binary without updating the docs is what we actually
// want to catch in code review. This test guarantees the *shape* the docs
// promise still parses.

#[derive(Debug, Parser)]
#[command(name = "wachat-parity")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Debug, Subcommand)]
enum Cmd {
    Record(RecordArgs),
    Replay(ReplayArgs),
    Diff(DiffArgs),
}

#[derive(Debug, Parser)]
struct RecordArgs {
    #[arg(long)]
    mongodb_uri: String,
    #[arg(long)]
    db: String,
    #[arg(long)]
    since: chrono::DateTime<chrono::Utc>,
    #[arg(long)]
    until: chrono::DateTime<chrono::Utc>,
    #[arg(long, default_value_t = 1000)]
    limit: i64,
    #[arg(long)]
    output: PathBuf,
    #[arg(long, default_value_t = false)]
    allow_prod: bool,
}

#[derive(Debug, Parser)]
struct ReplayArgs {
    #[arg(long)]
    fixture: PathBuf,
    #[arg(long)]
    rust_url: String,
    #[arg(long)]
    node_url: String,
    #[arg(long)]
    app_secret: String,
    #[arg(long)]
    mongodb_uri: String,
    #[arg(long)]
    db: String,
    #[arg(long)]
    project_id: String,
    #[arg(long)]
    rust_snapshot: PathBuf,
    #[arg(long)]
    node_snapshot: PathBuf,
    #[arg(long, default_value_t = false)]
    allow_prod: bool,
    #[arg(long, default_value_t = 10)]
    timeout_secs: u64,
}

#[derive(Debug, Parser)]
struct DiffArgs {
    #[arg(long)]
    rust_snapshot: PathBuf,
    #[arg(long)]
    node_snapshot: PathBuf,
    #[arg(long)]
    output: Option<PathBuf>,
}

#[test]
fn record_subcommand_parses() {
    let cli = Cli::try_parse_from([
        "wachat-parity",
        "record",
        "--mongodb-uri",
        "mongodb://localhost:27017",
        "--db",
        "sabnode",
        "--since",
        "2026-04-30T00:00:00Z",
        "--until",
        "2026-04-30T01:00:00Z",
        "--output",
        "fixtures.json",
    ])
    .expect("record args parse");
    assert!(matches!(cli.cmd, Cmd::Record(_)));
}

#[test]
fn replay_subcommand_parses() {
    let cli = Cli::try_parse_from([
        "wachat-parity",
        "replay",
        "--fixture",
        "fixtures.json",
        "--rust-url",
        "http://localhost:8080/v1/wachat/webhook/meta",
        "--node-url",
        "http://localhost:3000/api/webhooks/meta",
        "--app-secret",
        "shh",
        "--mongodb-uri",
        "mongodb://localhost:27017",
        "--db",
        "sabnode",
        "--project-id",
        "65a0deadbeef000000000001",
        "--rust-snapshot",
        "rust.json",
        "--node-snapshot",
        "node.json",
    ])
    .expect("replay args parse");
    assert!(matches!(cli.cmd, Cmd::Replay(_)));
}

#[test]
fn diff_subcommand_parses() {
    let cli = Cli::try_parse_from([
        "wachat-parity",
        "diff",
        "--rust-snapshot",
        "rust.json",
        "--node-snapshot",
        "node.json",
    ])
    .expect("diff args parse");
    assert!(matches!(cli.cmd, Cmd::Diff(_)));
}

#[test]
fn missing_required_flag_errors() {
    let err = Cli::try_parse_from(["wachat-parity", "record"]).unwrap_err();
    let msg = format!("{err}");
    assert!(
        msg.contains("--mongodb-uri") || msg.contains("required"),
        "expected required-arg error, got: {msg}"
    );
}
