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
