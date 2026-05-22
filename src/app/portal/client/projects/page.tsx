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

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = s.toLowerCase();
    if (v === 'completed') return 'secondary';
    if (v === 'cancelled') return 'destructive';
    if (v === 'on-hold') return 'outline';
    return 'default';
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString();
}

export default async function ClientProjectsPage() {
    const projects = await getClientProjects();

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h1 className="text-2xl font-semibold text-zoru-ink">My Projects</h1>
                <p className="text-sm text-zoru-ink-muted">
                    Read-only view of projects assigned to you.
                </p>
            </div>

            {projects.length === 0 ? (
                <EmptyState
                    title="No projects yet"
                    description="You'll see projects here once they're created for you."
                />
            ) : (
                <Card>
                    <ZoruCardContent className="p-0">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead>Name</ZoruTableHead>
                                    <ZoruTableHead>Status</ZoruTableHead>
                                    <ZoruTableHead>Deadline</ZoruTableHead>
                                    <ZoruTableHead>Progress</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {projects.map((p) => (
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
                                        <ZoruTableCell>{fmtDate(p.endDate)}</ZoruTableCell>
                                        <ZoruTableCell>
                                            <div className="flex items-center gap-2">
                                                <Progress value={p.progress} className="w-24" />
                                                <span className="text-xs text-zoru-ink-muted">{p.progress}%</span>
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    </ZoruCardContent>
                </Card>
            )}
        </div>
    );
}
