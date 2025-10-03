
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
  LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Heart, Route, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Palette, Bot, BookCopy, LayoutGrid, Brush, Handshake, Building, Mail, Zap, FolderKanban, Truck, Repeat, Video, Calendar, Package, TrendingUp, Rss, Globe, PhoneCall, Compass, Pencil, BookUser, Contact, FileUp, Inbox, ShieldCheck, KeyRound, Search, Plus, Hand, File as FileIcon, Star, BadgeInfo, IndianRupee, FilePlus
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, WaPayIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
import type { Plan, WithId, Project, Agent } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { Badge } from '@/components/ui/badge';
import { crmMenuItems } from '@/app/dashboard/crm/layout';


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

export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = React.useState<{ _id: string, name: string; email: string, credits?: number, plan?: WithId<Plan> } | null>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [activeApp, setActiveApp] = React.useState('whatsapp');

  const isWebsiteBuilderPage = pathname.includes('/builder');
  const isCrmPage = pathname.startsWith('/dashboard/crm');
  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
  
  React.useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const session = await getSession();
            if (!session?.user) {
                router.push('/login');
                return;
            }
            setSessionUser(session.user as any);

            const { projects: fetchedProjects } = await getProjects() || { projects: [] };
            setProjects(fetchedProjects);

            const storedProjectId = localStorage.getItem('activeProjectId');
            const storedProjectName = localStorage.getItem('activeProjectName');
            const isDashboardHome = pathname === '/dashboard';

            if (isDashboardHome) {
                localStorage.removeItem('activeProjectId');
                localStorage.removeItem('activeProjectName');
                setActiveProjectId(null);
                setActiveProjectName(null);
                setActiveProject(null);
            } else if (storedProjectId) {
                setActiveProjectId(storedProjectId);
                setActiveProjectName(storedProjectName || 'Loading...');
                const currentActiveProject = fetchedProjects.find(p => p._id.toString() === storedProjectId);
                setActiveProject(currentActiveProject || null);
            }

             if (pathname.startsWith('/dashboard/facebook')) {
                setActiveApp('facebook');
            } else if (pathname.startsWith('/dashboard/instagram')) {
                setActiveApp('instagram');
            } else if (pathname.startsWith('/dashboard/crm')) {
                setActiveApp('crm');
            } else if (pathname.startsWith('/dashboard/email')) {
                setActiveApp('email');
            } else if (pathname.startsWith('/dashboard/sms')) {
                setActiveApp('sms');
            } else if (pathname.startsWith('/dashboard/url-shortener')) {
                setActiveApp('url-shortener');
            } else if (pathname.startsWith('/dashboard/qr-code-maker')) {
                setActiveApp('qr-code-maker');
            } else if (pathname.startsWith('/dashboard/api')) {
                setActiveApp('api');
            } else if (pathname.startsWith('/dashboard/seo')) {
                setActiveApp('seo-suite');
            } else if (pathname.startsWith('/dashboard/website-builder')) {
                setActiveApp('website-builder');
            } else {
                setActiveApp('whatsapp');
            }

        } catch (error) {
            console.error("Failed to initialize dashboard layout:", error);
            router.push('/login');
        } finally {
            setIsVerifying(false);
        }
    };
    
    fetchInitialData();
  }, [pathname, router]);

  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);

  const currentUserRole = React.useMemo(() => {
    if (!sessionUser || !activeProject) return 'owner'; 
    if (sessionUser._id === activeProject.userId.toString()) return 'owner';
    const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id);
    return agentInfo?.role || 'none';
  }, [sessionUser, activeProject]);

  const menuGroups = React.useMemo(() => {
    let groups: any[];

    switch (activeApp) {
        case 'facebook':
            groups = facebookMenuGroups.map(group => ({
                ...group,
                items: group.items.map(item => ({ ...item, roles: ['owner', 'admin', 'agent'] }))
            }));
            break;
        case 'instagram':
            groups = instagramMenuGroups.map(group => ({
                ...group,
                items: group.items.map(item => ({ ...item, roles: ['owner', 'admin', 'agent'] }))
            }));
            break;
        case 'crm':
            groups = crmMenuItems.map(item => {
                if (item.subItems) {
                    return {
                        title: item.label,
                        icon: item.icon,
                        items: item.subItems.map(subItem => ({ ...subItem, roles: ['owner', 'admin', 'agent'] }))
                    };
                }
                return {
                    title: null,
                    items: [{ ...item, roles: ['owner', 'admin', 'agent'] }]
                };
            });
            break;
        case 'email':
            groups = [{ title: 'Email Suite', items: emailMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'sms':
            groups = [{ title: 'SMS Suite', items: smsMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'url-shortener':
            groups = [{ title: null, items: urlShortenerMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'qr-code-maker':
            groups = [{ title: null, items: qrCodeMakerMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'api':
            groups = [{ title: null, items: apiMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'seo-suite':
            groups = [{ title: null, items: seoMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        case 'website-builder':
            groups = [{ title: null, items: portfolioMenuItems.map(item => ({...item, roles: ['owner', 'admin', 'agent']})) }];
            break;
        default:
            groups = [{ title: null, items: wachatMenuItems }];
            break;
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
        const isActive = (
            item.href === pathname || 
            (item.href !== '/dashboard' && pathname.startsWith(item.href))
        );
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={item.label}
            className={isSubmenu ? 'h-8' : ''}
          >
            <Link href={item.href} scroll={false}>
              <item.icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
              {item.beta && <Badge variant="secondary" className="ml-auto group-data-[collapsible=icon]:hidden">Beta</Badge>}
            </Link>
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
                    'h-12 w-12 rounded-lg transition-colors',
                    activeApp === app.id ? app.className : app.hoverClassName
                  )}
                >
                  <Link href={app.href} scroll={false}><app.icon className="h-6 w-6" /></Link>
                </SidebarMenuButton>
              ))}
            </div>
          </div>
          <Sidebar
            variant="floating"
            sideOffset="calc(4rem + 8px)"
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
          <SidebarInset sideOffset="calc(4rem + 8px)" className="flex flex-col h-screen p-2 gap-2">
            <header className="flex items-center justify-between p-3 border bg-card rounded-lg shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
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
            <main className={cn(
                "flex-1 flex flex-col h-full rounded-lg border bg-card",
                isChatPage ? "overflow-hidden" : "",
                !isCrmPage && "p-4 md:p-6 lg:p-8 overflow-y-auto"
            )}>
                {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </div>
  );
}
