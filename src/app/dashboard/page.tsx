

'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import type { Metadata } from "next";
import Link from 'next/link';
import { getProjects } from "@/app/actions";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText, PlusCircle, Rows, X, Briefcase, Folder } from "lucide-react";
import type { WithId } from "mongodb";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { Button } from "@/components/ui/button";
import type { Project, ProjectGroup } from "@/lib/definitions";
import { SyncProjectsDialog } from "@/components/wabasimplify/sync-projects-dialog";
import { useRouter, useSearchParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function SelectProjectPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const query = searchParams ? searchParams.get('query') || '' : '';
    const [projects, setProjects] = useState<WithId<Project>[]>([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    
    const fetchProjects = useCallback(async () => {
        const projectsData = await getProjects(query, 'whatsapp');
        setProjects(projectsData);
    }, [query]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleSelectProject = (projectId: string) => {
        setSelectedProjects(prev => 
            prev.includes(projectId) 
            ? prev.filter(id => id !== projectId)
            : [...prev, projectId]
        );
    };

    const handleBulkAction = () => {
        const params = new URLSearchParams();
        params.set('projectIds', selectedProjects.join(','));
        router.push(`/dashboard/bulk?${params.toString()}`);
    }

    const groupedProjects = useMemo(() => {
        const grouped: { [key: string]: WithId<Project>[] } = {};
        const ungrouped: WithId<Project>[] = [];
        
        projects.forEach(p => {
            if (p.groupId && p.groupName) {
                if (!grouped[p.groupName]) {
                    grouped[p.groupName] = [];
                }
                grouped[p.groupName].push(p);
            } else {
                ungrouped.push(p);
            }
        });

        return { grouped, ungrouped };
    }, [projects]);


    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Select a Project ({projects.length})</h1>
                    <p className="text-muted-foreground">
                        Choose an existing project or connect a new one to get started.
                    </p>
                </div>
                 <div className="flex flex-wrap items-center gap-2">
                    <SyncProjectsDialog onSuccess={fetchProjects} />
                     <Button asChild>
                      <Link href="/dashboard/setup">
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Connect New Project
                      </Link>
                  </Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-grow md:max-w-sm">
                  <ProjectSearch placeholder="Search projects by name..." />
              </div>
               <Button variant="outline" onClick={() => setSelectionMode(!selectionMode)}>
                    {selectionMode ? 'Cancel Selection' : 'Select Projects'}
                </Button>
            </div>

            {projects.length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedProjects.grouped).map(([groupName, groupProjects]) => (
                        <Accordion key={groupName} type="single" collapsible defaultValue="item-1">
                            <AccordionItem value="item-1">
                                <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                                    <div className="flex items-center gap-2">
                                        <Folder className="h-5 w-5 text-muted-foreground" />
                                        {groupName} ({groupProjects.length})
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-4">
                                        {groupProjects.map((project) => (
                                            <ProjectCard 
                                                key={project._id.toString()} 
                                                project={project} 
                                                selectionMode={selectionMode}
                                                isSelected={selectedProjects.includes(project._id.toString())}
                                                onSelect={handleSelectProject}
                                            />
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    ))}
                     {groupedProjects.ungrouped.length > 0 && (
                        <div>
                             <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5 text-muted-foreground" /> Ungrouped Projects</h2>
                             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedProjects.ungrouped.map((project) => (
                                    <ProjectCard 
                                        key={project._id.toString()} 
                                        project={project} 
                                        selectionMode={selectionMode}
                                        isSelected={selectedProjects.includes(project._id.toString())}
                                        onSelect={handleSelectProject}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                 <div className="col-span-full">
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 py-20 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mt-4">No Projects Found</h3>
                        <p className="text-muted-foreground mt-2 max-w-sm">
                          {query 
                            ? "No projects matched your search."
                            : "You haven't connected any WhatsApp Business Accounts yet. Click 'Connect New Project' to get started."
                          }
                        </p>
                    </div>
                </div>
            )}
            
            {selectionMode && selectedProjects.length > 0 && (
                 <Card className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md shadow-2xl z-50 animate-fade-in-up">
                    <CardContent className="p-3 flex items-center justify-between">
                        <p className="text-sm font-medium">{selectedProjects.length} project(s) selected</p>
                        <Button onClick={handleBulkAction}>
                            <Rows className="mr-2 h-4 w-4" />
                            Bulk Actions
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
