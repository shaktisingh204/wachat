import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase,
    Phone, Webhook, CreditCard, ShoppingBag,
    Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake,
    Mail, Bolt, FolderKanban, Repeat, Inbox, Package, Compass, Search,
    Video, ShieldCheck, Key, BookCopy, Rss, TrendingUp, Calendar,
    Newspaper, Clapperboard, BarChart2, Landmark, Users as UsersIcon,
    LifeBuoy, HelpCircle, Bot, Wrench, Megaphone, Globe, LucideIcon, Database
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
    subSubItems?: MenuItem[]; // Handling the nested nature of some existing menus
}

export interface MenuGroup {
    title: string;
    items: MenuItem[];
}

export const appIcons = [
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat', href: '/dashboard' },
    { id: 'sabchat', icon: SabChatIcon, label: 'sabChat', href: '/dashboard/sabchat' },
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
    { id: 'ad-manager', href: '/dashboard/ad-manager/ad-accounts', icon: Megaphone, label: 'Ad Manager' },
    { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
    { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM' },
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
    { href: '/dashboard', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'] },
    { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'] },
    { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'] },
    { href: '/dashboard/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'] },
    { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'] },
    { href: '/dashboard/templates', label: 'Templates', icon: BookCopy, roles: ['owner', 'admin'] }, // Replaced React.Fragment with BookCopy
    { href: '/dashboard/catalog', label: 'Ecomm + Catalog', icon: ShoppingBag, roles: ['owner', 'admin'] },
    { href: '/dashboard/calls', label: 'Calls', icon: Phone, roles: ['owner', 'admin'] },
    { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'] },
    { href: '/dashboard/flows', label: 'Meta Flows', beta: true, icon: Settings, roles: ['owner', 'admin'] }, // ServerCog replaced with Settings for now or import nicely
    { href: '/dashboard/integrations', label: 'Integrations', icon: Bolt, roles: ['owner', 'admin'] },
    { href: '/dashboard/whatsapp-pay', label: 'WhatsApp Pay', icon: CreditCard, roles: ['owner', 'admin'] },
    { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'] },
    { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'] },
    { href: '/dashboard/settings', label: 'Project Settings', icon: Settings, roles: ['owner', 'admin'] },
];

export const crmMenuItems: MenuItem[] = [
    { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
    {
        href: "/dashboard/crm/sales",
        label: "Sales",
        icon: Handshake,
        subItems: [
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects" },
            { href: "/dashboard/crm/sales/quotations", label: "Quotation & Estimates" },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices" },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices" },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts" },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders" },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans" },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes" },
        ]
    },
    {
        href: "/dashboard/crm/purchases",
        label: 'Purchases',
        icon: ShoppingBag,
        subItems: [
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers" },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses" },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders" },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts" },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes" },
        ]
    },
    {
        href: '/dashboard/crm/inventory',
        label: 'Inventory',
        icon: Briefcase,
        subItems: [
            { href: "/dashboard/crm/inventory/items", label: "All Items" },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses" },
            { href: "/dashboard/crm/inventory/pnl", label: "Product-wise P&L" },
            { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report" },
            { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report" },
            { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions Report" },
            { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions Report" },
        ]
    },
    {
        href: "/dashboard/crm/accounting",
        label: "Accounting",
        icon: Database, // Replaced React.Fragment with Database
        subItems: [
            { href: "/dashboard/crm/accounting/groups", label: "Account Groups" },
            { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts" },
            { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books" },
            { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet" },
            { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance" },
            { href: "/dashboard/crm/accounting/pnl", label: "Profit and Loss" },
            { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement" },
            { href: "/dashboard/crm/accounting/day-book", label: "Day Book" },
            { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement" },
        ]
    },
    {
        href: "/dashboard/crm/sales-crm",
        label: "Sales CRM",
        icon: BarChart2,
        subItems: [
            { href: "/dashboard/crm/sales-crm/all-leads", label: "Leads & Contacts" },
            { href: "/dashboard/crm/deals", label: "Deals Pipeline" },
            { href: "/dashboard/crm/tasks", label: "Tasks" },
            { href: "/dashboard/crm/automations", label: "Automations" },
            { href: "/dashboard/crm/sales-crm/pipelines", label: "Manage Pipelines" },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms" },
            { href: "/dashboard/crm/analytics", label: "Analytics" },
            { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary" },
            { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report" },
            { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report" },
            { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report" },
        ]
    },
    {
        href: "/dashboard/crm/banking",
        label: "Bank & Payments",
        icon: Landmark,
        subItems: [
            { href: "/dashboard/crm/banking/all", label: "All Payment Accounts" },
            { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts" },
            { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts" },
            { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation" },
        ]
    },
    {
        href: "/dashboard/crm/hr-payroll",
        label: "HR & Payroll",
        icon: UsersIcon,
        subItems: [
            {
                href: 'hr-employee-management', // Dummy href for grouping
                label: 'Employee Management',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/employees", label: "Employee Directory" },
                    { href: "/dashboard/crm/hr-payroll/employees/new", label: "Add Employee" },
                    { href: "/dashboard/crm/hr-payroll/departments", label: "Departments" },
                    { href: "/dashboard/crm/hr-payroll/designations", label: "Designations" },
                ],
            },
            {
                href: 'hr-attendance',
                label: 'Attendance & Leave',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/attendance", label: "Daily Attendance" },
                    { href: "/dashboard/crm/hr-payroll/leave", label: "Leave Management" },
                    { href: "/dashboard/crm/hr-payroll/holidays", label: "Holiday List" },
                ],
            },
            {
                href: 'hr-payroll',
                label: 'Payroll Management',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/payroll", label: "Generate Payroll" },
                    { href: "/dashboard/crm/hr-payroll/salary-structure", label: "Salary Structure" },
                    { href: "/dashboard/crm/hr-payroll/payslips", label: "Payslips" },
                ],
            },
            {
                href: 'hr-compliance',
                label: 'Statutory Compliance',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/pf-esi", label: "PF / ESI Management" },
                    { href: "/dashboard/crm/hr-payroll/professional-tax", label: "Professional Tax" },
                    { href: "/dashboard/crm/hr-payroll/tds", label: "TDS" },
                    { href: "/dashboard/crm/hr-payroll/form-16", label: "Form 16" },
                ],
            },
            {
                href: 'hr-performance',
                label: 'Performance & Appraisal',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/goal-setting", label: "Goal Setting" },
                    { href: "/dashboard/crm/hr-payroll/kpi-tracking", label: "KPI Tracking" },
                    { href: "/dashboard/crm/hr-payroll/appraisal-reviews", label: "Appraisal Reviews" },
                ],
            },
            {
                href: 'hr-reports',
                label: 'Reports & Analytics',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/reports/attendance", label: "Attendance Report" },
                    { href: "/dashboard/crm/hr-payroll/reports/leave", label: "Leave Report" },
                    { href: "/dashboard/crm/hr-payroll/reports/payroll-summary", label: "Payroll Summary" },
                    { href: "/dashboard/crm/hr-payroll/reports/salary-register", label: "Salary Register" },
                ],
            },
            {
                href: 'hr-settings',
                label: 'HRM Settings',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/settings", label: "All Settings" },
                ],
            }
        ],
    },
    {
        href: "/dashboard/crm/reports",
        label: "GST Reports",
        icon: BookCopy, // Replaced React.Fragment with BookCopy
        subItems: [
            { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report" },
            { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report" },
        ]
    },
    { href: "/dashboard/crm/integrations", label: "Integrations", icon: Bolt },
    { href: "/dashboard/crm/settings", label: "CRM Settings", icon: Settings },
];

export const teamMenuItems: MenuItem[] = [
    { href: "/dashboard/team/manage-users", label: "Manage Users", icon: UsersIcon },
    { href: "/dashboard/team/manage-roles", label: "Manage Roles", icon: ShieldCheck },
    { href: "/dashboard/team/team-chat", label: "Team Chat", icon: MessageSquare },
];

export const sabChatMenuItems: MenuItem[] = [
    { href: '/dashboard/sabchat/inbox', label: 'Inbox', icon: Inbox },
    { href: '/dashboard/sabchat/visitors', label: 'Live Visitors', icon: Users },
    { href: '/dashboard/sabchat/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/sabchat/widget', label: 'Widget Setup', icon: Wrench },
    { href: '/dashboard/sabchat/auto-reply', label: 'Auto Reply', icon: Bot },
    { href: '/dashboard/sabchat/quick-replies', label: 'Quick Replies', icon: LifeBuoy },
    { href: '/dashboard/sabchat/ai-replies', label: 'AI Replies', icon: Bot },
    { href: '/dashboard/sabchat/faq', label: 'FAQ', icon: HelpCircle },
    { href: '/dashboard/sabchat/settings', label: 'Settings', icon: Settings },
];

export const facebookMenuGroups: MenuGroup[] = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/facebook/all-projects', label: 'Project Connections', icon: Wrench },
            { href: '/dashboard/facebook', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/facebook/posts', label: 'Posts', icon: Newspaper },
            { href: '/dashboard/facebook/scheduled', label: 'Scheduled', icon: Calendar },
            { href: '/dashboard/facebook/live-studio', label: 'Live Studio', icon: Video },
            { href: '/dashboard/facebook/post-randomizer', label: 'Post Randomizer', icon: Repeat },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/facebook/messages', label: 'Messages', icon: MessageSquare },
            { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: FolderKanban },
            { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: Bot },
        ]
    },
    {
        title: 'Custom Shops',
        items: [
            { href: '/dashboard/facebook/custom-ecommerce', label: 'Shops Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Meta Commerce',
        items: [
            { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag },
            { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutDashboard },
            { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package },
        ]
    }
];

export const instagramMenuGroups: MenuGroup[] = [
    {
        title: 'General',
        items: [
            { href: '/dashboard/instagram/connections', label: 'Connections', icon: Wrench },
            { href: '/dashboard/instagram', label: 'Dashboard', icon: LayoutDashboard },
        ],
    },
    {
        title: 'Content',
        items: [
            { href: '/dashboard/instagram/feed', label: 'Feed', icon: Newspaper },
            { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard },
            { href: '/dashboard/instagram/reels', label: 'Reels', icon: Video },
        ],
    },
    {
        title: 'Engagement',
        items: [
            { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare },
        ]
    },
    {
        title: 'Growth',
        items: [
            { href: '/dashboard/instagram/discovery', label: 'Discovery', icon: Compass },
            { href: '/dashboard/instagram/hashtag-search', label: 'Hashtag Search', icon: Search },
        ]
    }
];

export const adManagerMenuItems: MenuItem[] = [
    { href: '/dashboard/ad-manager/ad-accounts', label: 'Ad Accounts', icon: Wrench },
    { href: '/dashboard/ad-manager/campaigns', label: 'Campaigns', icon: Megaphone },
    { href: '/dashboard/ad-manager/audiences', label: 'Audiences', icon: Users },
];

export const emailMenuItems: MenuItem[] = [
    { href: '/dashboard/email', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/email/inbox', label: 'Inbox', icon: Inbox },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/email/templates', label: 'Templates', icon: BookCopy }, // Replaced React.Fragment with BookCopy
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings },
];

export const smsMenuItems: MenuItem[] = [
    { href: '/dashboard/sms', label: 'Dashboard', icon: LayoutDashboard },
    {
        href: "/dashboard/sms/dlt",
        label: "DLT Management",
        icon: Database, // Replaced React.Fragment with Database
        subItems: [
            { href: "/dashboard/sms/dlt", label: "Connect DLT Account" },
            { href: "/dashboard/sms/entity-management", label: "Entity Management" },
            { href: "/dashboard/sms/header-management", label: "Header Management" },
            { href: "/dashboard/sms/template-management", label: "Template Management" },
        ]
    },
    {
        href: "/dashboard/sms/messaging",
        label: "Messaging",
        icon: MessageSquare,
        subItems: [
            { href: "/dashboard/sms/campaigns", label: "Send SMS" },
            { href: "/dashboard/sms/message-history", label: "Message History" },
            { href: "/dashboard/sms/delivery-reports", label: "Delivery Reports" },
        ]
    },
    { href: '/dashboard/sms/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/sms/integrations', label: 'Integrations', icon: Bolt },
    { href: '/dashboard/sms/settings', label: 'Settings', icon: Settings },
];

export const apiMenuItems: MenuItem[] = [
    { href: '/dashboard/api', label: 'API Keys', icon: Key },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy },
];

export const sabflowMenuItems: MenuItem[] = [
    { href: '/dashboard/sabflow/flow-builder', label: 'Flow Builder', icon: GitFork },
    { href: '/dashboard/sabflow/docs', label: 'Documentation', icon: BookCopy },
];

export const urlShortenerMenuItems: MenuItem[] = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings },
];

export const qrCodeMakerMenuItems: MenuItem[] = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings },
];

export const portfolioMenuItems: MenuItem[] = [
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutDashboard },
];

export const seoMenuItems: MenuItem[] = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
];

export const userSettingsItems: MenuItem[] = [
    { href: '/dashboard/user/settings/profile', label: 'Profile', icon: UsersIcon }, // UserIcon
    { href: '/dashboard/user/settings/ui', label: 'UI Preferences', icon: Brush },
    { href: '/dashboard/user/billing', label: 'Billing & Plans', icon: CreditCard },
];
