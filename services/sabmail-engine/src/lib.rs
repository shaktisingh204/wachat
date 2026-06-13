//! SabMail engine library crate.
//!
//! The Rust backend for the SabMail module. The Next.js layer
//! (`src/lib/sabmail/engine-client.ts`) is a thin client over this HTTP
//! service. Owns the heavy/long-running work: SMTP send (lettre),
//! journey execution, and inbound binding (conversation + screener +
//! rules). Reads/writes the same `sabmail_*` Mongo collections the
//! TypeScript side uses, so the two can coexist (engine = source of
//! truth for send/journeys when `SABMAIL_ENABLED=true`).

pub mod auth;
pub mod config;
pub mod creds;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod inbound;
pub mod journeys;
pub mod send;
pub mod state;
