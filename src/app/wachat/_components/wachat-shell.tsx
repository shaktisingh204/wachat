'use client';

import { DashboardShell } from '@/components/dashboard-ui/shell';
import type { ReactNode } from 'react';

/**
 * WachatShell — thin wrapper around the new `DashboardShell`. The shell
 * auto-resolves the active sidebar from the pathname (via
 * `findAppSidebarConfig`), so /wachat/* automatically picks up the
 * existing Wachat module menu without us re-declaring it here.
 *
 * Kept as a wrapper so future Wachat-only banners / notices can land
 * here without touching every page.
 */

export interface WachatShellProps {
    user?: { name?: string | null; email?: string | null; avatar?: string | null; role?: string | null };
    plan?: { name?: string | null; credits?: number };
    children: ReactNode;
}

export function WachatShell({ user, plan, children }: WachatShellProps) {
    return (
        <DashboardShell user={user} plan={plan}>
            {children}
        </DashboardShell>
    );
}
