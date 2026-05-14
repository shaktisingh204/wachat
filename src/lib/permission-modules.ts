export const globalModules = [
    // WaChat Core
    'wachat_overview', 'wachat_chat', 'wachat_contacts', 'wachat_campaigns',
    'wachat_broadcast_cron',
    'wachat_templates', 'wachat_catalog', 'wachat_calls', 'wachat_flow_builder',
    'wachat_flows', 'wachat_integrations', 'wachat_whatsapp_pay', 'wachat_numbers',
    'wachat_webhooks', 'wachat_settings',

    // CRM - Sales
    'crm_dashboard', 'crm_clients', 'crm_quotations', 'crm_proforma',
    'crm_invoices', 'crm_receipts', 'crm_orders', 'crm_delivery', 'crm_credit_notes',
    // CRM - Sales (per-entity, singular keys used by requirePermission)
    'crm_account', 'crm_credit_note', 'crm_invoice', 'crm_quotation',
    'crm_receipt', 'crm_sales_order', 'crm_subscription',

    // CRM - Purchases
    'crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes',
    // CRM - Purchases (per-entity, singular)
    'crm_bill', 'crm_debit_note', 'crm_payout', 'crm_purchase_order',
    'crm_rfq', 'crm_vendor', 'crm_vendor_bid',

    // CRM - Inventory
    'crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value',
    'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions',
    // CRM - Inventory (per-entity, singular)
    'crm_grn', 'crm_item',

    // CRM - Accounting
    'crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet',
    'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow',

    // CRM - Sales CRM (Leads/Deals)
    'crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines',
    'crm_forms', 'crm_analytics', 'crm_reports',
    // CRM - Sales CRM (per-entity, singular)
    'crm_contact', 'crm_deal', 'crm_lead', 'crm_pipeline', 'crm_task',

    // CRM - Banking
    'crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation',

    // CRM - HR
    'crm_employees', 'crm_attendance', 'crm_payroll',
    // CRM - HR (per-entity, singular)
    'crm_asset', 'crm_department', 'crm_designation', 'crm_employee',
    'crm_holiday', 'crm_leave',

    // CRM - Cross-cutting (per-entity, singular)
    'crm_booking', 'crm_fixed_asset',

    // CRM - Support
    'crm_ticket',

    // CRM - Tax Reports
    'crm_gstr1', 'crm_gstr2b',

    // CRM - Settings
    'crm_settings',

    // Team
    'team_users', 'team_roles', 'team_tasks', 'team_chat',

    // Meta - Facebook
    'facebook_dashboard', 'facebook_posts', 'facebook_scheduled', 'facebook_live',
    'facebook_randomizer', 'facebook_messages', 'facebook_kanban', 'facebook_automation',
    'facebook_shops', 'facebook_products', 'facebook_shop_setup', 'facebook_orders',

    // Meta - Instagram
    'instagram_dashboard', 'instagram_feed', 'instagram_stories', 'instagram_reels',
    'instagram_messages', 'instagram_discovery', 'instagram_hashtags',

    // Meta - Ad Manager
    'ad_manager_accounts', 'ad_manager_campaigns', 'ad_manager_audiences',

    // Email
    'email_dashboard', 'email_inbox', 'email_campaigns', 'email_contacts',
    'email_templates', 'email_analytics', 'email_verification', 'email_settings',

    // SMS
    'sms_overview', 'sms_campaigns', 'sms_templates', 'sms_config', 'sms_developer',

    // SabChat
    'sabchat_inbox', 'sabchat_visitors', 'sabchat_analytics', 'sabchat_widget',
    'sabchat_auto_reply', 'sabchat_quick_replies', 'sabchat_ai_replies', 'sabchat_faq',
    'sabchat_settings',

    // SabWa (personal WhatsApp via Baileys; see SABWA_PLAN.md §10)
    'sabwa_overview', 'sabwa_connect', 'sabwa_inbox', 'sabwa_chats', 'sabwa_groups',
    'sabwa_group_manage', 'sabwa_broadcasts', 'sabwa_bulk_send', 'sabwa_scheduler',
    'sabwa_contacts', 'sabwa_templates', 'sabwa_auto_reply', 'sabwa_flows', 'sabwa_ai',
    'sabwa_media', 'sabwa_status', 'sabwa_calls', 'sabwa_labels', 'sabwa_starred',
    'sabwa_analytics', 'sabwa_export', 'sabwa_webhooks', 'sabwa_api_keys',
    'sabwa_audit', 'sabwa_settings',

    // Utilities
    'website_builder', 'url_shortener', 'qr_code_maker',

    // SEO
    'seo_dashboard', 'seo_brand_radar', 'seo_site_explorer',

    // Dev
    'api_keys', 'api_docs'
];

export const permissionActions = ['view', 'create', 'edit', 'delete'];

export const moduleCategories = {
    'WaChat Core': ['wachat_overview', 'wachat_chat', 'wachat_contacts', 'wachat_campaigns', 'wachat_broadcast_cron', 'wachat_templates', 'wachat_catalog', 'wachat_calls', 'wachat_flow_builder', 'wachat_flows', 'wachat_integrations', 'wachat_whatsapp_pay', 'wachat_numbers', 'wachat_webhooks', 'wachat_settings'],
    'CRM Sales': ['crm_dashboard', 'crm_clients', 'crm_quotations', 'crm_proforma', 'crm_invoices', 'crm_receipts', 'crm_orders', 'crm_delivery', 'crm_credit_notes', 'crm_account', 'crm_credit_note', 'crm_invoice', 'crm_quotation', 'crm_receipt', 'crm_sales_order', 'crm_subscription'],
    'CRM Purchases': ['crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes', 'crm_bill', 'crm_debit_note', 'crm_payout', 'crm_purchase_order', 'crm_rfq', 'crm_vendor', 'crm_vendor_bid'],
    'CRM Inventory': ['crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value', 'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions', 'crm_grn', 'crm_item'],
    'CRM Accounting': ['crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet', 'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow'],
    'Sales CRM': ['crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines', 'crm_forms', 'crm_analytics', 'crm_reports', 'crm_contact', 'crm_deal', 'crm_lead', 'crm_pipeline', 'crm_task'],
    'CRM Banking': ['crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation'],
    'CRM HR': ['crm_employees', 'crm_attendance', 'crm_payroll', 'crm_asset', 'crm_department', 'crm_designation', 'crm_employee', 'crm_holiday', 'crm_leave'],
    'CRM Cross-cutting': ['crm_booking', 'crm_fixed_asset'],
    'CRM Support': ['crm_ticket'],
    'CRM Tax': ['crm_gstr1', 'crm_gstr2b'],
    'CRM Settings': ['crm_settings'],
    'Team': ['team_users', 'team_roles', 'team_tasks', 'team_chat'],
    'Facebook': ['facebook_dashboard', 'facebook_posts', 'facebook_scheduled', 'facebook_live', 'facebook_randomizer', 'facebook_messages', 'facebook_kanban', 'facebook_automation', 'facebook_shops', 'facebook_products', 'facebook_shop_setup', 'facebook_orders'],
    'Instagram': ['instagram_dashboard', 'instagram_feed', 'instagram_stories', 'instagram_reels', 'instagram_messages', 'instagram_discovery', 'instagram_hashtags'],
    'Ad Manager': ['ad_manager_accounts', 'ad_manager_campaigns', 'ad_manager_audiences'],
    'Email': ['email_dashboard', 'email_inbox', 'email_campaigns', 'email_contacts', 'email_templates', 'email_analytics', 'email_verification', 'email_settings'],
    'SMS': ['sms_overview', 'sms_campaigns', 'sms_templates', 'sms_config', 'sms_developer'],
    'SabChat': ['sabchat_inbox', 'sabchat_visitors', 'sabchat_analytics', 'sabchat_widget', 'sabchat_auto_reply', 'sabchat_quick_replies', 'sabchat_ai_replies', 'sabchat_faq', 'sabchat_settings'],
    'SabWa': ['sabwa_overview', 'sabwa_connect', 'sabwa_inbox', 'sabwa_chats', 'sabwa_groups', 'sabwa_group_manage', 'sabwa_broadcasts', 'sabwa_bulk_send', 'sabwa_scheduler', 'sabwa_contacts', 'sabwa_templates', 'sabwa_auto_reply', 'sabwa_flows', 'sabwa_ai', 'sabwa_media', 'sabwa_status', 'sabwa_calls', 'sabwa_labels', 'sabwa_starred', 'sabwa_analytics', 'sabwa_export', 'sabwa_webhooks', 'sabwa_api_keys', 'sabwa_audit', 'sabwa_settings'],
    'Utilities': ['website_builder', 'url_shortener', 'qr_code_maker'],
    'SEO': ['seo_dashboard', 'seo_brand_radar', 'seo_site_explorer'],
    'Dev': ['api_keys', 'api_docs']
};
