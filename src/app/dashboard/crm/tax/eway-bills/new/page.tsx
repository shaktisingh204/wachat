import { Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/zoruui';

/**
 * Generate-new e-way bill — `/dashboard/crm/tax/eway-bills/new`.
 *
 * Thin shell: a form that posts to the `generateEWayBill` server action.
 * Invoice lookup is left as a string id for now — the picker can be
 * wired up in a follow-up using the existing entity-picker.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { NewEWayBillForm } from './_components/new-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tax/eway-bills';

export default function NewEWayBillPage() {
    return (
        <EntityDetailShell
            eyebrow="E-WAY BILL"
            title="Generate e-way bill"
            back={{ href: BASE, label: 'E-way bills' }}
        >
            <ZoruCard>
                <ZoruCardHeader>
                    <ZoruCardTitle>Consignment details</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <NewEWayBillForm />
                </ZoruCardContent>
            </ZoruCard>
        </EntityDetailShell>
    );
}
