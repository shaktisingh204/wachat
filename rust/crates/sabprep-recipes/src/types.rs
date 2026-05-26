//! On-disk shape of a `sabprep_recipes` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use sabprep_steps::Step;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabprepRecipe {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Required for non-ad-hoc recipes. ID of a row-set in
    /// `sabprep_outputs` or (when wired) `bi_datasets`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_dataset_id: Option<ObjectId>,

    /// Resolved column names for autocomplete + profiling. Cached at save
    /// time off the source dataset preview.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub source_columns: Vec<String>,

    /// Ordered list of transformations.
    #[serde(default)]
    pub steps: Vec<Step>,

    /// Last run's output dataset id (if any). Refreshed by `POST /run`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_dataset_id: Option<ObjectId>,

    /// Last run id — handy for "open last run" affordances in the UI.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run_id: Option<ObjectId>,

    /// Optional cron — when set, the scheduler picks the recipe up.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schedule_cron: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,

    /// `"active"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
