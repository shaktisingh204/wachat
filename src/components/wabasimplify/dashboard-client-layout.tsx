
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake, Building, Mail, Zap, FolderKanban, Repeat, Inbox, Package, Compass, Search, Star, Video, Bot, ShieldCheck, Key, BookCopy, Rss, ChevronsUpDown, TrendingUp, PanelLeft, Sparkles, ChevronRight, Calendar, Database, User as UserIcon, Wrench, Newspaper, Clapperboard, Pencil, BarChart2, Globe, Landmark, Users as UsersIcon, LifeBuoy, HelpCircle} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, InstagramIcon, SabChatIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getProjects } from '@/lib/actions/user.actions'
import { getSession } from '@/app/actions/index.ts';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import type { Plan, WithId, Project, User } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Drawer, DrawerTrigger } from '../ui/drawer';
import { ProjectProvider, useProject } from '@/context/project-context';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '../ui/separator';

const wachatMenuItems = [
  { href: '/dashboard', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'] },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'] },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, roles: ['owner', 'admin'] },
  { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'] },
  { href: '/dashboard/calls', label: 'Calls', icon: Phone, roles: ['owner', 'admin'] },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'] },
  { href: '/dashboard/flows', label: 'Meta Flows', beta: true, icon: ServerCog, roles: ['owner', 'admin'] },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'] },
  { href: '/dashboard/whatsapp-pay', label: 'WhatsApp Pay', icon: CreditCard, roles: ['owner', 'admin'] },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'] },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'] },
  { href: '/dashboard/settings', label: 'Project Settings', icon: Settings, roles: ['owner', 'admin'] },
];

const crmMenuItems = [
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
        icon: Database,
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
                label: 'Employee Management',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/employees", label: "Employee Directory" },
                    { href: "/dashboard/crm/hr-payroll/employees/new", label: "Add Employee" },
                    { href: "/dashboard/crm/hr-payroll/departments", label: "Departments" },
                    { href: "/dashboard/crm/hr-payroll/designations", label: "Designations" },
                ],
            },
            {
                label: 'Attendance & Leave',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/attendance", label: "Daily Attendance" },
                    { href: "/dashboard/crm/hr-payroll/leave", label: "Leave Management" },
                    { href: "/dashboard/crm/hr-payroll/holidays", label: "Holiday List" },
                ],
            },
             {
                label: 'Payroll Management',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/payroll", label: "Generate Payroll" },
                    { href: "/dashboard/crm/hr-payroll/salary-structure", label: "Salary Structure" },
                    { href: "/dashboard/crm/hr-payroll/payslips", label: "Payslips" },
                ],
            },
            {
                label: 'Statutory Compliance',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/pf-esi", label: "PF / ESI Management" },
                    { href: "/dashboard/crm/hr-payroll/professional-tax", label: "Professional Tax" },
                    { href: "/dashboard/crm/hr-payroll/tds", label: "TDS" },
                    { href: "/dashboard/crm/hr-payroll/form-16", label: "Form 16" },
                ],
            },
            {
                label: 'Performance & Appraisal',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/goal-setting", label: "Goal Setting" },
                    { href: "/dashboard/crm/hr-payroll/kpi-tracking", label: "KPI Tracking" },
                    { href: "/dashboard/crm/hr-payroll/appraisal-reviews", label: "Appraisal Reviews" },
                ],
            },
            {
                label: 'Reports & Analytics',
                subSubItems: [
                    { href: "/dashboard/crm/hr-payroll/reports/attendance", label: "Attendance Report" },
                    { href: "/dashboard/crm/hr-payroll/reports/leave", label: "Leave Report" },
                    { href: "/dashboard/crm/hr-payroll/reports/payroll-summary", label: "Payroll Summary" },
                    { href: "/dashboard/crm/hr-payroll/reports/salary-register", label: "Salary Register" },
                ],
            },
            {
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
        icon: FileText,
        subItems: [
            { href: "/dashboard/crm/reports/gstr-1", label: "GSTR-1 Sales Report" },
            { href: "/dashboard/crm/reports/gstr-2b", label: "GSTR-2B Purchase Report" },
        ]
    },
    { href: "/dashboard/crm/integrations", label: "Integrations", icon: Zap },
    { href: "/dashboard/crm/settings", label: "CRM Settings", icon: Settings },
];

const teamMenuItems = [
    { href: "/dashboard/team/manage-users", label: "Manage Users", icon: UsersIcon },
    { href: "/dashboard/team/manage-roles", label: "Manage Roles", icon: ShieldCheck },
    { href: "/dashboard/team/team-chat", label: "Team Chat", icon: MessageSquare },
];

const sabChatMenuItems = [
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


const facebookMenuGroups = [
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
      { href: '/dashboard/facebook/custom-ecommerce/manage/[shopId]/website-builder', label: 'Website Builder', icon: Brush },
    ],
  },
  {
    title: 'Meta Commerce',
    items: [
        { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag },
        { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutDashboard },
        { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package },
    ]
  },
  {
    title: 'Growth Tools',
    items: [
        { href: '/dashboard/facebook/ads', label: 'Ads Manager', icon: Megaphone },
        { href: '/dashboard/facebook/broadcasts', label: 'Broadcasts', icon: Send },
        { href: '/dashboard/facebook/subscribers', label: 'Subscribers', icon: Users },
    ]
  }
];

const instagramMenuGroups = [
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

const emailMenuItems = [
    { href: '/dashboard/email', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/email/inbox', label: 'Inbox', icon: Inbox },
    { href: '/dashboard/email/campaigns', label: 'Campaigns', icon: Send },
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/email/templates', label: 'Templates', icon: FileText },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings },
];

const smsMenuItems = [
    { href: '/dashboard/sms', label: 'Dashboard', icon: LayoutDashboard },
    {
        href: "/dashboard/sms/dlt",
        label: "DLT Management",
        icon: Database,
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
    { href: '/dashboard/sms/integrations', label: 'Integrations', icon: Zap },
    { href: '/dashboard/sms/settings', label: 'Settings', icon: Settings },
];

const apiMenuItems = [
    { href: '/dashboard/api', label: 'API Keys', icon: Key },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy },
];

const sabflowMenuItems = [
    { href: '/dashboard/sabflow/flow-builder', label: 'Flow Builder', icon: GitFork },
    { href: '/dashboard/sabflow/docs', label: 'Documentation', icon: BookCopy },
];

const urlShortenerMenuItems = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings },
];

const qrCodeMakerMenuItems = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings },
];

const portfolioMenuItems = [
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutDashboard },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
];

const userSettingsItems = [
    { href: '/dashboard/user/settings/profile', label: 'Profile', icon: UserIcon },
    { href: '/dashboard/user/settings/ui', label: 'UI Preferences', icon: Brush },
    { href: '/dashboard/user/billing', label: 'Billing & Plans', icon: CreditCard },
];

const FullPageSkeleton = () => (
    <div className="flex h-screen w-screen bg-background p-2 gap-2">
        <div className="w-16 rounded-lg bg-card p-2"><Skeleton className="h-full w-full"/></div>
        <div className="w-60 rounded-lg bg-card p-2"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col gap-2">
            <div className="h-16 rounded-lg bg-card p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 rounded-lg bg-card p-4"><Skeleton className="h-full w-full"/></div>
        </div>
    </div>
);

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const { 
        activeProject,
        activeProjectName,
        sessionUser,
    } = useProject();
    
    const pathname = usePathname();
    const [activeApp, setActiveApp] = React.useState('whatsapp');
    const [isSparklesEnabled, setIsSparklesEnabled] = React.useState(false);
    const appRailPosition = sessionUser?.appRailPosition || 'left';

    React.useEffect(() => {
        getDiwaliThemeStatus().then(status => setIsSparklesEnabled(status.enabled));

        let currentApp = 'whatsapp';
        if (pathname.startsWith('/dashboard/sabflow')) { currentApp = 'sabflow'; }
        else if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
        else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
        else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
        else if (pathname.startsWith('/dashboard/team')) { currentApp = 'team'; }
        else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
        else if (pathname.startsWith('/dashboard/sms')) { currentApp = 'sms'; }
        else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
        else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
        else if (pathname.startsWith('/dashboard/sabchat')) { currentApp = 'sabchat'; }
        else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
        else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
        else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
        else if (pathname.startsWith('/dashboard/user')) { currentApp = 'user-settings'; }
        else if (pathname.startsWith('/dashboard/settings')) { currentApp = 'whatsapp'; } // Treat Wachat settings as part of whatsapp
        setActiveApp(currentApp);
    }, [pathname]);

    const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban') || pathname.startsWith('/dashboard/sabchat/inbox');
    const isBuilderPage = pathname.includes('/builder');
  
    const currentUserRole = React.useMemo(() => {
        if (!sessionUser || !activeProject) return 'owner'; 
        if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
        const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id.toString());
        return agentInfo?.role || 'none';
    }, [sessionUser, activeProject]);

    const appIcons = [
        { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat', href: '/dashboard' },
        { id: 'sabchat', icon: SabChatIcon, label: 'sabChat', href: '/dashboard/sabchat' },
        { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
        { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
        { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM' },
        { id: 'sabflow', icon: GitFork, label: 'SabFlow', href: '/dashboard/sabflow' },
        { id: 'team', icon: Users, label: 'Team', href: '/dashboard/team' },
        { id: 'email', icon: Mail, label: 'Email', href: '/dashboard/email' },
        { id: 'sms', icon: MessageSquare, label: 'SMS', href: '/dashboard/sms' },
        { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
        { id: 'website-builder', icon: Brush, label: 'Website', href: '/dashboard/website-builder' },
        { id: 'url-shortener', icon: LinkIcon, label: 'Links', href: '/dashboard/url-shortener' },
        { id: 'qr-code-maker', icon: QrCode, label: 'QR Codes', href: '/dashboard/qr-code-maker' },
        { id: 'seo-suite', icon: SeoIcon, label: 'SEO', href: '/dashboard/seo' },
    ];
  
    const mainContent = (
        <div className="p-4 md:p-6 lg:p-8 h-full">
            {children}
        </div>
    );

    const SidebarItem = ({ item, isSubItem = false }: { item: any; isSubItem?: boolean }) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const LinkIcon = item.icon;
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={cn(isSubItem && "pl-10")}>
                    <Link href={item.href}>{LinkIcon && <LinkIcon />}<span>{item.label}</span>{item.new && <Badge className="ml-auto">New</Badge>}</Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    const CollapsibleSidebarItem = ({ item }: { item: any }) => {
        const isOpen = pathname.startsWith(item.href || item.label);
        const Icon = item.icon;
        return (
            <Collapsible defaultOpen={isOpen}>
                <CollapsibleTrigger asChild>
                     <SidebarMenuButton isActive={isOpen} tooltip={item.label} className="w-full">
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90"/>
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <SidebarMenu className="pl-4">
                        {(item.subItems || item.subSubItems || []).map((subItem: any, index: number) => 
                            subItem.subSubItems ? (
                                <CollapsibleSidebarItem key={subItem.label || index} item={subItem} />
                            ) : (
                                <SidebarItem key={subItem.href || index} item={subItem} isSubItem={true} />
                            )
                        )}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        )
    }

    const AppRail = () => (
        <Sidebar className="w-16 bg-sidebar-background border-sidebar-border">
            <SidebarHeader>
                <SabNodeLogo className="w-8 h-8" />
            </SidebarHeader>
            <SidebarContent>
                <SidebarMenu>
                    {appIcons.map(app => (
                        <SidebarMenuItem key={app.id}>
                            <SidebarMenuButton asChild isActive={activeApp === app.id} tooltip={app.label}>
                                <Link href={app.href} className="h-12"><app.icon /></Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarContent>
             <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="User Settings">
                            <Link href="/dashboard/user/settings">
                                <Settings className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
    
    const HeaderAppRail = () => (
        <nav className="hidden items-center gap-1 md:flex">
           {appIcons.map(app => (
                <Button key={app.id} asChild variant={activeApp === app.id ? 'secondary' : 'ghost'} size="sm">
                    <Link href={app.href} className="flex items-center gap-2">
                        <app.icon className="h-4 w-4"/>
                        {app.label}
                    </Link>
                </Button>
           ))}
        </nav>
    );

    return (
        <SidebarProvider>
            <div className={cn("admin-dashboard flex h-screen w-full flex-col bg-muted/30", appRailPosition === 'top' ? 'app-rail-top' : 'app-rail-left')}>
                <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background px-4">
                    <div className="flex items-center gap-2">
                         <SidebarTrigger>
                            <Button variant="ghost" size="icon" className="md:hidden">
                                <PanelLeft />
                            </Button>
                        </SidebarTrigger>
                        <Link href="/dashboard" className="hidden font-bold sm:inline-block">
                          SabNode
                        </Link>
                        {appRailPosition === 'top' && (
                            <>
                                <Separator orientation="vertical" className="h-6 mx-2 hidden md:block" />
                                <HeaderAppRail />
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="font-medium text-sm hidden md:block">{activeProjectName}</div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                <Avatar>
                                    <AvatarImage src={sessionUser?.image || `https://i.pravatar.cc/150?u=${sessionUser?.email}`} data-ai-hint="person avatar"/>
                                    <AvatarFallback>{sessionUser?.name?.charAt(0) || 'U'}</AvatarFallback>
                                </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                <DropdownMenuSeparator/>
                                <DropdownMenuItem asChild><Link href="/dashboard/user/settings/profile">Profile</Link></DropdownMenuItem>
                                <DropdownMenuItem asChild><Link href="/dashboard/user/billing">Billing</Link></DropdownMenuItem>
                                <DropdownMenuSeparator/>
                                <DropdownMenuItem asChild><Link href="/api/auth/logout"><LogOut className="mr-2 h-4 w-4"/>Logout</Link></DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>

                <div className="flex flex-1 overflow-hidden">
                    {appRailPosition === 'left' && <AppRail />}
                    <Sidebar className={cn("hidden md:flex")}>
                        <SidebarHeader>
                            {/* Can be used for project switcher */}
                        </SidebarHeader>
                        <SidebarContent>
                        {activeApp === 'whatsapp' && (
                            <SidebarMenu>
                                {wachatMenuItems.filter(item => item.roles.includes(currentUserRole) && !item.href.includes('[')).map((item) => (
                                    <SidebarItem key={item.href} item={item} />
                                ))}
                            </SidebarMenu>
                        )}
                        {activeApp === 'sabchat' && (
                            <SidebarMenu>
                                {sabChatMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'sabflow' && (
                            <SidebarMenu>
                                {sabflowMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'facebook' && (
                            <SidebarMenu>
                            {facebookMenuGroups.map(group => (
                                <React.Fragment key={group.title}>
                                <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-4 mb-1">{group.title}</p>
                                {group.items.filter(item => !item.href.includes('[')).map(item => (
                                    <SidebarItem key={item.href} item={item} />
                                ))}
                                </React.Fragment>
                            ))}
                            </SidebarMenu>
                        )}
                        {activeApp === 'instagram' && (
                            <SidebarMenu>
                                {instagramMenuGroups.flatMap(g => g.items).filter(item => !item.href.includes('[')).map(item => (
                                    <SidebarItem key={item.href} item={item} />
                                ))}
                            </SidebarMenu>
                        )}
                        {activeApp === 'crm' && (
                            <SidebarMenu>
                                {crmMenuItems.map(item => item.subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                         {activeApp === 'team' && (
                            <SidebarMenu>
                                {teamMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'email' && (
                            <SidebarMenu>
                                {emailMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                         {activeApp === 'sms' && (
                            <SidebarMenu>
                                {smsMenuItems.map(item => item.subItems ? <CollapsibleSidebarItem key={item.href} item={item} /> : <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'api' && (
                            <SidebarMenu>
                                {apiMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'website-builder' && (
                            <SidebarMenu>
                                {portfolioMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'url-shortener' && (
                            <SidebarMenu>
                                {urlShortenerMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'qr-code-maker' && (
                            <SidebarMenu>
                                {qrCodeMakerMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'seo-suite' && (
                            <SidebarMenu>
                                {seoMenuItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        {activeApp === 'user-settings' && (
                             <SidebarMenu>
                                {userSettingsItems.map(item => <SidebarItem key={item.href} item={item} />)}
                            </SidebarMenu>
                        )}
                        </SidebarContent>
                    </Sidebar>
                    <main className="margin-by-shakti flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
}

// This is the main exported component
export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
    const [isClient, setIsClient] = React.useState(false);
    const [initialData, setInitialData] = React.useState<{ user: any, projects: any[] } | null>(null);
    const router = useRouter();

    React.useEffect(() => {
        setIsClient(true);
        const fetchInitial = async () => {
            try {
                const session = await getSession();
                if (!session?.user) {
                    router.push('/login');
                    return;
                }
                const { projects } = await getProjects() || { projects: [] };
                setInitialData({ user: session.user, projects });
            } catch (error) {
                console.error("Initialization failed:", error);
                router.push('/login');
            }
        };
        fetchInitial();
    }, [router]);

    if (!isClient || !initialData) {
        return <FullPageSkeleton />;
    }

    return (
        <ProjectProvider initialProjects={initialData.projects} user={initialData.user}>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </ProjectProvider>
    );
}

    