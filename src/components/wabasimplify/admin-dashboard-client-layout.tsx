
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
  SidebarProvider,
} from '@/components/ui/sidebar';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { LayoutDashboard, ShieldCheck, Settings, LogOut, ChevronDown, History, CreditCard, GitFork, BookCopy, Users, PanelLeft, Sparkles, Server } from 'lucide-react';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getAdminSession, getDiwaliThemeStatus } from '@/app/actions/admin.actions';

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/whatsapp-projects', label: 'WA Projects', icon: WhatsAppIcon },
  { href: '/admin/dashboard/users', label: 'Users', icon: Users },
  { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
  { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
  { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitFork },
  { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
];

function FullPageSkeleton() {
    return (
        <div className="flex h-screen w-screen bg-background">
            <div className="w-60 border-r bg-sidebar p-2"><Skeleton className="h-full w-full"/></div>
            <div className="flex-1 flex flex-col">
                <div className="h-16 border-b p-4"><Skeleton className="h-full w-full"/></div>
                <div className="flex-1 p-4"><Skeleton className="h-full w-full"/></div>
            </div>
        </div>
    );
}

export function AdminDashboardClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isClient, setIsClient] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [isSparklesEnabled, setIsSparklesEnabled] = React.useState(false);
  

  React.useEffect(() => {
    setIsClient(true);
    getDiwaliThemeStatus().then(status => {
        setIsSparklesEnabled(status.enabled);
    });

    const checkAdminStatus = async () => {
        const session = await getAdminSession();
        if (!session.isAdmin) {
            router.push('/admin-login');
        } else {
            setIsAdmin(true);
        }
        setAuthLoading(false);
    };
    checkAdminStatus();
  }, [router]);

  if (!isClient || authLoading) {
    return <FullPageSkeleton />;
  }

  return (
    <SidebarProvider>
      <div className={cn("admin-dashboard flex h-screen w-full", isSparklesEnabled && 'diwali-theme')}>
        {isSparklesEnabled && (
            <div className="absolute inset-0 pointer-events-none z-0">
                <Sparkles className="absolute top-4 right-4 h-8 w-8 text-primary/50 animate-pulse" />
                <Sparkles className="absolute top-20 left-80 h-12 w-12 text-primary/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
                <Sparkles className="absolute bottom-16 right-20 h-16 w-16 text-primary/40 animate-pulse" style={{ animationDelay: '1s' }} />
                <Sparkles className="absolute bottom-4 left-4 h-6 w-6 text-primary/50 animate-pulse" style={{ animationDelay: '1.5s' }} />
                <Sparkles className="absolute top-1/2 left-1/2 h-10 w-10 text-primary/30 animate-pulse" style={{ animationDelay: '2s' }} />
            </div>
        )}
        <Sidebar>
            <SidebarHeader>
            <SabNodeLogo className="w-32 h-auto" />
            </SidebarHeader>
            <SidebarContent>
            <SidebarMenu>
                {menuItems.map((item) => {
                const isActive = (item.href === '/admin/dashboard' && pathname === item.href) || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                    <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        </Link>
                    </SidebarMenuButton>
                    </SidebarMenuItem>
                );
                })}
            </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Logout">
                        <Link href="/api/auth/admin-logout">
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col relative">
            <header className="flex items-center justify-between p-3 border-b bg-background sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
                <SidebarTrigger>
                    <Button variant="ghost" size="icon">
                        <PanelLeft />
                    </Button>
                </SidebarTrigger>
                <div className="text-sm font-semibold text-primary">Admin Panel</div>
            </div>
            <div className="flex items-center gap-1">
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src="https://placehold.co/100x100.png" alt="Admin Avatar" data-ai-hint="person avatar"/>
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">Admin User</span>
                    <ChevronDown className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/api/auth/admin-logout">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Logout</span>
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
            </div>
            </header>
            <div className="flex-1 min-h-0">
                <main className="h-full overflow-y-auto p-2 md:p-4 lg:p-8">
                    <React.Suspense fallback={<Skeleton className="h-full w-full" />}>
                        {children}
                    </React.Suspense>
                </main>
            </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
