import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { SuccessionForm } from './succession-form';

export default function NewSuccessionPage() {
    return (
        <EntityDetailShell
            title="New succession plan"
            eyebrow="SUCCESSION"
            back={{ href: '/dashboard/crm/hr/succession', label: 'Succession' }}
        >
            <SuccessionForm />
        </EntityDetailShell>
    );
}
