import { Card } from '@/components/sabcrm/20ui/compat';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';

export default function LoadingTdsDetail() {
    return (
        <EntityDetailShell
            eyebrow="TDS"
            title="Loading..."
            back={{ href: '/dashboard/hrm/payroll/tds', label: 'TDS' }}
        >
            <Card className="p-6">
                <div className="h-40 animate-pulse bg-zoru-surface-2 rounded-md" />
            </Card>
        </EntityDetailShell>
    );
}
