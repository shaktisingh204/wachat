import { EntityListShell } from '@/components/crm/entity-list-shell';
import { Skeleton } from '@/components/zoruui';

export default function LoadingEditSalaryStructure() {
    return (
        <EntityListShell
            title="Edit · Loading..."
            subtitle="Update earnings, deductions, or archive this structure."
        >
            <div className="space-y-4 rounded-xl border border-zoru-line bg-zoru-surface p-6 shadow-sm">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="mt-6 h-[200px] w-full" />
            </div>
        </EntityListShell>
    );
}
