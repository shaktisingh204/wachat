import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase,
    Phone, Webhook, CreditCard, ShoppingBag,
    Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake,
    Mail, Bolt, FolderKanban, Repeat, Inbox, Package, Compass, Search,
    Video, ShieldCheck, Key, BookCopy, Rss, TrendingUp, Calendar,
    Newspaper, Clapperboard, BarChart2, Landmark, Users as UsersIcon,
    LifeBuoy, HelpCircle, Bot, Wrench, Megaphone, Globe, LucideIcon, Database, Layers, FileText,
    Cable, Activity, UserCheck, Building2, DollarSign, ClipboardList, UserCog,
} from 'lucide-react';
import { MetaIcon, WhatsAppIcon, SeoIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import React from 'react';

export interface MenuItem {
    href: string;
    label: string;
    icon?: LucideIcon | React.FC<any>;
    roles?: string[];
    beta?: boolean;
    exact?: boolean;
    new?: boolean;
    subItems?: MenuItem[];
    subSubItems?: MenuItem[];
    permissionKey?: string; // Key from GlobalRolePermissions
}

export interface MenuGroup {
    title: string;
    items: MenuItem[];
}

export const appIcons = [
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat', href: '/wachat' },
    { id: 'sabchat', icon: SabChatIcon, label: 'sabChat', href: '/dashboard/sabchat' },
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
    { id: 'ad-manager', href: '/dashboard/ad-manager/ad-accounts', icon: Megaphone, label: 'Ad Manager' },
    { id: 'telegram', href: '/dashboard/telegram', icon: Send, label: 'Telegram' },
    { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
    { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM' },
    { id: 'hrm', href: '/dashboard/hrm', icon: UsersIcon, label: 'HRM' },
    { id: 'sabflow', icon: GitFork, label: 'SabFlow', href: '/dashboard/sabflow/flow-builder' },
    { id: 'team', icon: Users, label: 'Team', href: '/dashboard/team/manage-users' },
    { id: 'email', icon: Mail, label: 'Email', href: '/dashboard/email' },
    { id: 'sms', icon: MessageSquare, label: 'SMS', href: '/dashboard/sms' },
    { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
    { id: 'website-builder', icon: Brush, label: 'Website', href: '/dashboard/website-builder' },
    { id: 'url-shortener', icon: LinkIcon, label: 'Links', href: '/dashboard/url-shortener' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Codes', href: '/dashboard/qr-code-maker' },
    { id: 'seo-suite', icon: SeoIcon, label: 'SEO', href: '/dashboard/seo' },
];

export const wachatMenuItems: MenuItem[] = [
    // Primary
    { href: '/wachat', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'], exact: true, permissionKey: 'wachat_overview' },
    { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'], permissionKey: 'wachat_overview' },
    { href: '/wachat/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'], permissionKey: 'wachat_chat' },
    { href: '/wachat/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'], permissionKey: 'wachat_contacts' },
    { href: '/wachat/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'], permissionKey: 'wachat_campaigns' },
    { href: '/wachat/templates', label: 'Templates', icon: BookCopy, roles: ['owner', 'admin'], permissionKey: 'wachat_templates' },
    // Automate
    { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'], permissionKey: 'wachat_flow_builder' },
    { href: '/dashboard/flows', label: 'Meta Flows', beta: true, icon: Settings, roles: ['owner', 'admin'], permissionKey: 'wachat_flows' },
    { href: '/wachat/auto-reply', label: 'Auto Reply', icon: MessageSquare, roles: ['owner', 'admin'], permissionKey: 'wachat_auto_reply' },
    { href: '/wachat/automation', label: 'Conversational AI', icon: Bot, roles: ['owner', 'admin'], permissionKey: 'wachat_automation' },
    // Grow
    { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'], permissionKey: 'wachat_catalog' },
    { href: '/wachat/whatsapp-pay', label: 'WhatsApp Pay', icon: CreditCard, roles: ['owner', 'admin'], permissionKey: 'wachat_whatsapp_pay' },
    { href: '/wachat/qr-codes', label: 'QR Codes', icon: QrCode, roles: ['owner', 'admin'], permissionKey: 'wachat_qr_codes' },
    { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart, roles: ['owner', 'admin'], permissionKey: 'wachat_analytics' },
    // Configure
    { href: '/wachat/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'], permissionKey: 'wachat_numbers' },
    { href: '/wachat/calls', label: 'Calls', icon: Phone, roles: ['owner', 'admin'], permissionKey: 'wachat_calls' },
    { href: '/dashboard/health', label: 'Account Health', icon: Activity, roles: ['owner', 'admin'], permissionKey: 'wachat_health' },
    { href: '/dashboard/integrations', label: 'Integrations', icon: Bolt, roles: ['owner', 'admin'], permissionKey: 'wachat_integrations' },
    { href: '/wachat/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'], permissionKey: 'wachat_webhooks' },
    { href: '/dashboard/settings/general', label: 'General Settings', icon: Settings, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/dashboard/settings/agents', label: 'Agents & Roles', icon: Users, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/dashboard/settings/attributes', label: 'User Attributes', icon: Key, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/dashboard/settings/canned', label: 'Canned Messages', icon: BookCopy, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
];

export const crmMenuGroups: MenuGroup[] = [
    {
        title: "Overview",
        items: [
            { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true, permissionKey: 'crm_dashboard' },
        ]
    },
    {
        title: "Sales",
        items: [
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects", icon: Handshake, permissionKey: 'crm_clients' },
            { href: "/dashboard/crm/sales/quotations", label: "Quotation & Estimates", icon: Handshake, permissionKey: 'crm_quotations' },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: Handshake, permissionKey: 'crm_proforma' },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: Handshake, permissionKey: 'crm_invoices' },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: Handshake, permissionKey: 'crm_receipts' },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: Handshake, permissionKey: 'crm_orders' },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Handshake, permissionKey: 'crm_delivery' },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Handshake, permissionKey: 'crm_credit_notes' },
        ]
    },
    {
        title: "Purchases",
        items: [
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers", icon: ShoppingBag, permissionKey: 'crm_vendors' },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses", icon: ShoppingBag, permissionKey: 'crm_expenses' },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders", icon: ShoppingBag, permissionKey: 'crm_purchase_orders' },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts", icon: ShoppingBag, permissionKey: 'crm_payouts' },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes", icon: ShoppingBag, permissionKey: 'crm_debit_notes' },
        ]
    },
    {
        title: "Inventory",
        items: [
            { href: "/dashboard/crm/inventory/items", label: "All Items", icon: Briefcase, permissionKey: 'crm_items' },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Briefcase, permissionKey: 'crm_warehouses' },
            { href: "/dashboard/crm/inventory/pnl", label: "Product-wise P&L", icon: Briefcase, permissionKey: 'crm_inventory_pnl' },
            { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report", icon: Briefcase, permissionKey: 'crm_stock_value' },
            { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report", icon: Briefcase, permissionKey: 'crm_batch_expiry' },
            { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions Report", icon: Briefcase, permissionKey: 'crm_party_transactions' },
            { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions Report", icon: Briefcase, permissionKey: 'crm_all_transactions' },
        ]
    },
    {
        title: "Accounting",
        items: [
            { href: "/dashboard/crm/accounting/groups", label: "Account Groups", icon: Database, permissionKey: 'crm_account_groups' },
            { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts", icon: Database, permissionKey: 'crm_chart_of_accounts' },
            { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books", icon: Database, permissionKey: 'crm_vouchers' },
            { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet", icon: Database, permissionKey: 'crm_balance_sheet' },
            { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance", icon: Database, permissionKey: 'crm_trial_balance' },
            { href: "/dashboard/crm/accounting/pnl", label: "Profit and Loss", icon: Database, permissionKey: 'crm_pnl' },
            { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement", icon: Database, permissionKey: 'crm_income_statement' },
            { href: "/dashboard/crm/accounting/day-book", label: "Day Book", icon: Database, permissionKey: 'crm_day_book' },
            { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement", icon: Database, permissionKey: 'crm_cash_flow' },
        ]
    },
    {
        title: "Sales CRM",
        items: [
            { href: "/dashboard/crm/sales-crm/all-leads", label: "Leads & Contacts", icon: BarChart2, permissionKey: 'crm_leads' },
            { href: "/dashboard/crm/deals", label: "Deals Pipeline", icon: BarChart2, permissionKey: 'crm_deals' },
            { href: "/dashboard/crm/tasks", label: "Tasks", icon: BarChart2, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/automations", label: "Automations", icon: BarChart2, permissionKey: 'crm_automations' },
            { href: "/dashboard/crm/sales-crm/pipelines", label: "Manage Pipelines", icon: BarChart2, permissionKey: 'crm_pipelines' },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms", icon: BarChart2, permissionKey: 'crm_forms' },
            { href: "/dashboard/crm/analytics", label: "Analytics", icon: BarChart2, permissionKey: 'crm_analytics' },
            { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary", icon: BarChart2, permissionKey: 'crm_reports' },
            { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report", icon: BarChart2, permissionKey: 'crm_reports' },
            { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report", icon: BarChart2, permissionKey: 'crm_reports' },
            { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report", icon: BarChart2, permissionKey: 'crm_reports' },
        ]
    },
    {
        title: "Banking",
        items: [
            { href: "/dashboard/crm/banking/all", label: "All Payment Accounts", icon: Landmark, permissionKey: 'crm_banking_accounts' },
            { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts", icon: Landmark, permissionKey: 'crm_banking_accounts' },
            { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts", icon: Landmark, permissionKey: 'crm_banking_employee' },
            { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation", icon: Landmark, permissionKey: 'crm_banking_reconciliation' },
        ]
    },
    {
        title: "Reports",
        items: [
            { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report", icon: BookCopy, permissionKey: 'crm_gstr1' },
            { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report", icon: BookCopy, permissionKey: 'crm_gstr2b' },
        ]
    },
    {
        title: "Settings",
        items: [
            { href: "/dashboard/crm/integrations", label: "Integrations", icon: Bolt, permissionKey: 'crm_settings' },
            { href: "/dashboard/crm/settings", label: "CRM Settings", icon: Settings, permissionKey: 'crm_settings' },
        ]
    }
];

export const hrmMenuGroups: MenuGroup[] = [
    {
        title: "Overview",
        items: [
            { href: "/dashboard/hrm", label: "HRM Dashboard", icon: UsersIcon, exact: true, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Recruitment",
        items: [
            { href: "/dashboard/hrm/hr/jobs", label: "Job Postings", icon: Briefcase, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/candidates", label: "Candidates", icon: Users, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/interviews", label: "Interviews", icon: Calendar, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/offers", label: "Offers", icon: FileText, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/careers-page", label: "Careers Page", icon: Globe, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "People",
        items: [
            { href: "/dashboard/hrm/payroll/employees", label: "Employee Directory", icon: UsersIcon, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/onboarding", label: "Onboarding", icon: UserCheck, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/probation", label: "Probation", icon: ShieldCheck, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/directory", label: "Directory", icon: Users, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/org-chart", label: "Org Chart", icon: Building2, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/departments", label: "Departments", icon: Building2, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/designations", label: "Designations", icon: UserCog, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Payroll & Compliance",
        items: [
            { href: "/dashboard/hrm/payroll/payroll", label: "Payroll", icon: DollarSign, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/payslips", label: "Payslips", icon: FileText, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/salary-structure", label: "Salary Structure", icon: ClipboardList, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/pf-esi", label: "PF & ESI", icon: ShieldCheck, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/tds", label: "TDS", icon: FileText, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/professional-tax", label: "Professional Tax", icon: FileText, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/payroll/form-16", label: "Form 16", icon: FileText, permissionKey: 'crm_payroll' },
        ]
    },
    {
        title: "Attendance & Leave",
        items: [
            { href: "/dashboard/hrm/payroll/attendance", label: "Attendance", icon: Calendar, permissionKey: 'crm_attendance' },
            { href: "/dashboard/hrm/payroll/leave", label: "Leave", icon: Calendar, permissionKey: 'crm_attendance' },
            { href: "/dashboard/hrm/payroll/holidays", label: "Holidays", icon: Calendar, permissionKey: 'crm_attendance' },
            { href: "/dashboard/hrm/payroll/shifts", label: "Shifts", icon: Repeat, permissionKey: 'crm_attendance' },
            { href: "/dashboard/hrm/payroll/shift-rotations", label: "Shift Rotations", icon: Repeat, permissionKey: 'crm_attendance' },
            { href: "/dashboard/hrm/payroll/shift-change-requests", label: "Shift Changes", icon: Repeat, permissionKey: 'crm_attendance' },
        ]
    },
    {
        title: "Performance",
        items: [
            { href: "/dashboard/hrm/hr/okrs", label: "OKRs & Goals", icon: BarChart2, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/feedback-360", label: "360 Feedback", icon: Users, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/appraisal-reviews", label: "Appraisals", icon: BarChart2, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/kpi-tracking", label: "KPI Tracking", icon: BarChart2, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/goal-setting", label: "Goal Setting", icon: BarChart2, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Learning",
        items: [
            { href: "/dashboard/hrm/hr/training", label: "Training", icon: BookCopy, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/certifications", label: "Certifications", icon: ShieldCheck, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/learning-paths", label: "Learning Paths", icon: BookCopy, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Documents & Assets",
        items: [
            { href: "/dashboard/hrm/hr/documents", label: "Documents", icon: FileText, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/document-templates", label: "Templates", icon: FileText, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/assets", label: "Assets", icon: Briefcase, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/asset-assignments", label: "Asset Assignments", icon: Briefcase, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Engagement",
        items: [
            { href: "/dashboard/hrm/hr/recognition", label: "Recognition", icon: Users, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/surveys", label: "Surveys", icon: ClipboardList, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/announcements", label: "Announcements", icon: Megaphone, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/hr/one-on-ones", label: "One-on-Ones", icon: Users, permissionKey: 'crm_employees' },
        ]
    },
    {
        title: "Reports & Settings",
        items: [
            { href: "/dashboard/hrm/payroll/reports", label: "Payroll Reports", icon: BarChart2, permissionKey: 'crm_payroll' },
            { href: "/dashboard/hrm/hr/exits", label: "Exit Management", icon: Users, permissionKey: 'crm_employees' },
            { href: "/dashboard/hrm/payroll/settings", label: "Settings", icon: Settings, permissionKey: 'crm_employees' },
        ]
    },
];

export const teamMenuItems: MenuItem[] = [
    { href: "/dashboard/team/manage-users", label: "Manage Users", icon: UsersIcon, permissionKey: 'team_users' },
    { href: "/dashboard/team/manage-roles", label: "Manage Roles", icon: ShieldCheck, permissionKey: 'team_roles' },
    { href: "/dashboard/team/tasks", label: "Tasks", icon: FolderKanban, permissionKey: 'team_tasks' },
    { href: "/dashboard/team/team-chat", label: "Team Chat", icon: MessageSquare, permissionKey: 'team_chat' },
];

export const sabChatMenuItems: MenuItem[] = [
    { href: '/dashboard/sabchat/inbox', label: 'Inbox', icon: Inbox, permissionKey: 'sabchat_inbox' },
    { href: '/dashboard/sabchat/visitors', label: 'Live Visitors', icon: Users, permissionKey: 'sabchat_visitors' },
    { href: '/dashboard/sabchat/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'sabchat_analytics' },
    { href: '/dashboard/sabchat/widget', label: 'Widget Setup', icon: Wrench, permissionKey: 'sabchat_widget' },
    { href: '/dashboard/sabchat/auto-reply', label: 'Auto Reply', icon: Bot, permissionKey: 'sabchat_auto_reply' },
    { href: '/dashboard/sabchat/quick-replies', label: 'Quick Replies', icon: LifeBuoy, permissionKey: 'sabchat_quick_replies' },
    { href: '/dashboard/sabchat/ai-replies', label: 'AI Replies', icon: Bot, permissionKey: 'sabchat_ai_replies' },
    { href: '/dashboard/sabchat/faq', label: 'FAQ', icon: HelpCircle, permissionKey: 'sabchat_faq' },
    { href: '/dashboard/sabchat/settings', label: 'Settings', icon: Settings, permissionKey: 'sabchat_settings' },
];

export const facebookMenuGroups: MenuGroup[] = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/facebook/all-projects', label: 'Project Connections', icon: Wrench, permissionKey: 'facebook_dashboard' },
            { href: '/dashboard/facebook', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'facebook_dashboard' },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/facebook/posts', label: 'Posts', icon: Newspaper, permissionKey: 'facebook_posts' },
            { href: '/dashboard/facebook/scheduled', label: 'Scheduled', icon: Calendar, permissionKey: 'facebook_scheduled' },
            { href: '/dashboard/facebook/live-studio', label: 'Live Studio', icon: Video, permissionKey: 'facebook_live' },
            { href: '/dashboard/facebook/post-randomizer', label: 'Post Randomizer', icon: Repeat, permissionKey: 'facebook_randomizer' },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/facebook/messages', label: 'Messages', icon: MessageSquare, permissionKey: 'facebook_messages' },
            { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: FolderKanban, permissionKey: 'facebook_kanban' },
            { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: Bot, permissionKey: 'facebook_automation' },
        ]
    },
    {
        title: 'Custom Shops',
        items: [
            { href: '/dashboard/facebook/custom-ecommerce', label: 'Shops Dashboard', icon: LayoutDashboard, permissionKey: 'facebook_shops' },
        ],
    },
    {
        title: 'Meta Commerce',
        items: [
            { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag, permissionKey: 'facebook_products' },
            { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutDashboard, permissionKey: 'facebook_shop_setup' },
            { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package, permissionKey: 'facebook_orders' },
        ]
    }
];

export const instagramMenuGroups: MenuGroup[] = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/instagram/connections', label: 'Connections', icon: Wrench, permissionKey: 'instagram_dashboard' },
            { href: '/dashboard/instagram', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'instagram_dashboard' },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/instagram/feed', label: 'Feed', icon: Newspaper, permissionKey: 'instagram_feed' },
            { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard, permissionKey: 'instagram_stories' },
            { href: '/dashboard/instagram/reels', label: 'Reels', icon: Video, permissionKey: 'instagram_reels' },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare, permissionKey: 'instagram_messages' },
        ]
    },
    {
        title: 'Growth',
        items: [
            { href: '/dashboard/instagram/discovery', label: 'Discovery', icon: Compass, permissionKey: 'instagram_discovery' },
            { href: '/dashboard/instagram/hashtag-search', label: 'Hashtag Search', icon: Search, permissionKey: 'instagram_hashtags' },
        ]
    }
];

export const adManagerMenuItems: MenuItem[] = [
    // ── Analyze ────────────────────────────────────────────────
    { href: '/dashboard/ad-manager', label: 'Overview', icon: LayoutDashboard, permissionKey: 'ad_manager_accounts' },
    { href: '/dashboard/ad-manager/insights', label: 'Performance', icon: BarChart, permissionKey: 'ad_manager_accounts' },
    { href: '/dashboard/ad-manager/reports', label: 'Reports', icon: FileText, permissionKey: 'ad_manager_accounts' },
    // ── Advertise ──────────────────────────────────────────────
    { href: '/dashboard/ad-manager/campaigns', label: 'Campaigns', icon: Megaphone, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/ad-sets', label: 'Ad Sets', icon: Layers, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/ads', label: 'Ads', icon: Package, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/bulk-editor', label: 'Bulk Editor', icon: FolderKanban, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/split-tests', label: 'A/B Split Tests', icon: Repeat, permissionKey: 'ad_manager_campaigns' },
    // ── Creative & planning ────────────────────────────────────
    { href: '/dashboard/ad-manager/creative-library', label: 'Creative Library', icon: Clapperboard, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/ai-lab', label: 'AI Creative Lab', icon: Bot, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/catalogs', label: 'Product Catalogs', icon: ShoppingBag, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/automated-rules', label: 'Automated Rules', icon: Bolt, permissionKey: 'ad_manager_campaigns' },
    // ── Audiences ──────────────────────────────────────────────
    { href: '/dashboard/ad-manager/audiences', label: 'Audiences', icon: Users, permissionKey: 'ad_manager_audiences' },
    { href: '/dashboard/ad-manager/customer-lists', label: 'Customer Lists', icon: UsersIcon, permissionKey: 'ad_manager_audiences' },
    { href: '/dashboard/ad-manager/lead-forms', label: 'Lead Forms', icon: Inbox, permissionKey: 'ad_manager_campaigns' },
    // ── Measurement ────────────────────────────────────────────
    { href: '/dashboard/ad-manager/pixels', label: 'Pixels & Datasets', icon: Database, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/events-manager', label: 'Events Manager', icon: Activity, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/custom-conversions', label: 'Custom Conversions', icon: TrendingUp, permissionKey: 'ad_manager_campaigns' },
    { href: '/dashboard/ad-manager/capi', label: 'Conversions API', icon: ShieldCheck, permissionKey: 'ad_manager_campaigns' },
    // ── Settings ───────────────────────────────────────────────
    { href: '/dashboard/ad-manager/ad-accounts', label: 'Ad Accounts', icon: Wrench, permissionKey: 'ad_manager_accounts' },
    { href: '/dashboard/ad-manager/billing', label: 'Billing', icon: CreditCard, permissionKey: 'ad_manager_accounts' },
    { href: '/dashboard/ad-manager/settings', label: 'Settings', icon: Settings, permissionKey: 'ad_manager_accounts' },
];

export const emailMenuItems: MenuItem[] = [
    { href: '/dashboard/email', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'email_dashboard' },
    { href: '/dashboard/email/inbox', label: 'Inbox', icon: Inbox, permissionKey: 'email_inbox' },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send, permissionKey: 'email_campaigns' },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Users, permissionKey: 'email_contacts' },
    { href: '/dashboard/email/templates', label: 'Templates', icon: BookCopy, permissionKey: 'email_templates' },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'email_analytics' },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck, permissionKey: 'email_verification' },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings, permissionKey: 'email_settings' },
];

export const smsMenuItems: MenuItem[] = [
    { href: '/dashboard/sms', label: 'Overview', icon: LayoutDashboard, permissionKey: 'sms_overview' },
    { href: '/dashboard/sms/campaigns', label: 'Campaigns', icon: MessageSquare, permissionKey: 'sms_campaigns' },
    { href: '/dashboard/sms/templates', label: 'DLT Templates', icon: BookCopy, permissionKey: 'sms_templates' },
    { href: '/dashboard/sms/config', label: 'Configuration', icon: Settings, permissionKey: 'sms_config' },
    { href: '/dashboard/sms/developer', label: 'Developer API', icon: Server, permissionKey: 'sms_developer' },
];

export const apiMenuItems: MenuItem[] = [
    { href: '/dashboard/api', label: 'API Keys', icon: Key, permissionKey: 'api_keys' },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy, permissionKey: 'api_docs' },
];

export const sabflowMenuItems: MenuItem[] = [
    { href: '/dashboard/sabflow/flow-builder', label: 'Flow Builder', icon: GitFork, permissionKey: 'wachat_flows' },
    { href: '/dashboard/sabflow/logs', label: 'Execution Logs', icon: Activity, permissionKey: 'wachat_flows' },
    { href: '/dashboard/sabflow/connections', label: 'Connections', icon: Cable, permissionKey: 'wachat_flows' },
    { href: '/dashboard/sabflow/settings', label: 'Settings', icon: Settings, permissionKey: 'wachat_flows' },
    { href: '/dashboard/sabflow/docs', label: 'Documentation', icon: BookCopy, permissionKey: 'wachat_flows' },
];

export const urlShortenerMenuItems: MenuItem[] = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon, permissionKey: 'url_shortener' },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings, permissionKey: 'url_shortener' },
];

export const qrCodeMakerMenuItems: MenuItem[] = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode, permissionKey: 'qr_code_maker' },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings, permissionKey: 'qr_code_maker' },
];

export const portfolioMenuItems: MenuItem[] = [
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutDashboard, permissionKey: 'website_builder' },
];

export const seoMenuItems: MenuItem[] = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp, permissionKey: 'seo_dashboard' },
    { href: '/dashboard/seo/tools', label: 'SEO Tools (117)', icon: Wrench, permissionKey: 'seo_dashboard' },
    { href: '/dashboard/seo/rankings', label: 'Rank Tracker', icon: BarChart2, permissionKey: 'seo_rankings' },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe, permissionKey: 'seo_site_explorer' },
    { href: '/dashboard/seo/competitors', label: 'Competitor Gap', icon: UsersIcon, permissionKey: 'seo_competitors' }, // New
    { href: '/dashboard/seo/pseo', label: 'pSEO Clusters', icon: Layers, permissionKey: 'seo_pseo' }, // New
    { href: '/dashboard/seo/brand', label: 'Brand Radar', icon: Rss, permissionKey: 'seo_brand_radar' }, // Updated Path
    { href: '/dashboard/seo/logs', label: 'Log Forensics', icon: FileText, permissionKey: 'seo_logs' }, // New
];

export const userSettingsItems: MenuItem[] = [
    { href: '/dashboard/user/settings/profile', label: 'Profile', icon: UsersIcon },
    { href: '/dashboard/user/settings/ui', label: 'UI Preferences', icon: Brush },
    { href: '/dashboard/user/billing', label: 'Billing & Plans', icon: CreditCard },
];
