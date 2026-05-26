//! Top-level router assembly.
//!
//! Mounts liveness/readiness probes at the root and a versioned `/v1`
//! sub-router that domain crates plug into.

use std::time::Duration;

use axum::{
    Router,
    http::{HeaderName, StatusCode},
};
use tower_http::{
    cors::{Any, CorsLayer},
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};

use crate::{routes, state::AppState};

const REQUEST_ID_HEADER: &str = "x-request-id";

pub fn build(state: AppState) -> Router {
    let request_id_header = HeaderName::from_static(REQUEST_ID_HEADER);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let v1 = sabnode_users::router::<AppState>();
    let admin_router = sabnode_admin::router::<AppState>();

    // Wachat webhook routes are absolute (`/v1/wachat/webhook/meta`) so they
    // merge at the root rather than nest under /v1.
    let wachat_webhook = wachat_webhook::router::<AppState>();
    // Cron drain endpoint is also absolute (`/v1/wachat/webhook/cron/drain-dlq`)
    // and gated by a shared `CRON_SECRET` rather than the JWT/tenant pipeline,
    // so it merges at the root too.
    let wachat_webhook_cron = wachat_webhook_dlq::cron_router::<AppState>();
    let wachat_webhook_admin: Router<AppState> =
        let sabbi_charts_r = sabbi_charts::router::<AppState>();
    let sabbi_dataset_joins_r = sabbi_dataset_joins::router::<AppState>();
    let sabbi_datasets_r = sabbi_datasets::router::<AppState>();
    let sabbi_schedules_r = sabbi_schedules::router::<AppState>();
    let sabbi_workbooks_r = sabbi_workbooks::router::<AppState>();
    let sabbigin_config_r = sabbigin_config::router::<AppState>();
    let sabbugs_bugs_r = sabbugs_bugs::router::<AppState>();
    let sabbugs_comments_r = sabbugs_comments::router::<AppState>();
    let sabbugs_history_r = sabbugs_history::router::<AppState>();
    let sabbugs_saved_filters_r = sabbugs_saved_filters::router::<AppState>();
    let sabbugs_versions_r = sabbugs_versions::router::<AppState>();
    let sabconnect_comments_r = sabconnect_comments::router::<AppState>();
    let sabconnect_custom_apps_r = sabconnect_custom_apps::router::<AppState>();
    let sabconnect_feed_r = sabconnect_feed::router::<AppState>();
    let sabconnect_groups_r = sabconnect_groups::router::<AppState>();
    let sabconnect_manuals_r = sabconnect_manuals::router::<AppState>();
    let sabconnect_reactions_r = sabconnect_reactions::router::<AppState>();
    let sabmeet_dialins_r = sabmeet_dialins::router::<AppState>();
    let sabmeet_participants_r = sabmeet_participants::router::<AppState>();
    let sabmeet_polls_r = sabmeet_polls::router::<AppState>();
    let sabmeet_qna_r = sabmeet_qna::router::<AppState>();
    let sabmeet_recordings_r = sabmeet_recordings::router::<AppState>();
    let sabmeet_rooms_r = sabmeet_rooms::router::<AppState>();
    let sabprep_recipes_r = sabprep_recipes::router::<AppState>();
    let sabrequests_blueprints_r = sabrequests_blueprints::router::<AppState>();
    let sabrequests_instances_r = sabrequests_instances::router::<AppState>();
    let sabrewards_catalog_r = sabrewards_catalog::router::<AppState>();
    let sabrewards_members_r = sabrewards_members::router::<AppState>();
    let sabrewards_programs_r = sabrewards_programs::router::<AppState>();
    let sabrewards_redemptions_r = sabrewards_redemptions::router::<AppState>();
    let sabrewards_referrals_r = sabrewards_referrals::router::<AppState>();
    let sabsense_form_analytics_r = sabsense_form_analytics::router::<AppState>();
    let sabsense_funnel_runs_r = sabsense_funnel_runs::router::<AppState>();
    let sabsense_funnels_r = sabsense_funnels::router::<AppState>();
    let sabsense_heatmap_events_r = sabsense_heatmap_events::router::<AppState>();
    let sabsense_heatmaps_r = sabsense_heatmaps::router::<AppState>();
    let sabsense_recordings_r = sabsense_recordings::router::<AppState>();
    let sabsense_sites_r = sabsense_sites::router::<AppState>();
    let sabshop_carts_r = sabshop_carts::router::<AppState>();
    let sabshop_checkouts_r = sabshop_checkouts::router::<AppState>();
    let sabshop_collections_r = sabshop_collections::router::<AppState>();
    let sabshop_orders_r = sabshop_orders::router::<AppState>();
    let sabshop_shipping_zones_r = sabshop_shipping_zones::router::<AppState>();
    let sabshop_storefronts_r = sabshop_storefronts::router::<AppState>();
    let sabshop_tax_rules_r = sabshop_tax_rules::router::<AppState>();
    let sabshop_themes_r = sabshop_themes::router::<AppState>();
    let sabsign_audit_r = sabsign_audit::router::<AppState>();
    let sabsign_envelopes_r = sabsign_envelopes::router::<AppState>();
    let sabsign_fields_r = sabsign_fields::router::<AppState>();
    let sabsign_templates_r = sabsign_templates::router::<AppState>();
    let sabsprints_burndown_r = sabsprints_burndown::router::<AppState>();
    let sabsprints_epics_r = sabsprints_epics::router::<AppState>();
    let sabsprints_sprints_r = sabsprints_sprints::router::<AppState>();
    let sabsprints_stories_r = sabsprints_stories::router::<AppState>();
    let sabsprints_velocity_r = sabsprints_velocity::router::<AppState>();
    let sabvoice_agents_presence_r = sabvoice_agents_presence::router::<AppState>();
    let sabvoice_calls_r = sabvoice_calls::router::<AppState>();
    let sabvoice_dids_r = sabvoice_dids::router::<AppState>();
    let sabvoice_ivrs_r = sabvoice_ivrs::router::<AppState>();
    let sabvoice_queues_r = sabvoice_queues::router::<AppState>();
    let sabvoice_voicemail_r = sabvoice_voicemail::router::<AppState>();

    let sabbi_embeds_r = sabbi_embeds::router::<AppState>();
    let sabprep_profiles_r = sabprep_profiles::router::<AppState>();
    let sabprep_runs_r = sabprep_runs::router::<AppState>();
    let sabrequests_orgcharts_r = sabrequests_orgcharts::router::<AppState>();
    let sabrequests_stage_actions_r = sabrequests_stage_actions::router::<AppState>();

    Router::new().nest("/admin", wachat_webhook_config::router::<AppState>());
    let wachat_templates = wachat_templates_router::router::<AppState>();
    let wachat_templates_actions = wachat_templates_actions::router::<AppState>();
    let wachat_send = wachat_send_router::router::<AppState>();
    let wachat_config = wachat_config::router::<AppState>();
    let wachat_pay = wachat_pay::router::<AppState>();
    let wachat_calling = wachat_calling::router::<AppState>();
    let wachat_broadcast = wachat_broadcast::router::<AppState>();
    let wachat_features = wachat_features::router::<AppState>();
    let wachat_analytics = wachat_analytics::router::<AppState>();
    let wachat_webhook_actions = wachat_webhook_actions::router::<AppState>();
    let wachat_webhook_status = wachat_webhook_status::router::<AppState>();
    let meta_suite = meta_suite::router::<AppState>();
    let meta_token = meta_token::router::<AppState>();
    let meta_flows = meta_flows::router::<AppState>();
    let qr_codes = qr_codes::router::<AppState>();
    let url_shortener = url_shortener::router::<AppState>();
    let ad_manager = ad_manager::router::<AppState>();
    let facebook_flow = facebook_flow::router::<AppState>();
    let wachat_public = wachat_public_api::router::<AppState>();
    let wachat_projects = wachat_projects::router::<AppState>();
    let wachat_contacts = wachat_contacts::router::<AppState>();
    let crm_lookup = crm_lookup::router::<AppState>();
    let crm_accounts = crm_accounts::router::<AppState>();
    let crm_pipelines = crm_pipelines::router::<AppState>();
    let crm_contacts = crm_contacts::router::<AppState>();
    let crm_items = crm_items::router::<AppState>();
    let crm_leads = crm_leads::router::<AppState>();
    let crm_deals = crm_deals::router::<AppState>();
    let crm_quotations = crm_quotations::router::<AppState>();
    let crm_invoices = crm_invoices::router::<AppState>();
    let crm_sales_orders = crm_sales_orders::router::<AppState>();
    let crm_purchase_orders = crm_purchase_orders::router::<AppState>();
    let crm_payment_receipts = crm_payment_receipts::router::<AppState>();
    let crm_credit_notes = crm_credit_notes::router::<AppState>();
    let crm_debit_notes = crm_debit_notes::router::<AppState>();
    let crm_payouts = crm_payouts::router::<AppState>();
    let crm_tickets = crm_tickets::router::<AppState>();
    let crm_subscriptions = crm_subscriptions::router::<AppState>();
    let crm_bills = crm_bills::router::<AppState>();
    let crm_rfqs = crm_rfqs::router::<AppState>();
    let crm_vendors = crm_vendors::router::<AppState>();
    let crm_vendor_bids = crm_vendor_bids::router::<AppState>();
    let crm_grns = crm_grns::router::<AppState>();
    let crm_employees = crm_employees::router::<AppState>();
    let crm_attendance = crm_attendance::router::<AppState>();
    let crm_leaves = crm_leaves::router::<AppState>();
    let crm_payroll_runs = crm_payroll_runs::router::<AppState>();
    let crm_fixed_assets = crm_fixed_assets::router::<AppState>();
    let crm_bookings = crm_bookings::router::<AppState>();
    let crm_holidays = crm_holidays::router::<AppState>();
    let crm_departments = crm_departments::router::<AppState>();
    let crm_brands = crm_brands::router::<AppState>();
    let crm_tags = crm_tags::router::<AppState>();
    let crm_labels = crm_labels::router::<AppState>();
    let crm_branches = crm_branches::router::<AppState>();
    let crm_warehouses = crm_warehouses::router::<AppState>();
    let crm_stock_adjustments = crm_stock_adjustments::router::<AppState>();
    let crm_coupons = crm_coupons::router::<AppState>();
    let crm_gift_cards = crm_gift_cards::router::<AppState>();
    let crm_loyalty_programs = crm_loyalty_programs::router::<AppState>();
    let crm_budgets = crm_budgets::router::<AppState>();
    let crm_loans = crm_loans::router::<AppState>();
    let crm_petty_cash = crm_petty_cash::router::<AppState>();
    let crm_bom = crm_bom::router::<AppState>();
    let crm_production_orders = crm_production_orders::router::<AppState>();
    let crm_proforma_invoices = crm_proforma_invoices::router::<AppState>();
    let crm_delivery_challans = crm_delivery_challans::router::<AppState>();
    let crm_service_contracts = crm_service_contracts::router::<AppState>();
    let crm_tasks = crm_tasks::router::<AppState>();
    let crm_disciplinary = crm_disciplinary::router::<AppState>();
    let crm_vouchers = crm_vouchers::router::<AppState>();
    let crm_contracts = crm_contracts::router::<AppState>();
    let crm_awards = crm_awards::router::<AppState>();
    let crm_kb_articles = crm_kb_articles::router::<AppState>();
    let crm_payment_accounts = crm_payment_accounts::router::<AppState>();
    let crm_slas = crm_slas::router::<AppState>();
    let crm_exits = crm_exits::router::<AppState>();
    let crm_purchase_leads = crm_purchase_leads::router::<AppState>();
    let crm_automations_router = crm_automations::router::<AppState>();
    let crm_forms_router = crm_forms::router::<AppState>();
    let crm_saved_views_router = crm_saved_views::router::<AppState>();
    let crm_email_templates_router = crm_email_templates::router::<AppState>();
    let crm_portal_users_router = crm_portal_users::router::<AppState>();
    let crm_appraisals_router = crm_appraisals::router::<AppState>();
    let crm_succession_router = crm_succession::router::<AppState>();
    let crm_reconciliation_router = crm_reconciliation::router::<AppState>();
    let crm_payroll_settings_router = crm_payroll_settings::router::<AppState>();
    let crm_auto_leads_router = crm_auto_leads::router::<AppState>();
    let crm_project_tasks_router = crm_project_tasks::router::<AppState>();
    let crm_payslips_router = crm_payslips::router::<AppState>();
    let crm_salary_structures_router = crm_salary_structures::router::<AppState>();
    let crm_products_router = crm_products::router::<AppState>();
    let crm_goals_router = crm_goals::router::<AppState>();
    let crm_pt_slabs_router = crm_pt_slabs::router::<AppState>();
    let crm_chart_of_accounts_router = crm_chart_of_accounts::router::<AppState>();
    let crm_account_groups_router = crm_account_groups::router::<AppState>();
    let crm_dashboards_router = crm_dashboards::router::<AppState>();
    let crm_voucher_entries_router = crm_voucher_entries::router::<AppState>();
    let crm_form_submissions_router = crm_form_submissions::router::<AppState>();
    let crm_kpis_router = crm_kpis::router::<AppState>();
    let crm_industries_router = crm_industries::router::<AppState>();
    let crm_product_categories_router = crm_product_categories::router::<AppState>();
    let crm_settings_router = crm_settings::router::<AppState>();
    let crm_taxes_router = crm_taxes::router::<AppState>();
    let crm_units_router = crm_units::router::<AppState>();
    let crm_vendor_types_router = crm_vendor_types::router::<AppState>();
    let crm_purchases_router = crm_purchases::router::<AppState>();
    let crm_leave_requests_router = crm_leave_requests::router::<AppState>();
    let crm_subtasks_router = crm_subtasks::router::<AppState>();
    let crm_milestones_router = crm_milestones::router::<AppState>();
    let crm_issues_router = crm_issues::router::<AppState>();
    let crm_time_logs_router = crm_time_logs::router::<AppState>();
    let crm_ticket_tags_router = crm_ticket_tags::router::<AppState>();
    let crm_ticket_channels_router = crm_ticket_channels::router::<AppState>();
    let crm_reply_templates_router = crm_reply_templates::router::<AppState>();
    let crm_candidates_router = crm_candidates::router::<AppState>();
    let crm_jobs_router = crm_jobs::router::<AppState>();
    let crm_interviews_router = crm_interviews::router::<AppState>();
    let crm_offers_router = crm_offers::router::<AppState>();
    let crm_onboarding_router = crm_onboarding::router::<AppState>();
    let crm_assets_router = crm_assets::router::<AppState>();
    let crm_documents_router = crm_documents::router::<AppState>();
    let crm_training_router = crm_training::router::<AppState>();
    let crm_ticket_groups_router = crm_ticket_groups::router::<AppState>();
    let crm_ticket_types_router = crm_ticket_types::router::<AppState>();
    let crm_agent_groups_router = crm_agent_groups::router::<AppState>();
    let crm_shifts_router = crm_shifts::router::<AppState>();
    let crm_okrs_router = crm_okrs::router::<AppState>();
    let crm_policies_router = crm_policies::router::<AppState>();
    let crm_announcements_router = crm_announcements::router::<AppState>();
    let crm_events_router = crm_events::router::<AppState>();
    let crm_notices_router = crm_notices::router::<AppState>();
    let crm_currencies_router = crm_currencies::router::<AppState>();
    let crm_expense_categories_router = crm_expense_categories::router::<AppState>();
    let crm_custom_fields_router = crm_custom_fields::router::<AppState>();
    let crm_company_profile_router = crm_company_profile::router::<AppState>();
    let crm_shift_rotations_router = crm_shift_rotations::router::<AppState>();
    let crm_one_on_ones_router = crm_one_on_ones::router::<AppState>();
    let crm_project_categories_router = crm_project_categories::router::<AppState>();
    let crm_task_labels_router = crm_task_labels::router::<AppState>();
    let crm_taskboard_columns_router = crm_taskboard_columns::router::<AppState>();
    let wachat_flows = wachat_flows::router::<AppState>();
    let wachat_api_keys_admin = wachat_api_keys_admin::router::<AppState>();
    let fb_pages = wachat_facebook_pages::router::<AppState>();
    let fb_content = wachat_facebook_content::router::<AppState>();
    let fb_messaging = wachat_facebook_messaging::router::<AppState>();
    let fb_automation = wachat_facebook_automation::router::<AppState>();
    let fb_crm = wachat_facebook_crm::router::<AppState>();
    let fb_agents = wachat_facebook_agents::router::<AppState>();
    let fb_business = wachat_facebook_business::router::<AppState>();
    let fb_misc = wachat_facebook_misc::router::<AppState>();
    let fb_comments = wachat_facebook_comments::router::<AppState>();
    let fb_events = wachat_facebook_events::router::<AppState>();
    let fb_lead_gen = wachat_facebook_lead_gen::router::<AppState>();
    let fb_messenger_profile = wachat_facebook_messenger_profile::router::<AppState>();
    let instagram = wachat_instagram::router::<AppState>();
    let sabfiles_router = sabfiles::router::<AppState>();
    let telegram_bots_router = telegram_bots::router::<AppState>();
    let telegram_chats_router = telegram_chats::router::<AppState>();
    let telegram_broadcasts_router = telegram_broadcasts::router::<AppState>();
    let telegram_auto_reply_router = telegram_auto_reply::router::<AppState>();
    let telegram_commands_router = telegram_commands::router::<AppState>();
    let telegram_bot_profile_router = telegram_bot_profile::router::<AppState>();
    let telegram_channels_router = telegram_channels::router::<AppState>();
    let telegram_analytics_router = telegram_analytics::router::<AppState>();
    let telegram_payments_router = telegram_payments::router::<AppState>();
    let telegram_stickers_router = telegram_stickers::router::<AppState>();
    let telegram_stories_router = telegram_stories::router::<AppState>();
    let telegram_flows_router = telegram_flows::router::<AppState>();
    let telegram_mini_apps_router = telegram_mini_apps::router::<AppState>();
    let telegram_ads_router = telegram_ads::router::<AppState>();
    let telegram_api_credentials_router = telegram_api_credentials::router::<AppState>();
    let telegram_business_inbox_router = telegram_business_inbox::router::<AppState>();
    let telegram_contacts_router = telegram_contacts::router::<AppState>();
    let telegram_settings_router = telegram_settings::router::<AppState>();
    let telegram_webhooks_router = telegram_webhooks::router::<AppState>();

    let email_audience = email_audience::router::<AppState>();
    let email_templates = email_templates::router::<AppState>();
    let email_inbox = email_inbox::router::<AppState>();
    let email_inbound = email_inbound::router::<AppState>();
    let email_deliverability = email_deliverability::router::<AppState>();
    let email_api = email_api::router::<AppState>();
    let email_webhooks = email_webhooks::router::<AppState>();
    let email_campaigns = email_campaigns::router::<AppState>();
    let email_events = email_events::router::<AppState>();
    let email_reports = email_reports::router::<AppState>();
    let email_journeys = email_journeys::router::<AppState>();

    // SabChat — Pillar 1 + 2 foundation.
    let sabchat_inboxes = sabchat_inboxes::router::<AppState>();
    let sabchat_contacts_r = sabchat_contacts::router::<AppState>();
    let sabchat_conversations_r = sabchat_conversations::router::<AppState>();
    let sabchat_messages_r = sabchat_messages::router::<AppState>();
    let sabchat_audit_r = sabchat_audit::router::<AppState>();
    let sabchat_routing_r = sabchat_routing::router::<AppState>();
    let sabchat_widget_r = sabchat_widget::router::<AppState>();
    let sabchat_ws_r = sabchat_ws::router::<AppState>();

    let sabchat_channel_whatsapp_r = sabchat_channel_whatsapp::router::<AppState>();
    let sabchat_channel_instagram_r = sabchat_channel_instagram::router::<AppState>();
    let sabchat_channel_facebook_r = sabchat_channel_facebook::router::<AppState>();
    let sabchat_channel_telegram_r = sabchat_channel_telegram::router::<AppState>();
    let sabchat_channel_email_r = sabchat_channel_email::router::<AppState>();
    let sabchat_channel_sms_r = sabchat_channel_sms::router::<AppState>();
    let sabchat_ai_copilot_r = sabchat_ai_copilot::router::<AppState>();
    let sabchat_ai_translate_r = sabchat_ai_translate::router::<AppState>();
    let sabchat_ai_sentiment_r = sabchat_ai_sentiment::router::<AppState>();
    let sabchat_ai_resolve_bot_r = sabchat_ai_resolve_bot::router::<AppState>();
    let sabchat_macros_r = sabchat_macros::router::<AppState>();
    let sabchat_sla_r = sabchat_sla::router::<AppState>();
    let sabchat_business_hours_r = sabchat_business_hours::router::<AppState>();
    let sabchat_crm_bridge_r = sabchat_crm_bridge::router::<AppState>();
    let sabchat_knowledge_r = sabchat_knowledge::router::<AppState>();
    let sabchat_knowledge_public_r = sabchat_knowledge::public_router::<AppState>();
    let sabchat_commerce_r = sabchat_commerce::router::<AppState>();
    let sabchat_commerce_webhook_r = sabchat_commerce::webhook_router::<AppState>();
    let sabchat_reports_r = sabchat_reports::router::<AppState>();
    let sabchat_teams_r = sabchat_teams::router::<AppState>();
    
    let sabchat_webhooks_r = sabchat_webhooks::router::<AppState>();
    let sabchat_public_api_r = sabchat_public_api::router::<AppState>();
    let sabchat_events_r = sabchat_events::router::<AppState>();
    let sabchat_voice_r = sabchat_voice::router::<AppState>();
    let sabchat_cobrowse_r = sabchat_cobrowse::router::<AppState>();
    let sabchat_cobrowse_public_r = sabchat_cobrowse::public_router::<AppState>();
    let sabchat_shifts_r = sabchat_shifts::router::<AppState>();
    let sabchat_csat_r = sabchat_csat::router::<AppState>();
    let sabchat_csat_public_r = sabchat_csat::public_router::<AppState>();
    let sabchat_dispositions_r = sabchat_dispositions::router::<AppState>();
    let sabchat_gamification_r = sabchat_gamification::router::<AppState>();
    let sabchat_compliance_r = sabchat_compliance::router::<AppState>();
    let sabchat_sso_r = sabchat_sso::router::<AppState>();
    let sabchat_sso_scim_r = sabchat_sso::scim_router::<AppState>();
    let sabchat_ai_qa_r = sabchat_ai_qa::router::<AppState>();
    let sabchat_ai_voc_r = sabchat_ai_voc::router::<AppState>();
    let sabchat_sabflow_nodes_r = sabchat_sabflow_nodes::router::<AppState>();
    let sabchat_cart_recovery_r = sabchat_cart_recovery::router::<AppState>();
    let sabchat_cart_recovery_public_r = sabchat_cart_recovery::public_router::<AppState>();
    let sabchat_ad_attribution_r = sabchat_ad_attribution::router::<AppState>();
    let sabchat_ad_attribution_public_r = sabchat_ad_attribution::public_router::<AppState>();
    let sabchat_channel_line_r = sabchat_channel_line::router::<AppState>();
    let sabchat_channel_viber_r = sabchat_channel_viber::router::<AppState>();
    let sabchat_channel_apple_r = sabchat_channel_apple::router::<AppState>();
    let sabchat_channel_gbm_r = sabchat_channel_gbm::router::<AppState>();
    let sabchat_channel_x_r = sabchat_channel_x::router::<AppState>();
    let sabchat_marketplace_r = sabchat_marketplace::router::<AppState>();

    Router::new()
        .merge(routes::health::router())
        .merge(wachat_webhook)
        .merge(wachat_webhook_cron)
        .nest("/v1/wachat/webhook", wachat_webhook_admin)
        .nest("/v1/wachat/webhook-actions", wachat_webhook_actions)
        .nest("/v1/wachat/webhook-status", wachat_webhook_status)
        .nest("/v1/wachat/templates", wachat_templates)
        .nest("/v1/wachat/templates-actions", wachat_templates_actions)
        .nest("/v1/wachat/config", wachat_config)
        .nest("/v1/wachat/pay", wachat_pay)
        .nest("/v1/wachat/calling", wachat_calling)
        .nest("/v1/wachat/broadcast", wachat_broadcast)
        .nest("/v1/wachat/features", wachat_features)
        .nest("/v1/wachat/analytics", wachat_analytics)
        .nest("/v1/wachat/public", wachat_public)
        .nest("/v1/wachat", wachat_send)
        .nest("/v1/meta/suite", meta_suite)
        .nest("/v1/meta/token", meta_token)
        .nest("/v1/meta/flows", meta_flows)
        .nest("/v1/qr-codes", qr_codes)
        .nest("/v1/url-shortener", url_shortener)
        .nest("/v1/ad-manager", ad_manager)
        .nest("/v1/facebook/flow", facebook_flow)
        .nest("/v1/projects", wachat_projects)
        .nest("/v1/contacts", wachat_contacts)
        .nest("/v1/crm/lookup", crm_lookup)
        .nest("/v1/crm/accounts", crm_accounts)
        .nest("/v1/crm/pipelines", crm_pipelines)
        .nest("/v1/crm/contacts", crm_contacts)
        .nest("/v1/crm/items", crm_items)
        .nest("/v1/crm/leads", crm_leads)
        .nest("/v1/crm/deals", crm_deals)
        .nest("/v1/crm/quotations", crm_quotations)
        .nest("/v1/crm/invoices", crm_invoices)
        .nest("/v1/crm/sales-orders", crm_sales_orders)
        .nest("/v1/crm/purchase-orders", crm_purchase_orders)
        .nest("/v1/crm/payment-receipts", crm_payment_receipts)
        .nest("/v1/crm/credit-notes", crm_credit_notes)
        .nest("/v1/crm/debit-notes", crm_debit_notes)
        .nest("/v1/crm/payouts", crm_payouts)
        .nest("/v1/crm/tickets", crm_tickets)
        .nest("/v1/crm/subscriptions", crm_subscriptions)
        .nest("/v1/crm/bills", crm_bills)
        .nest("/v1/crm/rfqs", crm_rfqs)
        .nest("/v1/crm/vendors", crm_vendors)
        .nest("/v1/crm/vendor-bids", crm_vendor_bids)
        .nest("/v1/crm/grns", crm_grns)
        .nest("/v1/crm/fixed-assets", crm_fixed_assets)
        .nest("/v1/crm/bookings", crm_bookings)
        .nest("/v1/crm/brands", crm_brands)
        .nest("/v1/crm/tags", crm_tags)
        .nest("/v1/crm/labels", crm_labels)
        .nest("/v1/crm/branches", crm_branches)
        .nest("/v1/crm/warehouses", crm_warehouses)
        .nest("/v1/crm/stock-adjustments", crm_stock_adjustments)
        .nest("/v1/crm/coupons", crm_coupons)
        .nest("/v1/crm/gift-cards", crm_gift_cards)
        .nest("/v1/crm/loyalty-programs", crm_loyalty_programs)
        .nest("/v1/crm/budgets", crm_budgets)
        .nest("/v1/crm/loans", crm_loans)
        .nest("/v1/crm/petty-cash", crm_petty_cash)
        .nest("/v1/crm/boms", crm_bom)
        .nest("/v1/crm/production-orders", crm_production_orders)
        .nest("/v1/crm/proforma-invoices", crm_proforma_invoices)
        .nest("/v1/crm/delivery-challans", crm_delivery_challans)
        .nest("/v1/crm/service-contracts", crm_service_contracts)
        .nest("/v1/crm/tasks", crm_tasks)
        .nest("/v1/crm/disciplinary", crm_disciplinary)
        .nest("/v1/crm/voucher-books", crm_vouchers)
        .nest("/v1/crm/contracts", crm_contracts)
        .nest("/v1/crm/award-programs", crm_awards)
        .nest("/v1/crm/kb-articles", crm_kb_articles)
        .nest("/v1/crm/payment-accounts", crm_payment_accounts)
        .nest("/v1/crm/slas", crm_slas)
        .nest("/v1/crm/exits", crm_exits)
        .nest("/v1/crm/purchase-leads", crm_purchase_leads)
        .nest("/v1/crm/automations", crm_automations_router)
        .nest("/v1/crm/forms", crm_forms_router)
        .nest("/v1/crm/saved-views", crm_saved_views_router)
        .nest("/v1/crm/email-templates", crm_email_templates_router)
        .nest("/v1/crm/portal-users", crm_portal_users_router)
        .nest("/v1/crm/appraisals", crm_appraisals_router)
        .nest("/v1/crm/succession-plans", crm_succession_router)
        .nest("/v1/crm/reconciliations", crm_reconciliation_router)
        .nest("/v1/crm/payroll-settings", crm_payroll_settings_router)
        .nest("/v1/crm/auto-lead-rules", crm_auto_leads_router)
        .nest("/v1/crm/project-tasks", crm_project_tasks_router)
        .nest("/v1/crm/payslips", crm_payslips_router)
        .nest("/v1/crm/salary-structures", crm_salary_structures_router)
        .nest("/v1/crm/products", crm_products_router)
        .nest("/v1/crm/goals", crm_goals_router)
        .nest("/v1/crm/pt-slabs", crm_pt_slabs_router)
        .nest("/v1/crm/chart-of-accounts", crm_chart_of_accounts_router)
        .nest("/v1/crm/account-groups", crm_account_groups_router)
        .nest("/v1/crm/dashboards", crm_dashboards_router)
        .nest("/v1/crm/voucher-entries", crm_voucher_entries_router)
        .nest("/v1/crm/form-submissions", crm_form_submissions_router)
        .nest("/v1/crm/kpis", crm_kpis_router)
        .nest("/v1/crm/industries", crm_industries_router)
        .nest("/v1/crm/product-categories", crm_product_categories_router)
        .nest("/v1/crm/settings", crm_settings_router)
        .nest("/v1/crm/taxes", crm_taxes_router)
        .nest("/v1/crm/units", crm_units_router)
        .nest("/v1/crm/vendor-types", crm_vendor_types_router)
        .nest("/v1/crm/purchases", crm_purchases_router)
        .nest("/v1/crm/leave-requests", crm_leave_requests_router)
        .nest("/v1/crm/subtasks", crm_subtasks_router)
        .nest("/v1/crm/milestones", crm_milestones_router)
        .nest("/v1/crm/issues", crm_issues_router)
        .nest("/v1/crm/time-logs", crm_time_logs_router)
        .nest("/v1/crm/ticket-tags", crm_ticket_tags_router)
        .nest("/v1/crm/ticket-channels", crm_ticket_channels_router)
        .nest("/v1/crm/reply-templates", crm_reply_templates_router)
        .nest("/v1/crm/candidates", crm_candidates_router)
        .nest("/v1/crm/jobs", crm_jobs_router)
        .nest("/v1/crm/interviews", crm_interviews_router)
        .nest("/v1/crm/offers", crm_offers_router)
        .nest("/v1/crm/onboarding", crm_onboarding_router)
        .nest("/v1/crm/assets", crm_assets_router)
        .nest("/v1/crm/documents", crm_documents_router)
        .nest("/v1/crm/training", crm_training_router)
        .nest("/v1/crm/ticket-groups", crm_ticket_groups_router)
        .nest("/v1/crm/ticket-types", crm_ticket_types_router)
        .nest("/v1/crm/agent-groups", crm_agent_groups_router)
        .nest("/v1/crm/shifts", crm_shifts_router)
        .nest("/v1/crm/okrs", crm_okrs_router)
        .nest("/v1/crm/policies", crm_policies_router)
        .nest("/v1/crm/announcements", crm_announcements_router)
        .nest("/v1/crm/events", crm_events_router)
        .nest("/v1/crm/notices", crm_notices_router)
        .nest("/v1/crm/currencies", crm_currencies_router)
        .nest("/v1/crm/expense-categories", crm_expense_categories_router)
        .nest("/v1/crm/custom-fields", crm_custom_fields_router)
        .nest("/v1/crm/company-profile", crm_company_profile_router)
        .nest("/v1/crm/shift-rotations", crm_shift_rotations_router)
        .nest("/v1/crm/one-on-ones", crm_one_on_ones_router)
        .nest("/v1/crm/project-categories", crm_project_categories_router)
        .nest("/v1/crm/task-labels", crm_task_labels_router)
        .nest("/v1/crm/taskboard-columns", crm_taskboard_columns_router)
        .nest("/v1/hrm/employees", crm_employees)
        .nest("/v1/hrm/attendance", crm_attendance)
        .nest("/v1/hrm/leaves", crm_leaves)
        .nest("/v1/hrm/payroll-runs", crm_payroll_runs)
        .nest("/v1/hrm/holidays", crm_holidays)
        // The crm-departments crate contributes BOTH `/departments/*` and
        // `/designations/*` subtrees (see crate docstring) — mount it at
        // `/v1/crm` so the resulting paths are `/v1/crm/departments` and
        // `/v1/crm/designations`. This matches the TS rust-client at
        // `src/lib/rust-client/crm-departments.ts`.
        .nest("/v1/crm", crm_departments)
        .nest("/v1/flows", wachat_flows)
        .nest("/v1/api-keys", wachat_api_keys_admin)
        .nest("/v1/facebook/pages", fb_pages)
        .nest("/v1/facebook/content", fb_content)
        .nest("/v1/facebook/messaging", fb_messaging)
        .nest("/v1/facebook/automation", fb_automation)
        .nest("/v1/facebook/crm", fb_crm)
        .nest("/v1/facebook/agents", fb_agents)
        .nest("/v1/facebook/business", fb_business)
        .nest("/v1/facebook/misc", fb_misc)
        .nest("/v1/facebook/comments", fb_comments)
        .nest("/v1/facebook/events", fb_events)
        .nest("/v1/facebook/lead-gen", fb_lead_gen)
        .nest("/v1/facebook/messenger-profile", fb_messenger_profile)
        .nest("/v1/instagram", instagram)
        .nest("/v1/sabfiles", sabfiles_router)
        .nest("/v1/telegram/bots", telegram_bots_router)
        .nest("/v1/telegram/chats", telegram_chats_router)
        .nest("/v1/telegram/broadcasts", telegram_broadcasts_router)
        .nest("/v1/telegram/auto-reply", telegram_auto_reply_router)
        .nest("/v1/telegram/commands", telegram_commands_router)
        .nest("/v1/telegram/bot-profile", telegram_bot_profile_router)
        .nest("/v1/telegram/channels", telegram_channels_router)
        .nest("/v1/telegram/analytics", telegram_analytics_router)
        .nest("/v1/telegram/payments", telegram_payments_router)
        .nest("/v1/telegram/stickers", telegram_stickers_router)
        .nest("/v1/telegram/stories", telegram_stories_router)
        .nest("/v1/telegram/flows", telegram_flows_router)
        .nest("/v1/telegram/mini-apps", telegram_mini_apps_router)
        .nest("/v1/telegram/ads", telegram_ads_router)
        .nest("/v1/telegram/api-credentials", telegram_api_credentials_router)
        .nest("/v1/telegram/business-inbox", telegram_business_inbox_router)
        .nest("/v1/telegram/contacts", telegram_contacts_router)
        .nest("/v1/telegram/settings", telegram_settings_router)
        .nest("/v1/telegram/webhooks", telegram_webhooks_router)
        .nest("/v1/sabflow", sabflow_engine::router::<AppState>())
        .nest("/v1/sabflow", sabflow_engine_runtime::router::<AppState>())
        .nest("/v1/email/audience", email_audience)
        .nest("/v1/email/templates", email_templates)
        .nest("/v1/email/inbox", email_inbox)
        .nest("/v1/email/inbound", email_inbound)
        .nest("/v1/email/deliverability", email_deliverability)
        .nest("/v1/email/api-keys", email_api)
        .nest("/v1/email/webhooks", email_webhooks)
        .nest("/v1/email/campaigns", email_campaigns)
        .nest("/v1/email/events", email_events)
        .nest("/v1/email/reports", email_reports)
        .nest("/v1/email/journeys", email_journeys)
        .nest("/v1/sabchat/inboxes", sabchat_inboxes)
        .nest("/v1/sabchat/contacts", sabchat_contacts_r)
        .nest("/v1/sabchat/conversations", sabchat_conversations_r)
        .nest("/v1/sabchat/messages", sabchat_messages_r)
        .nest("/v1/sabchat/audit", sabchat_audit_r)
        .nest("/v1/sabchat/routing", sabchat_routing_r)
        .nest("/v1/sabchat/widget", sabchat_widget_r)
        .nest("/v1/sabchat/ws", sabchat_ws_r)
        .nest("/v1/sabchat/channels/whatsapp", sabchat_channel_whatsapp_r)
        .nest("/v1/sabchat/channels/instagram", sabchat_channel_instagram_r)
        .nest("/v1/sabchat/channels/facebook", sabchat_channel_facebook_r)
        .nest("/v1/sabchat/channels/telegram", sabchat_channel_telegram_r)
        .nest("/v1/sabchat/channels/email", sabchat_channel_email_r)
        .nest("/v1/sabchat/channels/sms", sabchat_channel_sms_r)
        .nest("/v1/sabchat/ai/copilot", sabchat_ai_copilot_r)
        .nest("/v1/sabchat/ai/translate", sabchat_ai_translate_r)
        .nest("/v1/sabchat/ai/sentiment", sabchat_ai_sentiment_r)
        .nest("/v1/sabchat/ai/resolve-bot", sabchat_ai_resolve_bot_r)
        .nest("/v1/sabchat/macros", sabchat_macros_r)
        .nest("/v1/sabchat/sla", sabchat_sla_r)
        .nest("/v1/sabchat/business-hours", sabchat_business_hours_r)
        .nest("/v1/sabchat/crm-bridge", sabchat_crm_bridge_r)
        .nest("/v1/sabchat/kb", sabchat_knowledge_r)
        .nest("/v1/sabchat/kb-public", sabchat_knowledge_public_r)
        .nest("/v1/sabchat/commerce", sabchat_commerce_r)
        .nest("/v1/sabchat/commerce-webhook", sabchat_commerce_webhook_r)
        .nest("/v1/sabchat/reports", sabchat_reports_r)
        .nest("/v1/sabchat/teams", sabchat_teams_r)
        .nest("/v1/sabchat/webhooks", sabchat_webhooks_r)
        .nest("/v1/sabchat/public-api", sabchat_public_api_r)
        .nest("/v1/sabchat/events", sabchat_events_r)
        .nest("/v1/sabchat/voice", sabchat_voice_r)
        .nest("/v1/sabchat/cobrowse", sabchat_cobrowse_r)
        .nest("/v1/sabchat/cobrowse-public", sabchat_cobrowse_public_r)
        .nest("/v1/sabchat/shifts", sabchat_shifts_r)
        .nest("/v1/sabchat/csat", sabchat_csat_r)
        .nest("/v1/sabchat/csat-public", sabchat_csat_public_r)
        .nest("/v1/sabchat/dispositions", sabchat_dispositions_r)
        .nest("/v1/sabchat/gamification", sabchat_gamification_r)
        .nest("/v1/sabchat/compliance", sabchat_compliance_r)
        .nest("/v1/sabchat/sso", sabchat_sso_r)
        .nest("/v1/sabchat/scim/v2", sabchat_sso_scim_r)
        .nest("/v1/sabchat/ai-qa", sabchat_ai_qa_r)
        .nest("/v1/sabchat/ai-voc", sabchat_ai_voc_r)
        .nest("/v1/sabchat/sabflow-nodes", sabchat_sabflow_nodes_r)
        .nest("/v1/sabchat/cart-recovery", sabchat_cart_recovery_r)
        .nest("/v1/sabchat/cart-recovery-public", sabchat_cart_recovery_public_r)
        .nest("/v1/sabchat/ad-attribution", sabchat_ad_attribution_r)
        .nest("/v1/sabchat/ad-attribution-public", sabchat_ad_attribution_public_r)
        .nest("/v1/sabchat/channels/line", sabchat_channel_line_r)
        .nest("/v1/sabchat/channels/viber", sabchat_channel_viber_r)
        .nest("/v1/sabchat/channels/apple", sabchat_channel_apple_r)
        .nest("/v1/sabchat/channels/gbm", sabchat_channel_gbm_r)
        .nest("/v1/sabchat/channels/x", sabchat_channel_x_r)
        .nest("/v1/sabchat/marketplace", sabchat_marketplace_r)
        // sabflow_webhooks::router mounts at /v1/sabflow/webhook but its state
        // (SabflowWebhooksState) is not yet wired into AppState — public
        // webhook URL is served by Next.js at /api/sabflow/webhook/[webhookId].
                .nest("/v1/sabbi/charts", sabbi_charts_r)
        .nest("/v1/sabbi/dataset-joins", sabbi_dataset_joins_r)
        .nest("/v1/sabbi/datasets", sabbi_datasets_r)
        .nest("/v1/sabbi/schedules", sabbi_schedules_r)
        .nest("/v1/sabbi/workbooks", sabbi_workbooks_r)
        .nest("/v1/sabbigin/config", sabbigin_config_r)
        .nest("/v1/sabbugs/bugs", sabbugs_bugs_r)
        .nest("/v1/sabbugs/comments", sabbugs_comments_r)
        .nest("/v1/sabbugs/history", sabbugs_history_r)
        .nest("/v1/sabbugs/saved-filters", sabbugs_saved_filters_r)
        .nest("/v1/sabbugs/versions", sabbugs_versions_r)
        .nest("/v1/sabconnect/comments", sabconnect_comments_r)
        .nest("/v1/sabconnect/custom-apps", sabconnect_custom_apps_r)
        .nest("/v1/sabconnect/feed", sabconnect_feed_r)
        .nest("/v1/sabconnect/groups", sabconnect_groups_r)
        .nest("/v1/sabconnect/manuals", sabconnect_manuals_r)
        .nest("/v1/sabconnect/reactions", sabconnect_reactions_r)
        .nest("/v1/sabmeet/dialins", sabmeet_dialins_r)
        .nest("/v1/sabmeet/participants", sabmeet_participants_r)
        .nest("/v1/sabmeet/polls", sabmeet_polls_r)
        .nest("/v1/sabmeet/qna", sabmeet_qna_r)
        .nest("/v1/sabmeet/recordings", sabmeet_recordings_r)
        .nest("/v1/sabmeet/rooms", sabmeet_rooms_r)
        .nest("/v1/sabprep/recipes", sabprep_recipes_r)
        .nest("/v1/sabrequests/blueprints", sabrequests_blueprints_r)
        .nest("/v1/sabrequests/instances", sabrequests_instances_r)
        .nest("/v1/sabrewards/catalog", sabrewards_catalog_r)
        .nest("/v1/sabrewards/members", sabrewards_members_r)
        .nest("/v1/sabrewards/programs", sabrewards_programs_r)
        .nest("/v1/sabrewards/redemptions", sabrewards_redemptions_r)
        .nest("/v1/sabrewards/referrals", sabrewards_referrals_r)
        .nest("/v1/pagesense/form-analytics", sabsense_form_analytics_r)
        .nest("/v1/pagesense/funnel-runs", sabsense_funnel_runs_r)
        .nest("/v1/pagesense/funnels", sabsense_funnels_r)
        .nest("/v1/pagesense/heatmap-events", sabsense_heatmap_events_r)
        .nest("/v1/pagesense/heatmaps", sabsense_heatmaps_r)
        .nest("/v1/pagesense/recordings", sabsense_recordings_r)
        .nest("/v1/pagesense/sites", sabsense_sites_r)
        .nest("/v1/sabshop/carts", sabshop_carts_r)
        .nest("/v1/sabshop/checkouts", sabshop_checkouts_r)
        .nest("/v1/sabshop/collections", sabshop_collections_r)
        .nest("/v1/sabshop/orders", sabshop_orders_r)
        .nest("/v1/sabshop/shipping-zones", sabshop_shipping_zones_r)
        .nest("/v1/sabshop/storefronts", sabshop_storefronts_r)
        .nest("/v1/sabshop/tax-rules", sabshop_tax_rules_r)
        .nest("/v1/sabshop/themes", sabshop_themes_r)
        .nest("/v1/sabsign/audit", sabsign_audit_r)
        .nest("/v1/sabsign/envelopes", sabsign_envelopes_r)
        .nest("/v1/sabsign/fields", sabsign_fields_r)
        .nest("/v1/sabsign/templates", sabsign_templates_r)
        .nest("/v1/agile/burndown", sabsprints_burndown_r)
        .nest("/v1/sabsprints/epics", sabsprints_epics_r)
        .nest("/v1/sabsprints/sprints", sabsprints_sprints_r)
        .nest("/v1/sabsprints/stories", sabsprints_stories_r)
        .nest("/v1/agile/velocity", sabsprints_velocity_r)
        .nest("/v1/sabvoice/agents-presence", sabvoice_agents_presence_r)
        .nest("/v1/sabvoice/calls", sabvoice_calls_r)
        .nest("/v1/sabvoice/dids", sabvoice_dids_r)
        .nest("/v1/sabvoice/ivrs", sabvoice_ivrs_r)
        .nest("/v1/sabvoice/queues", sabvoice_queues_r)
        .nest("/v1/sabvoice/voicemail", sabvoice_voicemail_r)
                .nest("/v1/sabbi/embeds", sabbi_embeds_r)
        .nest("/v1/sabprep/profiles", sabprep_profiles_r)
        .nest("/v1/sabprep/runs", sabprep_runs_r)
        .nest("/v1/sabrequests/orgcharts", sabrequests_orgcharts_r)
        .nest("/v1/sabrequests/stage-actions", sabrequests_stage_actions_r)
        .nest("/v1/admin", admin_router)
        .nest("/v1", v1)
        .with_state(state)
        .layer(SetRequestIdLayer::new(
            request_id_header.clone(),
            MakeRequestUuid,
        ))
        .layer(PropagateRequestIdLayer::new(request_id_header))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(30),
        ))
        .layer(cors)
}
