export const globalModules = [
    // WaChat Core
    'wachat_overview', 'wachat_chat', 'wachat_contacts', 'wachat_campaigns',
    'wachat_templates', 'wachat_catalog', 'wachat_calls', 'wachat_flow_builder',
    'wachat_flows', 'wachat_integrations', 'wachat_whatsapp_pay', 'wachat_numbers',
    'wachat_webhooks', 'wachat_settings',

    // CRM - Sales
    'crm_dashboard', 'crm_clients', 'crm_quotations', 'crm_proforma',
    'crm_invoices', 'crm_receipts', 'crm_orders', 'crm_delivery', 'crm_credit_notes',

    // CRM - Purchases
    'crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes',

    // CRM - Inventory
    'crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value',
    'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions',

    // CRM - Accounting
    'crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet',
    'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow',

    // CRM - Sales CRM (Leads/Deals)
    'crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines',
    'crm_forms', 'crm_analytics', 'crm_reports',

    // CRM - Banking
    'crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation',

    // CRM - HR
    'crm_employees', 'crm_attendance', 'crm_payroll',

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

    // Utilities
    'website_builder', 'url_shortener', 'qr_code_maker',

    // SEO
    'seo_dashboard', 'seo_brand_radar', 'seo_site_explorer',

    // Dev
    'api_keys', 'api_docs'
];

export const permissionActions = ['view', 'create', 'edit', 'delete'];

export const moduleCategories = {
    'WaChat Core': ['wachat_overview', 'wachat_chat', 'wachat_contacts', 'wachat_campaigns', 'wachat_templates', 'wachat_catalog', 'wachat_calls', 'wachat_flow_builder', 'wachat_flows', 'wachat_integrations', 'wachat_whatsapp_pay', 'wachat_numbers', 'wachat_webhooks', 'wachat_settings'],
    'CRM Sales': ['crm_dashboard', 'crm_clients', 'crm_quotations', 'crm_proforma', 'crm_invoices', 'crm_receipts', 'crm_orders', 'crm_delivery', 'crm_credit_notes'],
    'CRM Purchases': ['crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes'],
    'CRM Inventory': ['crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value', 'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions'],
    'CRM Accounting': ['crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet', 'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow'],
    'Sales CRM': ['crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines', 'crm_forms', 'crm_analytics', 'crm_reports'],
    'CRM Banking': ['crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation'],
    'CRM HR': ['crm_employees', 'crm_attendance', 'crm_payroll'],
    'CRM Tax': ['crm_gstr1', 'crm_gstr2b'],
    'CRM Settings': ['crm_settings'],
    'Team': ['team_users', 'team_roles', 'team_tasks', 'team_chat'],
    'Facebook': ['facebook_dashboard', 'facebook_posts', 'facebook_scheduled', 'facebook_live', 'facebook_randomizer', 'facebook_messages', 'facebook_kanban', 'facebook_automation', 'facebook_shops', 'facebook_products', 'facebook_shop_setup', 'facebook_orders'],
    'Instagram': ['instagram_dashboard', 'instagram_feed', 'instagram_stories', 'instagram_reels', 'instagram_messages', 'instagram_discovery', 'instagram_hashtags'],
    'Ad Manager': ['ad_manager_accounts', 'ad_manager_campaigns', 'ad_manager_audiences'],
    'Email': ['email_dashboard', 'email_inbox', 'email_campaigns', 'email_contacts', 'email_templates', 'email_analytics', 'email_verification', 'email_settings'],
    'SMS': ['sms_overview', 'sms_campaigns', 'sms_templates', 'sms_config', 'sms_developer'],
    'SabChat': ['sabchat_inbox', 'sabchat_visitors', 'sabchat_analytics', 'sabchat_widget', 'sabchat_auto_reply', 'sabchat_quick_replies', 'sabchat_ai_replies', 'sabchat_faq', 'sabchat_settings'],
    'Utilities': ['website_builder', 'url_shortener', 'qr_code_maker'],
    'SEO': ['seo_dashboard', 'seo_brand_radar', 'seo_site_explorer'],
    'Dev': ['api_keys', 'api_docs']
};
