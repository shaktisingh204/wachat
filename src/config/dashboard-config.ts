import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase,
    Phone, Webhook, CreditCard, ShoppingBag,
    Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake,
    Mail, Bolt, FolderKanban, Repeat, Inbox, Package, Compass, Search,
    Video, ShieldCheck, Key, BookCopy, Rss, TrendingUp, Calendar,
    Newspaper, Clapperboard, BarChart2, Landmark, Users as UsersIcon,
    LifeBuoy, HelpCircle, Bot, Wrench, Megaphone, Globe, LucideIcon, Database, Layers, FileText,
    Cable, Activity, Share2, ShieldAlert, UserCheck, Building2, DollarSign, ClipboardList, UserCog,
    Workflow, MessageSquareText, UsersRound, Target, LayoutTemplate, BriefcaseBusiness, FileSignature, FileKey, Shield,
    Smartphone, LayoutGrid, LayoutPanelTop, Zap, PieChart, Eye, CheckSquare, Check,
    Network, Store, Heart, Star, Gift, Truck, Receipt,
} from 'lucide-react';
import { MetaIcon, WhatsAppIcon, SeoIcon, InstagramIcon, SabChatIcon, TelegramIcon, CrmIcon, SabWaIcon } from '@/components/zoruui-domain/custom-sidebar-components';
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
    { id: 'sabwa', icon: SabWaIcon, label: 'SabWa', href: '/sabwa' },
    { id: 'sabchat', icon: SabChatIcon, label: 'sabChat', href: '/dashboard/sabchat' },
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
    { id: 'ad-manager', href: '/dashboard/ad-manager/ad-accounts', icon: Target, label: 'Ad Manager' },
    { id: 'telegram', href: '/dashboard/telegram', icon: TelegramIcon, label: 'Telegram' },
    { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
    { id: 'crm', href: '/dashboard/crm', icon: CrmIcon, label: 'CRM' },
    { id: 'sabcheckout', href: '/dashboard/sabcheckout', icon: CreditCard, label: 'SabCheckout' },
    { id: 'sabcreator', href: '/dashboard/sabcreator', icon: LayoutTemplate, label: 'SabCreator' },
    { id: 'hrm', href: '/dashboard/hrm', icon: BriefcaseBusiness, label: 'HRM' },
    { id: 'sabdesk', href: '/dashboard/sabdesk', icon: Target, label: 'SabDesk' },
    { id: 'sabflow', icon: Workflow, label: 'SabFlow', href: '/dashboard/sabflow/flow-builder' },
    { id: 'team', icon: UsersRound, label: 'Team', href: '/dashboard/team/manage-users' },
    { id: 'email', icon: Mail, label: 'Email', href: '/dashboard/email' },
    { id: 'sabsms', icon: MessageSquareText, label: 'SabSMS', href: '/sabsms' },
    { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
    { id: 'website-builder', icon: LayoutTemplate, label: 'Website', href: '/dashboard/website-builder' },
    { id: 'url-shortener', icon: LinkIcon, label: 'Links', href: '/dashboard/url-shortener' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Codes', href: '/dashboard/qr-code-maker' },
    { id: 'seo-suite', icon: SeoIcon, label: 'SEO', href: '/dashboard/seo' },
    { id: 'sabshop', icon: ShoppingBag, label: 'SabShop', href: '/dashboard/sabshop' },
    { id: 'sabsense', icon: LayoutPanelTop, label: 'SabSense', href: '/dashboard/sabsense' },
    { id: 'sabmeet', icon: Video, label: 'SabMeet', href: '/dashboard/sabmeet/rooms' },
    { id: 'sabwebinar', icon: Clapperboard, label: 'SabWebinar', href: '/dashboard/sabwebinar/webinars' },
    { id: 'sabsprints', icon: FolderKanban, label: 'SabSprints', href: '/dashboard/sabsprints/sprints' },
    { id: 'sabvault', icon: ShieldAlert, label: 'SabVault', href: '/dashboard/sabvault' },
    { id: 'sabsign', icon: FileSignature, label: 'SabSign', href: '/dashboard/sabsign' },
    { id: 'sabpractice', icon: Briefcase, label: 'SabPractice', href: '/dashboard/sabpractice/clients' },
    { id: 'sabtables', icon: Database, label: 'SabTables', href: '/dashboard/sabtables/bases' },
    { id: 'sabbi', icon: BarChart2, label: 'SabBI', href: '/dashboard/sabbi/datasets' },
    { id: 'sabops', icon: ShieldCheck, label: 'SabOps', href: '/dashboard/sabops' },
];

export const sabPracticeMenuGroups: MenuGroup[] = [
    {
        title: "Practice Management",
        items: [
            { href: "/dashboard/sabpractice/clients", label: "Clients", icon: Building2, permissionKey: 'sabpractice_view' },
            { href: "/dashboard/sabpractice/engagements", label: "Engagements", icon: BriefcaseBusiness, permissionKey: 'sabpractice_view' },
            { href: "/dashboard/sabpractice/deadlines", label: "Deadlines", icon: Calendar, permissionKey: 'sabpractice_view' },
        ]
    }
];

export const sabtablesMenuGroups: MenuGroup[] = [
    {
        title: "Relational Databases",
        items: [
            { href: "/dashboard/sabtables/bases", label: "Bases", icon: Database, permissionKey: 'sabtables_bases' },
            { href: "/dashboard/sabtables/views", label: "Views", icon: Layers, permissionKey: 'sabtables_views' },
            { href: "/dashboard/sabtables/automations", label: "Automations", icon: Bolt, permissionKey: 'sabtables_automations' },
        ]
    }
];

export const wachatMenuItems: MenuItem[] = [
    // Primary
    { href: '/wachat', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'], exact: true, permissionKey: 'wachat_overview' },
    { href: '/wachat/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'], permissionKey: 'wachat_overview' },
    { href: '/wachat/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'], permissionKey: 'wachat_chat' },
    { href: '/wachat/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'], permissionKey: 'wachat_contacts' },
    { href: '/wachat/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'], permissionKey: 'wachat_campaigns' },
    { href: '/wachat/broadcast-cron', label: 'Broadcast Cron', icon: Calendar, roles: ['owner', 'admin'], permissionKey: 'wachat_broadcast_cron' },
    { href: '/wachat/templates', label: 'Templates', icon: BookCopy, roles: ['owner', 'admin'], permissionKey: 'wachat_templates' },
    // Automate
    { href: '/wachat/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'], permissionKey: 'wachat_flow_builder' },
    { href: '/wachat/flows', label: 'Meta Flows', beta: true, icon: Settings, roles: ['owner', 'admin'], permissionKey: 'wachat_flows' },
    { href: '/wachat/auto-reply', label: 'Auto Reply', icon: MessageSquare, roles: ['owner', 'admin'], permissionKey: 'wachat_auto_reply' },
    { href: '/wachat/automation', label: 'Conversational AI', icon: Bot, roles: ['owner', 'admin'], permissionKey: 'wachat_automation' },
    // Grow
    { href: '/wachat/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'], permissionKey: 'wachat_catalog' },
    { href: '/wachat/whatsapp-pay', label: 'WhatsApp Pay', icon: CreditCard, roles: ['owner', 'admin'], permissionKey: 'wachat_whatsapp_pay' },
    { href: '/wachat/qr-codes', label: 'QR Codes', icon: QrCode, roles: ['owner', 'admin'], permissionKey: 'wachat_qr_codes' },
    { href: '/wachat/analytics', label: 'Analytics', icon: BarChart, roles: ['owner', 'admin'], permissionKey: 'wachat_analytics' },
    // Configure
    { href: '/wachat/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'], permissionKey: 'wachat_numbers' },
    { href: '/wachat/calls', label: 'Calls', icon: Phone, roles: ['owner', 'admin'], permissionKey: 'wachat_calls' },
    { href: '/wachat/health', label: 'Account Health', icon: Activity, roles: ['owner', 'admin'], permissionKey: 'wachat_health' },
    { href: '/wachat/integrations', label: 'Integrations', icon: Bolt, roles: ['owner', 'admin'], permissionKey: 'wachat_integrations' },
    { href: '/wachat/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'], permissionKey: 'wachat_webhooks' },
    { href: '/wachat/settings/general', label: 'General Settings', icon: Settings, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/wachat/settings/agents', label: 'Agents & Roles', icon: Users, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/wachat/settings/attributes', label: 'User Attributes', icon: Key, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
    { href: '/wachat/settings/canned', label: 'Canned Messages', icon: BookCopy, roles: ['owner', 'admin'], permissionKey: 'wachat_settings' },
];

// SabWa menu items — used by `getRequiredPermissionForPath` in `rbac-server.ts`
// to map each `/sabwa/*` route to its permission key for the layout-level
// `<RBACGuard>`. Keep hrefs aligned with `src/app/sabwa/**/page.tsx` and keys
// with `SABWA_PERMISSION_KEYS` in `src/lib/sabwa/rbac-keys.ts`.
//
// Order matters: the longest-prefix match wins inside `rbac-server.ts`, so
// specific sub-routes (e.g. `/sabwa/groups/categories`) are listed before
// their parents (e.g. `/sabwa/groups`).
export const sabwaMenuItems: MenuItem[] = [
    { href: '/sabwa', label: 'SabWa', icon: SabWaIcon, exact: true, permissionKey: 'sabwa_overview' },
    { href: '/sabwa/overview', label: 'Overview', icon: LayoutDashboard, permissionKey: 'sabwa_overview' },
    { href: '/sabwa/connect', label: 'Connect', icon: Cable, permissionKey: 'sabwa_connect' },
    { href: '/sabwa/devices', label: 'Devices', icon: Cable, permissionKey: 'sabwa_connect' },
    { href: '/sabwa/inbox', label: 'Inbox', icon: Inbox, permissionKey: 'sabwa_inbox' },
    { href: '/sabwa/chats', label: 'Chats', icon: MessageSquare, permissionKey: 'sabwa_chats' },
    // Sub-routes first so prefix matching resolves them before `/sabwa/groups`.
    { href: '/sabwa/groups/categories', label: 'Group Categories', icon: Layers, permissionKey: 'sabwa_groups' },
    { href: '/sabwa/groups/manage', label: 'Group Manage', icon: UsersRound, permissionKey: 'sabwa_group_manage' },
    { href: '/sabwa/groups', label: 'Groups', icon: UsersRound, permissionKey: 'sabwa_groups' },
    { href: '/sabwa/broadcasts', label: 'Broadcasts', icon: Send, permissionKey: 'sabwa_broadcasts' },
    { href: '/sabwa/bulk', label: 'Bulk Send', icon: Send, permissionKey: 'sabwa_bulk_send' },
    { href: '/sabwa/scheduler/queue', label: 'Scheduler Queue', icon: Calendar, permissionKey: 'sabwa_scheduler' },
    { href: '/sabwa/scheduler', label: 'Scheduler', icon: Calendar, permissionKey: 'sabwa_scheduler' },
    { href: '/sabwa/contacts', label: 'Contacts', icon: Users, permissionKey: 'sabwa_contacts' },
    { href: '/sabwa/templates', label: 'Templates', icon: BookCopy, permissionKey: 'sabwa_templates' },
    { href: '/sabwa/quick-replies', label: 'Quick Replies', icon: BookCopy, permissionKey: 'sabwa_templates' },
    { href: '/sabwa/auto-reply', label: 'Auto Reply', icon: MessageSquare, permissionKey: 'sabwa_auto_reply' },
    { href: '/sabwa/flows', label: 'Flows', icon: GitFork, permissionKey: 'sabwa_flows' },
    { href: '/sabwa/ai', label: 'AI', icon: Bot, permissionKey: 'sabwa_ai' },
    { href: '/sabwa/media', label: 'Media', icon: FolderKanban, permissionKey: 'sabwa_media' },
    { href: '/sabwa/status', label: 'Status', icon: Activity, permissionKey: 'sabwa_status' },
    { href: '/sabwa/calls', label: 'Calls', icon: Phone, permissionKey: 'sabwa_calls' },
    { href: '/sabwa/labels', label: 'Labels', icon: BookCopy, permissionKey: 'sabwa_labels' },
    { href: '/sabwa/starred', label: 'Starred', icon: BookCopy, permissionKey: 'sabwa_starred' },
    { href: '/sabwa/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'sabwa_analytics' },
    { href: '/sabwa/export', label: 'Export', icon: Database, permissionKey: 'sabwa_export' },
    { href: '/sabwa/webhooks', label: 'Webhooks', icon: Webhook, permissionKey: 'sabwa_webhooks' },
    { href: '/sabwa/api-keys', label: 'API Keys', icon: Key, permissionKey: 'sabwa_api_keys' },
    { href: '/sabwa/audit', label: 'Audit', icon: ClipboardList, permissionKey: 'sabwa_audit' },
    // `/sabwa/settings` covers all sub-routes (notifications/privacy/etc.) via
    // the prefix match in `getRequiredPermissionForPath`.
    { href: '/sabwa/settings', label: 'Settings', icon: Settings, permissionKey: 'sabwa_settings' },
];

// SabCRM — native metadata-driven CRM. Route-level RBAC: `/sabcrm` and every
// object route require `sabcrm:view`; settings (data-model admin) require
// `sabcrm:admin`. More specific (longer) hrefs are matched first by
// getRequiredPermissionForPath, so the settings/admin gate wins over the base.
//
// Ordering rule: list every sub-path BEFORE its parent so that the longest-
// prefix match in `getRequiredPermissionForPath` always resolves to the most
// specific entry. `settings/*` must come before `settings`, which must come
// before the root `/sabcrm` catch-all.
export const sabcrmMenuItems: MenuItem[] = [
    // ── Settings (admin-only) — most specific first ────────────────────────
    { href: '/dashboard/settings/crm/data-model',   label: 'Data Model',   icon: Database,       permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/members',      label: 'Members',      icon: Users,          permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/views',        label: 'Views',        icon: Layers,         permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/api',          label: 'API Keys',     icon: Key,            permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/automations',  label: 'Automations',  icon: Bolt,           permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/webhooks',     label: 'Webhooks',     icon: Webhook,        permissionKey: 'sabcrm:admin' },
    { href: '/dashboard/settings/crm/import-export', label: 'Import / Export', icon: Repeat,      permissionKey: 'sabcrm:admin' },
    // `/dashboard/settings/crm` covers any future settings sub-route not listed above.
    { href: '/dashboard/settings/crm',              label: 'Settings',     icon: Settings,       permissionKey: 'sabcrm:admin' },
    // ── Main views (view-level) — specific named routes before root ────────
    { href: '/sabcrm/dashboard',             label: 'Dashboard',    icon: LayoutDashboard, permissionKey: 'sabcrm:view' },
    { href: '/sabcrm/reports/builder',       label: 'Report Builder', icon: BarChart2,    permissionKey: 'sabcrm:view' },
    { href: '/sabcrm/reports',               label: 'Reports',      icon: BarChart,        permissionKey: 'sabcrm:view' },
    { href: '/sabcrm/notes',                 label: 'Notes',        icon: FileText,       permissionKey: 'sabcrm:view' },
    { href: '/sabcrm/tasks',                 label: 'Tasks',        icon: ClipboardList,   permissionKey: 'sabcrm:view' },
    // `/sabcrm` catches all remaining object and record routes via prefix match.
    { href: '/sabcrm', label: 'SabCRM', icon: CrmIcon, exact: false, permissionKey: 'sabcrm:view' },
];

export const sabbiMenuGroups: MenuGroup[] = [
    {
        title: "Data Intelligence",
        items: [
            { href: "/dashboard/sabbi/datasets", label: "Datasets", icon: Database, exact: true, permissionKey: 'sabbi_datasets' },
            { href: "/dashboard/sabbi/charts", label: "Charts", icon: BarChart2, exact: true, permissionKey: 'sabbi_charts' },
            { href: "/dashboard/sabbi/embeds", label: "Embeds", icon: LayoutDashboard, exact: true, permissionKey: 'sabbi_embeds' },
        ]
    }
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
        title: "Project Management",
        items: [
            { href: "/dashboard/crm/projects", label: "All Projects", icon: Briefcase, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/kanban", label: "Kanban Board", icon: FolderKanban, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/gantt", label: "Gantt Chart", icon: BarChart2, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/tasks", label: "Tasks", icon: ClipboardList, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/activity", label: "Project Activity", icon: Activity, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/milestones", label: "Milestones", icon: Target, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/issues", label: "Issues & Bugs", icon: ShieldCheck, permissionKey: 'crm_tasks' },
            { href: "/dashboard/hrm/hr/okrs", label: "OKRs & Goals", icon: Target, permissionKey: 'crm_employees' },
            { href: "/dashboard/crm/projects/categories", label: "Project Categories", icon: Layers, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/task-categories", label: "Task Categories", icon: Layers, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/taskboard-columns", label: "Taskboard Columns", icon: Layers, permissionKey: 'crm_tasks' },
            { href: "/dashboard/crm/projects/task-labels", label: "Task Labels", icon: BookCopy, permissionKey: 'crm_tasks' },
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
            { href: "/dashboard/crm/automations", label: "Automations", icon: BarChart2, permissionKey: 'crm_automations' },
            { href: "/dashboard/sabbigin/pipelines", label: "Manage Pipelines", icon: BarChart2, permissionKey: 'crm_pipelines' },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms", icon: BarChart2, permissionKey: 'crm_forms' },
            { href: "/dashboard/sabbi/analytics", label: "Analytics", icon: BarChart2, permissionKey: 'crm_analytics' },
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
            { href: "/dashboard/sabbi/reports/gstr-1", label: "GSTR-1 Sales Report", icon: BookCopy, permissionKey: 'crm_gstr1' },
            { href: "/dashboard/sabbi/reports/gstr-2b", label: "GSTR-2B Purchase Report", icon: BookCopy, permissionKey: 'crm_gstr2b' },
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
        title: "Core HR & People",
        items: [
            {
                href: "/dashboard/hrm/payroll/employees", label: "Employee Directory", icon: UsersIcon, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/directory", label: "Public Directory", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/org-chart", label: "Org Chart", permissionKey: 'crm_employees' }
                ]
            },
            {
                href: "/dashboard/hrm/hr/onboarding", label: "Onboarding & Exits", icon: UserCheck, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/probation", label: "Probation", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/exits", label: "Exit Management", permissionKey: 'crm_employees' }
                ]
            },
            {
                href: "/dashboard/hrm/payroll/departments", label: "Organization", icon: Building2, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/payroll/designations", label: "Designations", permissionKey: 'crm_employees' }
                ]
            }
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
        title: "Payroll & Attendance",
        items: [
            {
                href: "/dashboard/hrm/payroll/payroll", label: "Payroll", icon: DollarSign, permissionKey: 'crm_payroll',
                subItems: [
                    { href: "/dashboard/hrm/payroll/payslips", label: "Payslips", permissionKey: 'crm_payroll' },
                    { href: "/dashboard/hrm/payroll/salary-structure", label: "Salary Structure", permissionKey: 'crm_payroll' },
                    { href: "/dashboard/hrm/payroll/reports", label: "Payroll Reports", permissionKey: 'crm_payroll' }
                ]
            },
            {
                href: "/dashboard/hrm/payroll/attendance", label: "Attendance", icon: Calendar, permissionKey: 'crm_attendance',
                subItems: [
                    { href: "/dashboard/hrm/payroll/leave", label: "Leaves", permissionKey: 'crm_attendance' },
                    { href: "/dashboard/hrm/payroll/holidays", label: "Holidays", permissionKey: 'crm_attendance' }
                ]
            },
            {
                href: "/dashboard/hrm/payroll/shifts", label: "Shifts", icon: Repeat, permissionKey: 'crm_attendance',
                subItems: [
                    { href: "/dashboard/hrm/payroll/shift-rotations", label: "Shift Rotations", permissionKey: 'crm_attendance' },
                    { href: "/dashboard/hrm/payroll/shift-change-requests", label: "Shift Changes", permissionKey: 'crm_attendance' }
                ]
            },
            {
                href: "/dashboard/hrm/payroll/pf-esi", label: "Compliance & Taxes", icon: ShieldCheck, permissionKey: 'crm_payroll',
                subItems: [
                    { href: "/dashboard/hrm/payroll/tds", label: "TDS", permissionKey: 'crm_payroll' },
                    { href: "/dashboard/hrm/payroll/professional-tax", label: "Professional Tax", permissionKey: 'crm_payroll' },
                    { href: "/dashboard/hrm/payroll/form-16", label: "Form 16", permissionKey: 'crm_payroll' }
                ]
            }
        ]
    },
    {
        title: "Performance & Assets",
        items: [
            {
                href: "/dashboard/hrm/payroll/goal-setting", label: "Performance", icon: BarChart2, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/feedback-360", label: "360 Feedback", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/payroll/appraisal-reviews", label: "Appraisals", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/payroll/kpi-tracking", label: "KPI Tracking", permissionKey: 'crm_employees' }
                ]
            },
            {
                href: "/dashboard/hrm/hr/training", label: "Learning", icon: BookCopy, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/certifications", label: "Certifications", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/learning-paths", label: "Learning Paths", permissionKey: 'crm_employees' }
                ]
            },
            {
                href: "/dashboard/hrm/hr/documents", label: "Documents & Assets", icon: FileText, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/document-templates", label: "Templates", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/assets", label: "Assets", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/asset-assignments", label: "Asset Assignments", permissionKey: 'crm_employees' }
                ]
            },
            {
                href: "/dashboard/hrm/hr/recognition", label: "Engagement", icon: Users, permissionKey: 'crm_employees',
                subItems: [
                    { href: "/dashboard/hrm/hr/surveys", label: "Surveys", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/announcements", label: "Announcements", permissionKey: 'crm_employees' },
                    { href: "/dashboard/hrm/hr/one-on-ones", label: "One-on-Ones", permissionKey: 'crm_employees' }
                ]
            },
            { href: "/dashboard/hrm/payroll/settings", label: "Settings", icon: Settings, permissionKey: 'crm_employees' }
        ]
    }
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
    { href: '/dashboard/sabmail/inbox', label: 'Inbox', icon: Inbox, permissionKey: 'email_inbox' },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send, permissionKey: 'email_campaigns' },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Users, permissionKey: 'email_contacts' },
    { href: '/dashboard/email/templates', label: 'Templates', icon: BookCopy, permissionKey: 'email_templates' },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'email_analytics' },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck, permissionKey: 'email_verification' },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings, permissionKey: 'email_settings' },
];

export const smsMenuItems: MenuItem[] = [
    { href: '/sabsms', label: 'Overview', icon: LayoutDashboard, permissionKey: 'sabsms_overview' },
    { href: '/sabsms/inbox', label: 'Inbox', icon: Inbox, permissionKey: 'sabsms_inbox' },
    { href: '/sabsms/campaigns', label: 'Campaigns', icon: MessageSquare, permissionKey: 'sabsms_campaigns' },
    { href: '/sabsms/templates', label: 'Templates', icon: BookCopy, permissionKey: 'sabsms_templates' },
    { href: '/sabsms/drips', label: 'Drip Sequences', icon: GitFork, permissionKey: 'sabsms_drips' },
    { href: '/sabsms/numbers', label: 'Numbers', icon: Phone, permissionKey: 'sabsms_numbers' },
    { href: '/sabsms/providers', label: 'Providers', icon: Server, permissionKey: 'sabsms_providers' },
    { href: '/sabsms/suppressions', label: 'Suppressions', icon: ShieldCheck, permissionKey: 'sabsms_suppressions' },
    { href: '/sabsms/compliance', label: 'Compliance', icon: ShieldCheck, permissionKey: 'sabsms_compliance' },
    { href: '/sabsms/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'sabsms_analytics' },
    { href: '/sabsms/webhooks', label: 'Webhooks', icon: Webhook, permissionKey: 'sabsms_webhooks' },
    { href: '/sabsms/api-keys', label: 'API Keys', icon: Key, permissionKey: 'sabsms_api_keys' },
    { href: '/sabsms/settings', label: 'Settings', icon: Settings, permissionKey: 'sabsms_settings' },
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

export const sabdeskMenuGroups: MenuGroup[] = [
    {
        title: 'Tickets',
        items: [
            { href: '/dashboard/sabdesk', label: 'All Tickets', icon: Inbox, permissionKey: 'sabdesk_tickets' },
            { href: '/dashboard/sabdesk/my-tickets', label: 'My Tickets', icon: UserCog, permissionKey: 'sabdesk_tickets' },
            { href: '/dashboard/sabdesk/unassigned', label: 'Unassigned', icon: FolderKanban, permissionKey: 'sabdesk_tickets' },
            { href: '/dashboard/sabdesk/views', label: 'Custom Views', icon: Layers, permissionKey: 'sabdesk_tickets' },
        ]
    },
    {
        title: 'Help Center',
        items: [
            { href: '/dashboard/sabdesk/knowledge-base', label: 'Knowledge Base', icon: BookCopy, permissionKey: 'sabdesk_kb' },
            { href: '/dashboard/sabdesk/community', label: 'Community Forum', icon: Users, permissionKey: 'sabdesk_kb' },
            { href: '/dashboard/sabdesk/announcements', label: 'Announcements', icon: Megaphone, permissionKey: 'sabdesk_kb' },
        ]
    },
    {
        title: 'Automation & Routing',
        items: [
            { href: '/dashboard/sabdesk/routing', label: 'Ticket Routing', icon: GitFork, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/macros', label: 'Macros', icon: Bot, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/triggers', label: 'Triggers', icon: Bolt, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/sla', label: 'SLA Policies', icon: ShieldCheck, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'AI Copilot',
        items: [
            { href: '/dashboard/sabdesk/ai-copilot/training-data', label: 'Training Data', icon: BookCopy, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/ai-copilot/suggested-replies', label: 'Suggested Replies', icon: MessageSquare, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/ai-copilot/sentiment-analysis', label: 'Sentiment Analysis', icon: Users, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Workforce',
        items: [
            { href: '/dashboard/sabdesk/workforce/scheduling', label: 'Scheduling', icon: UsersRound, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/workforce/forecast', label: 'Forecast', icon: Target, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/workforce/time-off', label: 'Time Off', icon: UserCog, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Quality Assurance',
        items: [
            { href: '/dashboard/sabdesk/quality-assurance/scorecards', label: 'Scorecards', icon: FileText, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/quality-assurance/evaluations', label: 'Evaluations', icon: Check, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Analytics',
        items: [
            { href: '/dashboard/sabdesk/analytics/overview', label: 'Overview', icon: LayoutDashboard, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/analytics/agent-performance', label: 'Agent Performance', icon: Users, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/analytics/live-dashboards', label: 'Live Dashboards', icon: Target, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Integrations',
        items: [
            { href: '/dashboard/sabdesk/integrations/app-directory', label: 'App Directory', icon: Layers, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/integrations/webhooks', label: 'Webhooks', icon: LinkIcon, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/integrations/api-logs', label: 'API Logs', icon: Settings, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Settings',
        items: [
            { href: '/dashboard/sabdesk/channels', label: 'Channels', icon: Cable, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/teams', label: 'Teams & Agents', icon: UsersRound, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/custom-forms', label: 'Custom Forms', icon: FileText, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/settings', label: 'Settings', icon: Settings, permissionKey: 'sabdesk_admin' },
        ]
    },
    {
        title: 'Enterprise Add-ons',
        items: [
            { href: '/dashboard/sabdesk/field-service', label: 'Field Service', icon: UsersRound, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/itsm', label: 'IT Asset Mgmt', icon: Settings, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/voice-center', label: 'Voice & Call Center', icon: Cable, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/customer-success', label: 'Customer Success', icon: Target, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/incident-mgmt', label: 'Incident Mgmt', icon: Settings, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/surveys', label: 'Surveys & Feedback', icon: FileText, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/gamification', label: 'Gamification', icon: Target, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/billing', label: 'Billing', icon: CreditCard, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/social-inbox', label: 'Social Inbox', icon: UsersRound, permissionKey: 'sabdesk_admin' },
            { href: '/dashboard/sabdesk/localization', label: 'Localization', icon: Globe, permissionKey: 'sabdesk_admin' },
        ]
    }
];

export const sabcheckoutMenuGroups: MenuGroup[] = [
    {
        title: 'Overview',
        items: [
            { href: '/dashboard/sabcheckout', label: 'Dashboard', icon: LayoutDashboard, permissionKey: 'sabcheckout_view' },
            { href: '/dashboard/sabcheckout/live', label: 'Live Revenue Feed', icon: Activity, permissionKey: 'sabcheckout_view' },
            { href: '/dashboard/sabcheckout/customer-portal', label: 'Customer Portal', icon: Globe, permissionKey: 'sabcheckout_view' },
        ]
    },
    {
        title: 'Growth & Optimization',
        items: [
            { href: '/dashboard/sabcheckout/upsells', label: '1-Click Upsells', icon: TrendingUp, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/order-bumps', label: 'Order Bumps', icon: ShoppingBag, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/ab-testing', label: 'A/B Testing', icon: Activity, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/affiliates', label: 'Affiliates', icon: Users, permissionKey: 'sabcheckout_products' },
        ]
    },
    {
        title: 'Products & Pricing',
        items: [
            { href: '/dashboard/sabcheckout/products', label: 'Products', icon: Package, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/plans', label: 'Subscription Plans', icon: Repeat, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/tiered-pricing', label: 'Tiered Pricing', icon: Layers, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/metered-billing', label: 'Metered Billing', icon: Activity, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/coupons', label: 'Coupons & Discounts', icon: ShoppingBag, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/gift-cards', label: 'Gift Cards', icon: CreditCard, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/store-credit', label: 'Store Credit', icon: Landmark, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/loyalty', label: 'Loyalty & Rewards', icon: Target, permissionKey: 'sabcheckout_products' },
        ]
    },
    {
        title: 'Digital & Fulfillment',
        items: [
            { href: '/dashboard/sabcheckout/license-keys', label: 'License Keys', icon: Key, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/digital-watermarking', label: 'Digital Watermarks', icon: ShieldCheck, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/preorders', label: 'Pre-Orders', icon: Calendar, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/inventory', label: 'Inventory Sync', icon: Database, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/fulfillment', label: 'Fulfillment & Shipping', icon: Package, permissionKey: 'sabcheckout_products' },
        ]
    },
    {
        title: 'Customers & Revenue',
        items: [
            { href: '/dashboard/sabcheckout/customers', label: 'Customers', icon: Users, permissionKey: 'sabcheckout_customers' },
            { href: '/dashboard/sabcheckout/subscriptions', label: 'Subscriptions', icon: Calendar, permissionKey: 'sabcheckout_customers' },
            { href: '/dashboard/sabcheckout/invoices', label: 'Invoices', icon: FileText, permissionKey: 'sabcheckout_customers' },
            { href: '/dashboard/sabcheckout/sessions', label: 'Sessions', icon: FolderKanban, permissionKey: 'sabcheckout_customers' },
        ]
    },
    {
        title: 'Checkout Experience',
        items: [
            { href: '/dashboard/sabcheckout/pages', label: 'Payment Pages', icon: LayoutTemplate, permissionKey: 'sabcheckout_pages' },
            { href: '/dashboard/sabcheckout/links', label: 'Payment Links', icon: LinkIcon, permissionKey: 'sabcheckout_pages' },
            { href: '/dashboard/sabcheckout/custom-domains', label: 'Custom Domains', icon: Globe, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/multi-currency', label: 'Multi-Currency', icon: DollarSign, permissionKey: 'sabcheckout_settings' },
        ]
    },
    {
        title: 'Risk & Recovery',
        items: [
            { href: '/dashboard/sabcheckout/abandoned', label: 'Abandoned Carts', icon: ShoppingBag, permissionKey: 'sabcheckout_recovery' },
            { href: '/dashboard/sabcheckout/dunning', label: 'Dunning Management', icon: ShieldCheck, permissionKey: 'sabcheckout_recovery' },
            { href: '/dashboard/sabcheckout/fraud-prevention', label: 'Fraud Prevention', icon: ShieldCheck, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/disputes', label: 'Disputes & Chargebacks', icon: Activity, permissionKey: 'sabcheckout_recovery' },
        ]
    },
    {
        title: 'Enterprise & Finances',
        items: [
            { href: '/dashboard/sabcheckout/reseller', label: 'Reseller Portal', icon: Briefcase, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/payouts', label: 'Payouts', icon: Landmark, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/taxes', label: 'Tax Rules', icon: FileText, permissionKey: 'sabcheckout_products' },
            { href: '/dashboard/sabcheckout/tax-exemptions', label: 'Tax Exemptions', icon: ShieldCheck, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/payment-gateways', label: 'Payment Gateways', icon: CreditCard, permissionKey: 'sabcheckout_settings' },
        ]
    },
    {
        title: 'Analytics & Reports',
        items: [
            { href: '/dashboard/sabcheckout/analytics', label: 'Revenue Analytics', icon: BarChart, permissionKey: 'sabcheckout_analytics' },
            { href: '/dashboard/sabcheckout/reports/mrr', label: 'MRR Tracking', icon: TrendingUp, permissionKey: 'sabcheckout_analytics' },
            { href: '/dashboard/sabcheckout/reports/churn', label: 'Churn Analysis', icon: Activity, permissionKey: 'sabcheckout_analytics' },
        ]
    },
    {
        title: 'Developers & Settings',
        items: [
            { href: '/dashboard/sabcheckout/webhooks', label: 'Webhooks', icon: Webhook, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/api-keys', label: 'API Keys', icon: Key, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/integrations', label: 'Integrations', icon: Bolt, permissionKey: 'sabcheckout_settings' },
            { href: '/dashboard/sabcheckout/settings', label: 'Settings', icon: Settings, permissionKey: 'sabcheckout_settings' },
        ]
    }
];

export const sabsenseMenuGroups: MenuGroup[] = [
    {
        title: 'Publishers & Inventory',
        items: [
            { href: '/dashboard/sabsense/publishers', label: 'Publishers', icon: Users, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/sites', label: 'Sites', icon: Globe, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/apps', label: 'Apps', icon: Smartphone, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/ad-units', label: 'Ad Units', icon: LayoutGrid, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/placements', label: 'Placements', icon: LayoutPanelTop, permissionKey: 'sabsense_overview' },
        ]
    },
    {
        title: 'Advertisers & Campaigns',
        items: [
            { href: '/dashboard/sabsense/advertisers', label: 'Advertisers', icon: Briefcase, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/campaigns', label: 'Campaigns', icon: Megaphone, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/creatives', label: 'Creatives', icon: Brush, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/targeting', label: 'Targeting', icon: Target, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/budgeting', label: 'Budgeting', icon: DollarSign, permissionKey: 'sabsense_overview' },
        ]
    },
    {
        title: 'Yield & Monetization',
        items: [
            { href: '/dashboard/sabsense/bidding', label: 'Header Bidding', icon: Zap, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/direct-deals', label: 'Direct Deals', icon: Handshake, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/floor-pricing', label: 'Floor Pricing', icon: TrendingUp, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/yield-mgmt', label: 'Yield Mgmt', icon: BarChart, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/native-ads', label: 'Native Ads', icon: LayoutTemplate, permissionKey: 'sabsense_overview' },
        ]
    },
    {
        title: 'Billing & Payments',
        items: [
            { href: '/dashboard/sabsense/payouts', label: 'Publisher Payouts', icon: CreditCard, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/advertiser-billing', label: 'Adv. Billing', icon: FileText, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/revenue-share', label: 'Revenue Share', icon: PieChart, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/tax-forms', label: 'Tax Forms', icon: FileSignature, permissionKey: 'sabsense_overview' },
        ]
    },
    {
        title: 'Analytics & Compliance',
        items: [
            { href: '/dashboard/sabsense/analytics', label: 'Analytics', icon: BarChart2, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/fraud-detection', label: 'Fraud Detection', icon: ShieldAlert, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/viewability', label: 'Viewability', icon: Eye, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/consent-mgmt', label: 'Consent Mgmt', icon: CheckSquare, permissionKey: 'sabsense_overview' },
            { href: '/dashboard/sabsense/brand-safety', label: 'Brand Safety', icon: ShieldCheck, permissionKey: 'sabsense_overview' },
        ]
    }
];

export const sabshopMenuGroups: MenuGroup[] = [
    {
        title: 'Core E-Commerce',
        items: [
            { href: '/dashboard/sabshop', label: 'Storefronts', icon: LayoutDashboard, permissionKey: 'sabshop_overview' },
            { href: '/dashboard/sabshop/default/orders', label: 'Orders', icon: Package, permissionKey: 'sabshop_orders' },
            { href: '/dashboard/sabshop/default/products', label: 'Products', icon: ShoppingBag, permissionKey: 'sabshop_products' },
            { href: '/dashboard/sabshop/default/collections', label: 'Collections', icon: Layers, permissionKey: 'sabshop_products' },
            { href: '/dashboard/sabshop/default/customers', label: 'Customers', icon: Users, permissionKey: 'sabshop_customers' },
        ]
    },
    {
        title: 'Advanced Analytics',
        items: [
            { href: '/dashboard/sabshop/default/analytics/live', label: 'Live View', icon: Activity, permissionKey: 'sabshop_analytics' },
            { href: '/dashboard/sabshop/default/analytics/cohorts', label: 'Cohorts', icon: PieChart, permissionKey: 'sabshop_analytics' },
            { href: '/dashboard/sabshop/default/analytics/funnels', label: 'Funnels', icon: Target, permissionKey: 'sabshop_analytics' },
        ]
    },
    {
        title: 'Supply Chain',
        items: [
            { href: '/dashboard/sabshop/default/inventory/locations', label: 'Locations', icon: Building2, permissionKey: 'sabshop_inventory' },
            { href: '/dashboard/sabshop/default/inventory/purchase-orders', label: 'Purchase Orders', icon: FileText, permissionKey: 'sabshop_inventory' },
            { href: '/dashboard/sabshop/default/inventory/transfers', label: 'Transfers', icon: Repeat, permissionKey: 'sabshop_inventory' },
            { href: '/dashboard/sabshop/default/inventory/suppliers', label: 'Suppliers', icon: Network, permissionKey: 'sabshop_inventory' },
        ]
    },
    {
        title: 'Omnichannel',
        items: [
            { href: '/dashboard/sabshop/default/channels/pos', label: 'Point of Sale', icon: Store, permissionKey: 'sabshop_channels' },
            { href: '/dashboard/sabshop/default/channels/b2b', label: 'B2B Wholesale', icon: Globe, permissionKey: 'sabshop_channels' },
            { href: '/dashboard/sabshop/default/channels/marketplaces', label: 'Marketplaces', icon: Smartphone, permissionKey: 'sabshop_channels' },
        ]
    },
    {
        title: 'CRM & Loyalty',
        items: [
            { href: '/dashboard/sabshop/default/customers/segments', label: 'Segments', icon: UsersRound, permissionKey: 'sabshop_crm' },
            { href: '/dashboard/sabshop/default/customers/loyalty', label: 'Loyalty Program', icon: Heart, permissionKey: 'sabshop_crm' },
            { href: '/dashboard/sabshop/default/customers/reviews', label: 'Reviews', icon: Star, permissionKey: 'sabshop_crm' },
        ]
    },
    {
        title: 'Marketing & Flow',
        items: [
            { href: '/dashboard/sabshop/default/discounts', label: 'Discounts', icon: Gift, permissionKey: 'sabshop_marketing' },
            { href: '/dashboard/sabshop/default/gift-cards', label: 'Gift Cards', icon: Gift, permissionKey: 'sabshop_marketing' },
            { href: '/dashboard/sabshop/default/automations', label: 'Automations', icon: Zap, permissionKey: 'sabshop_marketing' },
            { href: '/dashboard/sabshop/default/webhooks', label: 'Webhooks', icon: Webhook, permissionKey: 'sabshop_marketing' },
        ]
    },
    {
        title: 'Operations',
        items: [
            { href: '/dashboard/sabshop/default/shipping', label: 'Shipping', icon: Truck, permissionKey: 'sabshop_settings' },
            { href: '/dashboard/sabshop/default/taxes', label: 'Taxes', icon: Receipt, permissionKey: 'sabshop_settings' },
            { href: '/dashboard/sabshop/default/settings', label: 'Settings', icon: Settings, permissionKey: 'sabshop_settings' },
        ]
    }
];

export const sabmeetMenuGroups: MenuGroup[] = [
    {
        title: 'SabMeet',
        items: [
            { href: '/dashboard/sabmeet/rooms', label: 'Rooms', icon: Video, permissionKey: 'sabmeet_rooms' },
            { href: '/dashboard/sabmeet/recordings', label: 'Recordings', icon: Clapperboard, permissionKey: 'sabmeet_recordings' },
            { href: '/dashboard/sabmeet/polls', label: 'Polls', icon: BarChart, permissionKey: 'sabmeet_polls' },
        ]
    }
];

export const sabvaultMenuGroups: MenuGroup[] = [
    {
        title: 'Vault Management',
        items: [
            { href: '/dashboard/sabvault', label: 'Secrets', icon: Key, permissionKey: 'sabvault_secrets' },
            { href: '/dashboard/sabvault/shares', label: 'Shares', icon: Share2, permissionKey: 'sabvault_shares' },
            { href: '/dashboard/sabvault/breach-alerts', label: 'Breach Alerts', icon: ShieldAlert, permissionKey: 'sabvault_breach_alerts' },
        ]
    }
];

export const sabcreatorMenuGroups: MenuGroup[] = [
    {
        title: 'SabCreator',
        items: [
            { href: '/dashboard/sabcreator', label: 'Overview', icon: LayoutTemplate, permissionKey: 'sabcreator_overview' },
            { href: '/dashboard/sabcreator/forms', label: 'Forms', icon: FileText, permissionKey: 'sabcreator_forms' },
            { href: '/dashboard/sabcreator/workflows', label: 'Workflows', icon: Workflow, permissionKey: 'sabcreator_workflows' },
        ]
    }
];

export const sabsprintsMenuGroups: MenuGroup[] = [
    {
        title: 'Agile Management',
        items: [
            { href: '/dashboard/sabsprints/sprints', label: 'Sprints', icon: Repeat, permissionKey: 'sabsprints_sprints' },
            { href: '/dashboard/sabsprints/epics', label: 'Epics', icon: Layers, permissionKey: 'sabsprints_epics' },
            { href: '/dashboard/sabsprints/velocity', label: 'Velocity', icon: Activity, permissionKey: 'sabsprints_velocity' },
        ]
    }
];

export const sabopsMenuGroups: MenuGroup[] = [
    {
        title: "Overview",
        items: [
            { href: "/dashboard/sabops", label: "Dashboard", icon: BarChart, exact: true },
        ]
    },
    {
        title: "Management",
        items: [
            { href: "/dashboard/sabops/mdm-profiles", label: "MDM Profiles", icon: ShieldCheck },
            { href: "/dashboard/sabops/inventory", label: "Inventory", icon: Package },
            { href: "/dashboard/sabops/alerts", label: "Alerts", icon: Server },
        ]
    }
];

export const sabsignMenuGroups: MenuGroup[] = [
    {
        title: 'Core',
        items: [
            { href: '/dashboard/sabsign', label: 'Envelopes', icon: FileSignature, permissionKey: 'sabsign_envelopes' },
            { href: '/dashboard/sabsign/templates', label: 'Templates', icon: FileKey, permissionKey: 'sabsign_templates' },
            { href: '/dashboard/sabsign/form-builder', label: 'Form Builder', icon: LayoutTemplate, permissionKey: 'sabsign_envelopes' },
        ]
    },
    {
        title: 'Compliance & Identity',
        items: [
            { href: '/dashboard/sabsign/audit', label: 'Audit Trail', icon: Shield, permissionKey: 'sabsign_audit' },
            { href: '/dashboard/sabsign/notary', label: 'Remote Notary', icon: Video, permissionKey: 'sabsign_audit' },
        ]
    },
    {
        title: 'Administration',
        items: [
            { href: '/dashboard/sabsign/integrations', label: 'Integrations & API', icon: Cable, permissionKey: 'sabsign_admin' },
            { href: '/dashboard/sabsign/settings', label: 'Settings & Branding', icon: Settings, permissionKey: 'sabsign_admin' },
            { href: '/dashboard/sabsign/signer-portal', label: 'Signer Portal (Preview)', icon: Globe, permissionKey: 'sabsign_admin' },
        ]
    }
];


export const sabwebinarMenuGroups: MenuGroup[] = [
    {
        title: 'SabWebinar',
        items: [
            { href: '/dashboard/sabwebinar/webinars', label: 'Webinars', icon: Clapperboard, permissionKey: 'sabwebinar_webinars' },
            { href: '/dashboard/sabwebinar/registrations', label: 'Registrations', icon: Users, permissionKey: 'sabwebinar_registrations' },
            { href: '/dashboard/sabwebinar/analytics', label: 'Analytics', icon: BarChart, permissionKey: 'sabwebinar_analytics' }
        ]
    }
];
