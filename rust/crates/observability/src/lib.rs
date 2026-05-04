//! `sabnode-observability` — shared tracing + OpenTelemetry bootstrap for every
//! Rust binary in the SabNode workspace.
//!
//! See [`telemetry::init_telemetry`] for the public entry point.
//!
//! # Shutdown
//!
//! Binaries that initialise the OTLP pipeline **must** call
//! [`opentelemetry::global::shutdown_tracer_provider`] from their main function
//! on graceful shutdown (e.g. inside a SIGTERM handler). Without this, in-flight
//! spans buffered by the batch exporter will be dropped instead of flushed to
//! the collector.

pub mod telemetry;

pub use telemetry::init_telemetry;
