import { EntityListShell } from '@/components/crm/entity-list-shell';
import { SuccessionForm } from './succession-form';

export default function NewSuccessionPage() {
    return (
        <EntityListShell title="New succession plan">
            <SuccessionForm />
        </EntityListShell>
    );
}
