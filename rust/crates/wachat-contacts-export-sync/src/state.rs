//! State slice (Mongo handle) for the wachat-contacts-export-sync router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatContactsExportSyncState { pub mongo: MongoHandle }
impl WachatContactsExportSyncState { pub fn new(mongo: MongoHandle) -> Self { Self { mongo } } }
