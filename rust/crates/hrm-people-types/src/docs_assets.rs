//! §10 Docs & Assets — Employee Documents, Document Templates, the
//! Asset Register, and Asset Assignments. Each top-level entity
//! flattens `crm-core` `Identity` + `Audit`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* =============================================================== */
/* Employee Documents                                              */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmployeeDocument {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub employee_id: ObjectId,
    /// Free-form: "pan", "aadhaar", "passport", "offer_letter", "nda", ...
    pub doc_type: String,
    /// SabFiles file id.
    pub file_id: ObjectId,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub issued: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
    #[serde(default)]
    pub verified: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub verified_by: Option<ObjectId>,
}

/* =============================================================== */
/* Document Templates                                              */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentTemplate {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub name: String,
    /// "offer_letter" | "appointment" | "nda" | "contract" | "experience_letter"
    pub kind: String,
    pub body_html: String,
    /// Names of `{{ }}` placeholders the template references.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<String>,
}

/* =============================================================== */
/* Asset Register                                                  */
/* =============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AssetCondition {
    #[default]
    New,
    Good,
    Fair,
    Damaged,
    Lost,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus {
    #[default]
    Available,
    Assigned,
    InRepair,
    Retired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Human-friendly tag printed on the device ("LAP-0421").
    pub asset_id: String,
    /// "laptop" | "monitor" | "phone" | "vehicle" | ...
    pub asset_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub serial: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default)]
    pub condition: AssetCondition,
    #[serde(default)]
    pub status: AssetStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
}

/* =============================================================== */
/* Asset Assignments                                               */
/* =============================================================== */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetAssignment {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub asset_id: ObjectId,
    pub employee_id: ObjectId,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub assigned_from: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub assigned_to: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub return_condition: Option<AssetCondition>,
    /// SabFiles ids of pickup / return photos.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub photos: Vec<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        Audit {
            created_at: Utc::now(),
            updated_at: Utc::now(),
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn asset_round_trips_with_flattened_fragments() {
        let asset = Asset {
            identity: ident(),
            audit: audit(),
            asset_id: "LAP-0421".into(),
            asset_type: "laptop".into(),
            model: Some("MBP 14 M3".into()),
            serial: Some("ABC123".into()),
            value: Some(180_000.0),
            condition: AssetCondition::Good,
            status: AssetStatus::InRepair,
            location: Some("HQ".into()),
        };

        let json = serde_json::to_value(&asset).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("assetId").is_some());
        assert_eq!(
            json.get("condition").and_then(|v| v.as_str()),
            Some("good"),
            "AssetCondition serializes lowercase"
        );
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("in_repair"),
            "AssetStatus serializes snake_case"
        );
        let back: Asset = serde_json::from_value(json).unwrap();
        assert_eq!(back.asset_id, "LAP-0421");
        assert_eq!(back.status, AssetStatus::InRepair);
    }
}
