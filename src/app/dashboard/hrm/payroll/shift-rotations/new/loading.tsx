import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

export default function NewShiftRotationLoading() {
    return (
        <EntityListShell
            title="New Shift Rotation"
            subtitle="Build a repeating shift pattern for an employee, department or team."
        >
            <div className="space-y-4 rounded-xl border bg-[var(--st-bg-secondary)] p-6">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
        </EntityListShell>
    );
}
