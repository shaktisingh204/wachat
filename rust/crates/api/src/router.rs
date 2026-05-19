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
        // sabflow_webhooks::router mounts at /v1/sabflow/webhook but its state
        // (SabflowWebhooksState) is not yet wired into AppState — public
        // webhook URL is served by Next.js at /api/sabflow/webhook/[webhookId].
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
