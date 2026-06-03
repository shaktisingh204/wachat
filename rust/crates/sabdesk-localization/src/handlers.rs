use axum::{
    extract::{State, Path, Query},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;
use crate::models::*;
use crate::mock_db::MockDb;

// --- DTOs ---

#[derive(Deserialize)]
pub struct CreateLocale {
    pub code: String,
    pub name: String,
    pub is_default: bool,
    pub is_active: bool,
}

#[derive(Deserialize)]
pub struct UpdateLocale {
    pub name: Option<String>,
    pub is_default: Option<bool>,
    pub is_active: Option<bool>,
}

#[derive(Deserialize)]
pub struct CreateTranslation {
    pub locale_id: Uuid,
    pub key: String,
    pub value: String,
    pub context: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateTranslation {
    pub value: Option<String>,
    pub context: Option<String>,
}

#[derive(Deserialize)]
pub struct CreateBusinessHourRegion {
    pub name: String,
    pub timezone: String,
    pub working_days: Vec<String>,
    pub start_time: String,
    pub end_time: String,
    pub holiday_calendar_id: Option<Uuid>,
}

#[derive(Deserialize)]
pub struct CreateLayoutConfig {
    pub locale_id: Uuid,
    pub right_to_left: bool,
    pub date_format: String,
    pub time_format: String,
    pub first_day_of_week: u8,
    pub number_format: String,
}

#[derive(Deserialize)]
pub struct CreateCurrencySetting {
    pub code: String,
    pub symbol: String,
    pub exchange_rate_to_base: f64,
    pub is_base: bool,
    pub decimal_places: u8,
}

#[derive(Deserialize)]
pub struct TranslationQuery {
    pub locale_id: Option<Uuid>,
    pub prefix: Option<String>,
}

// --- Locales ---

pub async fn list_locales(
    State(db): State<MockDb>,
) -> Json<Vec<Locale>> {
    let state = db.read().await;
    Json(state.locales.clone())
}

pub async fn create_locale(
    State(db): State<MockDb>,
    Json(payload): Json<CreateLocale>,
) -> (StatusCode, Json<Locale>) {
    let mut state = db.write().await;
    let locale = Locale {
        id: Uuid::new_v4(),
        code: payload.code,
        name: payload.name,
        is_default: payload.is_default,
        is_active: payload.is_active,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.locales.push(locale.clone());
    (StatusCode::CREATED, Json(locale))
}

pub async fn get_locale(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<Locale>, StatusCode> {
    let state = db.read().await;
    match state.locales.iter().find(|l| l.id == id) {
        Some(locale) => Ok(Json(locale.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_locale(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateLocale>,
) -> Result<Json<Locale>, StatusCode> {
    let mut state = db.write().await;
    if let Some(locale) = state.locales.iter_mut().find(|l| l.id == id) {
        if let Some(name) = payload.name {
            locale.name = name;
        }
        if let Some(is_default) = payload.is_default {
            locale.is_default = is_default;
        }
        if let Some(is_active) = payload.is_active {
            locale.is_active = is_active;
        }
        locale.updated_at = Utc::now();
        Ok(Json(locale.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_locale(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut state = db.write().await;
    let len_before = state.locales.len();
    state.locales.retain(|l| l.id != id);
    if state.locales.len() < len_before {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// --- Translations ---

pub async fn list_translations(
    State(db): State<MockDb>,
    Query(query): Query<TranslationQuery>,
) -> Json<Vec<TranslationString>> {
    let state = db.read().await;
    let mut result = state.translations.clone();
    
    if let Some(locale_id) = query.locale_id {
        result.retain(|t| t.locale_id == locale_id);
    }
    
    if let Some(prefix) = query.prefix {
        result.retain(|t| t.key.starts_with(&prefix));
    }
    
    Json(result)
}

pub async fn create_translation(
    State(db): State<MockDb>,
    Json(payload): Json<CreateTranslation>,
) -> (StatusCode, Json<TranslationString>) {
    let mut state = db.write().await;
    let translation = TranslationString {
        id: Uuid::new_v4(),
        locale_id: payload.locale_id,
        key: payload.key,
        value: payload.value,
        context: payload.context,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.translations.push(translation.clone());
    (StatusCode::CREATED, Json(translation))
}

pub async fn get_translation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> Result<Json<TranslationString>, StatusCode> {
    let state = db.read().await;
    match state.translations.iter().find(|t| t.id == id) {
        Some(t) => Ok(Json(t.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_translation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTranslation>,
) -> Result<Json<TranslationString>, StatusCode> {
    let mut state = db.write().await;
    if let Some(t) = state.translations.iter_mut().find(|t| t.id == id) {
        if let Some(value) = payload.value {
            t.value = value;
        }
        if let Some(context) = payload.context {
            t.context = Some(context);
        }
        t.updated_at = Utc::now();
        Ok(Json(t.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_translation(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
) -> StatusCode {
    let mut state = db.write().await;
    let len_before = state.translations.len();
    state.translations.retain(|t| t.id != id);
    if state.translations.len() < len_before {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

// Complex: Compile Language Pack
pub async fn compile_language_pack(
    State(db): State<MockDb>,
    Path(locale_id): Path<Uuid>,
) -> Result<Json<LanguagePack>, StatusCode> {
    let state = db.read().await;
    
    let locale = state.locales.iter().find(|l| l.id == locale_id).cloned().ok_or(StatusCode::NOT_FOUND)?;
    
    let translations: Vec<TranslationString> = state.translations
        .iter()
        .filter(|t| t.locale_id == locale_id)
        .cloned()
        .collect();
        
    let layout = state.layout_configs
        .iter()
        .find(|l| l.locale_id == locale_id)
        .cloned();

    Ok(Json(LanguagePack {
        locale,
        translations,
        layout,
        generated_at: Utc::now(),
    }))
}

// Bulk keys fetching
#[derive(Deserialize)]
pub struct BulkKeysRequest {
    pub locale_id: Uuid,
    pub keys: Vec<String>,
}

pub async fn get_translation_keys(
    State(db): State<MockDb>,
    Json(payload): Json<BulkKeysRequest>,
) -> Json<std::collections::HashMap<String, String>> {
    let state = db.read().await;
    let mut result = std::collections::HashMap::new();
    
    for t in state.translations.iter() {
        if t.locale_id == payload.locale_id && payload.keys.contains(&t.key) {
            result.insert(t.key.clone(), t.value.clone());
        }
    }
    Json(result)
}

// --- Business Hour Regions ---

pub async fn list_regions(State(db): State<MockDb>) -> Json<Vec<BusinessHourRegion>> {
    Json(db.read().await.business_hour_regions.clone())
}

pub async fn create_region(
    State(db): State<MockDb>,
    Json(payload): Json<CreateBusinessHourRegion>,
) -> (StatusCode, Json<BusinessHourRegion>) {
    let mut state = db.write().await;
    let region = BusinessHourRegion {
        id: Uuid::new_v4(),
        name: payload.name,
        timezone: payload.timezone,
        working_days: payload.working_days,
        start_time: payload.start_time,
        end_time: payload.end_time,
        holiday_calendar_id: payload.holiday_calendar_id,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.business_hour_regions.push(region.clone());
    (StatusCode::CREATED, Json(region))
}

pub async fn get_region(State(db): State<MockDb>, Path(id): Path<Uuid>) -> Result<Json<BusinessHourRegion>, StatusCode> {
    db.read().await.business_hour_regions.iter().find(|r| r.id == id)
        .map(|r| Json(r.clone())).ok_or(StatusCode::NOT_FOUND)
}

#[derive(Deserialize)]
pub struct RegionalOverrideRequest {
    pub timezone: Option<String>,
    pub holiday_calendar_id: Option<Uuid>,
}

pub async fn set_regional_override(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RegionalOverrideRequest>,
) -> Result<Json<BusinessHourRegion>, StatusCode> {
    let mut state = db.write().await;
    if let Some(r) = state.business_hour_regions.iter_mut().find(|r| r.id == id) {
        if let Some(tz) = payload.timezone {
            r.timezone = tz;
        }
        if let Some(cal) = payload.holiday_calendar_id {
            r.holiday_calendar_id = Some(cal);
        }
        r.updated_at = Utc::now();
        Ok(Json(r.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_region(State(db): State<MockDb>, Path(id): Path<Uuid>) -> StatusCode {
    let mut state = db.write().await;
    let len = state.business_hour_regions.len();
    state.business_hour_regions.retain(|r| r.id != id);
    if state.business_hour_regions.len() < len { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
}

// --- Layout Configs ---

pub async fn list_layouts(State(db): State<MockDb>) -> Json<Vec<LayoutConfig>> {
    Json(db.read().await.layout_configs.clone())
}

pub async fn create_layout(
    State(db): State<MockDb>,
    Json(payload): Json<CreateLayoutConfig>,
) -> (StatusCode, Json<LayoutConfig>) {
    let mut state = db.write().await;
    let layout = LayoutConfig {
        id: Uuid::new_v4(),
        locale_id: payload.locale_id,
        right_to_left: payload.right_to_left,
        date_format: payload.date_format,
        time_format: payload.time_format,
        first_day_of_week: payload.first_day_of_week,
        number_format: payload.number_format,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.layout_configs.push(layout.clone());
    (StatusCode::CREATED, Json(layout))
}

pub async fn get_layout(State(db): State<MockDb>, Path(id): Path<Uuid>) -> Result<Json<LayoutConfig>, StatusCode> {
    db.read().await.layout_configs.iter().find(|l| l.id == id)
        .map(|l| Json(l.clone())).ok_or(StatusCode::NOT_FOUND)
}

pub async fn delete_layout(State(db): State<MockDb>, Path(id): Path<Uuid>) -> StatusCode {
    let mut state = db.write().await;
    let len = state.layout_configs.len();
    state.layout_configs.retain(|l| l.id != id);
    if state.layout_configs.len() < len { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
}

// --- Currency Settings ---

pub async fn list_currencies(State(db): State<MockDb>) -> Json<Vec<CurrencySetting>> {
    Json(db.read().await.currency_settings.clone())
}

pub async fn create_currency(
    State(db): State<MockDb>,
    Json(payload): Json<CreateCurrencySetting>,
) -> (StatusCode, Json<CurrencySetting>) {
    let mut state = db.write().await;
    let currency = CurrencySetting {
        id: Uuid::new_v4(),
        code: payload.code,
        symbol: payload.symbol,
        exchange_rate_to_base: payload.exchange_rate_to_base,
        is_base: payload.is_base,
        decimal_places: payload.decimal_places,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    state.currency_settings.push(currency.clone());
    (StatusCode::CREATED, Json(currency))
}

pub async fn get_currency(State(db): State<MockDb>, Path(id): Path<Uuid>) -> Result<Json<CurrencySetting>, StatusCode> {
    db.read().await.currency_settings.iter().find(|c| c.id == id)
        .map(|c| Json(c.clone())).ok_or(StatusCode::NOT_FOUND)
}

#[derive(Deserialize)]
pub struct UpdateCurrency {
    pub exchange_rate_to_base: f64,
}

pub async fn update_currency_rate(
    State(db): State<MockDb>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCurrency>,
) -> Result<Json<CurrencySetting>, StatusCode> {
    let mut state = db.write().await;
    if let Some(c) = state.currency_settings.iter_mut().find(|c| c.id == id) {
        c.exchange_rate_to_base = payload.exchange_rate_to_base;
        c.updated_at = Utc::now();
        Ok(Json(c.clone()))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn delete_currency(State(db): State<MockDb>, Path(id): Path<Uuid>) -> StatusCode {
    let mut state = db.write().await;
    let len = state.currency_settings.len();
    state.currency_settings.retain(|c| c.id != id);
    if state.currency_settings.len() < len { StatusCode::NO_CONTENT } else { StatusCode::NOT_FOUND }
}
