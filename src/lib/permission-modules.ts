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
    'crm_account', 'crm_contract', 'crm_contract_template', 'crm_contract_type',
    'crm_coupon', 'crm_credit_note', 'crm_promotion',
    'crm_delivery_challan', 'crm_gift_card', 'crm_invoice', 'crm_loyalty_program',
    'crm_proforma_invoice', 'crm_proposal', 'crm_quotation',
    'crm_receipt', 'crm_recurring_invoice', 'crm_sales_order', 'crm_subscription',
    'crm_estimate_request', 'crm_estimate_template',
    'crm_service', 'crm_reply_template',

    // CRM - Purchases
    'crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes',
    // CRM - Purchases (per-entity, singular)
    'crm_bill', 'crm_debit_note', 'crm_payout', 'crm_purchase_order',
    'crm_rfq', 'crm_vendor', 'crm_vendor_bid',
    'crm_vendor_type', 'crm_expense',

    // CRM - Inventory
    'crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value',
    'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions',
    // CRM - Inventory (per-entity, singular)
    'crm_grn', 'crm_item', 'crm_warehouse', 'crm_stock_adjustment',
    'crm_bom', 'crm_production_order', 'crm_brand', 'crm_tag',
    'crm_label', 'crm_branch',
    'crm_stock_transfer', 'crm_inventory_settings', 'crm_product',

    // CRM - Accounting
    'crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet',
    'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow',
    // CRM - Accounting (per-entity, singular)
    'crm_account_group', 'crm_chart_of_account', 'crm_voucher', 'crm_service_contract',

    // CRM - Sales CRM (Leads/Deals)
    'crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines',
    'crm_forms', 'crm_analytics', 'crm_reports',
    // CRM - Sales CRM (per-entity, singular)
    'crm_contact', 'crm_deal', 'crm_lead', 'crm_pipeline', 'crm_task',
    'crm_milestone', 'crm_subtask', 'crm_task_category', 'crm_task_tag',
    'crm_taskboard_column', 'crm_announcement',
    // CRM - Cross-cutting (search/activity/audit/notifications surfaces)
    'crm_audit_log', 'crm_notification', 'crm_activity',
    // CRM - Compliance
    'crm_gdpr',

    // CRM - Banking
    'crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation',
    'crm_bank_transaction',

    // CRM - HR
    'crm_employees', 'crm_attendance', 'crm_payroll',
    // CRM - HR (per-entity, singular)
    'crm_asset', 'crm_department', 'crm_designation', 'crm_employee',
    'crm_holiday', 'crm_leave',
    'hrm_disciplinary', 'hrm_exit', 'hrm_award',
    // CRM - HR Payroll: shifts & settings (per-entity, singular)
    'crm_shift', 'crm_shift_rotation', 'crm_shift_change_request',
    'crm_payroll_setting',
    // CRM - HR (recruiting, employee lifecycle, payroll tax, learning)
    'crm_candidate', 'crm_careers_page', 'crm_certification', 'crm_compensation_bands',
    'crm_document', 'crm_document_template', 'crm_emergency_contact',
    'crm_employee_skill', 'crm_skill', 'crm_exit', 'crm_feedback_360', 'crm_form_16',
    'crm_goal', 'crm_interview', 'crm_job', 'crm_kpi', 'crm_learning_path',
    'crm_notice', 'crm_offer', 'crm_okr', 'crm_onboarding', 'crm_one_on_one',
    'crm_pf_esi', 'crm_policy', 'crm_probation', 'crm_professional_tax',
    'crm_recognition', 'crm_training', 'crm_visa_detail', 'crm_tds',
    'crm_event', 'crm_survey',
    // CRM - Finance (per-entity, singular)
    'crm_budget', 'crm_loan', 'crm_petty_cash', 'crm_payment_account',
    'crm_time_log', 'crm_reconciliation',

    // CRM - Cross-cutting (per-entity, singular)
    'crm_booking', 'crm_fixed_asset', 'crm_saved_view',

    // CRM - Support
    'crm_ticket', 'crm_agent_group', 'crm_ticket_group',

    // CRM - Tax Reports
    'crm_gstr1', 'crm_gstr2b',
    // CRM - Tax: India MSMED Act §6.10 (45-day MSME payment alerts) + unified GST
    'crm_msme', 'crm_gst',

    // CRM - Settings
    'crm_settings', 'crm_currency',

    // CRM - Misc + Settings (per-entity, singular)
    'crm_portal_user', 'crm_integration', 'crm_email_template',
    'crm_custom_field',

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

    // SabFlow (automation workflow engine — see src/lib/sabflow/rbac-keys.ts).
    // Dot-notation matches the keys already reserved by earlier SabFlow phases
    // (credentials/rbac.ts, persistence/guards.ts, triggers/replay/route.ts).
    'sabflow.doc.read', 'sabflow.doc.write', 'sabflow.doc.delete',
    'sabflow.doc.share', 'sabflow.doc.admin',
    'sabflow.credential.read', 'sabflow.credential.use', 'sabflow.credential.write',
    'sabflow.credential.delete', 'sabflow.credential.share', 'sabflow.credential.admin',
    'sabflow.workflow.read', 'sabflow.workflow.write', 'sabflow.workflow.execute',
    'sabflow.trigger.admin',

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
    'CRM Sales': ['crm_dashboard', 'crm_clients', 'crm_quotations', 'crm_proforma', 'crm_invoices', 'crm_receipts', 'crm_orders', 'crm_delivery', 'crm_credit_notes', 'crm_account', 'crm_contract', 'crm_contract_template', 'crm_contract_type', 'crm_coupon', 'crm_credit_note', 'crm_promotion', 'crm_delivery_challan', 'crm_gift_card', 'crm_invoice', 'crm_loyalty_program', 'crm_proforma_invoice', 'crm_proposal', 'crm_quotation', 'crm_receipt', 'crm_recurring_invoice', 'crm_sales_order', 'crm_subscription', 'crm_estimate_request', 'crm_estimate_template', 'crm_service', 'crm_reply_template'],
    'CRM Purchases': ['crm_vendors', 'crm_expenses', 'crm_purchase_orders', 'crm_payouts', 'crm_debit_notes', 'crm_bill', 'crm_debit_note', 'crm_payout', 'crm_purchase_order', 'crm_rfq', 'crm_vendor', 'crm_vendor_bid', 'crm_vendor_type', 'crm_expense'],
    'CRM Inventory': ['crm_items', 'crm_warehouses', 'crm_inventory_pnl', 'crm_stock_value', 'crm_batch_expiry', 'crm_party_transactions', 'crm_all_transactions', 'crm_grn', 'crm_item', 'crm_warehouse', 'crm_stock_adjustment', 'crm_bom', 'crm_production_order', 'crm_brand', 'crm_tag', 'crm_label', 'crm_branch', 'crm_stock_transfer', 'crm_inventory_settings', 'crm_product'],
    'CRM Accounting': ['crm_account_groups', 'crm_chart_of_accounts', 'crm_vouchers', 'crm_balance_sheet', 'crm_trial_balance', 'crm_pnl', 'crm_income_statement', 'crm_day_book', 'crm_cash_flow', 'crm_account_group', 'crm_chart_of_account', 'crm_voucher', 'crm_service_contract'],
    'Sales CRM': ['crm_leads', 'crm_deals', 'crm_tasks', 'crm_automations', 'crm_pipelines', 'crm_forms', 'crm_analytics', 'crm_reports', 'crm_contact', 'crm_deal', 'crm_lead', 'crm_pipeline', 'crm_task', 'crm_milestone', 'crm_subtask', 'crm_task_category', 'crm_task_tag', 'crm_taskboard_column', 'crm_announcement', 'crm_audit_log', 'crm_notification', 'crm_activity', 'crm_gdpr'],
    'CRM Banking': ['crm_banking_accounts', 'crm_banking_employee', 'crm_banking_reconciliation', 'crm_reconciliation', 'crm_bank_transaction'],
    'CRM HR': ['crm_employees', 'crm_attendance', 'crm_payroll', 'crm_asset', 'crm_department', 'crm_designation', 'crm_employee', 'crm_holiday', 'crm_leave', 'hrm_disciplinary', 'hrm_exit', 'hrm_award', 'crm_shift', 'crm_shift_rotation', 'crm_shift_change_request', 'crm_payroll_setting', 'crm_candidate', 'crm_careers_page', 'crm_certification', 'crm_compensation_bands', 'crm_document', 'crm_document_template', 'crm_emergency_contact', 'crm_employee_skill', 'crm_skill', 'crm_exit', 'crm_feedback_360', 'crm_form_16', 'crm_goal', 'crm_interview', 'crm_job', 'crm_kpi', 'crm_learning_path', 'crm_notice', 'crm_offer', 'crm_okr', 'crm_onboarding', 'crm_one_on_one', 'crm_pf_esi', 'crm_policy', 'crm_probation', 'crm_professional_tax', 'crm_recognition', 'crm_training', 'crm_visa_detail', 'crm_tds', 'crm_event', 'crm_survey'],
    'CRM Finance': ['crm_budget', 'crm_loan', 'crm_petty_cash', 'crm_payment_account', 'crm_time_log'],
    'CRM Cross-cutting': ['crm_booking', 'crm_fixed_asset', 'crm_saved_view'],
    'CRM Support': ['crm_ticket', 'crm_agent_group', 'crm_ticket_group'],
    'CRM Tax': ['crm_gstr1', 'crm_gstr2b', 'crm_msme', 'crm_gst'],
    'CRM Settings': ['crm_settings', 'crm_currency', 'crm_portal_user', 'crm_integration', 'crm_email_template', 'crm_custom_field'],
    'Team': ['team_users', 'team_roles', 'team_tasks', 'team_chat'],
    'Facebook': ['facebook_dashboard', 'facebook_posts', 'facebook_scheduled', 'facebook_live', 'facebook_randomizer', 'facebook_messages', 'facebook_kanban', 'facebook_automation', 'facebook_shops', 'facebook_products', 'facebook_shop_setup', 'facebook_orders'],
    'Instagram': ['instagram_dashboard', 'instagram_feed', 'instagram_stories', 'instagram_reels', 'instagram_messages', 'instagram_discovery', 'instagram_hashtags'],
    'Ad Manager': ['ad_manager_accounts', 'ad_manager_campaigns', 'ad_manager_audiences'],
    'Email': ['email_dashboard', 'email_inbox', 'email_campaigns', 'email_contacts', 'email_templates', 'email_analytics', 'email_verification', 'email_settings'],
    'SMS': ['sms_overview', 'sms_campaigns', 'sms_templates', 'sms_config', 'sms_developer'],
    'SabChat': ['sabchat_inbox', 'sabchat_visitors', 'sabchat_analytics', 'sabchat_widget', 'sabchat_auto_reply', 'sabchat_quick_replies', 'sabchat_ai_replies', 'sabchat_faq', 'sabchat_settings'],
    'SabWa': ['sabwa_overview', 'sabwa_connect', 'sabwa_inbox', 'sabwa_chats', 'sabwa_groups', 'sabwa_group_manage', 'sabwa_broadcasts', 'sabwa_bulk_send', 'sabwa_scheduler', 'sabwa_contacts', 'sabwa_templates', 'sabwa_auto_reply', 'sabwa_flows', 'sabwa_ai', 'sabwa_media', 'sabwa_status', 'sabwa_calls', 'sabwa_labels', 'sabwa_starred', 'sabwa_analytics', 'sabwa_export', 'sabwa_webhooks', 'sabwa_api_keys', 'sabwa_audit', 'sabwa_settings'],
    'SabFlow': ['sabflow.doc.read', 'sabflow.doc.write', 'sabflow.doc.delete', 'sabflow.doc.share', 'sabflow.doc.admin', 'sabflow.credential.read', 'sabflow.credential.use', 'sabflow.credential.write', 'sabflow.credential.delete', 'sabflow.credential.share', 'sabflow.credential.admin', 'sabflow.workflow.read', 'sabflow.workflow.write', 'sabflow.workflow.execute', 'sabflow.trigger.admin'],
    'Utilities': ['website_builder', 'url_shortener', 'qr_code_maker'],
    'SEO': ['seo_dashboard', 'seo_brand_radar', 'seo_site_explorer'],
    'Dev': ['api_keys', 'api_docs']
};
