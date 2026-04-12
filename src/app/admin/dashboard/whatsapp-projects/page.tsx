'use client';

import { getWhatsAppProjectsForAdmin } from '@/app/actions/user.actions';
import { AdminUserSearch } from '@/components/wabasimplify/admin-user-search';
import { AdminUserFilter } from '@/components/wabasimplify/admin-user-filter';
import { useEffect, useState, useTransition, useCallback } from 'react';
import type { WithId } from 'mongodb';
import type { Project, User } from '@/lib/definitions';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, LoaderCircle } from 'lucide-react';

const PROJECTS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    verified: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    pending: 'bg-amber-100 text-amber-600 border-amber-200',
    unknown: 'bg-slate-200 text-slate-500 border-slate-300',
};

function statusStyle(status?: string) {
    const key = (status || '').toLowerCase().split(' ')[0];
    return STATUS_STYLES[key] ?? STATUS_STYLES['unknown'];
}

export default function WhatsAppProjectsPage() {
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [projects, setProjects] = useState<WithId<Project & { owner: { name: string; email: string } }>[]>([]);
    const [users, setUsers] = useState<WithId<User>[]>([]);
    const [totalProjects, setTotalProjects] = useState(0);
    const [isLoading, startTransition] = useTransition();

    const query = searchParams.get('query') || '';
    const userId = searchParams.get('userId');
    const currentPage = Number(searchParams.get('page')) || 1;
    const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getWhatsAppProjectsForAdmin(currentPage, PROJECTS_PER_PAGE, query, userId || undefined);
            setProjects(data.projects);
            setTotalProjects(data.total);
            setUsers(data.users);
        });
    }, [currentPage, query, userId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const createPageURL = (page: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', String(page));
        return `${pathname}?${params}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900">WhatsApp Projects</h1>
                <p className="text-sm text-slate-500 mt-1">All connected WhatsApp Business Accounts across the platform.</p>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-900 text-sm">
                            Connected Accounts
                            <span className="ml-2 text-slate-500 font-normal">({totalProjects})</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <AdminUserSearch placeholder="Search by project name…" />
                        <AdminUserFilter users={users} />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                {['Project', 'Owner', 'WABA ID', 'Status'].map(h => (
                                    <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center">
                                        <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-slate-500" />
                                    </td>
                                </tr>
                            ) : projects.length > 0 ? (
                                projects.map(project => (
                                    <tr key={project._id.toString()} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-3.5 font-medium text-slate-900">{project.name}</td>
                                        <td className="px-6 py-3.5">
                                            <p className="font-medium text-slate-900">{project.owner?.name || '—'}</p>
                                            <p className="text-xs text-slate-500">{project.owner?.email || '—'}</p>
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-slate-500">{project.wabaId || '—'}</td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(project.reviewStatus)}`}>
                                                {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-16 text-center text-slate-500">
                                        No WhatsApp projects found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                            <Link href={createPageURL(currentPage - 1)}>Previous</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}
                            className="border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-40">
                            <Link href={createPageURL(currentPage + 1)}>Next</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
