
'use client';

import { useState, useEffect, useTransition } from 'react';
import { getCrmPipelines } from '@/app/actions/crm-pipelines.actions';
import type { CrmPipeline } from '@/lib/definitions';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Eye, Edit, Briefcase } from "lucide-react";
import { EditPipelinesDialog } from '@/components/wabasimplify/edit-pipelines-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';

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

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                            <Briefcase className="h-8 w-8" />
                            Sales Pipelines
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Create and manage multiple sales pipelines to track your deals.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Edit Pipelines</Button>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Pipeline
                        </Button>
                    </div>
                </div>

                {pipelines.length > 0 ? (
                    <Accordion type="multiple" defaultValue={pipelines.map(p => p.id)} className="w-full space-y-4">
                        {pipelines.map(pipeline => (
                             <AccordionItem key={pipeline.id} value={pipeline.id} className="border rounded-lg bg-card">
                                <AccordionTrigger className="p-4 text-lg font-semibold hover:no-underline">
                                    {pipeline.name}
                                </AccordionTrigger>
                                <AccordionContent className="p-4 pt-0">
                                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        {pipeline.stages.map((stage) => (
                                            <Card key={stage.id} className="text-center bg-muted/50">
                                                <CardHeader className="p-3">
                                                    <CardTitle className="text-sm font-medium text-muted-foreground">{stage.name}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="p-3">
                                                    <p className="text-xs text-muted-foreground">({stage.chance}% chance)</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <Button asChild variant="secondary" size="sm">
                                            <Link href="/dashboard/crm/deals">
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Leads in this Pipeline
                                            </Link>
                                        </Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                     <Card className="text-center py-20">
                        <CardHeader>
                            <CardTitle>No Pipelines Found</CardTitle>
                            <CardDescription>You haven't created any pipelines yet.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Your First Pipeline
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
}
