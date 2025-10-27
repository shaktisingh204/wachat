
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Eye, Edit } from 'lucide-react';
import { EditPipelinesDialog } from '@/components/wabasimplify/edit-pipelines-dialog';


const pipelineStages = [
    { name: 'Open', count: 0 },
    { name: 'Contacted', count: 0 },
    { name: 'Proposal Sent', count: 0 },
    { name: 'Deal Done', count: 0 },
    { name: 'Lost', count: 0 },
    { name: 'Not Serviceable', count: 0 }
];

export default function SalesPipelinePage() {
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    
    // In a real implementation, you would fetch and pass the pipelines here.
    const handlePipelinesUpdated = () => {
        // This function would be used to refetch pipeline data after an update.
        console.log("Pipelines updated, refetching data...");
    }

    return (
        <>
            <EditPipelinesDialog 
                isOpen={isEditOpen}
                onOpenChange={setIsEditOpen}
                onSuccess={handlePipelinesUpdated}
                initialPipelines={[{ id: 'default', name: 'Sales Pipeline', stages: pipelineStages.map(s => ({...s, id: s.name})) }]}
            />
             <EditPipelinesDialog 
                isOpen={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={handlePipelinesUpdated}
                isCreating={true}
            />

            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Sales Pipeline</h1>
                         <p className="text-muted-foreground max-w-2xl mt-2">
                            This is a sample description of your Sales Pipeline - A way to track your potential leads as they progress through different statuses.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline"><Eye className="mr-2 h-4 w-4" /> View Leads</Button>
                        <Button variant="outline" onClick={() => setIsEditOpen(true)}><Edit className="mr-2 h-4 w-4" /> Edit Pipeline</Button>
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> New Pipeline
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
                    {pipelineStages.map((stage) => (
                        <Card key={stage.name} className="text-center">
                            <CardHeader>
                                <CardTitle className="text-base font-medium text-muted-foreground">{stage.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-4xl font-bold">{stage.count}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}
