
'use client';

import { useState, useEffect } from 'react';
import type { WithId, Project, Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/wabasimplify/bulk-template-form';
import { Button } from '@/components/ui/button';
import { FileText, Rows, Send } from 'lucide-react';
import Link from 'next/link';
import { BulkBroadcastForm } from './bulk-broadcast-form';

interface BulkActionsClientProps {
    sourceProjectName: string;
    allProjects: WithId<Project>[];
    initialTemplates: WithId<Template>[];
    initialSelectedProjects: WithId<Project>[];
}

export function BulkActionsClient({ sourceProjectName, allProjects, initialTemplates, initialSelectedProjects }: BulkActionsClientProps) {
    const [selectedProjects, setSelectedProjects] = useState<WithId<Project>[]>(initialSelectedProjects);
    
    useEffect(() => {
        document.title = "Bulk Actions | SabNode";
    }, []);

    const projectIdsQuery = selectedProjects.map(p => p._id.toString()).join(',');

    return (
         <div className="flex flex-col gap-8">
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Bulk Actions</h1>
                    <p className="text-muted-foreground">
                        Performing actions on {selectedProjects.length} selected project(s).
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <BulkTemplateForm
                        sourceProjectName={sourceProjectName}
                        targetProjects={selectedProjects}
                        templates={initialTemplates}
                    />
                </div>
                 <div className="lg:col-span-1">
                    <BulkBroadcastForm
                        sourceProjectName={sourceProjectName}
                        targetProjects={selectedProjects}
                        templates={initialTemplates}
                    />
                </div>
                 <div className="lg:col-span-1">
                    <Button asChild className="w-full h-full min-h-48 text-lg">
                        <Link href={`/dashboard/bulk/template?projectIds=${projectIdsQuery}`}>
                            <FileText className="mr-4 h-8 w-8" />
                            <div>
                                <p className="font-semibold">Create & Apply New Template</p>
                                <p className="text-sm font-normal text-primary-foreground/80">Build a template from scratch and apply to all.</p>
                            </div>
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
