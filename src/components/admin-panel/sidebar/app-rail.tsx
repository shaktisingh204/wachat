'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Home,
    Globe,
    Crosshair,
    MessageCircle,
    Settings,
    Info,
    LogOut,
    Bell,
    MessageSquare,
    Briefcase,
    Users,
    Mail,
    Smartphone,
    LayoutTemplate,
    Link as LinkIcon,
    QrCode,
    LineChart,
    Facebook,
    Instagram,
    Monitor,
    Grid
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { AllAppsPopover } from './all-apps-popover';

interface AppRailProps {
    activeApp: string;
}

export function AppRail({ activeApp }: AppRailProps) {
    const pathname = usePathname();

    return (
        <Sidebar className="w-16 bg-sidebar-background flex !w-16 !block md:!flex z-20 m-2 rounded-2xl h-[calc(100%-1rem)] shadow-lg border-none hover:!w-16 hover:!min-w-0 pb-2">
            <div className="flex flex-col h-full items-center py-2">
                {/* Logo Section */}
                <SidebarHeader className="h-auto flex items-center justify-center p-0 mb-2 mt-2">
                    <div className="bg-[#1A2333] p-2 rounded-xl">
                        <SabNodeLogo className="w-6 h-6 text-white" />
                    </div>
                </SidebarHeader>

                <ScrollArea className="flex-1 w-full px-2">
                    <SidebarContent className="flex flex-col items-center gap-4 w-full overflow-visible">
                        {/* 1. Home */}
                        <SidebarMenu className="items-center gap-2 w-full">
                            <RailItem
                                icon={Home}
                                label="Home"
                                active={pathname === '/dashboard/home'}
                                href="/dashboard/home"
                            />
                        </SidebarMenu>


                        {/* 2. Notification */}
                        <div className="w-full flex justify-center">
                            <NotificationPopover />
                        </div>

                        {/* 3. Apps List */}
                        <div className="flex flex-col items-center gap-2 w-full mt-2">
                            <SidebarMenu className="items-center gap-2 w-full">
                                <RailItem
                                    icon={MessageSquare}
                                    label="WaChat"
                                    active={pathname === '/dashboard/'}
                                    href="/dashboard/"
                                />
                                <RailItem
                                    icon={Facebook}
                                    label="Meta Suite"
                                    active={activeApp === 'facebook'}
                                    href="/dashboard/facebook"
                                />
                                <RailItem
                                    icon={Crosshair}
                                    label="Ad Manager"
                                    active={activeApp === 'ad-manager'}
                                    href="/dashboard/ad-manager"
                                />
                                <RailItem
                                    icon={Instagram}
                                    label="Instagram"
                                    active={activeApp === 'instagram'}
                                    href="/dashboard/instagram"
                                />
                                <RailItem
                                    icon={Briefcase}
                                    label="CRM"
                                    active={activeApp === 'crm'}
                                    href="/dashboard/crm"
                                />
                                <RailItem
                                    icon={Users}
                                    label="Team"
                                    active={activeApp === 'team'}
                                    href="/dashboard/team"
                                />
                                <RailItem
                                    icon={Mail}
                                    label="Email"
                                    active={activeApp === 'email'}
                                    href="/dashboard/email"
                                />
                                <RailItem
                                    icon={Smartphone}
                                    label="SMS"
                                    active={activeApp === 'sms'}
                                    href="/dashboard/sms"
                                />
                                <RailItem
                                    icon={Globe}
                                    label="SabChat"
                                    active={activeApp === 'sabchat'}
                                    href="/dashboard/sabchat"
                                />
                                <AllAppsPopover activeApp={activeApp} />
                            </SidebarMenu>
                        </div>

                    </SidebarContent>
                </ScrollArea>

                {/* Footer Section */}
                <SidebarFooter className="w-full px-2 mt-auto">
                    <SidebarMenu className="items-center gap-2 w-full flex-col">
                        <RailItem
                            icon={Settings}
                            label="Settings"
                            active={pathname.startsWith('/dashboard/user/settings')}
                            href="/dashboard/user/settings"
                        />
                        <RailItem
                            icon={Info}
                            label="Info"
                            href="#"
                        />

                        <div className="w-8 h-[1px] bg-border my-1" />

                        <RailItem
                            icon={LogOut}
                            label="Logout"
                            href="/logout"
                            className="text-muted-foreground hover:text-destructive"
                        />
                    </SidebarMenu>
                </SidebarFooter>
            </div>
        </Sidebar>
    );
}

function RailItem({
    icon: Icon,
    label,
    active,
    href,
    className
}: {
    icon: any;
    label: string;
    active?: boolean;
    href: string;
    className?: string;
}) {
    return (
        <SidebarMenuItem className="w-full flex justify-center">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Link
                        href={href}
                        className={cn(
                            "h-10 w-10 flex items-center justify-center p-0 rounded-xl transition-all duration-200",
                            active
                                ? "bg-[#E3F2FD] text-[#0288D1]"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            className
                        )}
                    >
                        <Icon className={cn("h-5 w-5", active && "fill-current")} />
                        {label === 'Home' && <span className="sr-only">{label}</span>}
                    </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    <p>{label}</p>
                </TooltipContent>
            </Tooltip>
        </SidebarMenuItem>
    );
}
