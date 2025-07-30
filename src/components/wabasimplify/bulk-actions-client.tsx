
'use client';

import { useState, useEffect } from 'react';
import type { WithId, Project, Template } from '@/lib/definitions';
import { BulkTemplateForm } from '@/components/wabasimplify/bulk-template-form';
import { Button } from '@/components/ui/button';
import { FileText, Rows } from 'lucide-react';
import Link from 'next/link';

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
                        Perform actions on {selectedProjects.length} selected project(s).
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
                    <Button asChild className="w-full">
                        <Link href={`/dashboard/bulk/template?projectIds=${projectIdsQuery}`}>
                            <FileText className="mr-2 h-4 w-4" />
                            Create & Apply New Template
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
