//! §8 (second half) — Tenant-level Settings.
//!
//! Mongo collection: `crm_settings` — exactly one document per tenant
//! (keyed by `userId`). The document gathers every cross-cutting tenant
//! configuration knob that drives doc rendering, numbering, branching,
//! messaging, RBAC, custom-field shapes and menu/UI personalization.
//!
//! `Identity` and `Audit` are flattened so the doc root carries the §0
//! ownership / audit fields directly. The bulk of the entity is a
//! collection of `Vec<…>` config groups + a couple of nested config
//! structs (`FiscalYear`, `Branding`, `PlanUsage`).

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use crm_sales_types::Address;
use serde::{Deserialize, Serialize};

/* ============================================================== *
 *  Numbering schemas                                              *
 * ============================================================== */

/// Per-entity auto-numbering policy. One entry per doc kind
/// (`"invoice"`, `"quotation"`, `"sales_order"`, `"bill"`, …) — the
/// generator looks up the matching entry, formats
/// `prefix + zero_padded(starting_number, padding) + suffix`, then
/// rolls / resets the running counter according to `reset_frequency`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumberingSchema {
    /// Free-form entity discriminator (`"invoice"`, `"quotation"`, …).
    /// Kept as a `String` so new doc kinds can be added without a
    /// schema migration.
    pub entity: String,
    pub prefix: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub suffix: Option<String>,
    /// Zero-pad width for the running counter.
    pub padding: u8,
    /// Next value the generator will issue.
    pub starting_number: u64,
    /// `"none"` | `"yearly"` | `"monthly"`. The cron worker resets the
    /// counter to `starting_number` on the configured boundary.
    pub reset_frequency: String,
}

/* ============================================================== *
 *  Fiscal year                                                    *
 * ============================================================== */

/// Anchors the tenant's financial-year boundary. India defaults to
/// `start_month = 4, start_day = 1`; many SaaS tenants override to
/// calendar year (`1, 1`).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FiscalYear {
    /// 1-12.
    pub start_month: u8,
    /// 1-31.
    pub start_day: u8,
}

/* ============================================================== *
 *  Branches                                                       *
 * ============================================================== */

/// Physical / legal branch the tenant operates out of. Branch-aware
/// docs (invoice, bill, GRN) stamp the issuing branch so reporting
/// can pivot by location.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub id: ObjectId,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub address: Option<Address>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub gstin: Option<String>,
    pub active: bool,
}

/* ============================================================== *
 *  Branding                                                       *
 * ============================================================== */

/// Visual identity stamped onto rendered PDFs and outbound email.
/// All file pointers are FKs into the `files` collection (R2-backed)
/// — never raw URLs.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Branding {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signature_file_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub watermark_file_id: Option<ObjectId>,
    /// Hex color (e.g. `"#0ea5e9"`) used as accent in PDF templates
    /// and the customer portal.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_color: Option<String>,
}

/* ============================================================== *
 *  Message templates                                              *
 * ============================================================== */

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TemplateChannel {
    #[default]
    Email,
    Whatsapp,
    Sms,
}

/// Reusable message body shared by Email / WhatsApp / SMS senders.
/// `subject` is only meaningful when `channel == Email`. `variables`
/// is the list of `{{token}}` placeholders the body expects (used by
/// the UI to surface a fill-in form before sending).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageTemplate {
    pub id: ObjectId,
    pub channel: TemplateChannel,
    pub name: String,
    /// Email subject. Ignored for `Whatsapp` / `Sms`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    pub body: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub variables: Vec<String>,
}

/* ============================================================== *
 *  Role / permission matrix                                       *
 * ============================================================== */

/// Coarse role -> permission-bag mapping. The CRM authoriser checks
/// `permissions.contains("invoice.update")` etc. The matrix is
/// editable per-tenant so plan-gated features can be selectively
/// granted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleMatrixEntry {
    pub role: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub permissions: Vec<String>,
}

/* ============================================================== *
 *  Custom fields per entity                                       *
 * ============================================================== */

/// Per-entity custom-field schema. `fields` mirrors the
/// worksuite-meta `WsCustomField` map but is stored as opaque JSON
/// here so this DTO crate stays independent of the meta-types crate
/// (and so the schema can evolve without breaking older tenant docs).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFieldsBindings {
    /// Entity discriminator (`"client"`, `"invoice"`, `"deal"`, …).
    pub entity: String,
    /// Opaque map of `{ fieldKey: WsCustomField }` definitions.
    pub fields: serde_json::Value,
}

/* ============================================================== *
 *  Custom links                                                   *
 * ============================================================== */

/// Tenant-defined sidebar / quick-launcher link. `role_visibility`
/// gates which roles see the link; empty means "everyone".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomLink {
    pub label: String,
    pub href: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_visibility: Vec<String>,
}

/* ============================================================== *
 *  Menu reordering                                                *
 * ============================================================== */

/// Tenant-saved menu order for a single module (`"sales"`, `"crm"`,
/// `"purchases"`, …). The frontend renders modules in the order of
/// the tenant's `menu_order` Vec, then orders items inside each
/// module by `items`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuOrderEntry {
    pub module: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<String>,
}

/* ============================================================== *
 *  Plan / credit usage snapshot                                   *
 * ============================================================== */

/// Denormalized snapshot of the tenant's billing-plan usage. The live
/// truth lives in the billing service; this is a cached copy so the
/// settings UI can render usage without an extra RPC. The billing
/// worker refreshes the snapshot on every plan event.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanUsage {
    pub plan: String,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_start: DateTime<Utc>,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub period_end: DateTime<Utc>,
    pub credits_used: u64,
    pub credits_total: u64,
}

/* ============================================================== *
 *  Terms & conditions library                                     *
 * ============================================================== */

/// Reusable T&C clause. Quotation/Invoice/SO editors pull from this
/// library; `applies_to` filters which entity kinds the clause is
/// offered for (`"invoice"`, `"quotation"`, `"sales_order"`, …).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TermsLibraryEntry {
    pub id: ObjectId,
    pub label: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub applies_to: Vec<String>,
}

/* ============================================================== *
 *  Top-level entity                                               *
 * ============================================================== */

/// One document per tenant — the union of every tenant-scoped
/// configuration knob the CRM/HRM modules read at runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TenantSettings {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- numbering / money / fiscal ---------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub numbering_schemas: Vec<NumberingSchema>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_tax_rate_id: Option<ObjectId>,
    /// ISO-4217 (e.g. `"INR"`, `"USD"`).
    pub default_currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fiscal_year: Option<FiscalYear>,

    /* ----- org structure ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub branches: Vec<Branch>,

    /* ----- branding ---------------------------------------------- */
    #[serde(default)]
    pub branding: Branding,

    /* ----- templates --------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub message_templates: Vec<MessageTemplate>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub terms_library: Vec<TermsLibraryEntry>,

    /* ----- RBAC + customisation ---------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub role_matrix: Vec<RoleMatrixEntry>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub custom_fields: Vec<CustomFieldsBindings>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub custom_links: Vec<CustomLink>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub menu_order: Vec<MenuOrderEntry>,

    /* ----- billing snapshot -------------------------------------- */
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_usage: Option<PlanUsage>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mk_identity() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    fn mk_audit() -> Audit {
        let now = Utc::now();
        Audit {
            created_at: now,
            updated_at: now,
            created_by: None,
            updated_by: None,
        }
    }

    #[test]
    fn round_trips_with_flattened_fragments_and_nested_branding() {
        let settings = TenantSettings {
            identity: mk_identity(),
            audit: mk_audit(),
            numbering_schemas: vec![
                NumberingSchema {
                    entity: "invoice".into(),
                    prefix: "INV-".into(),
                    suffix: None,
                    padding: 5,
                    starting_number: 1,
                    reset_frequency: "yearly".into(),
                },
                NumberingSchema {
                    entity: "quotation".into(),
                    prefix: "QT-".into(),
                    suffix: Some("/26".into()),
                    padding: 4,
                    starting_number: 100,
                    reset_frequency: "none".into(),
                },
            ],
            default_tax_rate_id: None,
            default_currency: "INR".into(),
            fiscal_year: Some(FiscalYear {
                start_month: 4,
                start_day: 1,
            }),
            branches: vec![],
            branding: Branding {
                logo_file_id: Some(ObjectId::new()),
                signature_file_id: None,
                watermark_file_id: Some(ObjectId::new()),
                primary_color: Some("#0ea5e9".into()),
            },
            message_templates: vec![MessageTemplate {
                id: ObjectId::new(),
                channel: TemplateChannel::Whatsapp,
                name: "Invoice reminder".into(),
                subject: None,
                body: "Hi {{name}}, your invoice is due.".into(),
                variables: vec!["name".into()],
            }],
            terms_library: vec![],
            role_matrix: vec![RoleMatrixEntry {
                role: "manager".into(),
                permissions: vec!["invoice.update".into(), "client.read".into()],
            }],
            custom_fields: vec![],
            custom_links: vec![],
            menu_order: vec![],
            plan_usage: None,
        };

        let json = serde_json::to_value(&settings).unwrap();

        // Identity flattened at root
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        // Audit flattened at root
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());
        // No nested wrapper keys
        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());

        // NumberingSchema list — first entry's entity + camelCase fields
        let numbering = json
            .get("numberingSchemas")
            .and_then(|v| v.as_array())
            .unwrap();
        assert_eq!(numbering.len(), 2);
        assert_eq!(
            numbering[0].get("entity").and_then(|v| v.as_str()),
            Some("invoice")
        );
        assert_eq!(
            numbering[0].get("startingNumber").and_then(|v| v.as_u64()),
            Some(1)
        );
        assert_eq!(
            numbering[0].get("resetFrequency").and_then(|v| v.as_str()),
            Some("yearly")
        );
        // Optional `suffix` skipped on entry 0, present on entry 1
        assert!(numbering[0].get("suffix").is_none());
        assert_eq!(
            numbering[1].get("suffix").and_then(|v| v.as_str()),
            Some("/26")
        );

        // Nested Branding round-trips with camelCase keys
        let branding = json.get("branding").unwrap();
        assert!(branding.get("logoFileId").is_some());
        assert!(branding.get("watermarkFileId").is_some());
        assert!(
            branding.get("signatureFileId").is_none(),
            "None should skip"
        );
        assert_eq!(
            branding.get("primaryColor").and_then(|v| v.as_str()),
            Some("#0ea5e9")
        );

        // Enum lowercase serialization
        let tpl = json
            .get("messageTemplates")
            .and_then(|v| v.as_array())
            .unwrap();
        assert_eq!(
            tpl[0].get("channel").and_then(|v| v.as_str()),
            Some("whatsapp")
        );

        // Round-trip back into the struct
        let back: TenantSettings = serde_json::from_value(json).unwrap();
        assert_eq!(back.numbering_schemas.len(), 2);
        assert_eq!(back.numbering_schemas[0].entity, "invoice");
        assert_eq!(back.numbering_schemas[1].suffix.as_deref(), Some("/26"));
        assert_eq!(back.default_currency, "INR");
        assert_eq!(back.branding.primary_color.as_deref(), Some("#0ea5e9"));
        assert!(back.branding.logo_file_id.is_some());
        assert!(back.branding.signature_file_id.is_none());
        assert!(matches!(
            back.message_templates[0].channel,
            TemplateChannel::Whatsapp
        ));
    }
}
