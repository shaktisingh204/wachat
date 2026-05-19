//! Mongo collection names. Single source of truth — every email-* crate
//! references these constants rather than hard-coding strings.

pub const SETTINGS: &str = "email_settings";
pub const SUBSCRIBERS: &str = "email_subscribers";
pub const LISTS: &str = "email_lists";
pub const SEGMENTS: &str = "email_segments";
pub const CAMPAIGNS: &str = "email_campaigns";
pub const TEMPLATES: &str = "email_templates";
pub const TEMPLATE_BLOCKS: &str = "email_template_blocks";
pub const BRAND_KITS: &str = "email_brand_kits";
pub const FORMS: &str = "email_forms";
pub const JOURNEYS: &str = "email_journeys";
pub const JOURNEY_RUNS: &str = "email_journey_runs";
pub const THREADS: &str = "email_threads";
pub const MESSAGES: &str = "email_messages";
pub const ASSIGNMENTS: &str = "email_assignments";
pub const EVENTS: &str = "email_events";
pub const SUPPRESSIONS: &str = "email_suppressions";
pub const WARMUP_RUNS: &str = "email_warmup_runs";
pub const DNS_SNAPSHOTS: &str = "email_dns_snapshots";
pub const API_KEYS: &str = "email_api_keys";
pub const WEBHOOK_CONFIGS: &str = "email_webhook_configs";
pub const REPORTS_CACHE: &str = "email_reports_cache";
