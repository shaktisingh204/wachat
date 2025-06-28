'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { LayoutDashboard, MessageSquare, History, Users, Send, GitBranch, Settings, LayoutGrid, Tag, Briefcase, LogOut, ChevronDown } from 'lucide-react';
import { FacebookIcon, WaPayIcon, WachatSidebarTopLogo, WachatBrandLogo } from '@/components/wabasimplify/custom-sidebar-components';

const menuItems = [
  { href: '/dashboard/overview', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/chat', label: 'Live Chat', icon: MessageSquare },
  { href: '/dashboard/notifications', label: 'History', icon: History },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/broadcasts', label: 'Campaigns', icon: Send },
  { href: '/dashboard/ads', label: 'Ads Manager', icon: FacebookIcon },
  { href: '/dashboard/flow-builder', label: 'Flows', icon: GitBranch },
  { href: '/dashboard/payments', label: 'WA Pay', icon: WaPayIcon },
  { href: '/dashboard/settings', label: 'Manage', icon: Settings },
  { href: '/dashboard/integrations', label: 'Integrations', icon: LayoutGrid },
  { href: '/dashboard/ecommerce', label: 'EComm+', icon: Tag },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [activeProjectName, setActiveProjectName] = React.useState<string | null>(null);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
    const name = localStorage.getItem('activeProjectName');
    setActiveProjectName(name || 'No Project Selected');
  }, []);

  const hideNotificationFeed =
    pathname.startsWith('/dashboard/flow-builder') ||
    pathname.startsWith('/dashboard/auto-reply');

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader className="items-center justify-center p-4">
            <WachatSidebarTopLogo className="w-10 h-10" />
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} className="h-20">
                    <Link href={item.href}>
                      <item.icon className="h-6 w-6 mb-1" />
                      <span className="text-xs">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                 <SidebarMenuButton asChild isActive={pathname === '/dashboard'} className="h-20">
                  <Link href="/dashboard">
                    <Briefcase className="h-6 w-6 mb-1" />
                    <span className="text-xs">All Projects</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <div className="flex justify-center p-2">
                    <Avatar className="h-10 w-10">
                        <WachatBrandLogo />
                    </Avatar>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="flex flex-col">
          <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10 shrink-0">
            <SidebarTrigger className="md:hidden" />
            <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-primary">
                <Briefcase className="h-4 w-4" />
                {!isClient ? (
                    <Skeleton className="h-4 w-32" />
                ) : (
                    <span>{activeProjectName}</span>
                )}
            </div>
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="https://placehold.co/100x100.png" alt="User Avatar" data-ai-hint="person avatar"/>
                    <AvatarFallback>U</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline">User Name</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Billing</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">Logout</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
            <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
                {children}
            </main>
            {!hideNotificationFeed && (
             <aside className="w-full md:w-80 xl:w-96 border-t md:border-t-0 md:border-l bg-background shrink-0">
                <LiveNotificationFeed />
            </aside>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
