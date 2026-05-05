//! Shared application state slice for the templates-actions facade.
//!
//! Holds handles to every engine the action-shaped endpoints delegate
//! to. Cheap to clone — every field is `Arc`-backed.

use std::sync::Arc;

use sabnode_db::mongo::MongoHandle;
use wachat_templates::TemplatesReader;
use wachat_templates_categories::TemplatesLibrary;
use wachat_templates_mutate::TemplatesMutator;
use wachat_templates_sync::TemplatesSyncer;

/// Bundle of handles consumed by the templates-actions router.
///
/// Mirrors `wachat_templates_router::TemplatesState` minus the sender
/// (this crate does not expose a `send` action).
#[derive(Clone)]
pub struct WachatTemplatesActionsState {
    pub reader: Arc<TemplatesReader>,
    pub mutator: Arc<TemplatesMutator>,
    pub syncer: Arc<TemplatesSyncer>,
    pub library: Arc<TemplatesLibrary>,
    pub mongo: MongoHandle,
}

impl WachatTemplatesActionsState {
    pub fn new(
        reader: Arc<TemplatesReader>,
        mutator: Arc<TemplatesMutator>,
        syncer: Arc<TemplatesSyncer>,
        library: Arc<TemplatesLibrary>,
        mongo: MongoHandle,
    ) -> Self {
        Self {
            reader,
            mutator,
            syncer,
            library,
            mongo,
        }
    }
}
