import { Card } from '@/components/zoruui';
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

export const dynamic = 'force-dynamic';

export default async function CrmNotificationsPage() {
    const result = await getCrmNotifications({ limit: 50 });

    if ('error' in result) {
        return (
            <div className="flex w-full flex-col gap-6 p-4 md:p-6">
                <ZoruCard className="p-6">
                    <h1 className="mb-1 text-base font-semibold text-zoru-ink">Notifications</h1>
                    <p className="text-sm text-zoru-ink-muted">{result.error}</p>
                </ZoruCard>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6 p-4 md:p-6">
            <NotificationsClient initialItems={result.items} initialKpis={result.kpis} />
        </div>
    );
}
