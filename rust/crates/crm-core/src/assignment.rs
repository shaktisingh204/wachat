//! `assignedTo`, `teamId`, `pipelineId`, `stageId` — pipeline + ownership.
//!
//! Stage references can be either a plain ObjectId (for entities tracking
//! a stand-alone stage collection) or a composite "pipelineId:stageId"
//! string (today's embedded model on `users.crmPipelines[].stages`).
//! Where the composite form is needed, callers serialize the composite
//! into a separate string field — this fragment carries only the
//! ObjectId form, mirroring the `stageId` field listed in §0.

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Assignment {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pipeline_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage_id: Option<ObjectId>,
}
