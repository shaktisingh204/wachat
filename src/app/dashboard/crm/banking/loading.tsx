import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
    return (
        <EntityListShell
            title="Banking"
            subtitle="Bank accounts, statements, and reconciliation against your books."
            loading={true}
        >
            <div />
        </EntityListShell>
    );
}
