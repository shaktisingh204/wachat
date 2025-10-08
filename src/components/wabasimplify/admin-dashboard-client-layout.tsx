
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
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { LayoutDashboard, ShieldCheck, Settings, LogOut, ChevronDown, History, CreditCard, GitFork, BookCopy, Users } from 'lucide-react';
import { WhatsAppIcon } from '@/components/wabasimplify/custom-sidebar-components';

const menuItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/dashboard/whatsapp-projects', label: 'WhatsApp Projects', icon: WhatsAppIcon },
  { href: '/admin/dashboard/users', label: 'Users', icon: Users },
  { href: '/admin/dashboard/plans', label: 'Plans', icon: CreditCard },
  { href: '/admin/dashboard/template-library', label: 'Template Library', icon: BookCopy },
  { href: '/admin/dashboard/broadcast-log', label: 'Broadcast Log', icon: History },
  { href: '/admin/dashboard/flow-logs', label: 'Flow Logs', icon: GitFork },
  { href: '/admin/dashboard/system', label: 'System Health', icon: ShieldCheck },
];

export function AdminDashboardClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
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
      <SidebarInset className="flex flex-col">
        <header className="flex items-center justify-between p-3 border-b bg-background sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
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
          <main className="flex-1 p-2 md:p-4 lg:p-8 overflow-y-auto">{children}</main>
        </div>
      </SidebarInset>
    </>
  );
}
