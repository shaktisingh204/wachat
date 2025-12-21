
'use client';

import { useEffect, useState, useMemo, useCallback, useTransition } from 'react';
import type { Metadata } from "next";
import Link from 'next/link';
import { getProjects } from "@/lib/actions/user.actions.ts";
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { FileText, PlusCircle, Rows, X, Briefcase, Folder, CheckSquare, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import type { WithId } from "mongodb";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { Button } from "@/components/ui/button";
import type { Project, ProjectGroup } from "@/lib/definitions";
import { SyncProjectsDialog } from "@/components/wabasimplify/sync-projects-dialog";
import { useRouter, useSearchParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BulkChangeAppIdDialog } from '@/components/wabasimplify/bulk-change-app-id-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProject } from '@/context/project-context';

export default function SelectProjectPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { projects, reloadProjects, isLoadingProject } = useProject();
    
    const query = searchParams.get('query') || '';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 50;
    
    const [isClient, setIsClient] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
    const [isAppIdDialogOpen, setIsAppIdDialogOpen] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
        // On mount, ensure we have the freshest project list, especially after redirects.
        reloadProjects();
    }, [reloadProjects]);

    const handleSelectProject = (projectId: string) => {
        setSelectedProjects(prev => 
            prev.includes(projectId) 
            ? prev.filter(id => id !== projectId)
            : [...prev, projectId]
        );
    };

    const handleToggleSelectionMode = () => {
        if (selectionMode) {
            setSelectedProjects([]);
        }
        setSelectionMode(!selectionMode);
    };
    
    const filteredProjects = useMemo(() => {
        if (!projects || !Array.isArray(projects)) return [];
        if (!query) return projects;
        return projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    }, [projects, query]);

    const paginatedProjects = useMemo(() => {
        if (!filteredProjects || !Array.isArray(filteredProjects)) return [];
        const start = (page - 1) * limit;
        const end = start + limit;
        return filteredProjects.slice(start, end);
    }, [filteredProjects, page, limit]);
    
    const handleSelectAllOnPage = () => {
        const currentPageIds = paginatedProjects.map(p => p._id.toString());
        const allOnPageSelected = currentPageIds.every(id => selectedProjects.includes(id));
        
        if (allOnPageSelected) {
            // Deselect all on current page
            setSelectedProjects(prev => prev.filter(id => !currentPageIds.includes(id)));
        } else {
            // Select all on current page
            setSelectedProjects(prev => [...new Set([...prev, ...currentPageIds])]);
        }
    };

    const handleNavigateToBulk = () => {
        localStorage.setItem('bulkProjectIds', JSON.stringify(selectedProjects));
        router.push(`/dashboard/bulk`);
    }

    const groupedProjects = useMemo(() => {
        const grouped: { [key: string]: WithId<Project>[] } = {};
        const ungrouped: WithId<Project>[] = [];
        
        paginatedProjects.forEach(p => {
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
    }, [paginatedProjects]);
    
    const totalPages = Math.ceil((filteredProjects || []).length / limit);

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(newPage));
        router.push(`?${params.toString()}`);
    }

    const handleLimitChange = (newLimit: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('limit', newLimit);
        params.set('page', '1'); // Reset to first page
        router.push(`?${params.toString()}`);
    }

    if (!isClient) {
        return <div>Loading...</div>; // Or a skeleton loader
    }


    return (
        <div className="flex flex-col gap-8">
             <BulkChangeAppIdDialog 
                isOpen={isAppIdDialogOpen} 
                onOpenChange={setIsAppIdDialogOpen}
                projectIds={selectedProjects}
                onSuccess={() => {
                    reloadProjects();
                    setSelectedProjects([]);
                }}
            />
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Select a Project ({(projects || []).length})</h1>
                    <p className="text-muted-foreground">
                        Choose an existing project or connect a new one to get started.
                    </p>
                </div>
                 <div className="flex flex-wrap items-center gap-2">
                    <SyncProjectsDialog onSuccess={reloadProjects} />
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
               <Button variant="outline" onClick={handleToggleSelectionMode}>
                    {selectionMode ? 'Cancel Selection' : 'Select Projects'}
                </Button>
                {selectionMode && (
                    <Button variant="outline" onClick={handleSelectAllOnPage}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Select Page ({paginatedProjects.length})
                    </Button>
                )}
            </div>

            {isLoadingProject ? (
                 <p>Loading projects...</p>
            ) : Array.isArray(projects) && projects.length > 0 ? (
                <div className="space-y-6">
                    {Object.entries(groupedProjects.grouped).map(([groupName, groupProjects]) => (
                        <Accordion key={groupName} type="single" collapsible defaultValue="item-1">
                            <AccordionItem value="item-1">
                                <div className="flex items-center">
                                    <AccordionTrigger className="text-xl font-semibold hover:no-underline flex-1">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-5 w-5 text-muted-foreground" />
                                            {groupName} ({groupProjects.length})
                                        </div>
                                    </AccordionTrigger>
                                </div>
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
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select value={String(limit)} onValueChange={handleLimitChange}>
                        <SelectTrigger className="w-20">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="25">25</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page <= 1}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline ml-2">Previous</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page >= totalPages}
                    >
                         <span className="hidden sm:inline mr-2">Next</span>
                         <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            
            {selectionMode && selectedProjects.length > 0 && (
                 <Card className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md shadow-2xl z-50 animate-fade-in-up">
                    <CardContent className="p-3 flex items-center justify-between">
                        <p className="text-sm font-medium">{selectedProjects.length} project(s) selected</p>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button>
                                    <Rows className="mr-2 h-4 w-4" />
                                    Bulk Actions
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={handleNavigateToBulk}>
                                    Bulk Template / Broadcast
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setIsAppIdDialogOpen(true)}>
                                    Change App ID
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
