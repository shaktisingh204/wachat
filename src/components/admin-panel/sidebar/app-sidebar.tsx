'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    ChevronRight,
    Check,
    ChevronsUpDown,
    Workflow,
    Globe,
    Megaphone,
    Instagram,
    Briefcase,
    Users,
    Mail,
    Smartphone,
    Bot,
    Settings,
    Search,
    Monitor,
    Link as LinkIcon,
    QrCode,
    LayoutGrid,
} from 'lucide-react';
import {
    wachatMenuItems,
    crmMenuGroups,
    adManagerMenuItems,
    sabChatMenuItems,
    sabflowMenuItems,
    facebookMenuGroups,
    instagramMenuGroups,
    emailMenuItems,
    smsMenuItems,
    apiMenuItems,
    urlShortenerMenuItems,
    qrCodeMakerMenuItems,
    portfolioMenuItems,
    seoMenuItems,
    userSettingsItems,
    teamMenuItems,
    type MenuItem,
} from '@/config/dashboard-config';
import { useAdManager } from '@/context/ad-manager-context';
import { useProject } from '@/context/project-context';
import { canView } from '@/lib/rbac';
import { WhatsAppIcon, MetaIcon } from '@/components/wabasimplify/custom-sidebar-components';

/* ─── App metadata ───────────────────────────────────────────────────────────── */

const APP_META: Record<string, { label: string; icon: any }> = {
    home:             { label: 'Home',           icon: LayoutGrid },
    whatsapp:         { label: 'WaChat',         icon: WhatsAppIcon },
    sabflow:          { label: 'SabFlow',        icon: Workflow },
    facebook:         { label: 'Meta Suite',     icon: MetaIcon },
    instagram:        { label: 'Instagram',      icon: Instagram },
    crm:              { label: 'CRM',            icon: Briefcase },
    sabchat:          { label: 'SabChat',        icon: Bot },
    email:            { label: 'Email',          icon: Mail },
    sms:              { label: 'SMS',            icon: Smartphone },
    'ad-manager':     { label: 'Ad Manager',     icon: Megaphone },
    'seo-suite':      { label: 'SEO Suite',      icon: Search },
    team:             { label: 'Team',           icon: Users },
    'user-settings':  { label: 'Settings',       icon: Settings },
    'website-builder':{ label: 'Website Builder',icon: Monitor },
    'url-shortener':  { label: 'URL Shortener',  icon: LinkIcon },
    'qr-code-maker':  { label: 'QR Code Maker',  icon: QrCode },
    api:              { label: 'API',            icon: Globe },
};

/* ─── Project apps (those that require an active project) ──────────────────── */
const PROJECT_SCOPED_APPS = ['whatsapp', 'facebook', 'instagram', 'ad-manager', 'sabflow', 'sabchat'];

/* ─── Menu Item ──────────────────────────────────────────────────────────────── */

const NavItem = ({ item, depth = 0 }: { item: MenuItem; depth?: number }) => {
    const pathname = usePathname();
    const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    const Icon = item.icon;
    const indent = depth > 0 ? 'pl-8' : 'pl-3';

    return (
        <Link
            href={item.href}
            className={cn(
                'group flex items-center gap-2.5 rounded-xl py-2 pr-3 text-sm font-medium transition-all duration-150 relative',
                indent,
                isActive
                    ? 'text-[var(--app-text)]'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            )}
            style={isActive ? {
                background: 'var(--app-light)',
                boxShadow: '0 0 0 1px var(--app-border)',
            } : undefined}
        >
            {/* Left indicator */}
            {isActive && (
                <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                    style={{ background: 'var(--app-hex)' }}
                />
            )}

            {Icon && (
                <Icon
                    className="h-4 w-4 shrink-0 transition-colors"
                    style={isActive ? { color: 'var(--app-text)' } : undefined}
                />
            )}

            <span className="flex-1 truncate">{item.label}</span>

            {item.new && (
                <Badge className="ml-auto text-[10px] h-4 px-1.5 font-semibold"
                    style={{ background: 'var(--app-light)', color: 'var(--app-text)', border: '1px solid var(--app-border)' }}>
                    New
                </Badge>
            )}
            {item.beta && (
                <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">Beta</Badge>
            )}
        </Link>
    );
};

/* ─── Collapsible group item ─────────────────────────────────────────────────── */

const NavCollapsible = ({ item }: { item: MenuItem }) => {
    const pathname = usePathname();
    const isOpenPath = pathname.startsWith(item.href || '');
    const [open, setOpen] = React.useState(isOpenPath);
    const Icon = item.icon;

    return (
        <Collapsible open={open} onOpenChange={setOpen} className="w-full">
            <CollapsibleTrigger asChild>
                <button
                    className={cn(
                        'group flex w-full items-center gap-2.5 rounded-xl py-2 pl-3 pr-3 text-sm font-medium transition-all duration-150 relative',
                        isOpenPath ? 'text-[var(--app-text)]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                    )}
                    style={isOpenPath ? { background: 'var(--app-light)', boxShadow: '0 0 0 1px var(--app-border)' } : undefined}
                >
                    {isOpenPath && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                            style={{ background: 'var(--app-hex)' }} />
                    )}
                    {Icon && <Icon className="h-4 w-4 shrink-0" style={isOpenPath ? { color: 'var(--app-text)' } : undefined} />}
                    <span className="flex-1 text-left truncate">{item.label}</span>
                    <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-90')} />
                </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="mt-0.5 ml-3 pl-3 flex flex-col gap-0.5"
                    style={{ borderLeft: '1.5px solid var(--app-border)' }}>
                    {(item.subItems || item.subSubItems || []).map((sub: any, i: number) =>
                        sub.subItems ? (
                            <NavCollapsible key={sub.label || i} item={sub} />
                        ) : (
                            <NavItem key={sub.href || i} item={sub} depth={1} />
                        )
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};

/* ─── Group label ─────────────────────────────────────────────────────────────── */

const GroupLabel = ({ title }: { title: string }) => (
    <div className="px-3 pt-5 pb-1.5">
        <span
            className="text-[10px] font-bold uppercase tracking-[0.1em] transition-colors duration-500"
            style={{ color: 'var(--app-text)', opacity: 0.5 }}
        >
            {title}
        </span>
    </div>
);

/* ─── Project Switcher (inline, compact) ─────────────────────────────────────── */

function InlineProjectSwitcher() {
    const { projects: allProjects, activeProject, setActiveProjectId } = useProject();
    const router = useRouter();
    const projects = allProjects.filter((p: any) => !!p.wabaId);

    if (projects.length === 0) return null;

    const handleSelect = (id: string, name: string) => {
        localStorage.setItem('activeProjectId', id);
        localStorage.setItem('activeProjectName', name);
        setActiveProjectId(id);
        router.push('/dashboard/overview');
        router.refresh();
    };

    return (
        <div className="px-2 py-2">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 hover:bg-zinc-50 group"
                        style={{ border: '1px solid var(--app-border)', background: 'var(--app-light)' }}
                    >
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-white text-[10px] font-bold"
                            style={{ background: 'var(--app-hex)' }}>
                            {(activeProject?.name?.[0] || 'P').toUpperCase()}
                        </div>
                        <span className="flex-1 text-left truncate text-[var(--app-text)]">
                            {activeProject?.name || 'Select project'}
                        </span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 rounded-xl p-1.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">
                        Projects
                    </div>
                    {projects.map((p: any) => {
                        const isSelected = p._id.toString() === activeProject?._id?.toString();
                        return (
                            <DropdownMenuItem
                                key={p._id.toString()}
                                className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer text-sm"
                                onClick={() => handleSelect(p._id.toString(), p.name)}
                            >
                                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                                    style={{ background: isSelected ? 'var(--app-hex)' : '#94a3b8' }}>
                                    {(p.name?.[0] || 'P').toUpperCase()}
                                </div>
                                <span className="flex-1 truncate font-medium">{p.name}</span>
                                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--app-hex)' }} />}
                            </DropdownMenuItem>
                        );
                    })}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                        <Link href="/dashboard/setup" className="flex items-center gap-2 px-2 py-2 text-xs text-zinc-500 rounded-lg">
                            + Add project
                        </Link>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

/* ─── App Header ─────────────────────────────────────────────────────────────── */

function AppHeader({ activeApp }: { activeApp: string }) {
    const meta = APP_META[activeApp] ?? { label: 'Dashboard', icon: LayoutGrid };
    const Icon = meta.icon;

    return (
        <div className="px-3 pt-4 pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
                <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500"
                    style={{ background: 'var(--app-light)', boxShadow: '0 0 12px var(--app-glow)' }}
                >
                    <Icon className="h-4 w-4" style={{ color: 'var(--app-text)' }} />
                </div>
                <div>
                    <p className="text-sm font-bold tracking-tight leading-none" style={{ color: 'var(--app-text)' }}>
                        {meta.label}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Navigation</p>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Component ─────────────────────────────────────────────────────────── */

interface AppSidebarProps {
    activeApp: string;
    currentUserRole: string;
}

export function AppSidebar({ activeApp, currentUserRole }: AppSidebarProps) {
    const { activeAccount } = useAdManager();
    const { activeProject, effectivePermissions } = useProject();
    const showProjectSwitcher = PROJECT_SCOPED_APPS.includes(activeApp);

    // Filter MenuItems by their permissionKey. Returns true when the user may
    // view that menu entry. Items without a permissionKey are always shown.
    const canShowMenuItem = React.useCallback(
        (item: { permissionKey?: string }) => {
            if (!item.permissionKey) return true;
            if (!effectivePermissions) return true; // preload fallback
            return canView(effectivePermissions, item.permissionKey);
        },
        [effectivePermissions],
    );

    const renderMenu = () => {
        switch (activeApp) {
            case 'whatsapp':
                return wachatMenuItems
                    .filter(item => item.roles?.includes(currentUserRole))
                    .map(item => <NavItem key={item.href} item={item} />);

            case 'ad-manager':
                // Always render the full Ad Manager menu. Individual pages handle
                // the "no account selected" state themselves so the user can still
                // navigate freely.
                return adManagerMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'sabchat':
                return sabChatMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'sabflow':
                return sabflowMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'facebook':
                return facebookMenuGroups.map(group => (
                    <React.Fragment key={group.title}>
                        <GroupLabel title={group.title} />
                        {group.items.map(item => <NavItem key={item.href} item={item} />)}
                    </React.Fragment>
                ));

            case 'instagram':
                if (!activeProject?.facebookPageId || !activeProject?.accessToken) return null;
                return instagramMenuGroups.flatMap(g => g.items).map(item => <NavItem key={item.href} item={item} />);

            case 'crm':
                return crmMenuGroups.map(group => (
                    <React.Fragment key={group.title}>
                        <GroupLabel title={group.title} />
                        {group.items.map(item => <NavItem key={item.href} item={item} />)}
                    </React.Fragment>
                ));

            case 'team':
                return teamMenuItems.filter(canShowMenuItem).map(item => <NavItem key={item.href} item={item} />);

            case 'email':
                return emailMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'sms':
                return smsMenuItems.map(item =>
                    item.subItems
                        ? <NavCollapsible key={item.href} item={item} />
                        : <NavItem key={item.href} item={item} />
                );

            case 'api':
                return apiMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'website-builder':
                return portfolioMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'url-shortener':
                return urlShortenerMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'qr-code-maker':
                return qrCodeMakerMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'seo-suite':
                return seoMenuItems.map(item => <NavItem key={item.href} item={item} />);

            case 'user-settings':
                return userSettingsItems.map(item => <NavItem key={item.href} item={item} />);

            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full w-56 bg-transparent">
            {/* App header */}
            <AppHeader activeApp={activeApp} />

            {/* Thin accent line under header */}
            <div className="mx-3 h-px mb-1" style={{ background: 'var(--app-border)' }} />

            {/* Project switcher */}
            {showProjectSwitcher && <InlineProjectSwitcher />}

            {/* Menu items */}
            <ScrollArea className="flex-1">
                <div className="px-2 pb-4 flex flex-col gap-0.5">
                    {renderMenu()}
                </div>
            </ScrollArea>
        </div>
    );
}
