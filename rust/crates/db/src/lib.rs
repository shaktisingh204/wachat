//! SabNode `db` crate: thin, opinionated wrappers around the MongoDB and
//! Redis clients used by every business-logic crate in the Rust backend.
//!
//! Goals:
//! - One way to construct each client (consistent pool sizing, app name, TLS).
//! - Cheap, cloneable handles that can live in Axum app state.
//! - A small set of BSON helpers that map naturally to `ApiError`.
//!
//! Re-exports:
//! - [`mongo`] — MongoDB connection + collection helpers.
//! - [`redis`] — Redis (fred) client wrapper.
//! - [`bson_helpers`] — `ObjectId` parsing helpers tied to `ApiError`.

pub mod bson_helpers;
pub mod mongo;
pub mod redis;

pub use bson_helpers::{oid_from_str, oid_to_str};
pub use mongo::MongoHandle;
pub use redis::RedisHandle;
