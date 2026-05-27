//! On-disk shape of a `sabcreator_role_assignments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcreatorRoleAssignment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    /// Tenant / owner — the user who created the App and owns its data.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub app_id: ObjectId,

    /// The user being granted the role.
    pub assignee_user_id: ObjectId,

    pub role_id: ObjectId,

    pub assigned_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_by: Option<ObjectId>,
}
