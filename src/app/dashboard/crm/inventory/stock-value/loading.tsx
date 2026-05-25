import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
    return (
        <EntityListShell
            title="Stock value report"
            subtitle="Real-time valuation of every SKU across every warehouse."
            loading={true}
        >
            <div className="h-64" />
        </EntityListShell>
    );
}
