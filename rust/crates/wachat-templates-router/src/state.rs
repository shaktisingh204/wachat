//! Application state slice consumed by the templates router.
//!
//! The router is generic over the caller's outer state `S` and only asks
//! for two things via [`FromRef`]:
//!
//! 1. A [`TemplatesState`] — the bundle of engine handles below.
//! 2. An `Arc<sabnode_auth::AuthConfig>` — the JWT verifier the
//!    [`AuthUser`](sabnode_auth::AuthUser) extractor reads.
//!
//! Each engine handle is internally `Arc`-backed and cheap to clone, so
//! the bundle itself is also cheap. The orchestrating `api` crate
//! constructs a single `TemplatesState` at boot and exposes it from its
//! `AppState` via `FromRef`.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;
use wachat_templates::TemplatesReader;
use wachat_templates_categories::TemplatesLibrary;
use wachat_templates_mutate::TemplatesMutator;
use wachat_templates_send::TemplateSender;
use wachat_templates_sync::TemplatesSyncer;

/// Bundle of engine handles the templates router needs to satisfy every
/// route. Clone is cheap — every field is `Arc`-backed.
///
/// `mongo` is held alongside the engines because several handlers need
/// to look up a `Project` document to enforce per-project tenancy
/// (`AuthUser::tenant_id == project.userId.to_hex()`) before delegating
/// to an engine that takes `&Project`.
#[derive(Clone)]
pub struct TemplatesState {
    pub reader: Arc<TemplatesReader>,
    pub mutator: Arc<TemplatesMutator>,
    pub syncer: Arc<TemplatesSyncer>,
    pub library: Arc<TemplatesLibrary>,
    pub sender: Arc<TemplateSender>,
    /// Mongo handle for direct project lookups (per-project tenancy
    /// guard runs before delegating to the engines that need a
    /// `&Project`).
    pub mongo: MongoHandle,
}
