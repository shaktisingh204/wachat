//! State slice (Mongo handle) for the wachat-ads-roadmap router.
use sabnode_db::mongo::MongoHandle;

#[derive(Clone)]
pub struct WachatAdsRoadmapState {
    pub mongo: MongoHandle,
}

impl WachatAdsRoadmapState {
    pub fn new(mongo: MongoHandle) -> Self {
        Self { mongo }
    }
}
