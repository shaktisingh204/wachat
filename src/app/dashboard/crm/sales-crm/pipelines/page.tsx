'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type { CrmPipeline } from '@/lib/definitions';
import { Plus, Eye, Edit, Columns3 } from "lucide-react";
import { EditPipelinesDialog } from '@/components/wabasimplify/edit-pipelines-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

import { ClayButton, ClayCard } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

function PageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-64" />
                    <Skeleton className="h-4 w-96" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
            <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        </div>
    );
}

export default function SalesPipelinePage() {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [pipelines, setPipelines] = useState<CrmPipeline[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = () => {
        startTransition(async () => {
            const data = await getCrmPipelines();
            setPipelines(data);
        });
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading && pipelines.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <>
            <EditPipelinesDialog
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={fetchData}
                initialPipelines={pipelines}
            />
            <EditPipelinesDialog
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={fetchData}
                isCreating={true}
                initialPipelines={pipelines}
            />

            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Sales Pipelines"
                    subtitle="Create and manage multiple sales pipelines to track your deals."
                    icon={Columns3}
                    actions={
                        <>
                            <ClayButton variant="pill" leading={<Edit className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setIsEditOpen(true)}>
                                Edit Pipelines
                            </ClayButton>
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setIsCreateOpen(true)}>
                                New Pipeline
                            </ClayButton>
                        </>
                    }
                />

                {pipelines.length > 0 ? (
                    <Accordion type="multiple" defaultValue={pipelines.map(p => p.id)} className="w-full space-y-4">
                        {pipelines.map(pipeline => (
                            <AccordionItem key={pipeline.id} value={pipeline.id} className="rounded-clay-lg border border-clay-border bg-clay-surface">
                                <AccordionTrigger className="p-4 text-[15px] font-semibold text-clay-ink hover:no-underline">
                                    {pipeline.name}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {pipeline.stages.map((stage) => (
                                            <div key={stage.id} className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-3 text-center">
                                                <p className="text-[13px] font-medium text-clay-ink">{stage.name}</p>
                                                <p className="mt-1 text-[11.5px] text-clay-ink-muted">({stage.chance}% chance)</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Link href="/dashboard/crm/deals">
                                            <ClayButton variant="pill" size="sm" leading={<Eye className="h-4 w-4" strokeWidth={1.75} />}>
                                                View Leads in this Pipeline
                                            </ClayButton>
                                        </Link>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <ClayCard variant="outline" className="border-dashed">
                        <div className="flex flex-col items-center gap-3 py-16 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                                <Columns3 className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
                            </div>
                            <h3 className="text-[15px] font-semibold text-clay-ink">No Pipelines Found</h3>
                            <p className="text-[12.5px] text-clay-ink-muted">You haven&apos;t created any pipelines yet.</p>
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />} onClick={() => setIsCreateOpen(true)}>
                                Create Your First Pipeline
                            </ClayButton>
                        </div>
                    </ClayCard>
                )}
            </div>
        </>
    );
}
