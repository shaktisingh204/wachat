//! State slice (Mongo handle) for the wachat-widget-tracking router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatWidgetTrackingState {
    pub mongo: MongoHandle,
}

impl WachatWidgetTrackingState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
