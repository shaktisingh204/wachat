
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { WachatLogo } from '@/components/wabasimplify/logo';
import { LayoutDashboard, Users, ShieldCheck, Settings, LogOut, ChevronDown, History, Bell } from 'lucide-react';
import { LiveNotificationFeed } from '@/components/wabasimplify/live-notification-feed';
import { cn } from '@/lib/utils';

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/users', label: 'User Management', icon: Users },
  { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
  { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
];

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <WachatLogo className="w-32 h-auto" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.label}>
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" />
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
              <SidebarMenuButton asChild isActive={pathname === '/admin/dashboard/settings'} tooltip="Settings">
                <Link href="/admin/dashboard/settings">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Logout">
                <Link href="/">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div className="text-sm font-semibold text-primary">Admin Panel</div>
          </div>
          <div className="flex items-center gap-2">
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
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">Logout</Link>
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
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">{children}</main>
          <aside className="hidden md:flex w-full md:w-80 xl:w-96 border-t md:border-t-0 md:border-l bg-background shrink-0 flex-col">
              <LiveNotificationFeed />
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
