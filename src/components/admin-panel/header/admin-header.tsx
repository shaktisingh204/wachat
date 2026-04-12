'use client';

import * as React from 'react';
import { useProject } from '@/context/project-context';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
            className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 px-3 bg-white/60 backdrop-blur-md transition-colors duration-500"
            style={{ borderBottom: '1px solid var(--app-border)' }}
        >
            {/* ── Left ── */}
            <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <PanelLeft className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </SidebarTrigger>

                {/* App indicator pill */}
                <div
                    className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold shrink-0 transition-all duration-500"
                    style={{
                        background: 'var(--app-light)',
                        color: 'var(--app-text)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 0 10px var(--app-glow)',
                    }}
                >
                    <span className="text-base leading-none">{meta.icon}</span>
                    <span>{meta.label}</span>
                </div>

                {/* Active project breadcrumb */}
                {activeProject?.name && (
                    <div className="hidden md:flex items-center gap-1 min-w-0">
                        <span className="text-muted-foreground/40 text-sm">/</span>
                        <span
                            className="text-sm font-medium truncate max-w-[140px]"
                            style={{ color: 'var(--app-text)' }}
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
                    className="flex items-center gap-2 rounded-full px-2 py-1 bg-white/80 hover:bg-white transition-colors cursor-pointer"
                    style={{ border: '1px solid var(--app-border)' }}
                >
                    <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={avatarSrc} alt={displayName} />
                        <AvatarFallback
                            className="text-xs font-bold"
                            style={{ background: 'var(--app-light)', color: 'var(--app-text)' }}
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
