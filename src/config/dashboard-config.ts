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

export const crmMenuGroups: MenuGroup[] = [
    {
        title: "Overview",
        items: [
            { href: "/dashboard/crm", label: "Dashboard", icon: BarChart, exact: true },
        ]
    },
    {
        title: "Sales",
        items: [
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects", icon: Handshake },
            { href: "/dashboard/crm/sales/quotations", label: "Quotation & Estimates", icon: Handshake },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: Handshake },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: Handshake },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: Handshake },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: Handshake },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Handshake },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Handshake },
        ]
    },
    {
        title: "Purchases",
        items: [
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers", icon: ShoppingBag },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses", icon: ShoppingBag },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders", icon: ShoppingBag },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts", icon: ShoppingBag },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes", icon: ShoppingBag },
        ]
    },
    {
        title: "Inventory",
        items: [
            { href: "/dashboard/crm/inventory/items", label: "All Items", icon: Briefcase },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Briefcase },
            { href: "/dashboard/crm/inventory/pnl", label: "Product-wise P&L", icon: Briefcase },
            { href: "/dashboard/crm/inventory/stock-value", label: "Stock Value Report", icon: Briefcase },
            { href: "/dashboard/crm/inventory/batch-expiry", label: "Batch Expiry Report", icon: Briefcase },
            { href: "/dashboard/crm/inventory/party-transactions", label: "Party Transactions Report", icon: Briefcase },
            { href: "/dashboard/crm/inventory/all-transactions", label: "All Transactions Report", icon: Briefcase },
        ]
    },
    {
        title: "Accounting",
        items: [
            { href: "/dashboard/crm/accounting/groups", label: "Account Groups", icon: Database },
            { href: "/dashboard/crm/accounting/charts", label: "Chart of Accounts", icon: Database },
            { href: "/dashboard/crm/accounting/vouchers", label: "Voucher Books", icon: Database },
            { href: "/dashboard/crm/accounting/balance-sheet", label: "Balance Sheet", icon: Database },
            { href: "/dashboard/crm/accounting/trial-balance", label: "Trial Balance", icon: Database },
            { href: "/dashboard/crm/accounting/pnl", label: "Profit and Loss", icon: Database },
            { href: "/dashboard/crm/accounting/income-statement", label: "Income Statement", icon: Database },
            { href: "/dashboard/crm/accounting/day-book", label: "Day Book", icon: Database },
            { href: "/dashboard/crm/accounting/cash-flow", label: "Cash Flow Statement", icon: Database },
        ]
    },
    {
        title: "Sales CRM",
        items: [
            { href: "/dashboard/crm/sales-crm/all-leads", label: "Leads & Contacts", icon: BarChart2 },
            { href: "/dashboard/crm/deals", label: "Deals Pipeline", icon: BarChart2 },
            { href: "/dashboard/crm/tasks", label: "Tasks", icon: BarChart2 },
            { href: "/dashboard/crm/automations", label: "Automations", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/pipelines", label: "Manage Pipelines", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/forms", label: "Forms", icon: BarChart2 },
            { href: "/dashboard/crm/analytics", label: "Analytics", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/leads-summary", label: "Leads Summary", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/team-sales-report", label: "Team Sales Report", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/client-performance-report", label: "Client Performance Report", icon: BarChart2 },
            { href: "/dashboard/crm/sales-crm/lead-source-report", label: "Lead Source Report", icon: BarChart2 },
        ]
    },
    {
        title: "Banking",
        items: [
            { href: "/dashboard/crm/banking/all", label: "All Payment Accounts", icon: Landmark },
            { href: "/dashboard/crm/banking/bank-accounts", label: "Bank Accounts", icon: Landmark },
            { href: "/dashboard/crm/banking/employee-accounts", label: "Employee Accounts", icon: Landmark },
            { href: "/dashboard/crm/banking/reconciliation", label: "Bank Reconciliation", icon: Landmark },
        ]
    },
    {
        title: "HR & Payroll",
        items: [
            { href: "/dashboard/crm/hr-payroll/employees", label: "Employee Directory", icon: UsersIcon },
            { href: "/dashboard/crm/hr-payroll/employees/new", label: "Add Employee", icon: UsersIcon },
            { href: "/dashboard/crm/hr-payroll/attendance", label: "Attendance", icon: UsersIcon },
            { href: "/dashboard/crm/hr-payroll/payroll", label: "Payroll", icon: UsersIcon },
        ]
    },
    {
        title: "Reports",
        items: [
            { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report", icon: BookCopy },
            { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report", icon: BookCopy },
        ]
    },
    {
        title: "Settings",
        items: [
            { href: "/dashboard/crm/integrations", label: "Integrations", icon: Bolt },
            { href: "/dashboard/crm/settings", label: "CRM Settings", icon: Settings },
        ]
    }
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
