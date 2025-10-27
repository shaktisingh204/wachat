
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
    LayoutDashboard, MessageSquare, Globe, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake, Building, Mail, Zap, FolderKanban, Repeat, Inbox, Package, Compass, Search, Star, Video, Bot, ShieldCheck, Key, BookCopy, Rss, ChevronsUpDown, TrendingUp, PanelLeft, Sparkles, ChevronRight, Calendar, Database, User as UserIcon
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, WaPayIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
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
  { href: '/dashboard/whatsapp-pay', label: 'WhatsApp Pay', icon: WaPayIcon, roles: ['owner', 'admin'] },
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
            { href: "/dashboard/crm/sales/clients", label: "Clients & Prospects", icon: Users },
            { href: "/dashboard/crm/sales/quotations", label: "Quotation & Estimates", icon: FileText },
            { href: "/dashboard/crm/sales/proforma", label: "Proforma Invoices", icon: FileText },
            { href: "/dashboard/crm/sales/invoices", label: "Invoices", icon: FileText },
            { href: "/dashboard/crm/sales/receipts", label: "Payment Receipts", icon: CreditCard },
            { href: "/dashboard/crm/sales/orders", label: "Sales Orders", icon: ShoppingBag },
            { href: "/dashboard/crm/sales/delivery", label: "Delivery Challans", icon: Bot },
            { href: "/dashboard/crm/sales/credit-notes", label: "Credit Notes", icon: Repeat },
        ]
    },
    {
        href: "/dashboard/crm/purchases",
        label: 'Purchases',
        icon: ShoppingBag,
        subItems: [
            { href: "/dashboard/crm/purchases/leads", label: "Vendors Leads", icon: Users },
            { href: "/dashboard/crm/purchases/vendors", label: "Vendors & Suppliers", icon: Briefcase },
            { href: "/dashboard/crm/purchases/expenses", label: "Purchases & Expenses", icon: CreditCard },
            { href: "/dashboard/crm/purchases/orders", label: "Purchase Orders", icon: FileText },
            { href: "/dashboard/crm/purchases/payouts", label: "Payout Receipts", icon: CreditCard },
            { href: "/dashboard/crm/purchases/debit-notes", label: "Debit Notes", icon: Repeat },
            { href: "/dashboard/crm/purchases/hire", label: "Hire The Best Vendors", icon: Star },
        ]
    },
    { href: "/dashboard/crm/contacts", label: "Contacts", icon: Users },
    { href: "/dashboard/crm/accounts", label: "Accounts", icon: Building },
    { href: "/dashboard/crm/deals", label: "Deals", icon: Handshake },
    { href: "/dashboard/crm/tasks", label: "Tasks", icon: FolderKanban },
    { href: "/dashboard/crm/products", label: "Products", icon: ShoppingBag },
    { href: "/dashboard/crm/sales/forms", label: "Forms", icon: FileText },
    {
        href: '/dashboard/crm/inventory',
        label: 'Inventory',
        icon: Briefcase,
        subItems: [
            { href: "/dashboard/crm/inventory", label: "Dashboard", icon: LayoutDashboard },
            { href: "/dashboard/crm/inventory/warehouses", label: "Warehouses", icon: Server },
            { href: "/dashboard/crm/inventory/adjustments", label: "Adjustments", icon: Repeat },
        ]
    },
    { href: "/dashboard/crm/automations", label: "Automations", icon: GitFork },
    { href: "/dashboard/crm/analytics", label: "Analytics", icon: BarChart },
    { href: "/dashboard/crm/settings", label: "Settings", icon: Settings },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare },
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
    { href: '/dashboard/sms/integrations', label: 'Integrations', icon: Zap },
    { href: '/dashboard/sms/settings', label: 'Settings', icon: Settings },
];

const apiMenuItems = [
    { href: '/dashboard/api', label: 'API Keys', icon: Key },
    { href: '/dashboard/api/docs', label: 'API Docs', icon: BookCopy },
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
        if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
        else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
        else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
        else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
        else if (pathname.startsWith('/dashboard/sms')) { currentApp = 'sms'; }
        else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
        else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
        else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
        else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
        else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
        else if (pathname.startsWith('/dashboard/user/settings') || pathname.startsWith('/dashboard/user/billing')) { currentApp = 'user-settings'; }
        else if (pathname.startsWith('/dashboard/settings')) { currentApp = 'whatsapp'; } // Treat Wachat settings as part of whatsapp
        setActiveApp(currentApp);
    }, [pathname]);

    const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
    const isWebsiteBuilderPage = pathname.includes('/builder');
  
    const currentUserRole = React.useMemo(() => {
        if (!sessionUser || !activeProject) return 'owner'; 
        if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
        const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id.toString());
        return agentInfo?.role || 'none';
    }, [sessionUser, activeProject]);

    const appIcons = [
        { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat', href: '/dashboard' },
        { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite' },
        { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram' },
        { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM' },
        { id: 'email', icon: Mail, label: 'Email', href: '/dashboard/email' },
        { id: 'sms', icon: MessageSquare, label: 'SMS', href: '/dashboard/sms' },
        { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api' },
        { id: 'website-builder', icon: Brush, label: 'Website', href: '/dashboard/website-builder' },
        { id: 'url-shortener', icon: LinkIcon, label: 'Links', href: '/dashboard/url-shortener' },
        { id: 'qr-code-maker', icon: QrCode, label: 'QR Codes', href: '/dashboard/qr-code-maker' },
        { id: 'seo-suite', icon: SeoIcon, label: 'SEO', href: '/dashboard/seo' },
    ];
  
    const mainContent = (
        <div className="p-4 md:p-6 lg:p-8">
            {children}
        </div>
    );

    const SidebarItem = ({ item, isSubItem = false }: { item: any; isSubItem?: boolean }) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const LinkIcon = item.icon;
        return (
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className={cn(isSubItem && "pl-10")}>
                    <Link href={item.href}>{LinkIcon && <LinkIcon />}<span>{item.label}</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    }

    const CollapsibleSidebarItem = ({ item }: { item: any }) => {
        const isOpen = pathname.startsWith(item.href);
        return (
            <Collapsible defaultOpen={isOpen}>
                <CollapsibleTrigger asChild>
                     <SidebarMenuButton isActive={isOpen} tooltip={item.label} className="w-full">
                        <item.icon /><span>{item.label}</span><ChevronRight className="ml-auto transition-transform group-data-[state=open]:rotate-90"/>
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent asChild>
                    <SidebarMenu className="pl-4">
                        {item.subItems.map((subItem: any) => <SidebarItem key={subItem.href} item={subItem} isSubItem={true} />)}
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
                                <Link href={app.href} className="h-48px"><app.icon /></Link>
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
                                    <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" data-ai-hint="person avatar"/>
                                    <AvatarFallback>{sessionUser?.name.charAt(0) || 'U'}</AvatarFallback>
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
                    <Sidebar className="hidden md:flex">
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
                    <main className="flex-1 overflow-y-auto">
                        {isChatPage || isWebsiteBuilderPage ? children : mainContent}
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
