
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
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Heart, Route, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Palette, Bot, BookCopy, LayoutGrid, Brush, Handshake, Building, Mail, Zap, FolderKanban, Truck, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe
} from 'lucide-react';
import { SabNodeBrandLogo, MetaIcon, WhatsAppIcon, SeoIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
import type { Plan, WithId, Project, Agent } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { Badge } from '@/components/ui/badge';
import { CustomEcommerceIcon, WaPayIcon } from '@/components/wabasimplify/custom-sidebar-components';


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
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, roles: ['owner', 'admin'] },
  { href: '/dashboard/flows', label: 'Meta Flows', icon: ServerCog, beta: true, roles: ['owner', 'admin'] },
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
        { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: MessageSquare },
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

const crmMenuItems = [
    { href: '/dashboard/crm', label: 'CRM Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/crm/contacts', label: 'Leads & Contacts', icon: Users },
    { href: '/dashboard/crm/accounts', label: 'Accounts', icon: Building },
    { href: '/dashboard/crm/deals', label: 'Deals', icon: Handshake },
    { href: '/dashboard/crm/products', label: 'Products', icon: ShoppingBag },
    { href: '/dashboard/crm/inventory', label: 'Inventory', icon: Truck },
    { href: '/dashboard/crm/tasks', label: 'Tasks', icon: FolderKanban },
    { href: '/dashboard/crm/email', label: 'Email', icon: Mail },
    { href: '/dashboard/crm/team-chat', label: 'Team Chat', icon: MessageSquare },
    { href: '/dashboard/crm/analytics', label: 'Analytics', icon: BarChart },
    { href: '/dashboard/crm/automations', label: 'Automations', icon: Zap },
    { href: '/dashboard/crm/settings', label: 'Settings', icon: Settings },
];

const instagramMenuItems = [
    { href: '/dashboard/instagram/feed', label: 'Feed', icon: LayoutDashboard },
    { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard },
    { href: '/dashboard/instagram/reels', label: 'Reels', icon: Heart },
    { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare },
];

const urlShortenerMenuItems = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings },
];

const qrCodeMakerMenuItems = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe },
];

const customEcommerceMenuItems = [
    { href: '/dashboard/facebook/custom-ecommerce', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/facebook/custom-ecommerce/products', label: 'Products', icon: ShoppingBag },
    { href: '/dashboard/facebook/custom-ecommerce/orders', label: 'Orders', icon: Package },
    { href: '/dashboard/facebook/custom-ecommerce/appearance', label: 'Appearance', icon: Palette },
    { href: '/dashboard/facebook/custom-ecommerce/flow-builder', label: 'Chat Bot', icon: Bot },
    { href: '/dashboard/facebook/custom-ecommerce/settings', label: 'Settings', icon: Settings },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = React.useState<{ _id: string, name: string; email: string, credits?: number, plan?: WithId<Plan> } | null>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [activeApp, setActiveApp] = React.useState('whatsapp');

  const isWebsiteBuilderPage = pathname.includes('/website-builder');
  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
  
  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);
  const hasActiveWhatsAppProject = activeProjectId && projects.some(p => p._id.toString() === activeProjectId && p.wabaId);
  const hasActiveFacebookProject = activeProjectId && facebookProjects.some(p => p._id.toString() === activeProjectId);

  const currentUserRole = React.useMemo(() => {
    if (!sessionUser || !activeProject) return 'owner'; 
    if (sessionUser._id === activeProject.userId.toString()) return 'owner';
    const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id);
    return agentInfo?.role || 'none';
  }, [sessionUser, activeProject]);

  const menuGroups = React.useMemo(() => {
    let items: any;
    switch (activeApp) {
        case 'facebook': items = facebookMenuGroups.map(group => ({ ...group, items: group.items.map(item => ({ ...item, roles: ['owner', 'admin', 'agent']}))})); break;
        case 'crm': items = [{ title: 'CRM Tools', items: crmMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }]; break;
        case 'instagram': items = [{ title: null, items: instagramMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }]; break;
        case 'custom-ecommerce': items = [{ title: null, items: customEcommerceMenuItems.map(item => ({ ...item, roles: ['owner', 'admin', 'agent'] })) }]; break;
        case 'url-shortener': items = [{ title: null, items: urlShortenerMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }]; break;
        case 'qr-code-maker': items = [{ title: null, items: qrCodeMakerMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }]; break;
        case 'seo-suite': items = [{ title: null, items: seoMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }]; break;
        default: items = [{ title: null, items: wachatMenuItems }]; break;
    }
    
    return items.map((group: any) => ({
        ...group,
        items: group.items.filter((item: any) => item.roles?.includes(currentUserRole))
    }));
  }, [activeApp, currentUserRole]);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (isClient) {
      const storedProjectId = localStorage.getItem('activeProjectId');
      setActiveProjectId(storedProjectId);

      if (pathname.startsWith('/dashboard/facebook/custom-ecommerce')) {
          setActiveApp('custom-ecommerce');
      } else if (pathname.startsWith('/dashboard/facebook')) {
          setActiveApp('facebook');
      } else if (pathname.startsWith('/dashboard/instagram')) {
          setActiveApp('instagram');
      } else if (pathname.startsWith('/dashboard/crm')) {
          setActiveApp('crm');
      } else if (pathname.startsWith('/dashboard/url-shortener')) {
          setActiveApp('url-shortener');
      } else if (pathname.startsWith('/dashboard/qr-code-maker')) {
          setActiveApp('qr-code-maker');
      } else if (pathname.startsWith('/dashboard/seo')) {
          setActiveApp('seo-suite');
      } else {
          setActiveApp('whatsapp');
      }

      const isDashboardHome = pathname === '/dashboard';
      if (isDashboardHome) {
        localStorage.removeItem('activeProjectId');
        localStorage.removeItem('activeProjectName');
        setActiveProjectId(null);
        setActiveProjectName(null);
      } else {
        const name = localStorage.getItem('activeProjectName');
        setActiveProjectName(name || (storedProjectId ? 'Loading project...' : 'No Project Selected'));
      }
    }
  }, [pathname, isClient]);

  React.useEffect(() => {
    if (isClient) {
        getSession().then(session => {
            if(session?.user) {
                setSessionUser(session.user as any);
                getProjects().then(fetchedProjects => {
                    setProjects(fetchedProjects);
                    if (activeProjectId) {
                        const currentActiveProject = fetchedProjects.find(p => p._id.toString() === activeProjectId);
                        setActiveProject(currentActiveProject || null);
                    } else {
                        setActiveProject(null);
                    }
                });
            }
            setIsVerifying(false);
        });
    }
  }, [isClient, activeProjectId]);

  const appIcons = [
    { id: 'whatsapp', href: '/dashboard', icon: WhatsAppIcon, label: 'Wachat Suite', className: 'bg-[#25D366] text-white', hoverClassName: 'bg-card text-[#25D366] hover:bg-accent' },
    { id: 'facebook', href: '/dashboard/facebook/all-projects', icon: MetaIcon, label: 'Meta Suite', className: 'bg-blue-600 text-white', hoverClassName: 'bg-card text-blue-600 hover:bg-accent' },
    { id: 'custom-ecommerce', href: '/dashboard/facebook/custom-ecommerce', icon: CustomEcommerceIcon, label: 'Custom Ecommerce', className: 'bg-sky-500 text-white', hoverClassName: 'bg-card text-sky-500 hover:bg-accent' },
    { id: 'crm', href: '/dashboard/crm', icon: Handshake, label: 'CRM Suite', className: 'bg-rose-500 text-white', hoverClassName: 'bg-card text-rose-500 hover:bg-accent' },
    { id: 'seo-suite', href: '/dashboard/seo', icon: SeoIcon, label: 'SEO Suite', className: 'bg-indigo-500 text-white', hoverClassName: 'bg-card text-indigo-500 hover:bg-accent' },
    { id: 'url-shortener', href: '/dashboard/url-shortener', icon: LinkIcon, label: 'URL Shortener', className: 'bg-purple-600 text-white', hoverClassName: 'bg-card text-purple-600 hover:bg-accent' },
    { id: 'qr-code-maker', href: '/dashboard/qr-code-maker', icon: QrCode, label: 'QR Code Maker', className: 'bg-orange-500 text-white', hoverClassName: 'bg-card text-orange-500 hover:bg-accent' },
  ];
  
  if (!isClient || isVerifying) {
      return <FullPageSkeleton />;
  }
  
  if (isWebsiteBuilderPage) {
    return <>{children}</>;
  }

  return (
      <div data-theme={activeApp}>
        <SidebarProvider>
          <div className="fixed top-2 left-2 bottom-2 z-20 hidden md:flex">
            <div className="flex h-full w-16 flex-col items-center gap-4 rounded-lg border bg-card py-4 shadow-md">
                {appIcons.map(app => (
                  <SidebarMenuButton
                    asChild
                    key={app.id}
                    tooltip={app.label}
                    className={cn(
                      'p-3 mx-2 rounded-lg transition-colors',
                      activeApp === app.id ? app.className : app.hoverClassName
                    )}
                  >
                    <Link href={app.href}><app.icon className="h-6 w-6" /></Link>
                  </SidebarMenuButton>
                ))}
            </div>
          </div>
          <Sidebar
            sideOffset="calc(4rem + 8px)"
          >
            <SidebarHeader className="p-4">
              <div className="flex items-center gap-2">
                  <SabNodeBrandLogo className="size-8 shrink-0" />
                  <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">SabNode</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {menuGroups.map((group: any, groupIndex: number) => (
                  <React.Fragment key={group.title || groupIndex}>
                    {group.title && (
                        <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-2 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:pl-2">
                            <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
                        </SidebarGroupLabel>
                    )}
                    {group.items.map((item: any) => {
                      const isConnectionLink = item.href.includes('all-projects');
                      const suiteRequiresProject = activeApp === 'facebook' || activeApp === 'whatsapp' || activeApp === 'custom-ecommerce';
                      
                      const hasActiveProjectForSuite = 
                          (activeApp === 'facebook' && hasActiveFacebookProject) ||
                          (activeApp === 'whatsapp' && hasActiveWhatsAppProject) ||
                          (activeApp === 'custom-ecommerce' && hasActiveFacebookProject);

                      const isDisabled = !isConnectionLink && suiteRequiresProject && !hasActiveProjectForSuite && item.href !== '/dashboard' && activeApp !== 'crm';

                      let tooltipText = item.label;
                      if (isDisabled) {
                          tooltipText = `${item.label} (Select a project first)`;
                      }
                      
                      const isBasePage = 
                            item.href === '/dashboard' ||
                            item.href === '/dashboard/overview' ||
                            item.href === '/dashboard/facebook' ||
                            item.href === '/dashboard/instagram/feed' ||
                            item.href === '/dashboard/url-shortener' ||
                            item.href === '/dashboard/qr-code-maker' ||
                            item.href === '/dashboard/facebook/all-projects' ||
                            item.href === '/dashboard/facebook/custom-ecommerce' ||
                            item.href === '/dashboard/chatbot/agents' ||
                            item.href === '/dashboard/seo' ||
                            item.href === '/dashboard/crm';

                      const isActive = isBasePage ? pathname === item.href : pathname.startsWith(item.href);

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={tooltipText}
                            disabled={isDisabled}
                            aria-disabled={isDisabled}
                          >
                            <Link href={isDisabled ? '#' : item.href} className={cn(isDisabled && 'pointer-events-none')}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.label}</span>
                              {item.beta && <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Beta</Badge>}
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                    {group.title && groupIndex < menuGroups.length - 1 && <SidebarSeparator />}
                  </React.Fragment>
                ))}
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
          <SidebarInset sideOffset="calc(4rem + 8px)" className="flex flex-col h-screen p-2 gap-2">
            <header className="flex items-center justify-between p-3 border bg-card rounded-lg shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                {activeApp === 'facebook' && isClient ? (
                    <FacebookProjectSwitcher projects={facebookProjects} activeProject={activeProject} />
                  ) : (
                    <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                        <Briefcase className="h-4 w-4" />
                        {!isClient ? (
                            <Skeleton className="h-4 w-32" />
                        ) : (
                            <span>{activeProjectName}</span>
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
            <main className={cn(
                "flex-1 flex flex-col h-full rounded-lg border bg-card",
                isChatPage ? "overflow-hidden" : "p-4 md:p-6 lg:p-8 overflow-y-auto"
            )}>
                {children}
            </main>
          </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
