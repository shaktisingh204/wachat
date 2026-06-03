//! §1.1 Clients & Prospects.
//!
//! A unified record for both prospects (pre-conversion) and customers
//! (post-conversion). The `client_type` discriminator is the only thing
//! distinguishing the two — every other field applies to both stages so
//! a prospect → customer transition is a single field flip rather than
//! a record migration.
//!
//! Mongo collection: `crm_accounts` (named "accounts" in the TS code
//! because it stores the account-level entity; the §13 lookup registry
//! exposes it under the `client` entity key).

use crate::address::Address;
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Assignment, Attachment, Attribution, Audit, CustomFields, Identity, Note, Tags};
use serde::{Deserialize, Serialize};

/// Prospect (lead-converted, not yet billed) vs. Customer (billed at
/// least once). Both live in the same collection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientType {
    #[default]
    Prospect,
    Customer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaxPreference {
    #[default]
    Taxable,
    Exempt,
}

/// Channels supported by the CRM contact pipeline. Used by the
/// `preferredContactChannel` field.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContactChannel {
    Email,
    Phone,
    Whatsapp,
    Telegram,
    Sms,
}

/// Email + phone book. Primary is required; `alt` is a free-form
/// list (kept as plain strings — there's no per-row metadata yet).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactBook {
    pub primary_email: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub alt_emails: Vec<String>,
    pub primary_phone: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub alt_phones: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub whatsapp: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub telegram: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub linkedin: Option<String>,
    /// Twitter / X handle.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub twitter: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub website: Option<String>,
}

/// Opening-balance pair (amount + as-of date). When migrating an
/// existing customer in, this seeds the AR ledger so reports start
/// from a known baseline.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpeningBalance {
    pub amount: f64,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub as_of: DateTime<Utc>,
}

/// CRM Client (Prospect / Customer). Stored in `crm_accounts`.
///
/// The struct flattens cross-cutting `crm-core` fragments so callers
/// using the BSON serializer get the §0 fields at the document root —
/// no nested wrapper, matching the TS shape. Fields that map to a
/// fragment are not redeclared (e.g. there is no `tags: Vec<String>`
/// here — the flattened `Tags` newtype provides it).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Client {
    /* ----- crm-core fragments (flattened to document root) -------- */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- entity discriminator + name ---------------------------- */
    #[serde(default)]
    pub client_type: ClientType,

    pub first_name: String,
    pub last_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub salutation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub company_name: Option<String>,

    /* ----- India statutory ids ------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pan: Option<String>,
    /// Aadhaar is stored masked (only the last four digits) per the
    /// privacy guidance in the original TS spec. Callers that capture
    /// the full number must mask before persisting.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub aadhaar_masked: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cin: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub msme_no: Option<String>,

    /* ----- profile ------------------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sub_industry: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub designation: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub department: Option<String>,

    /* ----- contact book ------------------------------------------- */
    pub contact: ContactBook,

    /* ----- billing prefs ------------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price_list_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_limit: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_period_days: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_terms: Option<String>,

    /* ----- tax ---------------------------------------------------- */
    #[serde(default)]
    pub tax_preference: TaxPreference,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tax_registration_no: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub place_of_supply: Option<String>,

    /* ----- addresses ---------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing_address: Option<Address>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub shipping_addresses: Vec<Address>,

    /* ----- defaults ----------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_warehouse_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_agent_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_discount_pct: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_tax_rate_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opening_balance: Option<OpeningBalance>,

    /* ----- attribution + assignment + lead state ----------------- */
    #[serde(flatten)]
    pub attribution: Attribution,
    #[serde(flatten)]
    pub assignment: Assignment,
    /// Sales-CRM lead score (0-100). Optional; empty for pure customers
    /// that never went through scoring.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lead_score: Option<i32>,

    /* ----- soft profile ------------------------------------------ */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_file_id: Option<ObjectId>,
    /// Date of birth. Stored as a UTC timestamp (00:00 UTC on the day)
    /// because BSON has no date-only type.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub dob: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub anniversary: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferred_contact_channel: Option<ContactChannel>,
    /// IETF BCP 47 tag — "en", "hi", "en-IN", …
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preferred_language: Option<String>,
    /// IANA tz name — "Asia/Kolkata", "America/New_York", …
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
    /// 1-5 internal star rating.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_rating: Option<u8>,
    /// Loyalty-program tier label ("silver", "gold", "platinum", …).
    /// Free-form because tiers are tenant-configurable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub loyalty_tier: Option<String>,

    /* ----- bag-of-data fragments --------------------------------- */
    #[serde(default, skip_serializing_if = "Tags::is_empty")]
    pub tags: Tags,
    #[serde(default, skip_serializing_if = "CustomFields::is_empty")]
    pub custom_fields: CustomFields,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub notes: Vec<Note>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn sample_client() -> Client {
        Client {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            client_type: ClientType::Customer,
            first_name: "Asha".into(),
            last_name: "Iyer".into(),
            display_name: Some("Asha Iyer (Acme)".into()),
            salutation: Some("Ms.".into()),
            company_name: Some("Acme Corp".into()),
            gstin: Some("29ABCDE1234F1Z5".into()),
            pan: Some("ABCDE1234F".into()),
            aadhaar_masked: Some("XXXX-XXXX-1234".into()),
            cin: None,
            msme_no: None,
            industry: Some("SaaS".into()),
            sub_industry: None,
            designation: Some("CTO".into()),
            department: Some("Engineering".into()),
            contact: ContactBook {
                primary_email: "asha@acme.example".into(),
                alt_emails: vec!["asha.iyer@personal.example".into()],
                primary_phone: "+91 9876543210".into(),
                alt_phones: vec![],
                whatsapp: Some("+91 9876543210".into()),
                telegram: None,
                linkedin: Some("asha-iyer".into()),
                twitter: None,
                website: Some("https://acme.example".into()),
            },
            currency: Some("INR".into()),
            price_list_id: None,
            credit_limit: Some(500_000.0),
            credit_period_days: Some(30),
            payment_terms: Some("Net 30".into()),
            tax_preference: TaxPreference::Taxable,
            tax_registration_no: None,
            place_of_supply: Some("Karnataka".into()),
            billing_address: Some(Address {
                line1: Some("12, MG Road".into()),
                city: Some("Bengaluru".into()),
                state: Some("Karnataka".into()),
                country: Some("India".into()),
                pincode: Some("560001".into()),
                ..Default::default()
            }),
            shipping_addresses: vec![],
            default_warehouse_id: None,
            sales_agent_id: None,
            default_discount_pct: Some(5.0),
            default_tax_rate_id: None,
            opening_balance: Some(OpeningBalance {
                amount: 0.0,
                as_of: Utc::now(),
            }),
            attribution: Attribution::default(),
            assignment: Assignment::default(),
            lead_score: Some(72),
            avatar_file_id: None,
            dob: None,
            anniversary: None,
            preferred_contact_channel: Some(ContactChannel::Whatsapp),
            preferred_language: Some("en-IN".into()),
            timezone: Some("Asia/Kolkata".into()),
            customer_rating: Some(4),
            loyalty_tier: Some("gold".into()),
            tags: Tags::from_iter(["vip", "renewal-q3"]),
            custom_fields: CustomFields::default(),
            attachments: vec![],
            notes: vec![],
        }
    }

    #[test]
    fn cross_cutting_fragments_flatten_to_root() {
        let c = sample_client();
        let json = serde_json::to_value(&c).unwrap();
        // crm-core::Identity fields must appear at the root, not nested
        // under "identity".
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        // crm-core::Audit
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
    }

    #[test]
    fn camel_case_field_names() {
        let c = sample_client();
        let json = serde_json::to_value(&c).unwrap();
        assert!(json.get("clientType").is_some());
        assert!(json.get("firstName").is_some());
        assert!(json.get("lastName").is_some());
        assert!(json.get("companyName").is_some());
        assert!(json.get("creditLimit").is_some());
        assert!(json.get("creditPeriodDays").is_some());
        assert!(json.get("placeOfSupply").is_some());
        assert!(json.get("billingAddress").is_some());
        assert!(json.get("preferredContactChannel").is_some());
        assert!(json.get("loyaltyTier").is_some());
    }

    #[test]
    fn empty_tags_and_custom_fields_skip_serialize() {
        let mut c = sample_client();
        c.tags = Tags::default();
        c.custom_fields = CustomFields::default();
        let json = serde_json::to_value(&c).unwrap();
        assert!(json.get("tags").is_none());
        assert!(json.get("customFields").is_none());
    }

    #[test]
    fn tax_preference_lowercase() {
        let json = serde_json::to_string(&TaxPreference::Exempt).unwrap();
        assert_eq!(json, "\"exempt\"");
    }

    #[test]
    fn round_trips_through_serde_json() {
        let c = sample_client();
        let json = serde_json::to_string(&c).unwrap();
        let back: Client = serde_json::from_str(&json).unwrap();
        assert_eq!(back.first_name, c.first_name);
        assert_eq!(back.client_type, c.client_type);
        assert_eq!(back.contact.primary_email, c.contact.primary_email);
        assert_eq!(back.tags.len(), c.tags.len());
        assert_eq!(back.customer_rating, c.customer_rating);
    }
}
