
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
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
  SidebarGroupLabel,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Heart, Route, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Palette, Bot, BookCopy, LayoutGrid, Brush, Handshake, Building, Mail, Zap, FolderKanban, Truck, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe, PhoneCall, Compass, Pencil, BookUser, Contact, FileUp, Inbox, ShieldCheck, KeyRound, Search, Plus, Hand, File as FileIcon, Star, BadgeInfo, IndianRupee, FilePlus, X
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, WaPayIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
import type { Plan, WithId, Project, Agent, User } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { Badge } from '@/components/ui/badge';
import { crmMenuItems, pathComponentMap } from '@/app/dashboard/crm/layout';
import { Suspense } from 'react';


function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen">
        <div className="hidden md:flex w-16 border-r p-2"><Skeleton className="h-full w-full"/></div>
        <div className="w-72 border-r p-2 hidden md:block"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
}

const wachatMenuItems = [
  { href: '/dashboard', label: 'All Projects', icon: Briefcase, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, roles: ['owner', 'admin'] },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, roles: ['owner', 'admin', 'agent'] },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, roles: ['owner', 'admin'] },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, roles: ['owner', 'admin'] },
  { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag, roles: ['owner', 'admin'] },
  { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall, roles: ['owner', 'admin'] },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'] },
  { href: '/dashboard/flows', label: 'Meta Flows', beta: true, icon: ServerCog, roles: ['owner', 'admin'] },
  { href: '/dashboard/integrations', label: 'Integrations', icon: Zap, roles: ['owner', 'admin'] },
  { href: '/dashboard/whatsapp-pay', label: 'WhatsApp Pay', icon: WaPayIcon, roles: ['owner', 'admin'] },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, roles: ['owner', 'admin'] },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, roles: ['owner', 'admin'] },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, roles: ['owner', 'admin'] },
  { href: '/dashboard/notifications', label: 'Notifications', icon: History, roles: ['owner', 'admin'] },
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
        { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: LayoutGrid },
        { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: Bot },
    ]
  },
  {
    title: 'AI & Automation',
    items: [
        { href: '/dashboard/facebook/agents', label: 'AI Agents', icon: Bot },
        { href: '/dashboard/facebook/knowledge', label: 'Knowledge Base', icon: BookCopy },
    ]
  },
   {
    title: 'Custom Shops',
    items: [
      { href: '/dashboard/facebook/custom-ecommerce', label: 'Shops Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/facebook/custom-ecommerce/products', label: 'Products', icon: ShoppingBag },
      { href: '/dashboard/facebook/custom-ecommerce/orders', label: 'Orders', icon: Package },
      { href: '/dashboard/facebook/custom-ecommerce/appearance', label: 'Appearance', icon: Palette },
      { href: '/dashboard/facebook/custom-ecommerce/flow-builder', label: 'Chat Bot', icon: Bot },
      { href: '/dashboard/facebook/custom-ecommerce/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Meta Commerce',
    items: [
        { href: '/dashboard/facebook/commerce/products', label: 'Products & Collections', icon: ShoppingBag },
        { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutGrid },
        { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package },
        { href: '/dashboard/facebook/commerce/analytics', label: 'Analytics', icon: BarChart },
        { href: '/dashboard/facebook/commerce/api', label: 'APIs', icon: Server },
    ]
  },
  {
    title: 'Growth Tools',
    items: [
        { href: '/dashboard/facebook/ads', label: 'Ads Manager', icon: Megaphone },
        { href: '/dashboard/facebook/broadcasts', label: 'Broadcasts', icon: Send },
        { href: '/dashboard/facebook/subscribers', label: 'Subscribers', icon: Users },
        { href: '/dashboard/facebook/audiences', label: 'Audiences', icon: Users },
    ]
  },
  {
      title: 'Configuration',
      items: [
        { href: '/dashboard/facebook/pages', label: 'All Pages', icon: Newspaper },
        { href: '/dashboard/facebook/webhooks', label: 'Webhooks', icon: Webhook },
        { href: '/dashboard/facebook/settings', label: 'Settings', icon: Settings },
      ]
  }
];

const instagramMenuGroups = [
  {
    title: 'General',
    items: [
      { href: '/dashboard/instagram/connections', label: 'Connections', icon: Wrench },
      { href: '/dashboard/instagram/setup', label: 'Setup', icon: Plus },
      { href: '/dashboard/instagram', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/dashboard/instagram/create-post', label: 'Create Post', icon: Pencil },
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
    { href: '/dashboard/email/contacts', label: 'Contacts', icon: Contact },
    { href: '/dashboard/email/templates', label: 'Templates', icon: FileText },
    { href: '/dashboard/email/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/email/verification', label: 'Verification', icon: ShieldCheck },
    { href: '/dashboard/email/settings', label: 'Settings', icon: Settings },
];

const smsMenuItems = [
    { href: '/dashboard/sms', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/sms/campaigns', label: 'Campaigns', icon: Send },
    { href: '/dashboard/sms/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/sms/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/sms/settings', label: 'Settings', icon: Settings },
];

const apiMenuItems = [
    { href: '/dashboard/api', label: 'API Keys', icon: KeyRound },
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
    { href: '/dashboard/website-builder', label: 'Websites', icon: LayoutGrid },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
];

type Tab = {
    id: string;
    title: string;
    icon: React.ElementType;
    href: string;
    component: React.ComponentType;
};

export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = React.useState<any>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [activeApp, setActiveApp] = React.useState('whatsapp');
  const [isVerifying, setIsVerifying] = React.useState(true);

  const [openTabs, setOpenTabs] = React.useState<Tab[]>([]);
  const [activeTab, setActiveTab] = React.useState<string | null>(null);

  const isWebsiteBuilderPage = pathname.includes('/builder');
  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
  
  React.useEffect(() => {
    const fetchAndSetData = async () => {
      try {
        const session = await getSession();
        if (!session?.user) {
          router.push('/login');
          return;
        }
        setSessionUser(session.user);

        const { projects: fetchedProjects } = await getProjects() || { projects: [] };
        if (!fetchedProjects || fetchedProjects.length === 0) {
            setProjects([]);
            setIsVerifying(false);
            return;
        }
        setProjects(fetchedProjects);

        const storedProjectId = localStorage.getItem('activeProjectId');
        
        let currentApp = 'whatsapp';
        if (pathname.startsWith('/dashboard/facebook')) { currentApp = 'facebook'; }
        else if (pathname.startsWith('/dashboard/instagram')) { currentApp = 'instagram'; }
        else if (pathname.startsWith('/dashboard/crm')) { currentApp = 'crm'; }
        else if (pathname.startsWith('/dashboard/email')) { currentApp = 'email'; }
        else if (pathname.startsWith('/dashboard/sms')) { currentApp = 'sms'; }
        else if (pathname.startsWith('/dashboard/url-shortener')) { currentApp = 'url-shortener'; }
        else if (pathname.startsWith('/dashboard/qr-code-maker')) { currentApp = 'qr-code-maker'; }
        else if (pathname.startsWith('/dashboard/api')) { currentApp = 'api'; }
        else if (pathname.startsWith('/dashboard/seo')) { currentApp = 'seo-suite'; }
        else if (pathname.startsWith('/dashboard/website-builder') || pathname.startsWith('/dashboard/portfolio')) { currentApp = 'website-builder'; }
        setActiveApp(currentApp);

        const projectExists = fetchedProjects.some(p => p._id.toString() === storedProjectId);

        if (pathname === '/dashboard') {
            localStorage.removeItem('activeProjectId');
            localStorage.removeItem('activeProjectName');
            setActiveProjectId(null);
            setActiveProjectName(null);
            setActiveProject(null);
        } else if (storedProjectId && projectExists) {
            setActiveProjectId(storedProjectId);
            const currentActiveProject = fetchedProjects.find(p => p._id.toString() === storedProjectId);
            setActiveProject(currentActiveProject || null);
            setActiveProjectName(currentActiveProject?.name || 'Loading...');
        } else {
            localStorage.removeItem('activeProjectId');
            localStorage.removeItem('activeProjectName');
            setActiveProjectId(null);
            setActiveProjectName('Select a Project');
            setActiveProject(null);
        }
      } catch (error) {
        console.error("Failed to initialize dashboard layout:", error);
        router.push('/login');
      } finally {
        setIsVerifying(false);
      }
    };
    
    fetchAndSetData();
  }, [pathname, router]);
  
  const openTab = (item: { href: string; label: string; icon: React.ElementType, component?: React.ComponentType }) => {
    const tabId = item.href;
    if (!openTabs.some(tab => tab.id === tabId)) {
        if(item.component){
            setOpenTabs(prev => [...prev, { id: tabId, title: item.label, icon: item.icon, href: item.href, component: item.component }]);
        }
    }
    setActiveTab(tabId);
    router.push(item.href, { scroll: false });
  };

  const closeTab = (tabId: string) => {
    const tabIndex = openTabs.findIndex(tab => tab.id === tabId);
    setOpenTabs(prev => prev.filter(tab => tab.id !== tabId));

    if (activeTab === tabId) {
        const nextTab = openTabs[tabIndex - 1] || openTabs[tabIndex + 1] || null;
        setActiveTab(nextTab?.id || null);
        if (nextTab) {
            router.push(nextTab.href, { scroll: false });
        } else {
            router.push('/dashboard', { scroll: false });
        }
    }
  };
  
  React.useEffect(() => {
    // This effect ensures that a tab is opened when the user navigates directly to a URL
    const allMenuItems = [
        ...wachatMenuItems,
        ...emailMenuItems,
        ...smsMenuItems,
        ...apiMenuItems,
        ...urlShortenerMenuItems,
        ...qrCodeMakerMenuItems,
        ...portfolioMenuItems,
        ...seoMenuItems,
        ...facebookMenuGroups.flatMap(g => g.items),
        ...instagramMenuGroups.flatMap(g => g.items),
        ...crmMenuItems.flatMap(g => g.subItems || [g]),
    ];
    
    const matchingItem = allMenuItems.find(item => item.href === pathname);
    const component = pathComponentMap[pathname];

    if (matchingItem && component && !openTabs.some(t => t.id === pathname)) {
        openTab({ ...matchingItem, component });
    }
    
    if (activeTab !== pathname && openTabs.some(t => t.id === pathname)) {
      setActiveTab(pathname);
    }
  }, [pathname]);

  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);

  const currentUserRole = React.useMemo(() => {
    if (!sessionUser || !activeProject) return 'owner'; 
    if (sessionUser._id === activeProject.userId.toString()) return 'owner';
    const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id);
    return agentInfo?.role || 'none';
  }, [sessionUser, activeProject]);

  const menuGroups = React.useMemo(() => {
    let groups: any[];
    let allItems: any[] = [];
    switch (activeApp) {
        case 'facebook': allItems = facebookMenuGroups.flatMap(g => g.items); break;
        case 'instagram': allItems = instagramMenuGroups.flatMap(g => g.items); break;
        case 'crm': allItems = crmMenuItems.flatMap(g => g.subItems || [g]); break;
        case 'email': allItems = emailMenuItems; break;
        case 'sms': allItems = smsMenuItems; break;
        case 'url-shortener': allItems = urlShortenerMenuItems; break;
        case 'qr-code-maker': allItems = qrCodeMakerMenuItems; break;
        case 'api': allItems = apiMenuItems; break;
        case 'seo-suite': allItems = seoMenuItems; break;
        case 'website-builder': allItems = portfolioMenuItems; break;
        default: allItems = wachatMenuItems; break;
    }
    
    const componentMap = { ...pathComponentMap }; // Add other suites' maps
    allItems.forEach(item => {
        if(componentMap[item.href]) item.component = componentMap[item.href];
    });

    switch (activeApp) {
        case 'facebook': groups = facebookMenuGroups; break;
        case 'instagram': groups = instagramMenuGroups; break;
        case 'crm': groups = crmMenuItems.map(item => ({ title: item.label, icon: item.icon, items: item.subItems || [item] })); break;
        case 'email': groups = [{ title: null, items: emailMenuItems }]; break;
        case 'sms': groups = [{ title: null, items: smsMenuItems }]; break;
        case 'url-shortener': groups = [{ title: null, items: urlShortenerMenuItems }]; break;
        case 'qr-code-maker': groups = [{ title: null, items: qrCodeMakerMenuItems }]; break;
        case 'api': groups = [{ title: null, items: apiMenuItems }]; break;
        case 'seo-suite': groups = [{ title: null, items: seoMenuItems }]; break;
        case 'website-builder': groups = [{ title: null, items: portfolioMenuItems }]; break;
        default: groups = [{ title: null, items: wachatMenuItems }]; break;
    }
    
    return groups.map((group: any) => ({
        ...group,
        items: (group.items || []).filter((item: any) => item.roles?.includes(currentUserRole))
    }));
  }, [activeApp, currentUserRole]);

  const appIcons = [
    { id: 'whatsapp', icon: WhatsAppIcon, label: 'Wachat Suite', href: '/dashboard', className: 'bg-green-100 text-green-700', hoverClassName: 'hover:bg-green-100 hover:text-green-700' },
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite', className: 'bg-blue-100 text-blue-700', hoverClassName: 'hover:bg-blue-100 hover:text-blue-700' },
    { id: 'instagram', href: '/dashboard/instagram/connections', icon: InstagramIcon, label: 'Instagram Suite', className: 'bg-purple-100 text-purple-700', hoverClassName: 'hover:bg-purple-100 hover:text-purple-700' },
    { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM Suite', className: 'bg-orange-100 text-orange-700', hoverClassName: 'hover:bg-orange-100 hover:text-orange-700' },
    { id: 'email', icon: Mail, label: 'Email Suite', href: '/dashboard/email', className: 'bg-sky-100 text-sky-700', hoverClassName: 'hover:bg-sky-100 hover:text-sky-700' },
    { id: 'sms', icon: MessageSquare, label: 'SMS Suite', href: '/dashboard/sms', className: 'bg-indigo-100 text-indigo-700', hoverClassName: 'hover:bg-indigo-100 hover:text-indigo-700' },
    { id: 'api', icon: Server, label: 'API & Dev', href: '/dashboard/api', className: 'bg-gray-100 text-gray-700', hoverClassName: 'hover:bg-gray-100 hover:text-gray-700' },
    { id: 'website-builder', icon: Brush, label: 'Website Builder', href: '/dashboard/website-builder', className: 'bg-rose-100 text-rose-700', hoverClassName: 'hover:bg-rose-100 hover:text-rose-700' },
    { id: 'url-shortener', icon: LinkIcon, label: 'URL Shortener', href: '/dashboard/url-shortener', className: 'bg-teal-100 text-teal-700', hoverClassName: 'hover:bg-teal-100 hover:text-teal-700' },
    { id: 'qr-code-maker', icon: QrCode, label: 'QR Code Maker', href: '/dashboard/qr-code-maker', className: 'bg-stone-100 text-stone-700', hoverClassName: 'hover:bg-stone-100 hover:text-stone-700' },
    { id: 'seo-suite', icon: SeoIcon, label: 'SEO Suite', href: '/dashboard/seo', className: 'bg-amber-100 text-amber-700', hoverClassName: 'hover:bg-amber-100 hover:text-amber-700' },
  ];
  
  if (isVerifying) {
      return <FullPageSkeleton />;
  }
  
  if (isWebsiteBuilderPage) {
    return <>{children}</>;
  }

  const renderMenuItems = (items: any[], isSubmenu = false) => {
    return items.map((item: any) => {
        const isActive = activeTab === item.href;
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.label}
            className={isSubmenu ? 'h-8' : ''}
            onClick={() => item.component && openTab(item)}
          >
            <button>
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
              {item.beta && <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Beta</Badge>}
            </button>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });
  };

  const renderGroupedMenuItems = (groups: any[]) => {
    return groups.map((group, groupIndex) => (
      <React.Fragment key={group.title || groupIndex}>
        {group.title && (
          <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:pl-2">
            <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
          </SidebarGroupLabel>
        )}
        
        {group.items && renderMenuItems(group.items, false)}

        {groupIndex < groups.length - 1 && <SidebarSeparator />}
      </React.Fragment>
    ));
  };

  const ActiveComponent = openTabs.find(tab => tab.id === activeTab)?.component;

  return (
      <div data-theme={activeApp}>
        <SidebarProvider>
          <Sidebar
            variant="floating"
            collapsible="offcanvas"
            className="peer"
          >
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-2">
                <SabNodeLogo className="h-6 w-auto shrink-0" />
                <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden truncate">SabNode</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {renderGroupedMenuItems(menuGroups)}
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuButton asChild tooltip="My Account">
                        <button>
                          <Avatar className="size-7">
                            <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                            <AvatarFallback>{sessionUser?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="sr-only">User Account</span>
                        </button>
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start">
                      <DropdownMenuLabel>{sessionUser?.name || 'My Account'}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/profile">Profile</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/billing">Billing</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/billing/history">Billing History</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings">Settings</Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/api/auth/logout">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="flex flex-col h-screen p-2 gap-2">
             <header className="flex h-14 items-center justify-between gap-4 rounded-lg border bg-card px-4">
              <div className="flex-1">
                <div className="flex gap-2">
                  <SidebarTrigger />
                  <div className="flex gap-2 items-center">
                    {appIcons.map(app => (
                        <SidebarMenuButton
                            asChild
                            key={app.id}
                            tooltip={app.label}
                            className={cn(
                                'h-9 w-9 rounded-md transition-colors',
                                activeApp === app.id ? app.className : 'hover:bg-muted'
                            )}
                        >
                            <Link href={app.href} scroll={false}><app.icon className="h-5 w-5"/></Link>
                        </SidebarMenuButton>
                    ))}
                  </div>
                </div>
              </div>
            </header>
            <header className="flex h-16 items-center justify-between gap-4 rounded-lg border bg-card px-4">
              <div className="flex items-center gap-2">
                {activeApp === 'facebook' && isClient && activeProject ? (
                    <FacebookProjectSwitcher projects={facebookProjects} activeProject={activeProject} />
                  ) : (
                    <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                        <Briefcase className="h-4 w-4" />
                        {isVerifying ? (
                            <Skeleton className="h-4 w-32" />
                        ) : (
                            <span className="truncate">{activeProjectName || 'No Project Selected'}</span>
                        )}
                    </div>
                  )}
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                    <CreditCard className="h-4 w-4" />
                    <span>Credits: {sessionUser?.credits?.toLocaleString() || 0}</span>
                  </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                        <AvatarFallback>{sessionUser?.name.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <span className="hidden md:inline">{sessionUser?.name || 'User'}</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{sessionUser?.name || 'My Account'}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/billing">Billing</Link>
                      </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/billing/history">Billing History</Link>
                      </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/settings">Settings</Link>
                      </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/api/auth/logout">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </Link>
                      </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>
            <main className="flex-1 flex flex-col rounded-lg border bg-card overflow-hidden">
                <div className="flex-shrink-0 border-b">
                    <ScrollArea className="w-full whitespace-nowrap">
                        <div className="flex w-max">
                            {openTabs.map(tab => (
                                <div key={tab.id} className={cn("flex items-center border-r transition-colors", activeTab === tab.id ? 'bg-background' : 'bg-muted hover:bg-background/80')}>
                                    <Button variant="ghost" className="h-10 px-3 rounded-none" onClick={() => setActiveTab(tab.id)}>
                                        <tab.icon className="mr-2 h-4 w-4"/> {tab.title}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-sm mr-2" onClick={() => closeTab(tab.id)}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {openTabs.map(tab => (
                        <div key={tab.id} className={cn("h-full w-full", activeTab === tab.id ? 'block' : 'hidden')}>
                            {React.createElement(tab.component, { children })}
                        </div>
                    ))}
                    {openTabs.length === 0 && (
                        <div className="h-full w-full flex items-center justify-center">
                            {children}
                        </div>
                    )}
                </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
  );
}
