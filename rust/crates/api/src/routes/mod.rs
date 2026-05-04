//! HTTP route modules owned by the api crate. Feature routes live in their
//! own crates and merge into the `/v1` mount point in `router.rs`.

pub mod health;
