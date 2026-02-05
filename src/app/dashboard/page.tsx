'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ProjectCard } from "@/components/wabasimplify/project-card";
import { SeoProjectCard } from "@/components/wabasimplify/seo-project-card";

import { FileText, PlusCircle, Briefcase, Folder, ChevronLeft, ChevronRight, Clock, Search, Filter } from "lucide-react";
import type { WithId } from "mongodb";
import { ProjectSearch } from "@/components/wabasimplify/project-search";
import { Button } from "@/components/ui/button";
import type { Project, ProjectGroup } from "@/lib/definitions";
import { SyncProjectsDialog } from "@/components/wabasimplify/sync-projects-dialog";
import { useRouter, useSearchParams } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProject } from '@/context/project-context';
import { Input } from '@/components/ui/input';

export default function SelectProjectPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { projects: allProjects, reloadProjects, isLoadingProject } = useProject();

    // Only WaChat projects (those with wabaId) as per user request
    const projects = useMemo(() => allProjects.filter(p => !!p.wabaId), [allProjects]);

    const query = searchParams.get('query') || '';
    const page = Number(searchParams.get('page')) || 1;
    const limit = Number(searchParams.get('limit')) || 50;

    const [isClient, setIsClient] = useState(false);
    const [recentProjectIds, setRecentProjectIds] = useState<string[]>([]);

    useEffect(() => {
        setIsClient(true);
        // Load recents
        const recent = localStorage.getItem('recentProjects');
        if (recent) {
            try {
                setRecentProjectIds(JSON.parse(recent));
            } catch (e) { }
        }
    }, []);

    // Logic to update recents would exist in ProjectCard click handler, 
    // here we just read them.

    const recentProjects = useMemo(() => {
        return projects.filter(p => recentProjectIds.includes(p._id.toString())).slice(0, 4);
    }, [projects, recentProjectIds]);

    const filteredProjects = useMemo(() => {
        if (!projects || !Array.isArray(projects)) return [];
        if (!query) return projects;
        return projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    }, [projects, query]);

    const paginatedProjects = useMemo(() => {
        if (!Array.isArray(filteredProjects)) return [];
        const start = (page - 1) * limit;
        const end = start + limit;
        return filteredProjects.slice(start, end);
    }, [filteredProjects, page, limit]);

    const groupedProjects = useMemo(() => {
        const grouped: { [key: string]: WithId<Project>[] } = {};
        const ungrouped: WithId<Project>[] = [];

        if (!Array.isArray(paginatedProjects)) return { grouped, ungrouped };

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
        params.set('page', '1');
        router.push(`?${params.toString()}`);
    }

    if (!isClient) {
        return <div className="p-8 flex items-center justify-center">Loading Workspace...</div>;
    }

    return (
        <div className="flex flex-col gap-8 max-w-[1600px] mx-auto pb-20">
            {/* 1. Header with Greeting */}


            {/* 2. Recent Projects Row (if any) */}
            {recentProjects.length > 0 && !query && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" /> Recently Accessed
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {recentProjects.map(p => (
                            <ProjectCard key={p._id.toString()} project={p} />
                        ))}
                    </div>
                    <div className="my-8 border-t border-dashed border-border/50" />
                </div>
            )}

            {/* 3. Controls & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-muted/20 p-4 rounded-xl border border-border/40">
                <div className="w-full md:w-auto flex-1 max-w-lg space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Find Project</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <ProjectSearch placeholder="Search by name, ID..." className="pl-9 h-10 w-full" />
                        </div>
                        <Button variant="outline" size="icon" className="shrink-0">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <SyncProjectsDialog onSuccess={reloadProjects} />
                    <Button asChild size="lg" className="shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
                        <Link href="/dashboard/setup">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Connect New Project
                        </Link>
                    </Button>
                </div>
            </div>

            {/* 4. Main Grid */}
            {isLoadingProject ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted/20 animate-pulse rounded-xl" />)}
                </div>
            ) : Array.isArray(projects) && projects.length > 0 ? (
                <div className="space-y-8">
                    {/* Ungrouped first for immediate access if typical */}
                    {groupedProjects.ungrouped.length > 0 && (
                        <div>
                            {Object.keys(groupedProjects.grouped).length > 0 && (
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-primary" /> All Projects
                                </h2>
                            )}
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupedProjects.ungrouped.map((project) => (
                                    project.wabaId ? (
                                        <ProjectCard
                                            key={project._id.toString()}
                                            project={project}
                                        />
                                    ) : (
                                        <SeoProjectCard
                                            key={project._id.toString()}
                                            project={project}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {Object.entries(groupedProjects.grouped).map(([groupName, groupProjects]) => (
                        <div key={groupName} className="bg-muted/10 p-6 rounded-2xl border border-border/40">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-foreground/80">
                                <Folder className="h-5 w-5 text-blue-500 fill-blue-500/20" />
                                {groupName}
                                <span className="text-sm font-normal text-muted-foreground bg-background px-2 py-0.5 rounded-full border">
                                    {groupProjects.length}
                                </span>
                            </h2>
                            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupProjects.map((project) => (
                                    project.wabaId ? (
                                        <ProjectCard
                                            key={project._id.toString()}
                                            project={project}
                                        />
                                    ) : (
                                        <SeoProjectCard
                                            key={project._id.toString()}
                                            project={project}
                                        />
                                    )
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="col-span-full py-20">
                    <div className="max-w-md mx-auto text-center space-y-6">
                        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                            <PlusCircle className="h-10 w-10 text-primary animate-pulse" />
                            <div className="absolute inset-0 border border-primary/20 rounded-full animate-ping opacity-20" />
                        </div>

                        <h3 className="text-2xl font-bold">Start Your Journey</h3>
                        <p className="text-muted-foreground text-lg">
                            {query
                                ? "No projects matched your search."
                                : "You haven't connected any projects yet. Connect your first WhatsApp or Facebook account to unlock the dashboard."
                            }
                        </p>
                        {!query && (
                            <Button asChild size="lg" className="mt-8 w-full max-w-sm">
                                <Link href="/dashboard/setup">
                                    Connect Project
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            )}

            {/* Pagination / Footer */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/40">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Rows per page</span>
                        <Select value={String(limit)} onValueChange={handleLimitChange}>
                            <SelectTrigger className="w-20 h-8">
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
                        <span className="text-sm text-medium text-muted-foreground mr-4">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page >= totalPages}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
