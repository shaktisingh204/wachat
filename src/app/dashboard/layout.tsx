
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
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  SidebarSeparator,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Heart, Route, Wrench, Link as LinkIcon, QrCode, Calendar, TrendingUp, Globe, Rss, MessageSquareReply, Repeat, Video, Package, BarChart2, Server, LayoutGrid
} from 'lucide-react';
import { SabNodeBrandLogo, FacebookIcon as FacebookAppIcon, WhatsAppIcon, InstagramIcon, SeoIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getProjectCount, handleLogout, getSession, getProjects } from '@/app/actions';
import { type Plan, type WithId, type Project } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';

function FullPageSkeleton() {
    return (
      <div className="flex h-screen w-screen">
        <div className="hidden md:block w-72 border-r p-2"><Skeleton className="h-full w-full"/></div>
        <div className="flex-1 flex flex-col">
            <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
        </div>
      </div>
    );
}

const wachatMenuItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, featureKey: 'overview' },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, featureKey: 'liveChat' },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, featureKey: 'contacts' },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, featureKey: 'campaigns' },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, featureKey: 'templates' },
  { href: '/dashboard/catalog', label: 'Catalog', icon: ShoppingBag, featureKey: 'catalog' },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, featureKey: 'flowBuilder' },
  { href: '/dashboard/flows', label: 'Meta Flows', icon: ServerCog, featureKey: 'metaFlows' },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, featureKey: 'numbers' },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, featureKey: 'webhooks' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, featureKey: 'settings' },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, featureKey: 'billing' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: History, featureKey: 'notifications' },
];

const facebookMenuGroups = [
  {
    title: 'General',
    items: [
      { href: '/dashboard/facebook/all-projects', label: 'Project Connections', icon: Wrench, featureKey: 'whatsappAds' },
      { href: '/dashboard/facebook', label: 'Dashboard', icon: LayoutDashboard, featureKey: 'whatsappAds' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/dashboard/facebook/posts', label: 'Posts', icon: Newspaper, featureKey: 'whatsappAds' },
      { href: '/dashboard/facebook/scheduled', label: 'Scheduled', icon: Calendar, featureKey: 'whatsappAds' },
      { href: '/dashboard/facebook/live-studio', label: 'Live Studio', icon: Video, featureKey: 'whatsappAds' },
      { href: '/dashboard/facebook/post-randomizer', label: 'Post Randomizer', icon: Repeat, featureKey: 'whatsappAds' },
    ],
  },
  {
    title: 'Engagement',
    items: [
        { href: '/dashboard/facebook/messages', label: 'Messages', icon: MessageSquare, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/kanban', label: 'Kanban Board', icon: LayoutGrid, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/auto-reply', label: 'Automation', icon: MessageSquareReply, featureKey: 'whatsappAds' },
    ]
  },
  {
    title: 'E-Commerce',
    items: [
        { href: '/dashboard/facebook/commerce/products', label: 'Products', icon: ShoppingBag, featureKey: 'ecommerce' },
        { href: '/dashboard/facebook/commerce/collections', label: 'Collections', icon: ShoppingBag, featureKey: 'ecommerce' },
        { href: '/dashboard/facebook/commerce/shop', label: 'Shop Setup', icon: LayoutGrid, featureKey: 'ecommerce' },
        { href: '/dashboard/facebook/commerce/orders', label: 'Orders', icon: Package, featureKey: 'ecommerce' },
        { href: '/dashboard/facebook/commerce/analytics', label: 'Analytics', icon: BarChart2, featureKey: 'ecommerce' },
        { href: '/dashboard/facebook/commerce/api', label: 'APIs', icon: Server, featureKey: 'ecommerce' },
    ]
  },
   {
    title: 'Growth Tools',
    items: [
        { href: '/dashboard/facebook/flow-builder', label: 'Flow Builder', icon: GitFork, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/ads', label: 'Ads Manager', icon: Megaphone, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/subscribers', label: 'Subscribers', icon: Users, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/audiences', label: 'Audiences', icon: Users, featureKey: 'whatsappAds' },
    ]
  },
  {
      title: 'Configuration',
      items: [
        { href: '/dashboard/facebook/pages', label: 'All Pages', icon: Newspaper, featureKey: 'whatsappAds' },
        { href: '/dashboard/facebook/settings', label: 'Settings', icon: Settings, featureKey: 'whatsappAds' },
      ]
  }
];

const instagramMenuItems = [
    { href: '/dashboard/instagram/feed', label: 'Feed', icon: LayoutDashboard, featureKey: 'instagramFeed' },
    { href: '/dashboard/instagram/stories', label: 'Stories', icon: Clapperboard, featureKey: 'instagramStories' },
    { href: '/dashboard/instagram/reels', label: 'Reels', icon: Heart, featureKey: 'instagramReels' },
    { href: '/dashboard/instagram/messages', label: 'Messages', icon: MessageSquare, featureKey: 'instagramMessages' },
];

const urlShortenerMenuItems = [
    { href: '/dashboard/url-shortener', label: 'Shortener', icon: LinkIcon, featureKey: 'urlShortener' },
    { href: '/dashboard/url-shortener/settings', label: 'Settings', icon: Settings, featureKey: 'urlShortener' },
];

const qrCodeMakerMenuItems = [
    { href: '/dashboard/qr-code-maker', label: 'QR Maker', icon: QrCode, featureKey: 'qrCodeMaker' },
    { href: '/dashboard/qr-code-maker/settings', label: 'Settings', icon: Settings, featureKey: 'qrCodeMaker' },
];

const seoMenuItems = [
    { href: '/dashboard/seo', label: 'Dashboard', icon: TrendingUp, featureKey: 'overview' },
    { href: '/dashboard/seo/brand-radar', label: 'Brand Radar', icon: Rss, featureKey: 'overview' },
    { href: '/dashboard/seo/site-explorer', label: 'Site Explorer', icon: Globe, featureKey: 'overview' },
];


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = React.useState<{ name: string; email: string, credits?: number, plan?: WithId<Plan> } | null>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [projectCount, setProjectCount] = React.useState<number | null>(null);
  const [activeApp, setActiveApp] = React.useState('whatsapp');


  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (!isClient) return;

    if (pathname.startsWith('/dashboard/facebook')) {
        setActiveApp('facebook');
    } else if (pathname.startsWith('/dashboard/instagram')) {
        setActiveApp('instagram');
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
    }
  }, [pathname, isClient]);

  React.useEffect(() => {
    if (isClient) {
        getSession().then(session => {
            if(session?.user) {
                setSessionUser(session.user as any);
                getProjectCount().then(setProjectCount);
                getProjects().then(setProjects);
            }
            setIsVerifying(false);
        });
    }
  }, [isClient]);

  React.useEffect(() => {
    if (isClient) {
        const name = localStorage.getItem('activeProjectName');
        const id = localStorage.getItem('activeProjectId');
        setActiveProjectName(name || (id ? 'Loading project...' : 'No Project Selected'));
    }
  }, [pathname, isClient]);

  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');

  if (!isClient || isVerifying) {
      return <FullPageSkeleton />;
  }
  
  const hasNoProjects = projectCount === 0;
  const isSetupPage = pathname.startsWith('/dashboard/setup') || pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/billing') || pathname.startsWith('/dashboard/settings');
  const planFeatures = sessionUser?.plan?.features;

  const menuGroups = activeApp === 'facebook' ? facebookMenuGroups : [{ title: null, items: activeApp === 'instagram' ? instagramMenuItems : activeApp === 'url-shortener' ? urlShortenerMenuItems : activeApp === 'qr-code-maker' ? qrCodeMakerMenuItems : activeApp === 'seo-suite' ? seoMenuItems : wachatMenuItems }];
      
  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);
  const activeProjectId = isClient ? localStorage.getItem('activeProjectId') : null;
  const activeFacebookProject = facebookProjects.find(p => p._id.toString() === activeProjectId);

  return (
    <div data-theme={activeApp}>
    <SidebarProvider>
      <div className="fixed top-2 left-2 bottom-2 z-20 hidden md:flex">
        <div className="flex h-full w-16 flex-col items-center gap-4 rounded-lg border bg-card py-4 shadow-md">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                    href="/dashboard/overview"
                    className={cn(
                        'p-3 mx-2 rounded-lg transition-colors',
                        activeApp === 'whatsapp'
                        ? 'bg-[#25D366] text-white'
                        : 'bg-card text-[#25D366] hover:bg-accent'
                    )}
                    >
                    <WhatsAppIcon className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Wachat Suite</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                    href="/dashboard/facebook/all-projects"
                    className={cn(
                        'p-3 mx-2 rounded-lg transition-colors',
                        activeApp === 'facebook'
                        ? 'bg-blue-600 text-white'
                        : 'bg-card text-blue-600 hover:bg-accent'
                    )}
                    >
                    <FacebookAppIcon className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Meta Suite</TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                    href="/dashboard/instagram/feed"
                    className={cn(
                        'p-3 mx-2 rounded-lg transition-colors',
                        activeApp === 'instagram'
                        ? 'bg-instagram text-white'
                        : 'bg-card text-instagram hover:bg-accent'
                    )}
                    >
                    <InstagramIcon className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Instagram Manager</TooltipContent>
            </Tooltip>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                    href="/dashboard/seo"
                    className={cn(
                        'p-3 mx-2 rounded-lg transition-colors',
                        activeApp === 'seo-suite'
                        ? 'bg-red-600 text-white'
                        : 'bg-card text-red-600 hover:bg-accent'
                    )}
                    >
                    <SeoIcon className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">SEO Suite</TooltipContent>
            </Tooltip>
            <Separator className="w-2/3 my-1 bg-border/50"/>
            <Tooltip>
                <TooltipTrigger asChild>
                     <Link
                        href="/dashboard/url-shortener"
                        className={cn(
                            'p-3 mx-2 rounded-lg transition-colors',
                            activeApp === 'url-shortener'
                            ? 'bg-purple-600 text-white'
                            : 'bg-card text-purple-600 hover:bg-accent'
                        )}
                        >
                        <LinkIcon className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">URL Shortener</TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                     <Link
                        href="/dashboard/qr-code-maker"
                        className={cn(
                            'p-3 mx-2 rounded-lg transition-colors',
                            activeApp === 'qr-code-maker'
                            ? 'bg-orange-500 text-white'
                            : 'bg-card text-orange-500 hover:bg-accent'
                        )}
                        >
                        <QrCode className="h-6 w-6" />
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right">QR Code Maker</TooltipContent>
            </Tooltip>
        </div>
      </div>
      <Sidebar
        variant="floating"
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
            {menuGroups.map((group, groupIndex) => (
              <React.Fragment key={group.title || groupIndex}>
                {group.title && (
                    <SidebarGroupLabel className="group-data-[collapsible=icon]:-mt-2 group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:pl-2">
                        <span className="group-data-[collapsible=icon]:hidden">{group.title}</span>
                    </SidebarGroupLabel>
                )}
                {group.items.map((item) => {
                  const isAllowed = !planFeatures ? true : (planFeatures as any)[item.featureKey] ?? true;
                  const isDisabled = (hasNoProjects && !isSetupPage) || !isAllowed;
                  
                  let tooltipText = item.label;
                  if (hasNoProjects && !isSetupPage) {
                    tooltipText = `${item.label} (connect a project first)`;
                  } else if (!isAllowed) {
                    tooltipText = `${item.label} (Upgrade plan)`;
                  }
                  
                  const isBasePage = 
                        item.href === '/dashboard' ||
                        item.href === '/dashboard/overview' ||
                        item.href === '/dashboard/facebook' ||
                        item.href === '/dashboard/instagram/feed' ||
                        item.href === '/dashboard/url-shortener' ||
                        item.href === '/dashboard/qr-code-maker' ||
                        item.href === '/dashboard/facebook/all-projects' ||
                        item.href === '/dashboard/seo';

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
                          <item.icon />
                          <span>{item.label}</span>
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
            {activeApp !== 'facebook' && activeApp !== 'instagram' && (
                <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="All Projects">
                        <Link href="/dashboard">
                        <Briefcase />
                        <span>All Projects</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            )}
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
                  <DropdownMenuItem asChild><Link href="/dashboard/profile">Profile</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/dashboard/billing">Billing</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/dashboard/billing/history">Billing History</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link href="/dashboard/settings">Settings</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={handleLogout} className="w-full">
                        <button type="submit" className="flex items-center w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </form>
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
                <FacebookProjectSwitcher projects={facebookProjects} activeProject={activeFacebookProject} />
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
                <DropdownMenuItem asChild><Link href="/dashboard/profile">Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/billing">Billing</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/billing/history">Billing History</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/dashboard/settings">Settings</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <form action={handleLogout} className="w-full">
                        <button type="submit" className="flex items-center w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </form>
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
    </SidebarProvider>
    </div>
  );
}
