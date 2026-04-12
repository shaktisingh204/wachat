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
} from 'lucide-react';
import { SabNodeLogo } from '@/components/wabasimplify/logo';
import { WhatsAppIcon, MetaIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { NotificationPopover } from '@/components/notifications/notification-popover';
import { useProject } from '@/context/project-context';

/* ─── App definitions ──────────────────────────────────────────────────────── */

const ALL_APPS = [
    { id: 'sabflow',        label: 'SabFlow',        icon: Workflow,     href: '/dashboard/sabflow' },
    { id: 'whatsapp',       label: 'WaChat',         icon: WhatsAppIcon, href: '/dashboard' },
    { id: 'facebook',       label: 'Meta Suite',     icon: MetaIcon,     href: '/dashboard/facebook/all-projects' },
    { id: 'ad-manager',     label: 'Ad Manager',     icon: Megaphone,    href: '/dashboard/ad-manager' },
    { id: 'instagram',      label: 'Instagram',      icon: Instagram,    href: '/dashboard/instagram/connections' },
    { id: 'crm',            label: 'CRM',            icon: Briefcase,    href: '/dashboard/crm' },
    { id: 'team',           label: 'Team',           icon: Users,        href: '/dashboard/team' },
    { id: 'email',          label: 'Email',          icon: Mail,         href: '/dashboard/email' },
    { id: 'sms',            label: 'SMS',            icon: Smartphone,   href: '/dashboard/sms' },
    { id: 'sabchat',        label: 'SabChat',        icon: Bot,          href: '/dashboard/sabchat' },
    { id: 'seo-suite',      label: 'SEO Suite',      icon: Search,       href: '/dashboard/seo' },
    { id: 'website-builder',label: 'Website Builder',icon: Globe,        href: '/dashboard/website-builder' },
    { id: 'url-shortener',  label: 'URL Shortener',  icon: LinkIcon,     href: '/dashboard/url-shortener' },
    { id: 'qr-code-maker',  label: 'QR Code',        icon: QrCode,       href: '/dashboard/qr-code-maker' },
];

/* ─── Types ──────────────────────────────────────────────────────────────────── */

interface AppRailProps {
    activeApp: string;
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

export function AppRail({ activeApp }: AppRailProps) {
    const pathname = usePathname();
    const { sessionUser } = useProject();

    const initials = React.useMemo(() => {
        const name = (sessionUser as any)?.name || (sessionUser as any)?.email || '';
        return name.split(/[\s@]/).map((p: string) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'U';
    }, [sessionUser]);

    const avatarSrc = (sessionUser as any)?.image || (sessionUser as any)?.profilePic || '';

    return (
        <nav
            className="hidden md:flex flex-col h-[calc(100vh-1rem)] w-[64px] shrink-0 m-2 mr-0 rounded-2xl z-20 overflow-hidden"
            style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
                transition: 'border-color 0.5s ease',
            }}
        >
            {/* ── Logo ── */}
            <div className="flex items-center justify-center pt-4 pb-3 shrink-0">
                <Link
                    href="/home"
                    className="flex items-center justify-center w-9 h-9 rounded-xl transition-transform duration-200 hover:scale-105"
                    style={{
                        background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                        boxShadow: '0 4px 14px var(--app-glow)',
                    }}
                >
                    <SabNodeLogo className="w-5 h-5 text-white" />
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
                    active={pathname === '/home'}
                    href="/home"
                />

                {/* Micro label */}
                <span className="mt-3 mb-1 text-[9px] font-bold uppercase tracking-[0.12em] select-none"
                    style={{ color: 'var(--app-text)', opacity: 0.45 }}>
                    Apps
                </span>

                {/* All apps */}
                {ALL_APPS.map(app => (
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
                            <Avatar className="h-8 w-8 ring-2 ring-transparent hover:ring-2 transition-all duration-200"
                                style={{ '--tw-ring-color': 'var(--app-border)' } as React.CSSProperties}>
                                <AvatarImage src={avatarSrc} />
                                <AvatarFallback
                                    className="text-[11px] font-bold"
                                    style={{ background: 'var(--app-light)', color: 'var(--app-text)' }}
                                >
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
                            ? 'text-zinc-400 hover:text-red-500 hover:bg-red-50'
                            : !active
                                ? 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100/80'
                                : ''
                    )}
                    style={active && !destructive ? {
                        background: 'var(--app-light)',
                        color: 'var(--app-text)',
                        boxShadow: '0 0 14px var(--app-glow)',
                        outline: '1px solid var(--app-border)',
                    } : undefined}
                >
                    {/* Left indicator bar */}
                    {active && !destructive && (
                        <span
                            className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                            style={{ background: 'var(--app-hex)' }}
                        />
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
        <div
            className="w-8 h-px my-1.5 shrink-0 rounded-full transition-colors duration-500"
            style={{ background: 'var(--app-border)' }}
        />
    );
}
