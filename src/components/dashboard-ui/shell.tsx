'use client';

import { usePathname } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';
import { findAppSidebarConfig } from '@/components/zoruui/shell/zoru-app-sidebars';
import { CommandPaletteProvider, useCommandPalette } from '@/components/crm/command-palette';
import { useProject } from '@/context/project-context';
import { isElevatedRole } from '@/lib/rbac';
import { AppRail } from './app-rail';
import { Sidebar, type SidebarGroup, type SidebarLeaf } from './sidebar';
import { Topbar } from './topbar';
import { getActiveSlug } from './active-module';

export interface DashboardShellProps {
    user?: { name?: string | null; email?: string | null; avatar?: string | null; role?: string | null };
    plan?: { name?: string | null; credits?: number };
    /** Skip rendering the sidebar for full-bleed routes (canvases, 3-pane layouts). */
    children: ReactNode;
}

/**
 * Full-bleed routes opt out of the padded main wrapper so the page
 * can paint edge-to-edge (flow builder, sabwa inbox, etc.).
 */
function isFullBleedRoute(pathname: string | null): boolean {
    if (!pathname) return false;
    if (/^\/dashboard\/sabflow\/flow-builder\/[^/]+/.test(pathname)) return true;
    if (pathname === '/sabwa/inbox' || pathname.startsWith('/sabwa/inbox/')) return true;
    return false;
}

export function DashboardShell({ user, plan, children }: DashboardShellProps) {
    return (
        <CommandPaletteProvider>
            <ShellInner user={user} plan={plan}>
                {children}
            </ShellInner>
        </CommandPaletteProvider>
    );
}

function ShellInner({ user, plan, children }: DashboardShellProps) {
    const pathname = usePathname();
    // Keep the palette mounted so existing keybindings continue to work.
    useCommandPalette();

    const activeSlug = getActiveSlug(pathname);
    const fullBleed = isFullBleedRoute(pathname);

    // Use the existing per-module sidebar config so all module menus
    // (wachat, crm, sabflow, hrm, ...) work without duplicating data.
    const activeAppConfig = useMemo(() => findAppSidebarConfig(pathname), [pathname]);
    const rawGroups: SidebarGroup[] = useMemo(
        () => (activeAppConfig ? (activeAppConfig.build(pathname ?? '') as SidebarGroup[]) : []),
        [activeAppConfig, pathname],
    );

    // RBAC: strip admin-only entries for non-admin members (same rule the old shell applied).
    const { effectivePermissions } = useProject();
    const isAdmin = Boolean(effectivePermissions?.isOwner) || isElevatedRole(effectivePermissions?.role);

    const groups: SidebarGroup[] = useMemo(() => {
        if (isAdmin) return rawGroups;
        const stripAdmin = (items: SidebarLeaf[]): SidebarLeaf[] =>
            items
                .filter((it) => !it.adminOnly)
                .map((it) => (it.children ? { ...it, children: stripAdmin(it.children) } : it));
        return rawGroups
            .map((g) => ({ ...g, items: stripAdmin(g.items) }))
            .filter((g) => g.items.length > 0);
    }, [rawGroups, isAdmin]);

    return (
        <div className="flex h-[100dvh] w-full overflow-hidden bg-[#fafaf7] text-zinc-900 antialiased">
            <AppRail />
            {!fullBleed && groups.length > 0 && (
                <Sidebar
                    activeSlug={activeSlug}
                    groups={groups}
                    heading={activeAppConfig?.heading as ReactNode}
                    caption={activeAppConfig?.caption as ReactNode}
                />
            )}

            <div className="relative flex min-w-0 flex-1 flex-col">
                <Topbar user={user} plan={plan} />
                <main className={fullBleed ? 'min-w-0 flex-1 overflow-auto' : 'min-w-0 flex-1 overflow-auto'}>
                    {children}
                </main>
            </div>
        </div>
    );
}
