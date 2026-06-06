import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { Card } from '@/components/sabcrm/20ui';

export default function Loading() {
    return (
        <EntityDetailShell
            eyebrow="SALARY STRUCTURE"
            title="Loading..."
            back={{ href: '/dashboard/hrm/payroll/salary-structure', label: 'Salary structures' }}
        >
            <Card className="p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 w-1/4 rounded bg-[var(--st-bg-muted)]"></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-24 rounded bg-[var(--st-bg-muted)]"></div>
                        <div className="h-24 rounded bg-[var(--st-bg-muted)]"></div>
                    </div>
                </div>
            </Card>
        </EntityDetailShell>
    );
}
