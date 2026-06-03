//! §5.1 Leads.
//!
//! Mongo collection: `crm_leads`. A lead is a pre-qualified contact that
//! has not yet been linked to a client account. Once converted, the lead
//! is replaced by a `Contact` (§5.2) tied to the resulting `Client`
//! (§1.1) — the lead row itself is preserved for attribution / reporting
//! and gets a backward `lineage` pointer onto the new contact.
//!
//! The struct flattens the cross-cutting `crm-core` fragments (`Identity`,
//! `Audit`, `Attribution`, `Assignment`) so the document root carries §0
//! ownership / audit / attribution / pipeline fields directly. `Status`
//! is the transparent string newtype from `crm-core` — lead-stage vocab
//! is tenant-configurable so a closed enum would not survive contact with
//! production.
//!
//! `Attribution` already carries `source` + `campaignId` + `utm{...}`,
//! but the §5.1 spec lists a separate "Sub-source" dimension that
//! Attribution does not model. We add `sub_source` directly on `Lead`.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{
    Assignment, Attachment, Attribution, Audit, CustomFields, Identity, Note, Status, Tags,
};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

/// Per-channel marketing-consent flags. All default to `false` — opt-in
/// is explicit. The struct itself uses `#[serde(default)]` so a missing
/// `consent` object on read deserializes cleanly.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Consent {
    #[serde(default, skip_serializing_if = "is_false")]
    pub email: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub sms: bool,
    #[serde(default, skip_serializing_if = "is_false")]
    pub whatsapp: bool,
}

impl Consent {
    pub fn is_empty(&self) -> bool {
        !self.email && !self.sms && !self.whatsapp
    }
}

fn is_false(b: &bool) -> bool {
    !*b
}

/// Single entry in the lead's activity log. `kind` is intentionally
/// free-text ("call", "email", "stage_change", "note_added", …) — every
/// tenant logs slightly different activity verbs and a closed enum
/// would force a churn cycle each time the UI grows a new event type.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLogEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// CRM Lead. Stored in `crm_leads`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Lead {
    /* ----- crm-core fragments (flattened to document root) -------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,
    #[serde(flatten)]
    pub attribution: Attribution,
    #[serde(flatten)]
    pub assignment: Assignment,

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
    /// Sub-classification under `attribution.source` (e.g. when source
    /// is "Referral", sub_source might be "Existing Customer" /
    /// "Partner"). Not modeled by `Attribution` so it lives here.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_source: Option<String>,

    /* ----- workflow ---------------------------------------------- */
    /// Tenant-configurable stage / status string. Vocab examples:
    /// "new", "contacted", "qualified", "unqualified", "converted",
    /// "lost". Validated by the action layer, not by the type system.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<Status>,

    /// 0-100 lead score. Stored as `i32` so a tenant can run a
    /// disqualifying scoring rule that drives the score negative
    /// (e.g. -50 for blacklisted domains) without overflow surprises.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_score: Option<i32>,

    /// Owner (user FK). The §0 `Assignment.assigned_to` carries the
    /// pipeline-side owner; this is the explicit lead-owner field
    /// listed in the §5.1 spec. Both can be set independently — e.g.
    /// owner = SDR who logged the lead, assignedTo = AE the lead was
    /// routed to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    /* ----- deal-shape ('estimated' fields, not yet a Deal) ------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub estimated_value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Win probability as a 0-100 percentage.
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

    fn sample_lead() -> Lead {
        Lead {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            attribution: Attribution::default(),
            assignment: Assignment::default(),
            first_name: "Asha".into(),
            last_name: "Iyer".into(),
            email: Some("asha@acme.example".into()),
            phone: Some("+91 9876543210".into()),
            company: Some("Acme Corp".into()),
            title: Some("CTO".into()),
            sub_source: Some("Existing Customer".into()),
            status: Some(Status::new("qualified")),
            lead_score: Some(72),
            owner_id: Some(ObjectId::new()),
            estimated_value: Some(125_000.0),
            currency: Some("INR".into()),
            probability_pct: Some(40.0),
            expected_close: Some(Utc::now()),
            address: None,
            industry: Some("SaaS".into()),
            consent: Consent {
                email: true,
                sms: false,
                whatsapp: true,
            },
            tags: Tags::from_iter(["inbound", "q3"]),
            custom_fields: CustomFields::default(),
            attachments: vec![],
            notes: vec![],
            activity_log: vec![ActivityLogEntry {
                at: Utc::now(),
                kind: "stage_change".into(),
                by: None,
                summary: Some("new -> qualified".into()),
            }],
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let lead = sample_lead();
        let json = serde_json::to_value(&lead).unwrap();

        // crm-core fragments must flatten to the document root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(
            json.get("attribution").is_none(),
            "Attribution must flatten"
        );
        assert!(json.get("assignment").is_none(), "Assignment must flatten");

        // Identity / Audit fields appear at root.
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("firstName").is_some());
        assert!(json.get("lastName").is_some());
        assert!(json.get("subSource").is_some());
        assert!(json.get("leadScore").is_some());
        assert!(json.get("estimatedValue").is_some());
        assert!(json.get("probabilityPct").is_some());
        assert!(json.get("expectedClose").is_some());
        assert!(json.get("ownerId").is_some());

        // Status is a transparent string newtype.
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("qualified")
        );

        // Consent serializes as a nested camelCase object.
        assert_eq!(
            json.pointer("/consent/email").and_then(|v| v.as_bool()),
            Some(true)
        );
        // Default-false consent fields are skipped.
        assert!(json.pointer("/consent/sms").is_none());

        // Round-trip back.
        let s = serde_json::to_string(&lead).unwrap();
        let back: Lead = serde_json::from_str(&s).unwrap();
        assert_eq!(back.first_name, lead.first_name);
        assert_eq!(back.last_name, lead.last_name);
        assert_eq!(back.lead_score, lead.lead_score);
        assert_eq!(back.consent.email, true);
        assert_eq!(back.consent.whatsapp, true);
        assert_eq!(back.activity_log.len(), 1);
        assert_eq!(back.activity_log[0].kind, "stage_change");
        assert_eq!(back.tags.len(), 2);
    }
}
