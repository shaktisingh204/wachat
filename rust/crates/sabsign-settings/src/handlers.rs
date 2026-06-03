use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    mock_db::AppState,
    models::{
        BrandProfile, ComplianceSetting, EmailTemplate, LegalDisclosure, PasswordPolicy,
        SecurityConfig, SettingsAnalytics,
    },
};

// --- Brand Endpoints (1-6) ---

pub async fn create_brand(
    State(state): State<AppState>,
    Json(mut payload): Json<BrandProfile>,
) -> Result<Json<BrandProfile>, StatusCode> {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    let mut db = state.db.write().await;
    db.brands.insert(payload.id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_brands(State(state): State<AppState>) -> Json<Vec<BrandProfile>> {
    let db = state.db.read().await;
    let brands: Vec<BrandProfile> = db.brands.values().cloned().collect();
    Json(brands)
}

pub async fn get_brand(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<BrandProfile>, StatusCode> {
    let db = state.db.read().await;
    db.brands
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_brand(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<BrandProfile>,
) -> Result<Json<BrandProfile>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(brand) = db.brands.get_mut(&id) {
        brand.name = payload.name;
        brand.logo_url = payload.logo_url;
        brand.primary_color = payload.primary_color;
        brand.secondary_color = payload.secondary_color;
        brand.custom_css = payload.custom_css;
        brand.updated_at = Utc::now();
        return Ok(Json(brand.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

pub async fn delete_brand(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.write().await;
    if db.brands.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn override_css_brand(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(css_payload): Json<String>,
) -> Result<Json<BrandProfile>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(brand) = db.brands.get_mut(&id) {
        brand.custom_css = Some(css_payload);
        brand.updated_at = Utc::now();
        return Ok(Json(brand.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

// --- Email Template Endpoints (7-12) ---

pub async fn create_template(
    State(state): State<AppState>,
    Json(mut payload): Json<EmailTemplate>,
) -> Result<Json<EmailTemplate>, StatusCode> {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    let mut db = state.db.write().await;
    db.templates.insert(payload.id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_templates(State(state): State<AppState>) -> Json<Vec<EmailTemplate>> {
    let db = state.db.read().await;
    let templates: Vec<EmailTemplate> = db.templates.values().cloned().collect();
    Json(templates)
}

pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<EmailTemplate>, StatusCode> {
    let db = state.db.read().await;
    db.templates
        .get(&id)
        .cloned()
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<EmailTemplate>,
) -> Result<Json<EmailTemplate>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(template) = db.templates.get_mut(&id) {
        template.template_type = payload.template_type;
        template.subject = payload.subject;
        template.body_html = payload.body_html;
        template.brand_id = payload.brand_id;
        template.updated_at = Utc::now();
        return Ok(Json(template.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.write().await;
    if db.templates.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn bulk_delete_templates(
    State(state): State<AppState>,
    Json(ids): Json<Vec<Uuid>>,
) -> StatusCode {
    let mut db = state.db.write().await;
    for id in ids {
        db.templates.remove(&id);
    }
    StatusCode::NO_CONTENT
}

// --- Legal Disclosure Endpoints (13-16) ---

pub async fn create_disclosure(
    State(state): State<AppState>,
    Json(mut payload): Json<LegalDisclosure>,
) -> Result<Json<LegalDisclosure>, StatusCode> {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    let mut db = state.db.write().await;
    db.disclosures.insert(payload.id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_disclosures(State(state): State<AppState>) -> Json<Vec<LegalDisclosure>> {
    let db = state.db.read().await;
    let disclosures: Vec<LegalDisclosure> = db.disclosures.values().cloned().collect();
    Json(disclosures)
}

pub async fn require_esign_consent(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(requires): Json<bool>,
) -> Result<Json<LegalDisclosure>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(disc) = db.disclosures.get_mut(&id) {
        disc.requires_explicit_consent = requires;
        disc.updated_at = Utc::now();
        return Ok(Json(disc.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

pub async fn delete_disclosure(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut db = state.db.write().await;
    if db.disclosures.remove(&id).is_some() {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// --- Security Config Endpoints (17-19) ---

pub async fn create_security_config(
    State(state): State<AppState>,
    Json(mut payload): Json<SecurityConfig>,
) -> Result<Json<SecurityConfig>, StatusCode> {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    let mut db = state.db.write().await;
    db.security_configs.insert(payload.id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_security_configs(State(state): State<AppState>) -> Json<Vec<SecurityConfig>> {
    let db = state.db.read().await;
    let configs: Vec<SecurityConfig> = db.security_configs.values().cloned().collect();
    Json(configs)
}

pub async fn update_security_config(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<SecurityConfig>,
) -> Result<Json<SecurityConfig>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(config) = db.security_configs.get_mut(&id) {
        config.require_mfa = payload.require_mfa;
        config.session_timeout_minutes = payload.session_timeout_minutes;
        config.allowed_ips = payload.allowed_ips;
        config.sso_enabled = payload.sso_enabled;
        config.password_policy = payload.password_policy;
        config.updated_at = Utc::now();
        return Ok(Json(config.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

// --- Compliance Settings Endpoints (20-22) ---

pub async fn create_compliance_setting(
    State(state): State<AppState>,
    Json(mut payload): Json<ComplianceSetting>,
) -> Result<Json<ComplianceSetting>, StatusCode> {
    payload.id = Uuid::new_v4();
    payload.created_at = Utc::now();
    payload.updated_at = Utc::now();

    let mut db = state.db.write().await;
    db.compliance_settings.insert(payload.id, payload.clone());
    Ok(Json(payload))
}

pub async fn get_compliance_settings(
    State(state): State<AppState>,
) -> Json<Vec<ComplianceSetting>> {
    let db = state.db.read().await;
    let settings: Vec<ComplianceSetting> = db.compliance_settings.values().cloned().collect();
    Json(settings)
}

pub async fn update_compliance_setting(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<ComplianceSetting>,
) -> Result<Json<ComplianceSetting>, StatusCode> {
    let mut db = state.db.write().await;
    if let Some(setting) = db.compliance_settings.get_mut(&id) {
        setting.hipaa_compliant = payload.hipaa_compliant;
        setting.gdpr_compliant = payload.gdpr_compliant;
        setting.data_retention_days = payload.data_retention_days;
        setting.audit_log_retention_days = payload.audit_log_retention_days;
        setting.updated_at = Utc::now();
        return Ok(Json(setting.clone()));
    }
    Err(StatusCode::NOT_FOUND)
}

// --- Analytics Endpoint (23) ---

pub async fn get_settings_analytics(State(state): State<AppState>) -> Json<SettingsAnalytics> {
    let db = state.db.read().await;

    let total_brands = db.brands.len();
    let total_templates = db.templates.len();
    let mfa_enabled_accounts = db
        .security_configs
        .values()
        .filter(|c| c.require_mfa)
        .count();
    let active_sso_configs = db
        .security_configs
        .values()
        .filter(|c| c.sso_enabled)
        .count();

    Json(SettingsAnalytics {
        total_brands,
        total_templates,
        mfa_enabled_accounts,
        active_sso_configs,
    })
}
