'use client';

import { Button, Avatar, AvatarFallback, AvatarImage } from '@/components/sabcrm/20ui';
import {
  useProject } from '@/context/project-context';
import { SidebarTrigger } from '@/components/sabcrm/20ui';

import * as React from 'react';

import { NotificationPopover } from '@/components/notifications/notification-popover';
import { PanelLeft } from 'lucide-react';

interface AdminHeaderProps {
    appRailPosition: 'left' | 'top';
    activeApp: string;
}

const APP_META: Record<string, { label: string; icon: string }> = {
    home: { label: 'Home', icon: '🏠' },
    whatsapp: { label: 'WaChat', icon: '💬' },
    sabflow: { label: 'SabFlow', icon: '⚡' },
    facebook: { label: 'Meta Suite', icon: '📘' },
    instagram: { label: 'Instagram', icon: '📸' },
    crm: { label: 'CRM', icon: '🧩' },
    sabchat: { label: 'SabChat', icon: '🤖' },
    email: { label: 'Email', icon: '📧' },
    sms: { label: 'SMS', icon: '📱' },
    'ad-manager': { label: 'Ad Manager', icon: '📢' },
    'seo-suite': { label: 'SEO Suite', icon: '🔍' },
    team: { label: 'Team', icon: '👥' },
    'user-settings': { label: 'Settings', icon: '⚙️' },
    'website-builder': { label: 'Website Builder', icon: '🌐' },
    'url-shortener': { label: 'URL Shortener', icon: '🔗' },
    'qr-code-maker': { label: 'QR Maker', icon: '📲' },
    api: { label: 'API', icon: '🔌' },
};

export function AdminHeader({ appRailPosition, activeApp }: AdminHeaderProps) {
    const { sessionUser, activeProject } = useProject();
    const meta = APP_META[activeApp] ?? { label: 'Dashboard', icon: '◆' };

    const initials = React.useMemo(() => {
        const name = (sessionUser as any)?.name || (sessionUser as any)?.email || '';
        return name.split(/[\s@]/).map((p: string) => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || 'U';
    }, [sessionUser]);

    const displayName = (sessionUser as any)?.name || (sessionUser as any)?.email?.split('@')[0] || 'User';
    const avatarSrc = (sessionUser as any)?.image || (sessionUser as any)?.profilePic || '';

    return (
        <header
            className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-[var(--st-bg-secondary)]/50 bg-[var(--st-bg-secondary)]/85 transition-colors duration-500 border-b border-[var(--app-border)]"
        >
            {/* ── Left ── */}
            <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <PanelLeft className="h-4 w-4 text-[var(--st-text-secondary)]" />
                    </Button>
                </SidebarTrigger>

                {/* App indicator pill */}
                <div
                    className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold shrink-0 transition-all duration-500 bg-[var(--app-light)] text-[var(--app-text)] border border-[var(--app-border)] shadow-[0_0_10px_var(--app-glow)]"
                >
                    <span className="text-base leading-none">{meta.icon}</span>
                    <span>{meta.label}</span>
                </div>

                {/* Active project breadcrumb */}
                {activeProject?.name && (
                    <div className="hidden md:flex items-center gap-1 min-w-0">
                        <span className="text-[var(--st-text-secondary)]/40 text-sm">/</span>
                        <span
                            className="text-sm font-medium truncate max-w-[140px] text-[var(--app-text)]"
                            title={activeProject.name}
                        >
                            {activeProject.name}
                        </span>
                    </div>
                )}
            </div>

            {/* ── Right ── */}
            <div className="flex items-center gap-2 shrink-0">
                <NotificationPopover />

                {/* User pill */}
                <div
                    className="flex items-center gap-2 rounded-full px-2 py-1 bg-[var(--st-bg-secondary)]/80 hover:bg-[var(--st-bg-secondary)] transition-colors cursor-pointer border border-[var(--app-border)]"
                >
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={avatarSrc} alt={displayName} />
                        <AvatarFallback
                            className="text-xs font-bold bg-[var(--app-light)] text-[var(--app-text)]"
                        >
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:block text-sm font-medium max-w-[90px] truncate">
                        {displayName}
                    </span>
                </div>
            </div>
        </header>
    );
}
