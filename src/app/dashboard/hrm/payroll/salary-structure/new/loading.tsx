import { LoaderCircle } from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';

export default function Loading() {
    return (
        <EntityListShell
            title="New salary structure"
            subtitle="Capture an employee's basic / HRA / DA, plus PF, ESI, professional tax."
        >
            <div className="p-8 flex justify-center">
                <LoaderCircle className="animate-spin text-[var(--st-text-secondary)] w-8 h-8" />
            </div>
        </EntityListShell>
    );
}
