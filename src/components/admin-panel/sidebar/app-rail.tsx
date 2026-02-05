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
    Grid,
    Mic,
    Megaphone,
    Workflow
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { WhatsAppIcon, MetaIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { AllAppsPopover } from './all-apps-popover';

interface AppRailProps {
    activeApp: string;
}

export function AppRail({ activeApp }: AppRailProps) {
    const pathname = usePathname();

    return (
        <Sidebar className="w-16 bg-background/60 backdrop-blur-2xl flex !w-16 !block md:!flex z-20 m-2 rounded-2xl h-[calc(100%-1rem)] shadow-2xl border border-white/10 hover:!w-16 hover:!min-w-0 pb-2 transition-all duration-300">
            <div className="flex flex-col h-full items-center py-2">
                {/* Logo Section */}
                <SidebarHeader className="h-auto flex items-center justify-center p-0 mb-4 mt-2">
                    <div className="bg-[#1A2333] p-2 rounded-xl">
                        <SabNodeLogo className="w-6 h-6 text-white" />
                    </div>
                </SidebarHeader>

                <ScrollArea className="flex-1 w-full">
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
                            <div className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">Apps</div>
                            <SidebarMenu className="items-center gap-2 w-full">
                                <RailItem
                                    icon={Workflow}
                                    label="SabFlow"
                                    active={activeApp === 'sabflow'}
                                    href="/dashboard/sabflow"
                                />
                                <RailItem
                                    icon={WhatsAppIcon}
                                    label="WaChat"
                                    active={activeApp === 'whatsapp'}
                                    href="/dashboard"
                                />
                                <RailItem
                                    icon={MetaIcon}
                                    label="Meta Suite"
                                    active={activeApp === 'facebook'}
                                    href="/dashboard/facebook/all-projects"
                                />
                                <RailItem
                                    icon={Megaphone}
                                    label="Ad Manager"
                                    active={activeApp === 'ad-manager'}
                                    href="/dashboard/ad-manager"
                                />
                                <RailItem
                                    icon={Instagram}
                                    label="Instagram"
                                    active={activeApp === 'instagram'}
                                    href="/dashboard/instagram/connections"
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
                <SidebarFooter className="w-full mt-auto">
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
                                ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(var(--primary),0.3)] ring-1 ring-primary/20 backdrop-blur-sm"
                                : "text-muted-foreground/70 hover:bg-white/10 hover:text-foreground hover:backdrop-blur-md",
                            className
                        )}
                    >
                        <Icon className={cn("h-5 w-5")} />
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
