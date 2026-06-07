'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Skeleton,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarProvider,
  cn,
} from '@/components/sabcrm/20ui';
import { usePathname, useRouter } from 'next/navigation';
import { SabNodeLogo } from '@/components/zoruui-domain/logo';
import {
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  ChevronDown,
  History,
  CreditCard,
  GitFork,
  BookCopy,
  Users,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/zoruui-domain/custom-sidebar-components';

import React from 'react';
import Link from 'next/link';

import { checkAdminSession, getDiwaliThemeStatus } from '@/app/actions/admin.actions';

const menuItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/whatsapp-projects', label: 'WA Projects', icon: WhatsAppIcon as LucideIcon },
  { href: '/admin/dashboard/users', label: 'Users', icon: Users },
  { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
  { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
  { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitFork },
  { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
];

export function AdminDashboardClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [authLoading, setAuthLoading] = React.useState(true);
  const [isSparklesEnabled, setIsSparklesEnabled] = React.useState(false);

  React.useEffect(() => {
    getDiwaliThemeStatus().then((status) => {
      setIsSparklesEnabled(status.enabled);
    });

    const checkAdminStatus = async () => {
      const session = await checkAdminSession();
      if (!session.isAdmin) {
        router.replace('/admin-login');
      } else {
        setIsAdmin(true);
      }
      setAuthLoading(false);
    };
    checkAdminStatus();
  }, [router]);

  if (authLoading) {
    return null; // The parent suspense will handle the skeleton
  }

  if (!isAdmin) {
    return null; // Render nothing, middleware and effect will handle redirect
  }

  return (
    <SidebarProvider>
      <div className={cn('admin-dashboard flex h-screen w-full', isSparklesEnabled && 'diwali-theme')}>
        {isSparklesEnabled && (
          <div className="absolute inset-0 pointer-events-none z-0" aria-hidden="true">
            <Sparkles className="absolute top-4 right-4 h-8 w-8 text-[var(--st-text)]/50 animate-pulse" />
            <Sparkles className="absolute top-20 left-80 h-12 w-12 text-[var(--st-text)]/30 animate-pulse [animation-delay:0.5s]" />
            <Sparkles className="absolute bottom-16 right-20 h-16 w-16 text-[var(--st-text)]/40 animate-pulse [animation-delay:1s]" />
            <Sparkles className="absolute bottom-4 left-4 h-6 w-6 text-[var(--st-text)]/50 animate-pulse [animation-delay:1.5s]" />
            <Sparkles className="absolute top-1/2 left-1/2 h-10 w-10 text-[var(--st-text)]/30 animate-pulse [animation-delay:2s]" />
          </div>
        )}
        <Sidebar>
          <SidebarHeader>
            <SabNodeLogo className="w-32 h-auto" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive =
                  (item.href === '/admin/dashboard' && pathname === item.href) ||
                  (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      icon={item.icon}
                      isActive={isActive}
                      tooltip={item.label}
                      render={(p) => (
                        <Link href={item.href} className={p.className} aria-current={p['aria-current']}>
                          {p.children}
                        </Link>
                      )}
                    >
                      {item.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  icon={LogOut}
                  tooltip="Logout"
                  render={(p) => (
                    <Link href="/api/auth/admin-logout" prefetch={false} className={p.className} aria-current={p['aria-current']}>
                      {p.children}
                    </Link>
                  )}
                >
                  Logout
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col relative">
          <header className="flex items-center justify-between p-3 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] sticky top-0 z-10 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger label="Toggle sidebar" />
              <div className="text-sm font-semibold text-[var(--st-text)]">Admin Panel</div>
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="https://placehold.co/100x100.png" alt="Admin avatar" data-ai-hint="person avatar" />
                      <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline">Admin User</span>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Admin Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/api/auth/admin-logout" prefetch={false}>
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
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
