'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Home,
    Settings,
    LogOut,
    Mail,
    Smartphone,
    Users,
    Instagram,
    Briefcase,
    Megaphone,
    Workflow,
    Bot,
    Search,
    Globe,
    Link as LinkIcon,
    QrCode,
    Send,
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { WhatsAppIcon, MetaIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { useProject } from '@/context/project-context';
import { can } from '@/lib/rbac';

/* ─── App definitions ──────────────────────────────────────────────────────── */

/**
 * Each app has a primary permissionKey used to decide whether the icon is
 * shown in the rail. null → always shown (core surfaces every user gets).
 */
const ALL_APPS: { id: string; label: string; icon: any; href: string; permissionKey: string | null }[] = [
    { id: 'sabflow',        label: 'SabFlow',        icon: Workflow,     href: '/dashboard/sabflow',                permissionKey: null },
    { id: 'whatsapp',       label: 'WaChat',         icon: WhatsAppIcon, href: '/wachat',                        permissionKey: 'wachat_overview' },
    { id: 'facebook',       label: 'Meta Suite',     icon: MetaIcon,     href: '/dashboard/facebook/all-projects',  permissionKey: 'facebook_dashboard' },
    { id: 'ad-manager',     label: 'Ad Manager',     icon: Megaphone,    href: '/dashboard/ad-manager/ad-accounts', permissionKey: 'ad_manager_accounts' },
    { id: 'telegram',       label: 'Telegram',       icon: Send,         href: '/dashboard/telegram',               permissionKey: null },
    { id: 'instagram',      label: 'Instagram',      icon: Instagram,    href: '/dashboard/instagram/connections',  permissionKey: 'instagram_dashboard' },
    { id: 'crm',            label: 'CRM',            icon: Briefcase,    href: '/dashboard/crm',                    permissionKey: 'crm_dashboard' },
    { id: 'team',           label: 'Team',           icon: Users,        href: '/dashboard/team',                   permissionKey: 'team_users' },
    { id: 'email',          label: 'Email',          icon: Mail,         href: '/dashboard/email',                  permissionKey: 'email_dashboard' },
    { id: 'sms',            label: 'SMS',            icon: Smartphone,   href: '/dashboard/sms',                    permissionKey: 'sms_overview' },
    { id: 'sabchat',        label: 'SabChat',        icon: Bot,          href: '/dashboard/sabchat',                permissionKey: 'sabchat_inbox' },
    { id: 'seo-suite',      label: 'SEO Suite',      icon: Search,       href: '/dashboard/seo',                    permissionKey: 'seo_dashboard' },
    { id: 'website-builder',label: 'Website Builder',icon: Globe,        href: '/dashboard/website-builder',        permissionKey: 'website_builder' },
    { id: 'url-shortener',  label: 'URL Shortener',  icon: LinkIcon,     href: '/dashboard/url-shortener',          permissionKey: 'url_shortener' },
    { id: 'qr-code-maker',  label: 'QR Code',        icon: QrCode,       href: '/dashboard/qr-code-maker',          permissionKey: 'qr_code_maker' },
];

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface AppRailProps {
    activeApp: string;
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export function AppRail({ activeApp }: AppRailProps) {
    const pathname = usePathname();
    const { sessionUser, effectivePermissions } = useProject();

    const initials = React.useMemo(() => {
        const name = (sessionUser as any)?.name || (sessionUser as any)?.email || '';
        return name.split(/[\s@]/).map((p: string) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'U';
    }, [sessionUser]);

    const avatarSrc = (sessionUser as any)?.image || (sessionUser as any)?.profilePic || '';

    // Filter apps by effective permissions. Owners and admins bypass naturally
    // (rbac.ts returns true when no explicit deny exists). Entries without
    // a permissionKey are always shown.
    const visibleApps = React.useMemo(() => {
        // Before permissions have loaded, show everything — avoids a flash
        // of an empty rail on first paint.
        if (!effectivePermissions) return ALL_APPS;
        return ALL_APPS.filter((app) => {
            if (!app.permissionKey) return true;
            return can(effectivePermissions, app.permissionKey, 'view');
        });
    }, [effectivePermissions]);

    return (
        <nav
            className="hidden md:flex flex-col h-[calc(100vh-1rem)] w-[64px] shrink-0 m-2 mr-0 rounded-2xl z-20 overflow-hidden bg-card border border-border"
            style={{
                boxShadow: '0 1px 3px hsl(240 6% 10% / 0.04)',
            }}
        >
            {/* ── Logo — black wordmark on white ── */}
            <div className="flex items-center justify-center pt-4 pb-3 shrink-0">
                <Link
                    href="/dashboard"
                    className="flex items-center justify-center w-9 h-9 rounded-xl bg-foreground text-background transition-all duration-200 hover:scale-105"
                >
                    <SabNodeLogo className="w-5 h-5 text-background" />
                </Link>
            </div>

            {/* ── Divider ── */}
            <Divider />

            {/* ── Scrollable nav ── */}
            <div className="flex-1 flex flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden py-2 scroll-container">

                {/* Home */}
                <RailItem
                    icon={Home}
                    label="Home"
                    active={pathname === '/dashboard'}
                    href="/dashboard"
                />

                {/* Micro label */}
                <span className="mt-3 mb-1 text-[9px] font-bold uppercase tracking-[0.12em] select-none text-muted-foreground/60">
                    Apps
                </span>

                {/* All apps */}
                {visibleApps.map(app => (
                    <RailItem
                        key={app.id}
                        icon={app.icon}
                        label={app.label}
                        active={activeApp === app.id}
                        href={app.href}
                    />
                ))}
            </div>

            {/* ── Divider ── */}
            <Divider />

            {/* ── Footer ── */}
            <div className="flex flex-col items-center gap-0.5 py-2 shrink-0">
                {/* Notifications */}
                <div className="flex justify-center w-full">
                    <NotificationPopover />
                </div>

                {/* Settings */}
                <RailItem
                    icon={Settings}
                    label="Settings"
                    active={pathname.startsWith('/dashboard/user/settings')}
                    href="/dashboard/user/settings"
                />

                <Divider />

                {/* User avatar → user settings */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link
                            href="/dashboard/user/profile"
                            className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 hover:scale-105 mt-0.5"
                        >
                            <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-border transition-all duration-200">
                                <AvatarImage src={avatarSrc} />
                                <AvatarFallback className="text-[11px] font-bold bg-secondary text-foreground">
                                    {initials}
                                </AvatarFallback>
                            </Avatar>
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={12}>
                        <p>{(sessionUser as any)?.name || 'Profile'}</p>
                    </TooltipContent>
                </Tooltip>

                {/* Logout */}
                <RailItem
                    icon={LogOut}
                    label="Logout"
                    href="/logout"
                    prefetch={false}
                    destructive
                />

                <div className="pb-1" />
            </div>
        </nav>
    );
}

/* ─── Rail Item ──────────────────────────────────────────────────────────────── */

function RailItem({
    icon: Icon,
    label,
    active,
    href,
    prefetch,
    destructive,
}: {
    icon: any;
    label: string;
    active?: boolean;
    href: string;
    prefetch?: boolean;
    destructive?: boolean;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Link
                    href={href}
                    prefetch={prefetch}
                    className={cn(
                        'relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 group',
                        destructive
                            ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                            : active
                                ? 'bg-secondary text-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                >
                    {/* Left indicator bar */}
                    {active && !destructive && (
                        <span className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-foreground" />
                    )}
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="sr-only">{label}</span>
                </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12}>
                <p>{label}</p>
            </TooltipContent>
        </Tooltip>
    );
}

/* ─── Divider ────────────────────────────────────────────────────────────────── */

function Divider() {
    return (
        <div className="w-8 h-px my-1.5 shrink-0 rounded-full bg-border" />
    );
}
