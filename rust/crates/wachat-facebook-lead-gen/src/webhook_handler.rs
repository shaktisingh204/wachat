//! `POST /v1/facebook/lead-gen/process-webhook`
//!
//! Called by the Next.js Meta webhook route when Meta fires a `leadgen`
//! change event for a Page. The caller mints a short-lived JWT scoped to
//! the originating tenant (project.userId) and forwards the raw webhook
//! fields so all Graph API work and MongoDB writes happen here.
//!
//! Flow:
//!  1. Load `crm_facebook_leadgen_config` for the tenant.
//!  2. Match `formId` to a [`FormConfig`] entry.
//!  3. Guard against Meta retries via `facebookLeadId` index on `crm_leads`.
//!  4. Fetch full lead from Graph API using the stored page access token.
//!  5. Map `field_data` to `crm_leads` fields; unmapped Q&A → `description`.
//!  6. Evaluate `campaignRules` top-down; fall back to `defaultRouting`.
//!  7. Insert into `crm_leads` (retries once on transient Mongo errors).
//!  8. Write an entry to `crm_facebook_leadgen_activity`.

use axum::{Json, extract::State};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use serde_json::Value;
use tracing::{instrument, warn};

use crate::dto::{ActivityEntry, FormConfig, LeadGenConfig, ProcessWebhookBody, WebhookProcessResp};
use crate::state::WachatFacebookLeadGenState;

const LEADS_COLL: &str = "crm_leads";
const CONFIG_COLL: &str = "crm_facebook_leadgen_config";
const ACTIVITY_COLL: &str = "crm_facebook_leadgen_activity";

// =========================================================================
//  Public handler
// =========================================================================

#[instrument(skip_all, fields(tenant = %user.user_id, form_id = %body.form_id, lead_id = %body.lead_id))]
pub async fn process_webhook(
    user: AuthUser,
    State(s): State<WachatFacebookLeadGenState>,
    Json(body): Json<ProcessWebhookBody>,
) -> Json<WebhookProcessResp> {
    // --- 1. Load active config for this tenant ---
    let config_coll = s.mongo.collection::<LeadGenConfig>(CONFIG_COLL);
    let config = match config_coll
        .find_one(doc! { "tenantId": &user.user_id, "isActive": true })
        .await
    {
        Ok(Some(c)) => c,
        Ok(None) => {
            log_activity(
                &s, &user.user_id, &body.form_id, "unknown", &body.lead_id,
                "Lead", "skipped", Some("Integration not configured or inactive"),
            ).await;
            return Json(WebhookProcessResp { lead_id: None, status: "skipped".to_owned() });
        }
        Err(e) => {
            warn!("process_webhook: config lookup failed: {e}");
            return Json(WebhookProcessResp { lead_id: None, status: "error".to_owned() });
        }
    };

    // --- 2. Find the matching form config ---
    let form_config = match config.forms.iter().find(|f| f.form_id == body.form_id) {
        Some(f) => f.clone(),
        None => {
            log_activity(
                &s, &user.user_id, &body.form_id, "unknown", &body.lead_id,
                "Lead", "skipped", Some("Form not configured"),
            ).await;
            return Json(WebhookProcessResp { lead_id: None, status: "skipped".to_owned() });
        }
    };
    let form_name = form_config.form_name.clone();

    // --- 3. Idempotency guard (Meta retry protection) ---
    let user_oid = match ObjectId::parse_str(&user.user_id) {
        Ok(o) => o,
        Err(_) => {
            warn!("process_webhook: invalid user_id OID: {}", user.user_id);
            return Json(WebhookProcessResp { lead_id: None, status: "error".to_owned() });
        }
    };

    let leads_coll = s.mongo.collection::<Document>(LEADS_COLL);
    match leads_coll
        .find_one(doc! { "facebookLeadId": &body.lead_id, "userId": user_oid })
        .await
    {
        Ok(Some(_)) => {
            log_activity(
                &s, &user.user_id, &body.form_id, &form_name, &body.lead_id,
                "Lead", "skipped", Some("Duplicate leadgen_id"),
            ).await;
            return Json(WebhookProcessResp { lead_id: None, status: "skipped".to_owned() });
        }
        Err(e) => warn!("process_webhook: idempotency check error (continuing): {e}"),
        Ok(None) => {}
    }

    // --- 4. Fetch full lead from Graph API ---
    let graph_path = format!(
        "{}?fields=id,created_time,field_data,form_id",
        body.lead_id
    );
    let raw_lead: Value = match s.meta.get_json(&graph_path, &config.page_access_token).await {
        Ok(v) => v,
        Err(e) => {
            let err_str = e.to_string();
            // Detect expired token (Facebook error code 190).
            if err_str.contains("190") || err_str.contains("Invalid OAuth") || err_str.contains("access token") {
                let _ = s.mongo
                    .collection::<Document>(CONFIG_COLL)
                    .update_one(
                        doc! { "tenantId": &user.user_id },
                        doc! { "$set": { "isActive": false } },
                    )
                    .await;
                log_activity(
                    &s, &user.user_id, &body.form_id, &form_name, &body.lead_id,
                    "Lead", "error", Some("Page access token expired — reconnect required"),
                ).await;
            } else {
                log_activity(
                    &s, &user.user_id, &body.form_id, &form_name, &body.lead_id,
                    "Lead", "error", Some(&err_str),
                ).await;
            }
            return Json(WebhookProcessResp { lead_id: None, status: "error".to_owned() });
        }
    };

    // --- 5. Parse field_data ---
    let field_data: Vec<(String, String)> = raw_lead
        .get("field_data")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|entry| {
                    let name = entry.get("name")?.as_str()?.to_owned();
                    let values = entry.get("values")?.as_array()?;
                    let value = values.first()?.as_str().unwrap_or("").to_owned();
                    Some((name, value))
                })
                .collect()
        })
        .unwrap_or_default();

    // --- 5b. Apply field mapping ---
    let (first_name, last_name, email, phone, company, title, description) =
        apply_field_mapping(&field_data, &form_config);

    let lead_name = format!("{} {}", first_name, last_name).trim().to_owned();
    let lead_name = if lead_name.is_empty() { "Lead".to_owned() } else { lead_name };

    // --- 6. Resolve routing (campaign rules, first match wins) ---
    let (mut pipeline_id_str, mut stage_str, assigned_to_str) =
        resolve_routing(&form_config, body.campaign_id.as_deref(), body.adset_id.as_deref());

    // CRM ↔ Facebook ads binding overrides take precedence so the
    // tenant's CRM integration settings drive routing rather than the
    // form's `defaultRouting`. Non-empty hints from the wizard win.
    if let Some(p) = body.crm_pipeline.as_deref() {
        if !p.is_empty() {
            pipeline_id_str = p.to_owned();
        }
    }
    if let Some(s) = body.crm_stage.as_deref() {
        if !s.is_empty() {
            stage_str = s.to_owned();
        }
    }

    let pipeline_oid = ObjectId::parse_str(&pipeline_id_str).ok();
    let assigned_oid = ObjectId::parse_str(&assigned_to_str).ok();

    // --- 7. Build and insert CRM lead document ---
    let lead_oid = ObjectId::new();
    let now = bson::DateTime::from_chrono(Utc::now());

    let mut lead_doc = doc! {
        "_id":           lead_oid,
        "projectId":     ObjectId::new(),
        "userId":        user_oid,
        "createdAt":     now,
        "updatedAt":     now,
        "source":        "Facebook Ads",
        "facebookLeadId": &body.lead_id,
        "firstName":     &first_name,
        "lastName":      &last_name,
    };

    if let Some(v) = &email       { lead_doc.insert("email", v); }
    if let Some(v) = &phone       { lead_doc.insert("phone", v); }
    if let Some(v) = &company     { lead_doc.insert("company", v); }
    if let Some(v) = &title       { lead_doc.insert("title", v); }
    if let Some(v) = &description { lead_doc.insert("description", v); }
    if !stage_str.is_empty()      { lead_doc.insert("status", &stage_str); }
    if let Some(oid) = pipeline_oid { lead_doc.insert("pipelineId", oid); }
    if let Some(oid) = assigned_oid { lead_doc.insert("assignedTo", oid); }

    // Retry once on transient failure.
    let lead_doc_retry = lead_doc.clone();
    let insert_result = leads_coll.insert_one(&lead_doc).await;
    let insert_result = if insert_result.is_err() {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        leads_coll.insert_one(&lead_doc_retry).await
    } else {
        insert_result
    };

    match insert_result {
        Ok(res) => {
            let inserted_id = res.inserted_id.as_object_id().map(|o| o.to_hex());
            log_activity(
                &s, &user.user_id, &body.form_id, &form_name, &body.lead_id,
                &lead_name, "created", None,
            ).await;
            Json(WebhookProcessResp { lead_id: inserted_id, status: "created".to_owned() })
        }
        Err(e) => {
            warn!("process_webhook: insert_one failed after retry: {e}");
            log_activity(
                &s, &user.user_id, &body.form_id, &form_name, &body.lead_id,
                &lead_name, "error", Some(&e.to_string()),
            ).await;
            Json(WebhookProcessResp { lead_id: None, status: "error".to_owned() })
        }
    }
}

// =========================================================================
//  Helpers
// =========================================================================

/// Map Facebook field_data entries to CRM lead fields.
/// Returns `(first_name, last_name, email, phone, company, title, description)`.
fn apply_field_mapping(
    field_data: &[(String, String)],
    form_config: &FormConfig,
) -> (String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>) {
    let mut first_name = String::new();
    let mut last_name = String::new();
    let mut email: Option<String> = None;
    let mut phone: Option<String> = None;
    let mut company: Option<String> = None;
    let mut title: Option<String> = None;
    let mut extra_parts: Vec<String> = Vec::new();

    for (fb_field, value) in field_data {
        let crm_field = form_config
            .field_mapping
            .iter()
            .find(|m| &m.fb_field == fb_field)
            .map(|m| m.crm_field.as_str());

        match crm_field {
            Some("ignore") => {}
            Some("firstName") => first_name = value.clone(),
            Some("lastName") => last_name = value.clone(),
            Some("email") => email = Some(value.clone()),
            Some("phone") => phone = Some(value.clone()),
            Some("company") => company = Some(value.clone()),
            Some("title") => title = Some(value.clone()),
            Some("description") | Some("notes") => {
                extra_parts.push(format!("{}: {}", fb_field, value));
            }
            // No explicit mapping — auto-handle standard Facebook field names.
            None => match fb_field.as_str() {
                "full_name" => {
                    if let Some((f, l)) = value.split_once(' ') {
                        first_name = f.to_owned();
                        last_name = l.to_owned();
                    } else {
                        first_name = value.clone();
                    }
                }
                "email" => email = Some(value.clone()),
                "phone_number" => phone = Some(value.clone()),
                "company_name" => company = Some(value.clone()),
                "job_title" => title = Some(value.clone()),
                _ => extra_parts.push(format!("Q: {} / A: {}", fb_field, value)),
            },
            _ => extra_parts.push(format!("Q: {} / A: {}", fb_field, value)),
        }
    }

    if first_name.is_empty() {
        first_name = "Lead".to_owned();
    }

    let description = if extra_parts.is_empty() {
        None
    } else {
        Some(extra_parts.join("\n"))
    };

    (first_name, last_name, email, phone, company, title, description)
}

/// Evaluate campaign rules top-down; return the first matching routing target.
/// Falls back to `defaultRouting` when no rule matches.
fn resolve_routing(
    form_config: &FormConfig,
    campaign_id: Option<&str>,
    adset_id: Option<&str>,
) -> (String, String, String) {
    for rule in &form_config.campaign_rules {
        let campaign_match = rule
            .campaign_id
            .as_deref()
            .map_or(true, |c| Some(c) == campaign_id);
        let adset_match = rule
            .adset_id
            .as_deref()
            .map_or(true, |a| Some(a) == adset_id);
        if campaign_match && adset_match {
            return (
                rule.pipeline_id.clone(),
                rule.stage.clone(),
                rule.assigned_to.clone(),
            );
        }
    }
    (
        form_config.default_routing.pipeline_id.clone(),
        form_config.default_routing.stage.clone(),
        form_config.default_routing.assigned_to.clone(),
    )
}

/// Fire-and-forget activity log write.
async fn log_activity(
    s: &WachatFacebookLeadGenState,
    tenant_id: &str,
    form_id: &str,
    form_name: &str,
    facebook_lead_id: &str,
    lead_name: &str,
    status: &str,
    error_message: Option<&str>,
) {
    let entry = ActivityEntry {
        id: Some(ObjectId::new()),
        tenant_id: tenant_id.to_owned(),
        timestamp: bson::DateTime::from_chrono(Utc::now()),
        form_id: form_id.to_owned(),
        form_name: form_name.to_owned(),
        facebook_lead_id: facebook_lead_id.to_owned(),
        crm_lead_id: None,
        lead_name: lead_name.to_owned(),
        status: status.to_owned(),
        error_message: error_message.map(ToOwned::to_owned),
    };
    let coll = s.mongo.collection::<ActivityEntry>(ACTIVITY_COLL);
    if let Err(e) = coll.insert_one(entry).await {
        warn!("log_activity: insert failed: {e}");
    }
}
