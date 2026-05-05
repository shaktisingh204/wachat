//! Integration tests for the templates pipeline.
//!
//! This crate intentionally exposes no public Rust surface — it exists only
//! as a host for the `tests/` directory, where the end-to-end scenarios live.
//! Keeping the library empty means downstream consumers cannot accidentally
//! depend on test plumbing, and `cargo build -p wachat-templates-tests` is a
//! near-instant no-op.
