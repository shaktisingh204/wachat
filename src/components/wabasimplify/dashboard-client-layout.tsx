
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
    LayoutDashboard, MessageSquare, Users, Send, GitFork, Settings, Briefcase, ChevronDown, FileText, Phone, Webhook, History, LogOut, CreditCard, LoaderCircle, Megaphone, ServerCog, ShoppingBag, Newspaper, Clapperboard, Wrench, Link as LinkIcon, QrCode, BarChart, Server, Brush, Handshake, Building, Mail, Zap, FolderKanban, Repeat, Inbox, Package, Compass, Search, Calendar, Video, Bot, ShieldCheck, Key, BookCopy, Rss, ChevronsUpDown, TrendingUp, PanelLeft
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { MetaIcon, WhatsAppIcon, SeoIcon, CustomEcommerceIcon, WaPayIcon, InstagramIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { getSession, getProjects } from '@/app/actions';
import { getDiwaliThemeStatus } from '@/app/actions/admin.actions';
import type { Plan, WithId, Project, User } from '@/lib/definitions';
import { FacebookProjectSwitcher } from '@/components/wabasimplify/facebook-project-switcher';
import { crmMenuItems } from '@/app/dashboard/crm/layout';
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
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, roles: ['owner', 'admin'] },
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
    { href: '/dashboard/sms/campaigns', label: 'Campaigns', icon: Send },
    { href: '/dashboard/sms/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/sms/analytics', label: 'Analytics', icon: BarChart },
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

export function DashboardClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  
  const [sessionUser, setSessionUser] = React.useState<any>(null);
  const [projects, setProjects] = React.useState<WithId<Project>[]>([]);
  const [activeProject, setActiveProject] = React.useState<WithId<Project> | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = React.useState<string | null>(null);
  const [activeApp, setActiveApp] = React.useState('whatsapp');
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [isDiwaliTheme, setIsDiwaliTheme] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  
  const isChatPage = pathname.startsWith('/dashboard/chat') || pathname.startsWith('/dashboard/facebook/messages') || pathname.startsWith('/dashboard/facebook/kanban');
  const isWebsiteBuilderPage = pathname.includes('/builder');
  
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if(!isClient) return;

    const fetchAndSetData = async () => {
        try {
            const [session, diwaliStatus] = await Promise.all([getSession(), getDiwaliThemeStatus()]);
            
            if (!session?.user) {
                router.push('/login');
                return;
            }
            setSessionUser(session.user);
            setIsDiwaliTheme(diwaliStatus?.enabled || false);

            const { projects: fetchedProjects } = await getProjects() || { projects: [] };
            setProjects(fetchedProjects || []);
            
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
            setActiveApp(currentApp);

            const storedProjectId = localStorage.getItem('activeProjectId');
            const projectExists = (fetchedProjects || []).some(p => p._id.toString() === storedProjectId);

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
            } else if (pathname !== '/dashboard/setup' && pathname !== '/dashboard/bulk' && pathname !== '/dashboard/bulk/template') {
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
    
  }, [pathname, router, isClient]);

  const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);
  
  const currentUserRole = React.useMemo(() => {
    if (!sessionUser || !activeProject) return 'owner'; 
    if (sessionUser._id.toString() === activeProject.userId.toString()) return 'owner';
    const agentInfo = activeProject.agents?.find(a => a.userId.toString() === sessionUser._id);
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
  
  if (!isClient || isVerifying) {
    return <FullPageSkeleton />;
  }
  
  const mainContent = (
    <div className="p-4 md:p-6 lg:p-8">
        {children}
    </div>
  );

  return (
    <SidebarProvider>
      <div className={cn("flex h-screen bg-muted/30 p-2 gap-2", isDiwaliTheme && 'diwali-theme')} data-theme={activeApp}>
        {/* Primary Sidebar Rail */}
        <div className="flex-shrink-0 w-16 bg-card rounded-lg shadow-sm flex flex-col items-center py-2 space-y-2">
            <Link href="/dashboard" className="mb-4">
            <SabNodeLogo className="h-8 w-auto" />
            </Link>
            {appIcons.map(app => (
                 <Button key={app.id} asChild variant={activeApp === app.id ? 'ghost' : 'ghost'} data-theme={app.id} className={cn("rounded-lg flex-col justify-center gap-1 text-xs p-0 apprailhw", activeApp === app.id && "active-app-icon")}>
                    <Link href={app.href} scroll={false} className="h-full w-full flex flex-col items-center justify-center gap-1">
                        <app.icon className="h-5 w-5"/>
                    </Link>
                </Button>
            ))}
        </div>
        
        <Sidebar>
            <SidebarHeader>
                <h2 className="text-lg font-semibold tracking-tight">
                    {appIcons.find(app => app.id === activeApp)?.label || 'SabNode'}
                </h2>
            </SidebarHeader>
             <SidebarContent>
                 {activeApp === 'whatsapp' && (
                     <SidebarMenu>
                         {wachatMenuItems.filter(item => item.roles.includes(currentUserRole) && !item.href.includes('[')).map((item) => (
                             <SidebarMenuItem key={item.href}>
                                 <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                     <Link href={item.href}><item.icon /><span>{item.label}</span></Link>
                                 </SidebarMenuButton>
                             </SidebarMenuItem>
                         ))}
                     </SidebarMenu>
                 )}
                 {activeApp === 'facebook' && (
                    <SidebarMenu>
                      {facebookMenuGroups.map(group => (
                        <React.Fragment key={group.title}>
                          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mt-4 mb-1">{group.title}</p>
                          {group.items.filter(item => !item.href.includes('[')).map(item => (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </React.Fragment>
                      ))}
                    </SidebarMenu>
                )}
                {activeApp === 'instagram' && (
                     <SidebarMenu>
                        {instagramMenuGroups.flatMap(g => g.items).filter(item => !item.href.includes('[')).map(item => (
                            <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                 {activeApp === 'crm' && (
                     <SidebarMenu>
                        {crmMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                 {activeApp === 'email' && (
                     <SidebarMenu>
                        {emailMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                 {activeApp === 'sms' && (
                     <SidebarMenu>
                        {smsMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                {activeApp === 'api' && (
                     <SidebarMenu>
                        {apiMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                 {activeApp === 'website-builder' && (
                     <SidebarMenu>
                        {portfolioMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                {activeApp === 'url-shortener' && (
                     <SidebarMenu>
                        {urlShortenerMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                 {activeApp === 'qr-code-maker' && (
                     <SidebarMenu>
                        {qrCodeMakerMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
                {activeApp === 'seo-suite' && (
                     <SidebarMenu>
                        {seoMenuItems.map(item => (
                             <SidebarMenuItem key={item.href}>
                                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                                    <Link href={item.href}><item.icon/><span>{item.label}</span></Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                )}
            </SidebarContent>
            <SidebarFooter>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2 bg-muted/50 hover:bg-muted border border-border">
                             <Avatar className="size-7">
                                <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                                <AvatarFallback>{sessionUser?.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                            </Avatar>
                            <span className="truncate flex-1 text-left">{sessionUser?.name}</span>
                            <ChevronsUpDown className="h-4 w-4 opacity-50"/>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 mb-2" align="end" side="top">
                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem asChild><Link href="/dashboard/profile">Profile</Link></DropdownMenuItem>
                        <DropdownMenuItem asChild><Link href="/dashboard/billing">Billing</Link></DropdownMenuItem>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem asChild><Link href="/api/auth/logout"><LogOut className="mr-2 h-4 w-4"/>Logout</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0 bg-card shadow-sm rounded-lg">
            <header className="flex h-16 items-center justify-between gap-4 border-b px-4 flex-shrink-0">
                 <div className="flex items-center gap-2">
                    <SidebarTrigger>
                        <Button variant="ghost" size="icon"><PanelLeft /></Button>
                    </SidebarTrigger>
                    {activeApp === 'facebook' && activeProject ? (
                        <FacebookProjectSwitcher projects={facebookProjects} activeProject={activeProject} />
                    ) : (
                        <div className="hidden md:flex items-center gap-2 text-sm font-semibold">
                            <Briefcase className="h-4 w-4" />
                            <span className="truncate">{activeProjectName || 'No Project Selected'}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden sm:flex items-center gap-2 text-sm font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                        <CreditCard className="h-4 w-4" />
                        <span>Credits: {sessionUser?.credits?.toLocaleString() || 0}</span>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto">
                {isChatPage || isWebsiteBuilderPage ? children : mainContent}
            </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
