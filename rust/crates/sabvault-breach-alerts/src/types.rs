//! On-disk shape of a `sabvault_breach_alerts` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum BreachStatus {
    /// Provider lookup found no breaches.
    Clean,
    /// Provider lookup found at least one breach.
    Breached,
    /// Not yet checked or provider returned an error.
    #[default]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabvaultBreachAlert {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Owner of the secret (tenant anchor).
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub secret_id: ObjectId,
    pub status: BreachStatus,
    pub last_checked_at: BsonDateTime,

    /// Breach source — e.g. `"hibp"` (Have I Been Pwned) or a future
    /// provider. Free-form to keep room for swap-ins.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breach_source_url: Option<String>,
    /// How many breached datasets this credential appeared in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub breach_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}
