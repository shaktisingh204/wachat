use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Locale {
    pub id: Uuid,
    pub code: String, // e.g., "en-US", "fr-FR"
    pub name: String,
    pub is_default: bool,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationString {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub key: String, // e.g., "ui.button.save"
    pub value: String,
    pub context: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BusinessHourRegion {
    pub id: Uuid,
    pub name: String,
    pub timezone: String, // e.g., "America/Los_Angeles"
    pub working_days: Vec<String>, // e.g., ["Monday", "Tuesday"]
    pub start_time: String, // e.g., "09:00"
    pub end_time: String, // e.g., "17:00"
    pub holiday_calendar_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LayoutConfig {
    pub id: Uuid,
    pub locale_id: Uuid,
    pub right_to_left: bool,
    pub date_format: String, // e.g., "MM/DD/YYYY"
    pub time_format: String, // e.g., "12h" or "24h"
    pub first_day_of_week: u8, // 0 = Sunday, 1 = Monday
    pub number_format: String, // e.g., "#,##0.00"
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CurrencySetting {
    pub id: Uuid,
    pub code: String, // e.g., "USD"
    pub symbol: String, // e.g., "$"
    pub exchange_rate_to_base: f64,
    pub is_base: bool,
    pub decimal_places: u8,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LanguagePack {
    pub locale: Locale,
    pub translations: Vec<TranslationString>,
    pub layout: Option<LayoutConfig>,
    pub generated_at: DateTime<Utc>,
}
