use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;
use chrono::Utc;
use crate::models::*;

#[derive(Debug, Default)]
pub struct MockDbState {
    pub locales: Vec<Locale>,
    pub translations: Vec<TranslationString>,
    pub business_hour_regions: Vec<BusinessHourRegion>,
    pub layout_configs: Vec<LayoutConfig>,
    pub currency_settings: Vec<CurrencySetting>,
}

pub type MockDb = Arc<RwLock<MockDbState>>;

pub fn create_mock_db() -> MockDb {
    let mut state = MockDbState::default();
    
    // Seed some data
    let en_us_id = Uuid::new_v4();
    state.locales.push(Locale {
        id: en_us_id,
        code: "en-US".to_string(),
        name: "English (United States)".to_string(),
        is_default: true,
        is_active: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    state.translations.push(TranslationString {
        id: Uuid::new_v4(),
        locale_id: en_us_id,
        key: "ui.button.save".to_string(),
        value: "Save".to_string(),
        context: Some("Save button across all forms".to_string()),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    state.business_hour_regions.push(BusinessHourRegion {
        id: Uuid::new_v4(),
        name: "US West Coast (HQ)".to_string(),
        timezone: "America/Los_Angeles".to_string(),
        working_days: vec!["Monday".to_string(), "Tuesday".to_string(), "Wednesday".to_string(), "Thursday".to_string(), "Friday".to_string()],
        start_time: "09:00".to_string(),
        end_time: "17:00".to_string(),
        holiday_calendar_id: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    state.layout_configs.push(LayoutConfig {
        id: Uuid::new_v4(),
        locale_id: en_us_id,
        right_to_left: false,
        date_format: "MM/DD/YYYY".to_string(),
        time_format: "12h".to_string(),
        first_day_of_week: 0,
        number_format: "#,##0.00".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    state.currency_settings.push(CurrencySetting {
        id: Uuid::new_v4(),
        code: "USD".to_string(),
        symbol: "$".to_string(),
        exchange_rate_to_base: 1.0,
        is_base: true,
        decimal_places: 2,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    });

    Arc::new(RwLock::new(state))
}
