/**
 * Open new POS session — `/dashboard/crm/pos/sessions/new`.
 *
 * Server component shell hosts the `<PosSessionNewForm>` client island.
 * Terminal is free-text for now (per spec); follow-up batch will add a
 * lookup-registry entry for `terminal`.
 */

import { Store } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

import { PosSessionNewForm } from '../../_components/pos-session-new-form';

export const dynamic = 'force-dynamic';

export default function NewPosSessionPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Open POS session"
                subtitle="Start a fresh cashier shift on a terminal."
                icon={Store}
                breadcrumbs={[
                    { label: 'CRM', href: '/dashboard/crm' },
                    { label: 'POS', href: '/dashboard/crm/pos' },
                    { label: 'Sessions', href: '/dashboard/crm/pos/sessions' },
                    { label: 'New' },
                ]}
            />
            <PosSessionNewForm />
        </div>
    );
}
