
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
} from 'lucide-react';
import { WachatBrandLogo } from '@/components/wabasimplify/custom-sidebar-components';

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
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/flow-builder') ||
    pathname.startsWith('/dashboard/auto-reply') ||
    pathname.startsWith('/dashboard/chat');

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
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                  <Link href={item.href}>
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
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <span className="sr-only">User Account</span>
                    </button>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile</DropdownMenuItem>
                  <DropdownMenuItem>Billing</DropdownMenuItem>
                  <DropdownMenuItem>Settings</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/">Logout</Link>
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
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">Logout</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="grid md:grid-cols-[1fr_auto] flex-1 min-h-0">
          <main className="p-4 md:p-6 lg:p-8 overflow-y-auto">
              {children}
          </main>
          {!hideNotificationFeed && (
           <aside className="w-full md:w-80 xl:w-96 border-t md:border-t-0 md:border-l bg-background shrink-0 flex flex-col">
              <LiveNotificationFeed />
          </aside>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
