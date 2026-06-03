//! §5.2 Contacts.
//!
//! Mongo collection: `crm_contacts`. A contact is a person tied to a
//! client account (§1.1) — typically created when a Lead converts, but
//! can also be entered directly against an existing customer (e.g. when
//! an account adds a new procurement contact).
//!
//! The shape mirrors §5.1 Lead (same demographic + attribution + scoring
//! fields, same flattened `crm-core` fragments) but adds:
//!   - `account_id` — required FK back to the owning client.
//!   - `relationship` — decision-maker / influencer / champion / blocker.
//!   - `reports_to` — FK to another `Contact`.
//!   - `secondary_owner_id` — second user FK (for shared coverage).
//!
//! Like `Lead`, `status` is the `crm-core::Status` newtype (tenant-
//! configurable vocab) and the `sub_source` field is carried directly
//! on the struct because `Attribution` does not model it.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{
    Assignment, Attachment, Attribution, Audit, CustomFields, Identity, Note, Status, Tags,
};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

use crate::lead::{ActivityLogEntry, Consent};

/// Buyer-relationship classification used to drive account-mapping
/// reports ("does this deal have a verified champion?").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Relationship {
    DecisionMaker,
    Influencer,
    Champion,
    Blocker,
}

/// CRM Contact. Stored in `crm_contacts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    /* ----- crm-core fragments (flattened to document root) -------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub attribution: Attribution,
    #[serde(flatten)]
    pub assignment: Assignment,

    /* ----- account linkage (required) ---------------------------- */
    /// FK into `crm_accounts` — the client this contact represents.
    pub account_id: ObjectId,

    /* ----- name (★ required) ------------------------------------- */
    pub first_name: String,
    pub last_name: String,

    /* ----- contact ------------------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /* ----- attribution extras ------------------------------------ */
    /// See §5.1 — `Attribution` carries source/utm but not sub-source.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_source: Option<String>,

    /* ----- workflow ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_score: Option<i32>,

    /// Primary owner (user FK). `Assignment.assigned_to` is the pipeline
    /// owner; this is the explicit account-relationship owner.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    /// Secondary owner — second user covering this contact (shared
    /// rep, account manager + CSM split, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub secondary_owner_id: Option<ObjectId>,

    /* ----- account-mapping --------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub relationship: Option<Relationship>,

    /// FK into `crm_contacts` — the contact this person reports to
    /// (their manager). Drives org-chart visualization.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reports_to: Option<ObjectId>,

    /* ----- deal-shape -------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub probability_pct: Option<f32>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expected_close: Option<DateTime<Utc>>,

    /* ----- profile ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,

    /* ----- consent ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Consent::is_empty")]
    pub consent: Consent,

    /* ----- bag-of-data fragments --------------------------------- */
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
    #[serde(default, skip_serializing_if = "CustomFields::is_empty")]
    pub custom_fields: CustomFields,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<Note>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub activity_log: Vec<ActivityLogEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_contact() -> Contact {
        Contact {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            attribution: Attribution::default(),
            assignment: Assignment::default(),
            account_id: ObjectId::new(),
            first_name: "Ravi".into(),
            last_name: "Menon".into(),
            email: Some("ravi@acme.example".into()),
            phone: Some("+91 9123456789".into()),
            company: Some("Acme Corp".into()),
            title: Some("VP Procurement".into()),
            sub_source: None,
            status: Some(Status::new("active")),
            lead_score: Some(85),
            owner_id: Some(ObjectId::new()),
            secondary_owner_id: Some(ObjectId::new()),
            relationship: Some(Relationship::DecisionMaker),
            reports_to: Some(ObjectId::new()),
            estimated_value: Some(250_000.0),
            currency: Some("INR".into()),
            probability_pct: Some(60.0),
            expected_close: Some(Utc::now()),
            address: None,
            industry: Some("Manufacturing".into()),
            consent: Consent {
                email: true,
                sms: false,
                whatsapp: false,
            },
            tags: Tags::from_iter(["primary-buyer"]),
            custom_fields: CustomFields::default(),
            attachments: vec![],
            notes: vec![],
            activity_log: vec![],
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let c = sample_contact();
        let json = serde_json::to_value(&c).unwrap();

        // crm-core fragments must flatten to the document root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(
            json.get("attribution").is_none(),
            "Attribution must flatten"
        );
        assert!(json.get("assignment").is_none(), "Assignment must flatten");

        // Identity / Audit fields at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // Contact-specific camelCase fields.
        assert!(json.get("accountId").is_some());
        assert!(json.get("firstName").is_some());
        assert!(json.get("lastName").is_some());
        assert!(json.get("ownerId").is_some());
        assert!(json.get("secondaryOwnerId").is_some());
        assert!(json.get("reportsTo").is_some());
        assert!(json.get("estimatedValue").is_some());
        assert!(json.get("probabilityPct").is_some());

        // Status is transparent string.
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("active"));

        // Relationship serializes as snake_case.
        assert_eq!(
            json.get("relationship").and_then(|v| v.as_str()),
            Some("decision_maker")
        );

        // Round-trip back.
        let s = serde_json::to_string(&c).unwrap();
        let back: Contact = serde_json::from_str(&s).unwrap();
        assert_eq!(back.first_name, c.first_name);
        assert_eq!(back.account_id, c.account_id);
        assert_eq!(back.relationship, Some(Relationship::DecisionMaker));
        assert_eq!(back.consent.email, true);
        assert_eq!(back.consent.sms, false);
        assert_eq!(back.tags.len(), 1);
    }
}
