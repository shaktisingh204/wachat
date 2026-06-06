import { Card } from '@/components/sabcrm/20ui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function LoadingTdsDetail() {
    return (
        <EntityDetailShell
            eyebrow="TDS"
            title="Loading..."
            back={{ href: '/dashboard/hrm/payroll/tds', label: 'TDS' }}
        >
            <Card className="p-6">
                <div className="h-40 animate-pulse bg-[var(--st-bg-muted)] rounded-md" />
            </Card>
        </EntityDetailShell>
    );
}
