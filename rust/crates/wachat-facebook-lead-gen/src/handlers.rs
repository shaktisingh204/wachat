//! HTTP handlers for the Facebook Lead Gen domain.
//!
//! Each handler maps 1:1 to an `export async function` in the Lead Gen
//! slice of `src/app/actions/facebook.actions.ts`. The TS originals return
//! `{ … , error? }` envelopes and never throw — handlers below mirror that
//! convention so callers branch on `body.error` rather than HTTP status.
//!
//! ## Project access check
//!
//! [`load_project_for`] is inlined here (rather than imported) so the crate
//! stays self-contained per the porting brief. It resolves a project by id
//! and verifies the caller owns it (`project.userId === user._id`),
//! mirroring the `getProjectById` access path in the TS module.
//!
//! ## Token plumbing
//!
//! The TS code passes `?access_token=…` on every Graph API call. We let
//! `MetaClient` send the token via `Authorization: Bearer` instead — Meta
//! accepts both forms equivalently.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use serde_json::Value;
use wachat_meta_client::MetaError;

use crate::dto::{
    FacebookLead, FacebookLeadGenForm, LeadGenFormsResp, LeadResp, LeadsResp, ProjectQuery,
};
use crate::state::WachatFacebookLeadGenState;

const PROJECTS_COLLECTION: &str = "projects";

const ERR_PROJECT_MISSING_TOKEN: &str =
    "Project not found or is missing Facebook Page ID or access token.";
const ERR_ACCESS_DENIED_NO_CONFIG: &str = "Access denied or project not configured.";
const ERR_ACCESS_DENIED: &str = "Access denied.";

// =========================================================================
//  Project / user helpers
// =========================================================================

fn parse_user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

fn parse_project_oid(id: &str) -> Result<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| ApiError::BadRequest("invalid project id".to_owned()))
}

/// Lightweight projection of the `projects` doc fields the lead-gen handlers
/// care about.
pub struct ProjectCtx {
    pub facebook_page_id: Option<String>,
    pub access_token: Option<String>,
}

/// Resolve a project by id and confirm the caller owns it. Returns
/// `NotFound` for both "project missing" and "project belongs to another
/// user", so we don't leak project existence across tenants.
///
/// Inlined here per the porting brief — mirrors the `getProjectById`
/// helper in `src/app/actions/project.actions.ts` invoked at the top of
/// every legacy lead-gen action.
pub async fn load_project_for(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id: &str,
) -> Result<ProjectCtx> {
    let project_oid = parse_project_oid(project_id)?;
    let user_oid = parse_user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLLECTION);
    let doc = coll
        .find_one(doc! { "_id": project_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::anyhow!(e)))?
        .ok_or_else(|| ApiError::NotFound("project".to_owned()))?;

    let owner = doc.get_object_id("userId").ok();
    if owner != Some(user_oid) {
        return Err(ApiError::NotFound("project".to_owned()));
    }

    Ok(ProjectCtx {
        facebook_page_id: doc.get_str("facebookPageId").ok().map(|s| s.to_owned()),
        access_token: doc.get_str("accessToken").ok().map(|s| s.to_owned()),
    })
}

fn require_token(p: &ProjectCtx) -> std::result::Result<&str, &'static str> {
    p.access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_ACCESS_DENIED_NO_CONFIG)
}

fn require_page(p: &ProjectCtx) -> std::result::Result<(&str, &str), &'static str> {
    let token = p
        .access_token
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)?;
    let page = p
        .facebook_page_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .ok_or(ERR_PROJECT_MISSING_TOKEN)?;
    Ok((page, token))
}

/// Squash a `MetaError` into the `String` shape the TS callers expect —
/// matches `getErrorMessage(e)` in the legacy code.
fn err_msg(e: MetaError) -> String {
    e.to_string()
}

fn pull_data_array(v: &Value) -> Vec<Value> {
    v.get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default()
}

// =========================================================================
//  getLeadGenForms  (GET /v1/facebook/lead-gen/projects/:project_id/forms)
//
//  Legacy: getLeadGenForms(projectId)
//    -> GET https://graph.facebook.com/v23.0/{pageId}/leadgen_forms
//       fields=id,name,status,leads_count,created_time,expired_leads_count
//       limit=50
// =========================================================================

pub async fn get_lead_gen_forms(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Path(project_id): Path<String>,
) -> Json<LeadGenFormsResp> {
    let project = match load_project_for(&user, &s.mongo, &project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LeadGenFormsResp {
                error: Some(ERR_PROJECT_MISSING_TOKEN.to_owned()),
                ..Default::default()
            });
        }
    };
    let (page, token) = match require_page(&project) {
        Ok(t) => t,
        Err(e) => {
            return Json(LeadGenFormsResp {
                error: Some(e.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!(
        "{page}/leadgen_forms?fields=id,name,status,leads_count,created_time,expired_leads_count&limit=50"
    );
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => {
            let raw = pull_data_array(&v);
            let mut forms = Vec::with_capacity(raw.len());
            for entry in raw {
                match serde_json::from_value::<FacebookLeadGenForm>(entry) {
                    Ok(f) => forms.push(f),
                    Err(_) => continue,
                }
            }
            Json(LeadGenFormsResp {
                forms: Some(forms),
                ..Default::default()
            })
        }
        Err(e) => Json(LeadGenFormsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getLeadsForForm  (GET /v1/facebook/lead-gen/forms/:form_id/leads?projectId=…)
//
//  Legacy: getLeadsForForm(formId, projectId)
//    -> GET https://graph.facebook.com/v23.0/{formId}/leads
//       fields=id,created_time,field_data
//       limit=100
// =========================================================================

pub async fn get_leads_for_form(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Path(form_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<LeadsResp> {
    let project = match load_project_for(&user, &s.mongo, &q.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LeadsResp {
                error: Some(ERR_ACCESS_DENIED_NO_CONFIG.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(LeadsResp {
                error: Some(ERR_ACCESS_DENIED_NO_CONFIG.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{form_id}/leads?fields=id,created_time,field_data&limit=100");
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => {
            let raw = pull_data_array(&v);
            let mut leads = Vec::with_capacity(raw.len());
            for entry in raw {
                match serde_json::from_value::<FacebookLead>(entry) {
                    Ok(l) => leads.push(l),
                    Err(_) => continue,
                }
            }
            Json(LeadsResp {
                leads: Some(leads),
                ..Default::default()
            })
        }
        Err(e) => Json(LeadsResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}

// =========================================================================
//  getLeadById  (GET /v1/facebook/lead-gen/leads/:lead_id?projectId=…)
//
//  Legacy: getLeadById(leadId, projectId)
//    -> GET https://graph.facebook.com/v23.0/{leadId}
//       fields=id,created_time,field_data,form_id
// =========================================================================

pub async fn get_lead_by_id(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Path(lead_id): Path<String>,
    Query(q): Query<ProjectQuery>,
) -> Json<LeadResp> {
    let project = match load_project_for(&user, &s.mongo, &q.project_id).await {
        Ok(p) => p,
        Err(_) => {
            return Json(LeadResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };
    let token = match require_token(&project) {
        Ok(t) => t,
        Err(_) => {
            return Json(LeadResp {
                error: Some(ERR_ACCESS_DENIED.to_owned()),
                ..Default::default()
            });
        }
    };

    let path = format!("{lead_id}?fields=id,created_time,field_data,form_id");
    match s.meta.get_json::<Value>(&path, token).await {
        Ok(v) => match serde_json::from_value::<FacebookLead>(v) {
            Ok(lead) => Json(LeadResp {
                lead: Some(lead),
                ..Default::default()
            }),
            Err(e) => Json(LeadResp {
                error: Some(format!("Failed to parse lead: {e}")),
                ..Default::default()
            }),
        },
        Err(e) => Json(LeadResp {
            error: Some(err_msg(e)),
            ..Default::default()
        }),
    }
}
