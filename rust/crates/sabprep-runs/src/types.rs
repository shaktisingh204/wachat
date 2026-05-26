//! On-disk shape of a `sabprep_runs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use sabprep_steps::{StepError, StepRunSummary};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabprepRun {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub recipe_id: ObjectId,
    pub started_at: BsonDateTime,
    pub finished_at: BsonDateTime,
    /// `"ok"` | `"partial"` | `"failed"`.
    pub status: String,
    pub rows_in: i64,
    pub rows_out: i64,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<StepError>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub summaries: Vec<StepRunSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_dataset_id: Option<ObjectId>,
}
