'use client';

import { Plus, Columns3 } from "lucide-react";
import Link from 'next/link';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function PipelinesPage() {
    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Pipelines"
                subtitle="Create and manage multiple sales pipelines to track your deals."
                icon={Columns3}
                actions={
                    <Link href="#">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Pipeline
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard variant="outline" className="border-dashed">
                <div className="flex flex-col items-center gap-3 py-16 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                        <Columns3 className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
                    </div>
                    <h3 className="text-[15px] font-semibold text-clay-ink">No Pipelines Found</h3>
                    <p className="text-[12.5px] text-clay-ink-muted">You haven&apos;t created any pipelines yet.</p>
                    <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                        Create Your First Pipeline
                    </ClayButton>
                </div>
            </ClayCard>
        </div>
    );
}
