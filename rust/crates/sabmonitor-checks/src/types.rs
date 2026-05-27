//! On-disk shape of a `sabmonitor_checks` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmonitorCheck {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    /// `http` | `tcp` | `dns` | `ssl` | `ping` | `synthetic_browser` | `api_transaction`
    pub kind: String,

    /* ----- target ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub port: Option<i32>,

    /* ----- schedule + regions ----- */
    pub interval_secs: i32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub regions: Vec<String>,

    /* ----- request shape ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headers_json: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body_json: Option<String>,

    /* ----- assertions ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_status: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_body_contains: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_body_regex: Option<String>,

    /* ----- SSL ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssl_expiry_warn_days: Option<i32>,

    /* ----- linked script refs ----- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub synthetic_script_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_transaction_id: Option<ObjectId>,

    /* ----- tagging ----- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,

    /* ----- lifecycle ----- */
    /// `active` | `paused`
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_run_at: Option<BsonDateTime>,
    /// `up` | `down` | `warning` | `unknown`
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_status: Option<String>,

    /* ----- audit ----- */
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
