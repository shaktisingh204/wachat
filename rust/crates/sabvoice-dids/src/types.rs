//! On-disk shape of a `sabvoice_dids` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VoiceDid {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// E.164 phone number (e.g. `+14155552671`).
    pub number: String,

    /// ISO-3166 alpha-2 country code, lowercased.
    pub country: String,

    /// Whichever of voice/sms/mms this DID supports.
    #[serde(default)]
    pub capabilities: Vec<String>,

    /// `"active"` | `"pending"` | `"released"`.
    pub status: String,

    /// Friendly label users can attach.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,

    /// Upstream provider — `"twilio"` | `"plivo"` | `"mock"`.
    pub provider: String,

    /// Reference id at the upstream provider (e.g. Twilio SID).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_ref: Option<String>,

    /// Monthly recurring cost in the listed currency.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub monthly_cost: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /// Optional routing target — an IVR id, queue id, or user id.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route_to_ivr_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route_to_queue_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub route_to_user_id: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
