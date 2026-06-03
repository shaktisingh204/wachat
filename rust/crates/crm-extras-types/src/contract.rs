//! §12.2 Contracts & E-Signature.
//!
//! Mongo collection: `crm_contracts`. A `Contract` is the legal-document
//! envelope around an agreement (NDA, MSA, SOW, service, lease) — it
//! tracks the parties, the effective / expiry window, the renewal
//! terms, the signed-PDF attachments, and a `signatures[]` log per
//! party with provider-specific evidence (signed_doc_id, IP, signed_at).
//! `parent_contract_id` lets renewals / amendments chain back to the
//! original so version history is queryable.
//!
//! Spec verbatim: Type (NDA/MSA/SOW/Service/Lease), parties, effective
//! date, expiry, renewal terms, value, attachments, signatures
//! (provider, status, signed-by, IP, timestamp), version history,
//! parent contract.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Attachment, Audit, Identity};
use serde::{Deserialize, Serialize};

/// Document type. Multi-word legal acronyms are spelled in CamelCase
/// in Rust but renamed to their canonical lowercase abbreviations
/// (`nda`, `msa`, `sow`) in JSON so the wire format matches the TS
/// dropdown values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum ContractType {
    #[serde(rename = "nda")]
    Nda,
    #[serde(rename = "msa")]
    Msa,
    #[serde(rename = "sow")]
    Sow,
    #[default]
    #[serde(rename = "service")]
    Service,
    #[serde(rename = "lease")]
    Lease,
    #[serde(rename = "other")]
    Other,
}

/// Lifecycle status of the contract envelope. `Sent` = out for
/// signature, `Signed` = all signatures collected, `Active` = inside
/// the effective→expiry window post-signing.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContractStatus {
    #[default]
    Draft,
    Sent,
    Signed,
    Active,
    Expired,
    Terminated,
}

/// One party to the contract. `entity_id` is an optional FK back into
/// the CRM (clients / vendors / users collection — the role
/// determines which one); for ad-hoc external counterparties it stays
/// `None` and only `name` + `email` are persisted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContractParty {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    /// `"customer"` | `"vendor"` | `"internal"`.
    pub role: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<ObjectId>,
}

/// E-signature provider. `Internal` is SabNode's first-party signing
/// flow; the others are external integrations whose IDs we resolve
/// against `signed_doc_id`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum EsignProvider {
    #[default]
    Internal,
    Digio,
    DocuSign,
    Aadhaar,
}

/// Per-party signature record. `party_index` points back into the
/// parent's `parties` vector (so a single party can have multiple
/// signature attempts across providers without losing the link).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Signature {
    pub party_index: u8,
    pub provider: EsignProvider,
    /// `"pending"` | `"signed"` | `"declined"` | `"expired"`. Free-form
    /// to absorb provider-specific intermediate states without forcing
    /// a schema migration each time a vendor adds a status.
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signed_by: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub signed_at: Option<DateTime<Utc>>,
    /// Captured IP at signing time for non-repudiation. Stored as a
    /// string so v4 / v6 / private-network forms all round-trip.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    /// Provider's document identifier (e.g. Digio doc id, DocuSign
    /// envelope id, internal SabFiles file id). String so we don't
    /// require every provider to use ObjectId-shaped tokens.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signed_doc_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contract {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- type + parties ---------------------------------------- */
    pub contract_type: ContractType,
    pub parties: Vec<ContractParty>,

    /* ----- term + renewal ---------------------------------------- */
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub effective_date: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expiry: Option<DateTime<Utc>>,
    /// Free-form renewal terms (e.g. "Auto-renews for 12 months unless
    /// either party gives 30 days notice"). Parsing is out of scope —
    /// only the human-readable text is stored.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub renewal_terms: Option<String>,

    /* ----- money ------------------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    /* ----- documents + signatures -------------------------------- */
    /// Source / signed PDFs. Always SabFile pointers per project policy.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachments: Vec<Attachment>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub signatures: Vec<Signature>,

    /* ----- versioning -------------------------------------------- */
    /// Bumped on every published amendment; new versions are stored as
    /// new documents pointing back via `parent_contract_id`.
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_contract_id: Option<ObjectId>,

    /* ----- workflow ---------------------------------------------- */
    pub status: ContractStatus,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let c = Contract {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            contract_type: ContractType::Msa,
            parties: vec![
                ContractParty {
                    name: "Acme Corp".into(),
                    email: Some("legal@acme.example".into()),
                    role: "customer".into(),
                    entity_id: Some(ObjectId::new()),
                },
                ContractParty {
                    name: "SabNode Inc.".into(),
                    email: Some("contracts@sabnode.example".into()),
                    role: "internal".into(),
                    entity_id: None,
                },
            ],
            effective_date: now,
            expiry: Some(now),
            renewal_terms: Some("Auto-renews annually.".into()),
            value: Some(120_000.0),
            currency: Some("USD".into()),
            attachments: vec![],
            signatures: vec![Signature {
                party_index: 0,
                provider: EsignProvider::DocuSign,
                status: "signed".into(),
                signed_by: Some("Asha Iyer".into()),
                signed_at: Some(now),
                ip: Some("203.0.113.42".into()),
                signed_doc_id: Some("envelope_abc123".into()),
            }],
            version: 2,
            parent_contract_id: Some(ObjectId::new()),
            status: ContractStatus::Active,
        };

        let json = serde_json::to_value(&c).unwrap();

        // crm-core fragments must flatten to the root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("contractType").is_some());
        assert!(json.get("effectiveDate").is_some());
        assert!(json.get("renewalTerms").is_some());
        assert!(json.get("parentContractId").is_some());

        // ContractType serializes to lowercase canonical form.
        assert_eq!(
            json.get("contractType").and_then(|v| v.as_str()),
            Some("msa")
        );
        // Status lowercase.
        assert_eq!(json.get("status").and_then(|v| v.as_str()), Some("active"));
        // EsignProvider lowercase (note `docusign`, not `DocuSign`).
        let sig_provider = json
            .get("signatures")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|s| s.get("provider"))
            .and_then(|p| p.as_str());
        assert_eq!(sig_provider, Some("docusign"));

        // Round-trip back.
        let back: Contract = serde_json::from_value(json).unwrap();
        assert!(matches!(back.contract_type, ContractType::Msa));
        assert!(matches!(back.status, ContractStatus::Active));
        assert_eq!(back.version, 2);
        assert_eq!(back.parties.len(), 2);
        assert_eq!(back.signatures.len(), 1);
        assert!(matches!(
            back.signatures[0].provider,
            EsignProvider::DocuSign
        ));
    }
}
