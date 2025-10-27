
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type { WithId, CrmPipeline } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Eye, Edit } from 'lucide-react';
import { EditPipelinesDialog } from '@/components/wabasimplify/edit-pipelines-dialog';
import { Skeleton } from '@/components/ui/skeleton';

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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
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

    const activePipeline = pipelines[0]; // For now, just use the first pipeline

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

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">{activePipeline?.name || 'Sales Pipeline'}</h1>
                         <p className="text-muted-foreground max-w-2xl mt-2">
                            This is a sample description of your Sales Pipeline - A way to track your potential leads as they progress through different statuses.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" disabled><Eye className="mr-2 h-4 w-4" /> View Leads</Button>
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Edit Pipeline</Button>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Pipeline
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {(activePipeline?.stages || []).map((stage) => (
                        <Card key={stage.id} className="text-center">
                            <CardHeader>
                                <CardTitle className="text-base font-medium text-muted-foreground">{stage.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">0</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

    