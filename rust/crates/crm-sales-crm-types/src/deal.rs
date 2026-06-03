//! §5.3 Deals.
//!
//! Mongo collection: `crm_deals`. A deal is the workable opportunity that
//! moves through a pipeline's stages — created from a converted lead or
//! manually for an existing client. The struct flattens the cross-cutting
//! `crm-core` fragments (`Identity`, `Audit`) at the top so the document
//! root carries §0 ownership / audit fields directly.
//!
//! Per the spec, `pipelineId`, `stageId` and `ownerId` are REQUIRED on a
//! deal — unlike most CRM entities where pipeline/stage assignment is
//! optional. To keep them non-`Option` we declare them directly on the
//! struct rather than flattening `Assignment` (whose fields are all
//! optional). `teamId` (the only other Assignment field a deal might
//! carry) is added explicitly as an optional field.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, CustomFields, Identity, Note, Tags};
use serde::{Deserialize, Serialize};

/// Counter-party on a deal — either an existing `Client` (post-conversion
/// account) or an unconverted `Lead`. Tagged so JSON readers can branch
/// on `kind` without inspecting which id field is populated.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "id", rename_all = "lowercase")]
pub enum DealParty {
    Client(ObjectId),
    Lead(ObjectId),
}

/// Single product line on a deal. Mirrors the §5.3 spec — no taxes /
/// totals here (those live on the downstream Quotation / Invoice the deal
/// converts to). Discount is a percentage (0-100), kept optional so a
/// flat-priced line can serialize without a zero placeholder.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DealProduct {
    pub item_id: ObjectId,
    pub qty: f64,
    pub rate: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discount_pct: Option<f32>,
}

/// Win/Loss workflow state. `Open` is the natural default — the deal is
/// still moving through the pipeline. `Won` / `Lost` close the deal and
/// usually populate `won_lost_reason` + `actual_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DealStatus {
    #[default]
    Open,
    Won,
    Lost,
    Abandoned,
}

/// Activity timeline entry. Same shape as the lead activity log — kept
/// local rather than imported so the two evolve independently if the
/// deal-side gains structured payloads (call recording id, email-thread
/// id, …) before the lead-side does.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLogEntry {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// Free-form kind ("note", "call", "email", "stage_change", …).
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
}

/// CRM Deal. Stored in `crm_deals`.
///
/// `pipeline_id`, `stage_id` and `owner_id` are required (unlike the
/// optional `Assignment` fragment most entities flatten). A deal also
/// always has a counter-party (`DealParty::Client` or `DealParty::Lead`),
/// a title, an amount and an expected close date.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Deal {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- core fields ------------------------------------------- */
    pub title: String,

    /* ----- pipeline + ownership (REQUIRED; not flattened) -------- */
    pub pipeline_id: ObjectId,
    pub stage_id: ObjectId,
    pub owner_id: ObjectId,
    /// Optional team scope. Mirrors `Assignment::team_id` but lives
    /// alongside the required ownership fields for JSON parity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub team_id: Option<ObjectId>,

    /* ----- counter-party ----------------------------------------- */
    pub party: DealParty,

    /* ----- money ------------------------------------------------- */
    pub amount: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    /// Probability of closing, 0-100 (%).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub probability_pct: Option<f32>,

    /* ----- dates ------------------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub expected_close: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub actual_close: Option<DateTime<Utc>>,

    /* ----- workflow + outcome ------------------------------------ */
    #[serde(default)]
    pub status: DealStatus,
    /// Free-form reason text recorded when the deal is marked Won or
    /// Lost. Drives win/loss-reason analytics in §5.7.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub won_lost_reason: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub competitors: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub products: Vec<DealProduct>,

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
    pub activities: Vec<ActivityLogEntry>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_deal() -> Deal {
        Deal {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            title: "Acme — Q3 expansion".into(),
            pipeline_id: ObjectId::new(),
            stage_id: ObjectId::new(),
            owner_id: ObjectId::new(),
            team_id: None,
            party: DealParty::Client(ObjectId::new()),
            amount: 250_000.0,
            currency: Some("INR".into()),
            probability_pct: Some(60.0),
            expected_close: Utc::now(),
            actual_close: None,
            status: DealStatus::Open,
            won_lost_reason: None,
            competitors: vec!["BigCo".into()],
            products: vec![DealProduct {
                item_id: ObjectId::new(),
                qty: 10.0,
                rate: 25_000.0,
                discount_pct: Some(5.0),
            }],
            tags: Tags::from_iter(["expansion", "q3"]),
            custom_fields: CustomFields::default(),
            attachments: vec![],
            notes: vec![],
            activities: vec![ActivityLogEntry {
                at: Utc::now(),
                kind: "stage_change".into(),
                by: None,
                summary: Some("Moved to Negotiation".into()),
            }],
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments() {
        let d = sample_deal();
        let json = serde_json::to_value(&d).unwrap();

        // Identity + Audit must flatten to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // Required deal fields appear at root in camelCase.
        assert!(json.get("title").is_some());
        assert!(json.get("pipelineId").is_some());
        assert!(json.get("stageId").is_some());
        assert!(json.get("ownerId").is_some());
        assert!(json.get("expectedClose").is_some());
        assert!(json.get("amount").is_some());

        // Status enum serializes lowercase.
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("open"));

        // Tagged DealParty: kind + id, lowercase.
        let party = json.get("party").unwrap();
        assert_eq!(party.get("kind").and_then(|v| v.as_str()), Some("client"));
        assert!(party.get("id").is_some());

        // Round-trip back.
        let s = serde_json::to_string(&d).unwrap();
        let back: Deal = serde_json::from_str(&s).unwrap();
        assert_eq!(back.title, d.title);
        assert_eq!(back.amount, d.amount);
        assert_eq!(back.status, d.status);
        assert_eq!(back.competitors, d.competitors);
        assert_eq!(back.products.len(), d.products.len());
    }
}
