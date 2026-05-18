/**
 * Open new POS session — `/dashboard/crm/pos/sessions/new`.
 *
 * Server component shell hosts the `<PosSessionNewForm>` client island.
 * Terminal is free-text for now (per spec); follow-up batch will add a
 * lookup-registry entry for `terminal`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

import { PosSessionNewForm } from '../../_components/pos-session-new-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/pos/sessions';

export default function NewPosSessionPage() {
    return (
        <EntityDetailShell
            eyebrow="POS SESSION"
            title="Open POS session"
            back={{ href: BASE, label: 'Sessions' }}
        >
            <PosSessionNewForm />
        </EntityDetailShell>
    );
}
