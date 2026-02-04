'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { Monitor, Link as LinkIcon, QrCode, LineChart, Grid } from 'lucide-react';

const apps = [
    {
        title: "Website Builder",
        icon: Monitor,
        href: "/dashboard/website-builder",
        color: "text-blue-500",
        bg: "bg-blue-500/10"
    },
    {
        title: "URL Shortener",
        icon: LinkIcon,
        href: "/dashboard/url-shortener",
        color: "text-purple-500",
        bg: "bg-purple-500/10"
    },
    {
        title: "QR Code Maker",
        icon: QrCode,
        href: "/dashboard/qr-code-maker",
        color: "text-green-500",
        bg: "bg-green-500/10"
    },
    {
        title: "SEO Tools",
        icon: LineChart,
        href: "/dashboard/seo",
        color: "text-orange-500",
        bg: "bg-orange-500/10"
    }
];

interface AllAppsPopoverProps {
    activeApp?: string;
}

export function AllAppsPopover({ activeApp }: AllAppsPopoverProps) {
    const [open, setOpen] = React.useState(false);
    const isActive = ['website-builder', 'url-shortener', 'qr-code-maker', 'seo'].includes(activeApp || '');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <SidebarMenuItem className="w-full flex justify-center">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <button
                                className={cn(
                                    "h-10 w-10 flex items-center justify-center p-0 rounded-xl transition-all duration-200 outline-none",
                                    isActive || open
                                        ? "bg-[#E3F2FD] text-[#0288D1]"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Grid className={cn("h-5 w-5")} />
                                <span className="sr-only">All Apps</span>
                            </button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={10}>
                        <p>All Apps</p>
                    </TooltipContent>
                </Tooltip>
            </SidebarMenuItem>

            <PopoverContent side="right" align="center" sideOffset={20} className="w-80 p-4">
                <div className="grid grid-cols-2 gap-3">
                    {apps.map((app) => (
                        <Link
                            key={app.href}
                            href={app.href}
                            onClick={() => setOpen(false)}
                            className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg hover:bg-muted transition-colors text-center group"
                        >
                            <div className={cn("p-2 rounded-md transition-colors", app.bg, "group-hover:bg-opacity-80")}>
                                <app.icon className={cn("h-5 w-5", app.color)} />
                            </div>
                            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground">
                                {app.title}
                            </span>
                        </Link>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
