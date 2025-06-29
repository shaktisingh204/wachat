
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
import { LiveNotificationFeed } from '@/components/wabasimplify/live-notification-feed';
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Send,
  GitBranch,
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
} from 'lucide-react';
import { WachatBrandLogo } from '@/components/wabasimplify/custom-sidebar-components';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getProjects, getSession, handleLogout } from '@/app/actions';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = React.useState<{ name: string; email: string } | null>(null);
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);
  const [projectCount, setProjectCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    setIsClient(true);
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
            setSessionUser(session.user);
            getProjects().then(projects => {
              const count = projects.length;
              setProjectCount(count);
              if (count === 0 && pathname !== '/dashboard' && pathname !== '/dashboard/setup' && pathname !== '/dashboard/profile') {
                  router.push('/dashboard/setup');
              }
            });
        } else {
            router.push('/login');
        }
        setIsVerifying(false);
    })

  }, [pathname, router]);

  const isChatPage = pathname.startsWith('/dashboard/chat');
  
  const hideNotificationFeedOnDesktop =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/flow-builder') ||
    isChatPage;

  if (isVerifying) {
      return (
          <div className="flex items-center justify-center h-screen">
              <Skeleton className="h-full w-full" />
          </div>
      )
  }

  const hasNoProjects = projectCount === 0;

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
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={hasNoProjects ? `${item.label} (connect a project first)` : item.label}
                  disabled={hasNoProjects}
                  aria-disabled={hasNoProjects}
                >
                  <Link href={hasNoProjects ? '#' : item.href} className={cn(hasNoProjects && 'pointer-events-none')}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
                  <DropdownMenuItem>Billing</DropdownMenuItem>
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
             <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="md:hidden">
                        <Bell className="h-5 w-5"/>
                        <span className="sr-only">Toggle Notifications</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="p-0">
                    <LiveNotificationFeed />
                </SheetContent>
            </Sheet>
          </div>
        </header>
        <div className="flex flex-1 min-h-0">
           <main className={cn(
            "flex-1 flex flex-col",
            isChatPage ? "" : "p-4 md:p-6 lg:p-8 overflow-y-auto"
            )}>
              {children}
          </main>
          {!hideNotificationFeedOnDesktop && (
           <aside className="hidden md:flex w-full md:w-80 xl:w-96 border-t md:border-t-0 md:border-l bg-background shrink-0 flex-col">
              <LiveNotificationFeed />
          </aside>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

const menuItems = [
  { href: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send },
  { href: '/dashboard/templates', label: 'Templates', icon: FileText },
  { href: '/dashboard/flow-builder', label: 'Flow Builder', icon: GitBranch },
  { href: '/dashboard/auto-reply', label: 'Auto-Reply', icon: Bot },
  { href: '/dashboard/numbers', label: 'Numbers', icon: Phone },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/notifications', label: 'Notifications', icon: History },
];
