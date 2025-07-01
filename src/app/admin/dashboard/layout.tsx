
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
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WachatLogo } from '@/components/wabasimplify/logo';
import { LayoutDashboard, ShieldCheck, Settings, LogOut, ChevronDown, History, Bell, CreditCard, GitBranch, BookCopy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { handleLogout } from '@/app/actions';

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
  { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
  { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
  { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitBranch },
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
              <SidebarMenuButton asChild isActive={pathname.startsWith('/admin/dashboard/system')} tooltip="System Settings">
                <Link href="/admin/dashboard/system">
                  <Settings className="h-4 w-4" />
                  <span>System Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <form action={handleLogout} className="w-full">
                    <SidebarMenuButton asChild tooltip="Logout">
                        <button type="submit" className="w-full">
                            <LogOut className="h-4 w-4" />
                            <span>Logout</span>
                        </button>
                    </SidebarMenuButton>
                </form>
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
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
