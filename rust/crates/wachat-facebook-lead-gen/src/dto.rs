//! Wire DTOs for the Facebook Lead Gen router.
//!
//! Mirrors the legacy TS shapes recovered from
//! `src/app/actions/facebook.actions.ts` (commit `a3d8ff38`):
//!
//! ```text
//! getLeadGenForms(projectId)         -> { forms?: FacebookLeadGenForm[]; error? }
//! getLeadsForForm(formId, projectId) -> { leads?: FacebookLead[]; error? }
//! getLeadById(leadId, projectId)     -> { lead?: FacebookLead; error? }
//! ```
//!
//! `FacebookLeadGenForm` and `FacebookLead` are defined in
//! `src/lib/definitions.ts`. We model their fields directly so the wire
//! contract matches the TS callers byte-for-byte.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  FacebookLeadGenForm  (mirrors `src/lib/definitions.ts:1874`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct FacebookLeadGenForm {
    pub id: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leads_count: Option<i64>,
    #[serde(default)]
    pub created_time: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expired_leads_count: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub page: Option<Value>,
}

// ---------------------------------------------------------------------------
//  FacebookLead  (mirrors `src/lib/definitions.ts:1884`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct LeadFieldEntry {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub values: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
pub struct FacebookLead {
    pub id: String,
    #[serde(default)]
    pub created_time: String,
    #[serde(default)]
    pub field_data: Vec<LeadFieldEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub form_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  Response envelopes  ({ success?, error?, ... } per the TS originals)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LeadGenFormsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forms: Option<Vec<FacebookLeadGenForm>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LeadsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leads: Option<Vec<FacebookLead>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct LeadResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lead: Option<FacebookLead>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  CRM Integration — config / webhook / activity DTOs
// ---------------------------------------------------------------------------

/// Maps a single Facebook form field to a CRM lead field.
/// `crm_field` is one of: "firstName" | "lastName" | "email" | "phone" |
/// "company" | "title" | "description" | "notes" | "ignore".
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FieldMapping {
    pub fb_field: String,
    pub crm_field: String,
}

/// Default or campaign-rule routing target.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Routing {
    #[serde(default)]
    pub pipeline_id: String,
    #[serde(default)]
    pub stage: String,
    #[serde(default)]
    pub assigned_to: String,
}

/// Routing override applied when campaign_id / adset_id match.
/// `None` fields act as wildcards.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CampaignRule {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub campaign_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adset_id: Option<String>,
    #[serde(default)]
    pub pipeline_id: String,
    #[serde(default)]
    pub stage: String,
    #[serde(default)]
    pub assigned_to: String,
}

/// Per-form configuration: field mapping + routing rules.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FormConfig {
    pub form_id: String,
    #[serde(default)]
    pub form_name: String,
    #[serde(default)]
    pub field_mapping: Vec<FieldMapping>,
    #[serde(default)]
    pub default_routing: Routing,
    #[serde(default)]
    pub campaign_rules: Vec<CampaignRule>,
}

/// Tenant-level CRM Facebook Lead Ads configuration.
/// Stored in `crm_facebook_leadgen_config`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LeadGenConfig {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub id: Option<bson::oid::ObjectId>,
    pub tenant_id: String,
    #[serde(default)]
    pub page_id: String,
    #[serde(default)]
    pub page_access_token: String,
    #[serde(default)]
    pub is_active: bool,
    #[serde(default)]
    pub forms: Vec<FormConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub created_at: Option<bson::DateTime>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub updated_at: Option<bson::DateTime>,
}

/// Payload Next.js sends when Meta fires a `leadgen` webhook change.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProcessWebhookBody {
    pub page_id: String,
    pub form_id: String,
    pub lead_id: String,
    #[serde(default)]
    pub ad_id: Option<String>,
    #[serde(default)]
    pub adset_id: Option<String>,
    #[serde(default)]
    pub campaign_id: Option<String>,
    /// CRM ↔ Facebook ads binding override — pipeline slug/ObjectId hex
    /// from `/dashboard/crm/settings/integrations/facebook-ads`. When
    /// present, takes precedence over the form's `defaultRouting`.
    #[serde(default)]
    pub crm_pipeline: Option<String>,
    /// CRM stage override (paired with `crm_pipeline`).
    #[serde(default)]
    pub crm_stage: Option<String>,
}

/// Single entry in the activity log collection.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Option<String>)]
    pub id: Option<bson::oid::ObjectId>,
    pub tenant_id: String,
    #[schema(value_type = String)]
    pub timestamp: bson::DateTime,
    pub form_id: String,
    #[serde(default)]
    pub form_name: String,
    pub facebook_lead_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub crm_lead_id: Option<String>,
    pub lead_name: String,
    /// "created" | "skipped" | "error"
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
}

// --- Response envelopes ---

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConfigResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<LeadGenConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActivityResp {
    pub entries: Vec<ActivityEntry>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WebhookProcessResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lead_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FormsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forms: Option<Vec<FacebookLeadGenForm>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  Query params for project-scoped lead-gen GETs
// ---------------------------------------------------------------------------

/// Both `getLeadsForForm` and `getLeadById` take a project id alongside the
/// resource id. Path-style routing puts the resource in the URL, so we read
/// `projectId` from the query string.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ProjectQuery {
    #[serde(rename = "projectId")]
    pub project_id: String,
}
