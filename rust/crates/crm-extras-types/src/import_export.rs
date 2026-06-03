//! §12.23 Bulk Import/Export + Data Hygiene + GDPR/DPDP.
//!
//! Mongo collections: `crm_import_jobs`, `crm_dedupe_rules`,
//! `crm_blacklist`, `crm_erase_requests`, `crm_consent_events`. Per
//! entity the platform supports CSV / XLSX / JSON imports with a
//! mapping wizard, dedupe key, dry-run validation report and optional
//! schedule. Hygiene tooling on top: dedupe rules, merge UI, blacklist,
//! GDPR / DPDP erase requests, and a consent ledger.
//!
//! All structs flatten the `crm-core` `Identity` + `Audit` fragments so
//! the document root carries §0 ownership and audit fields directly.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Source file format for an import job. Lowercase to match the wire
/// values clients send in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ImportFormat {
    #[default]
    Csv,
    Xlsx,
    Json,
}

/// One row in the mapping-wizard table — "this column from the upload
/// maps to that field on the target entity, optionally piped through a
/// transform".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldMapping {
    pub source_column: String,
    pub target_field: String,
    /// Free-form transform identifier (`"trim"`, `"lower"`,
    /// `"parse_iso_date"`, …). The worker resolves it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportJob {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Target entity name (`"client"`, `"lead"`, `"product"`, …).
    pub entity: String,
    pub format: ImportFormat,
    /// SabFiles file id of the uploaded source.
    pub source_file_id: ObjectId,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub mappings: Vec<FieldMapping>,
    /// Field used to detect duplicates (e.g. `"email"`, `"gstin"`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dedupe_key: Option<String>,
    #[serde(default)]
    pub dry_run: bool,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub scheduled_for: Option<DateTime<Utc>>,
    /// SabFiles id of the JSON validation report produced after the run.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub validation_report_id: Option<ObjectId>,
    /// `"queued" | "running" | "completed" | "failed"`.
    pub status: String,
    #[serde(default)]
    pub rows_total: u64,
    #[serde(default)]
    pub rows_succeeded: u64,
    #[serde(default)]
    pub rows_failed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DedupeRule {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    pub entity: String,
    /// Fields to combine when computing the dedupe fingerprint.
    pub match_fields: Vec<String>,
    /// `"merge" | "skip" | "flag"`.
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlacklistEntry {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// `"email" | "phone" | "domain" | "ip"`.
    pub kind: String,
    pub value: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EraseRequest {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// CRM entity id of the data subject if the requester maps to one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_email: Option<String>,
    /// `"gdpr" | "dpdp" | "ccpa"`.
    pub regulation: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub requested_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub processed_at: Option<DateTime<Utc>>,
    pub status: String,
    /// Entity kinds the erase covers (`["client", "ticket", "invoice"]`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub scope: Vec<String>,
    /// SabFiles id of the signed certificate / completion proof.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence_file_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsentEvent {
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_email: Option<String>,
    /// `"marketing" | "data_processing" | "third_party"`.
    pub consent_type: String,
    pub granted: bool,
    /// Channel the consent was captured on (`"web_form"`, `"whatsapp"`,
    /// `"email_double_optin"`, …).
    pub channel: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub captured_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub expires_at: Option<DateTime<Utc>>,
    /// Free-form proof reference (IP + user agent string, signed token,
    /// SabFiles url, …).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
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
    fn import_job_round_trips_with_flattened_fragments() {
        let job = ImportJob {
            identity: identity(),
            audit: audit(),
            entity: "client".to_string(),
            format: ImportFormat::Csv,
            source_file_id: ObjectId::new(),
            mappings: vec![FieldMapping {
                source_column: "Email".to_string(),
                target_field: "primary_email".to_string(),
                transform: Some("lower".to_string()),
            }],
            dedupe_key: Some("primary_email".to_string()),
            dry_run: true,
            scheduled_for: None,
            validation_report_id: None,
            status: "queued".to_string(),
            rows_total: 1_000,
            rows_succeeded: 0,
            rows_failed: 0,
        };

        let json = serde_json::to_value(&job).unwrap();
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert_eq!(json.get("format").unwrap(), "csv");
        assert!(json.get("sourceFileId").is_some());
        assert!(json.get("dryRun").is_some());

        let back: ImportJob = serde_json::from_value(json).unwrap();
        assert_eq!(back.entity, "client");
        assert!(matches!(back.format, ImportFormat::Csv));
        assert_eq!(back.mappings.len(), 1);
    }

    #[test]
    fn consent_event_round_trips() {
        let evt = ConsentEvent {
            identity: identity(),
            audit: audit(),
            subject_id: None,
            subject_email: Some("a@b.com".to_string()),
            consent_type: "marketing".to_string(),
            granted: true,
            channel: "web_form".to_string(),
            captured_at: Utc::now(),
            expires_at: None,
            evidence: Some("ip=1.2.3.4".to_string()),
        };
        let json = serde_json::to_value(&evt).unwrap();
        assert_eq!(json.get("consentType").unwrap(), "marketing");
        assert!(json.get("subjectEmail").is_some());

        let back: ConsentEvent = serde_json::from_value(json).unwrap();
        assert!(back.granted);
    }
}
