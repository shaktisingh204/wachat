import React from "react";
/**
 * /portal/client/projects — read-only project list for the signed-in client.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getClientProjects } from '@/app/actions/client-portal.actions';
import { Badge } from '@/components/zoruui/badge';
import {
    Card,
    ZoruCardContent,
} from '@/components/zoruui/card';
import {
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
} from '@/components/zoruui/table';
import { EmptyState } from '@/components/zoruui/empty-state';
import { Progress } from '@/components/zoruui/progress';
import { cn } from '@/components/zoruui/lib/cn';
import { buttonVariants } from '@/components/zoruui/button';
import { ClientProject } from '@/lib/client-portal/types';

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = s.toLowerCase();
    if (v === 'completed') return 'secondary';
    if (v === 'cancelled') return 'destructive';
    if (v === 'on-hold') return 'outline';
    return 'default';
}

function getProjectHealth(project: ClientProject) {
    if (project.status.toLowerCase() === 'completed' || project.progress === 100) return 'Completed';
    if (!project.endDate) return 'On Track';

    const end = new Date(project.endDate);
    const now = new Date();
    
    if (end < now && project.progress < 100) return 'Delayed';
    
    const daysLeft = (end.getTime() - now.getTime()) / (1000 * 3600 * 24);
    if (daysLeft <= 7 && project.progress < 80) return 'At Risk';
    
    return 'On Track';
}

function healthVariant(health: string): 'success' | 'danger' | 'warning' | 'info' {
    if (health === 'Completed') return 'success';
    if (health === 'Delayed') return 'danger';
    if (health === 'At Risk') return 'warning';
    return 'info';
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

async function ClientProjectsPageContent(props: {
    searchParams: Promise<{ filter?: string }>;
}) {
    const searchParams = await props.searchParams;
    const filter = searchParams.filter || 'all';
    const allProjects = await getClientProjects();

    const projects = allProjects.filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'completed') return p.status.toLowerCase() === 'completed';
        if (filter === 'active') return p.status.toLowerCase() !== 'completed';
        return true;
    });

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">My Projects</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Read-only view of projects assigned to you.
                </p>
            </div>

            {allProjects.length === 0 ? (
                <EmptyState
                    title="No projects yet"
                    description="You'll see projects here once they're created for you."
                />
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        <Link
                            href="?filter=all"
                            className={cn(
                                buttonVariants({ variant: filter === 'all' ? 'default' : 'outline', size: 'sm' })
                            )}
                        >
                            All
                        </Link>
                        <Link
                            href="?filter=active"
                            className={cn(
                                buttonVariants({ variant: filter === 'active' ? 'default' : 'outline', size: 'sm' })
                            )}
                        >
                            Active
                        </Link>
                        <Link
                            href="?filter=completed"
                            className={cn(
                                buttonVariants({ variant: filter === 'completed' ? 'default' : 'outline', size: 'sm' })
                            )}
                        >
                            Completed
                        </Link>
                    </div>

                    {projects.length === 0 ? (
                        <EmptyState
                            title="No projects found"
                            description={`No ${filter} projects match your criteria.`}
                        />
                    ) : (
                        <Card>
                            <ZoruCardContent className="p-0">
                                <Table>
                                    <ZoruTableHeader>
                                        <ZoruTableRow>
                                            <ZoruTableHead>Name</ZoruTableHead>
                                            <ZoruTableHead>Status</ZoruTableHead>
                                            <ZoruTableHead>Health</ZoruTableHead>
                                            <ZoruTableHead>Deadline</ZoruTableHead>
                                            <ZoruTableHead>Progress</ZoruTableHead>
                                        </ZoruTableRow>
                                    </ZoruTableHeader>
                                    <ZoruTableBody>
                                        {projects.map((p) => {
                                            const health = getProjectHealth(p);
                                            return (
                                                <ZoruTableRow key={p._id}>
                                                    <ZoruTableCell>
                                                        <Link
                                                            href={`/portal/client/projects/${p._id}`}
                                                            className="font-medium text-zoru-ink hover:underline"
                                                        >
                                                            {p.name}
                                                        </Link>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <Badge variant={healthVariant(health)}>{health}</Badge>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>{fmtDate(p.endDate)}</ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <div className="flex flex-col gap-1 w-32">
                                                            <div className="flex items-center justify-between text-xs text-zoru-ink-muted">
                                                                <span>Progress</span>
                                                                <span>{p.progress}%</span>
                                                            </div>
                                                            <Progress value={p.progress} className="h-2" />
                                                        </div>
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })}
                                    </ZoruTableBody>
                                </Table>
                            </ZoruCardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    );
}


export default function ClientProjectsPage(props: {
    searchParams: Promise<{ filter?: string }>;
}) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <ClientProjectsPageContent searchParams={searchParams} />
    </React.Suspense>
  );
}
