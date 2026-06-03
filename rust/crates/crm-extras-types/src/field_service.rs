//! §12.11 Field Service.
//!
//! Two top-level entities live in this module:
//! - `AmcContract` (Mongo collection `crm_amc_contracts`) — a recurring
//!   service contract (annual maintenance contract / AMC) that covers a
//!   list of customer assets for a fixed window with a billing cadence
//!   and an escalation matrix.
//! - `ServiceRequest` (Mongo collection `crm_service_requests`) — one
//!   field-service ticket. Optionally tied to an `AmcContract` so AMC
//!   visits draw from the parent coverage / billing terms.
//!
//! Each struct flattens the `crm-core` cross-cutting fragments
//! (`Identity`, `Audit`, plus `Assignment` on `ServiceRequest` so the
//! dispatcher can use the standard pipeline/team plumbing) so the
//! document root carries the §0 ownership and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Audit, Identity, Priority};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

/* ============================================================== */
/*  AMC contract                                                   */
/* ============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AmcContractStatus {
    #[default]
    Active,
    Expired,
    Terminated,
    Renewed,
}

/// One asset row inside an AMC. `included = false` lets the operator
/// list excluded equipment (commonly to surface "this asset is *not*
/// covered" on the customer-portal contract preview) without splitting
/// the contract into two documents.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmcCoverageItem {
    pub asset_id: ObjectId,
    pub included: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AmcContract {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- parties + scope -------------------------------------- */
    pub customer_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<AmcCoverageItem>,

    /* ----- coverage terms --------------------------------------- */
    /// Free-form vocabulary, but the spec calls out
    /// `comprehensive` | `non_comprehensive` | `breakdown_only`.
    pub coverage: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub end: DateTime<Utc>,
    /// Free-form vocabulary, but the spec calls out
    /// `monthly` | `quarterly` | `yearly`.
    pub frequency: String,

    /* ----- ops -------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub technician_id: Option<ObjectId>,

    /* ----- billing ---------------------------------------------- */
    pub billing_currency: String,
    pub billing_amount: f64,

    /* ----- escalation ------------------------------------------- */
    /// Free-form JSON ladder (level, role, contact, after-hours).
    /// Stored opaque so the schema can evolve without churning this
    /// crate.
    pub escalation_matrix: serde_json::Value,

    /* ----- workflow --------------------------------------------- */
    #[serde(default)]
    pub status: AmcContractStatus,
}

/* ============================================================== */
/*  Service request                                                */
/* ============================================================== */

/// Field-service ticket lifecycle. Multi-word variants serialize as
/// `snake_case` (`en_route`, `in_progress`) to match the §0 enum
/// convention.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServiceRequestStatus {
    #[default]
    New,
    Scheduled,
    EnRoute,
    InProgress,
    Completed,
    Cancelled,
}

/// One consumed inventory line on a `ServiceRequest`. The CRM debits
/// `qty` from `item_id`'s on-hand stock when the request closes.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PartUsed {
    pub item_id: ObjectId,
    pub qty: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRequest {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- parties + scope -------------------------------------- */
    pub customer_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amc_contract_id: Option<ObjectId>,

    /* ----- ticket header ---------------------------------------- */
    /// Free-form vocabulary, but the spec calls out
    /// `installation` | `repair` | `maintenance` | `inspection`.
    pub request_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<Address>,

    /* ----- visit ------------------------------------------------ */
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub scheduled_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub technician_id: Option<ObjectId>,

    /* ----- field report ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub parts_used: Vec<PartUsed>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_spent_minutes: Option<u32>,
    /// SabFile ids of on-site photos.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub photos: Vec<ObjectId>,
    /// SabFile id of the captured customer signature.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_signature_file_id: Option<ObjectId>,

    /* ----- billing crosslink ------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invoice_id: Option<ObjectId>,

    /* ----- workflow --------------------------------------------- */
    #[serde(default)]
    pub status: ServiceRequestStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

/* ============================================================== */
/*  Tests                                                          */
/* ============================================================== */

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn amc_contract_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let amc = AmcContract {
            identity: identity(),
            audit: audit(),
            customer_id: ObjectId::new(),
            items: vec![AmcCoverageItem {
                asset_id: ObjectId::new(),
                included: true,
                notes: Some("Front-office HVAC".to_string()),
            }],
            coverage: "comprehensive".to_string(),
            start: now,
            end: now,
            frequency: "quarterly".to_string(),
            technician_id: Some(ObjectId::new()),
            billing_currency: "INR".to_string(),
            billing_amount: 48000.0,
            escalation_matrix: serde_json::json!([
                { "level": 1, "role": "technician", "afterHours": false },
                { "level": 2, "role": "supervisor", "afterHours": true }
            ]),
            status: AmcContractStatus::Active,
        };

        let json = serde_json::to_value(&amc).unwrap();

        // Flattened crm-core fragments live at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // Nested fragment keys must NOT exist.
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        // Entity-specific camelCase fields.
        assert!(json.get("customerId").is_some());
        assert!(json.get("billingCurrency").is_some());
        assert!(json.get("billingAmount").is_some());
        assert!(json.get("escalationMatrix").is_some());
        // Status serializes lowercase.
        assert_eq!(json.get("status").unwrap(), "active");
        assert_eq!(json.get("coverage").unwrap(), "comprehensive");

        let back: AmcContract = serde_json::from_value(json).unwrap();
        assert_eq!(back.billing_currency, "INR");
        assert!(matches!(back.status, AmcContractStatus::Active));
        assert_eq!(back.items.len(), 1);
    }

    #[test]
    fn service_request_round_trips_with_flattened_fragments() {
        let req = ServiceRequest {
            identity: identity(),
            audit: audit(),
            assignment: Assignment::default(),
            customer_id: ObjectId::new(),
            asset_id: Some(ObjectId::new()),
            amc_contract_id: None,
            request_type: "repair".to_string(),
            priority: Some(Priority::High),
            location: Some(Address {
                line1: Some("221B Baker St".to_string()),
                ..Default::default()
            }),
            scheduled_at: Some(Utc::now()),
            technician_id: Some(ObjectId::new()),
            parts_used: vec![PartUsed {
                item_id: ObjectId::new(),
                qty: 2.0,
            }],
            time_spent_minutes: Some(90),
            photos: vec![ObjectId::new()],
            customer_signature_file_id: Some(ObjectId::new()),
            invoice_id: None,
            status: ServiceRequestStatus::InProgress,
            notes: Some("Compressor humming".to_string()),
        };

        let json = serde_json::to_value(&req).unwrap();

        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("assignment").is_none());
        assert!(json.get("customerId").is_some());
        assert!(json.get("requestType").is_some());
        assert!(json.get("scheduledAt").is_some());
        assert!(json.get("partsUsed").is_some());
        assert!(json.get("timeSpentMinutes").is_some());
        assert!(json.get("customerSignatureFileId").is_some());
        // Status serializes snake_case (multi-word).
        assert_eq!(json.get("status").unwrap(), "in_progress");
        assert_eq!(json.get("priority").unwrap(), "high");

        let back: ServiceRequest = serde_json::from_value(json).unwrap();
        assert_eq!(back.request_type, "repair");
        assert!(matches!(back.status, ServiceRequestStatus::InProgress));
        assert_eq!(back.parts_used.len(), 1);
    }
}
