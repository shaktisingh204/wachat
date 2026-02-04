'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
} from '@/components/ui/sidebar';
import { User as UserIcon } from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { appIcons } from '@/config/dashboard-config';

interface AppRailProps {
    activeApp: string;
}

export function AppRail({ activeApp }: AppRailProps) {
    return (
        <Sidebar className="w-16 bg-sidebar-background flex !w-16 !block md:!flex z-20 m-2 rounded-2xl h-[calc(100%-1rem)] shadow-lg border-none">
            <div className="flex flex-col h-full">
                <SidebarHeader className="h-16 flex items-center justify-center">
                    <SabNodeLogo className="w-8 h-8" />
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu className="items-center gap-1.5 py-2">
                        {appIcons.map(app => (
                            <SidebarMenuItem key={app.id} className={cn("relative w-full flex justify-center", activeApp === app.id && 'active-app-border')}>
                                <SidebarMenuButton asChild isActive={activeApp === app.id} tooltip={app.label} showTooltip={true} className="h-10 w-10 justify-center p-0 rounded-xl hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
                                    <Link href={app.href}>
                                        <app.icon className="h-5 w-5" />
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu className="items-center mb-2">
                        <SidebarMenuItem className="w-full flex justify-center">
                            <SidebarMenuButton asChild tooltip="User Settings" className="h-10 w-10 justify-center p-0 rounded-xl hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                                <Link href="/dashboard/user/settings">
                                    <UserIcon className="h-4 w-4" />
                                    <span className="sr-only">Settings</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            </div>
        </Sidebar>
    );
}
