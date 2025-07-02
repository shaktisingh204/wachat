
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
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  GitFork,
  Settings,
  Briefcase,
  ChevronDown,
  FileText,
  Bot,
  Phone,
  Webhook,
  History,
  Bell,
  LogOut,
  ClipboardList,
  CreditCard,
  LoaderCircle,
  Megaphone,
  ServerCog,
} from 'lucide-react';
import { WachatBrandLogo } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { getProjectCount, getSession, handleLogout } from '@/app/actions';
import { type Plan, type WithId } from '@/lib/definitions';

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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = React.useState<{ name: string; email: string, credits?: number, plan?: WithId<Plan> } | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [projectCount, setProjectCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (!isClient) return;

    const isDashboardHome = pathname === '/dashboard';

    if (isDashboardHome) {
      localStorage.removeItem('activeProjectId');
      localStorage.removeItem('activeProjectName');
      setActiveProjectName('All Projects');
    } else {
      const name = localStorage.getItem('activeProjectName');
      const id = localStorage.getItem('activeProjectId');
      setActiveProjectName(name || (id ? 'Loading project...' : 'No Project Selected'));
    }

    getSession().then(session => {
        if(session?.user) {
            setSessionUser(session.user as any);
            getProjectCount().then(count => {
              setProjectCount(count);
              if (count === 0 && pathname !== '/dashboard' && pathname !== '/dashboard/setup' && pathname !== '/dashboard/profile' && pathname !== '/dashboard/billing' && pathname !== '/dashboard/settings') {
                  router.push('/dashboard/setup');
              }
               setIsVerifying(false);
            });
        } else {
            router.push('/login');
            setIsVerifying(false);
        }
    })

  }, [pathname, router, isClient]);

  const isChatPage = pathname.startsWith('/dashboard/chat');

  if (!isClient || isVerifying) {
      return <FullPageSkeleton />;
  }

  const hasNoProjects = projectCount === 0;
  const isSetupPage = pathname.startsWith('/dashboard/setup') || pathname.startsWith('/dashboard/profile') || pathname.startsWith('/dashboard/billing') || pathname.startsWith('/dashboard/settings');
  const planFeatures = sessionUser?.plan?.features;

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
           <div className="flex items-center gap-2">
              <WachatBrandLogo className="size-8 shrink-0" />
              <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">Wachat</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {allMenuItems.map((item) => {
              const isAllowed = !planFeatures ? true : (planFeatures as any)[item.featureKey] ?? true;
              const isDisabled = (hasNoProjects && !isSetupPage) || !isAllowed;
              
              let tooltipText = item.label;
              if (hasNoProjects && !isSetupPage) {
                tooltipText = `${item.label} (connect a project first)`;
              } else if (!isAllowed) {
                tooltipText = `${item.label} (Upgrade plan)`;
              }

              return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
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
            )})}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton asChild isActive={pathname === '/dashboard'} tooltip="All Projects">
                <Link href="/dashboard">
                  <Briefcase />
                  <span>All Projects</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
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
      <SidebarInset className="flex flex-col">
        <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                <Briefcase className="h-4 w-4" />
                {!isClient ? (
                    <Skeleton className="h-4 w-32" />
                ) : (
                    <span>{activeProjectName}</span>
                )}
            </div>
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
        <div className="flex flex-1 min-h-0">
           <main className={cn(
            "flex-1 flex flex-col",
            isChatPage ? "" : "p-4 md:p-6 lg:p-8 overflow-y-auto"
            )}>
              {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const allMenuItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard, featureKey: 'overview' },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare, featureKey: 'liveChat' },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users, featureKey: 'contacts' },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send, featureKey: 'campaigns' },
  { href: '/dashboard/whatsapp-ads', label: 'WhatsApp Ads', icon: Megaphone, featureKey: 'whatsappAds' },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText, featureKey: 'templates' },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitFork, featureKey: 'flowBuilder' },
  { href: '/dashboard/flows', label: 'Meta Flows', icon: ServerCog, featureKey: 'metaFlows' },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone, featureKey: 'numbers' },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook, featureKey: 'webhooks' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, featureKey: 'settings' },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, featureKey: 'billing' },
  { href: '/dashboard/notifications', label: 'Notifications', icon: History, featureKey: 'notifications' },
];
