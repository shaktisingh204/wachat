import { Card } from '@/components/sabcrm/20ui/compat';
import { getCrmNotifications } from '@/app/actions/crm-notifications.actions';

/**
 * §5.3 — CRM Notifications Hub page.
 *
 * Server Component that:
 *   1. Resolves the current user's notifications via
 *      `getCrmNotifications()` (backed by `crm_audit_log`).
 *   2. Hands the initial payload to a client island for filter chips +
 *      optimistic mark-read.
 *
 * RBAC: enforced inside `getCrmNotifications` — falls back to error
 * banner if the user lacks `crm_lead.view` (documented gap: no
 * `crm_notification` module key exists in `permission-modules.ts`).
 *
 * This route is intentionally dynamic — notification freshness is
 * primary and we'd rather pay the per-request cost than serve a stale
 * cached page.
 */

import { NotificationsClient } from './_components/notifications-client';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import React from 'react';

export const dynamic = 'force-dynamic';

async function NotificationsContent() {
    const result = await getCrmNotifications({ limit: 50 });

    if ('error' in result) {
        return (
            <Card className="p-6">
                <h1 className="mb-1 text-base font-semibold text-[var(--st-text)]">Notifications Error</h1>
                <p className="text-sm text-[var(--st-text-secondary)]">{result.error}</p>
            </Card>
        );
    }

    return (
        <NotificationsClient 
            initialItems={result.items} 
            initialKpis={result.kpis} 
            initialNextCursor={result.nextCursor}
            initialOptedOutKinds={result.optedOutKinds}
        />
    );
}

export default function CrmNotificationsPage() {
    return (
        <EntityListShell
            title="Notifications"
            subtitle="View all CRM activity notifications."
        >
            <React.Suspense fallback={
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-20 w-full animate-pulse bg-[var(--st-bg-muted)] rounded-md" />
                    ))}
                </div>
            }>
                <NotificationsContent />
            </React.Suspense>
        </EntityListShell>
    );
}
