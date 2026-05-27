'use client';

import { Button } from '@/components/zoruui';
import {
  getWhatsAppProjectsForAdmin } from '@/app/actions/user.actions';
import { AdminUserSearch } from '@/components/zoruui-domain/admin-user-search';
import { AdminUserFilter } from '@/components/zoruui-domain/admin-user-filter';
import { useEffect,
  useState,
  useTransition,
  useCallback,
  Suspense } from 'react';
import type { WithId } from 'mongodb';
import type { Project,
  User } from '@/lib/definitions';
import { usePathname,
  useRouter,
  useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';

import { MessageSquare, LoaderCircle, Archive } from 'lucide-react';
import { AdminArchiveProjectButton } from '@/components/zoruui-domain/admin-archive-project-button';

const PROJECTS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
    approved: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    verified: 'bg-emerald-100 text-emerald-600 border-emerald-200',
    pending: 'bg-amber-100 text-amber-600 border-amber-200',
    failed: 'bg-red-100 text-red-600 border-red-200',
    rejected: 'bg-red-100 text-red-600 border-red-200',
    'partial failure': 'bg-amber-100 text-amber-600 border-amber-200',
    unknown: 'bg-zoru-surface text-zoru-ink-muted border-zoru-line',
};

function statusStyle(status?: string) {
    if (!status) return STATUS_STYLES.unknown;
    const key = status.toLowerCase();
    
    if (STATUS_STYLES[key]) return STATUS_STYLES[key];
    if (key.includes('partial failure') || key.includes('partial')) return STATUS_STYLES['partial failure'];
    if (key.includes('fail') || key.includes('reject')) return STATUS_STYLES.failed;
    if (key.includes('pend') || key.includes('review')) return STATUS_STYLES.pending;
    if (key.includes('approv') || key.includes('verif')) return STATUS_STYLES.approved;
    
    return STATUS_STYLES.unknown;
}

function WhatsAppProjectsContent() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const [projects, setProjects] = useState<WithId<Project & { owner: { name: string; email: string }; isArchived?: boolean }>[]>([]);
    const [users, setUsers] = useState<WithId<User>[]>([]);
    const [totalProjects, setTotalProjects] = useState(0);
    const [isLoading, startTransition] = useTransition();

    const query = searchParams.get('query') || '';
    const userId = searchParams.get('userId');
    const statusParam = searchParams.get('status') || 'all';
    const currentPage = Number(searchParams.get('page')) || 1;
    const totalPages = Math.ceil(totalProjects / PROJECTS_PER_PAGE);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getWhatsAppProjectsForAdmin(
                currentPage, 
                PROJECTS_PER_PAGE, 
                query, 
                userId || undefined, 
                statusParam === 'all' ? undefined : statusParam
            );
            setProjects(data.projects);
            setTotalProjects(data.total);
            setUsers(data.users);
        });
    }, [currentPage, query, userId, statusParam]);

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
                <h1 className="text-2xl font-bold text-zoru-ink">WhatsApp Projects</h1>
                <p className="text-sm text-zoru-ink-muted mt-1">All connected WhatsApp Business Accounts across the platform.</p>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-zoru-line bg-zoru-bg overflow-hidden">
                <div className="px-6 py-4 border-b border-zoru-line flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-zoru-ink-muted" />
                        <span className="font-medium text-zoru-ink text-sm">
                            Connected Accounts
                            <span className="ml-2 text-zoru-ink-muted font-normal">({totalProjects})</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select
                            value={statusParam}
                            onValueChange={(val) => {
                                const params = new URLSearchParams(searchParams);
                                if (val && val !== 'all') {
                                    params.set('status', val);
                                } else {
                                    params.delete('status');
                                }
                                params.set('page', '1');
                                router.push(`${pathname}?${params.toString()}`);
                            }}
                        >
                            <SelectTrigger className="w-[150px] h-9">
                                <SelectValue placeholder="Filter by status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="verified">Verified</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="partial_failure">Partial Failure</SelectItem>
                            </SelectContent>
                        </Select>
                        <AdminUserSearch placeholder="Search by project name…" />
                        <AdminUserFilter users={users} />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zoru-line">
                                {['Project', 'Owner', 'WABA ID', 'Status', ''].map((h, i) => (
                                    <th key={i} className={`px-6 py-3 text-xs font-semibold text-zoru-ink-muted uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--zoru-line)]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-zoru-ink-muted" />
                                    </td>
                                </tr>
                            ) : projects.length > 0 ? (
                                projects.map(project => (
                                    <tr key={project._id.toString()} className={`hover:bg-zoru-surface transition-colors ${project.isArchived ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-3.5 font-medium text-zoru-ink">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/wachat?projectId=${project._id}`}
                                                    className="hover:underline text-zoru-ink font-medium"
                                                >
                                                    {project.name}
                                                </Link>
                                                {project.isArchived && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-zoru-line bg-zoru-surface px-2 py-0.5 text-[10px] font-medium text-zoru-ink-muted">
                                                        <Archive className="h-3 w-3" />
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <p className="font-medium text-zoru-ink">{project.owner?.name || '—'}</p>
                                            <p className="text-xs text-zoru-ink-muted">{project.owner?.email || '—'}</p>
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-zoru-ink-muted">{project.wabaId || '—'}</td>
                                        <td className="px-6 py-3.5">
                                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyle(project.reviewStatus)}`}>
                                                {project.reviewStatus?.replace(/_/g, ' ') || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3.5 text-right">
                                            <AdminArchiveProjectButton
                                                projectId={project._id.toString()}
                                                projectName={project.name}
                                                isArchived={project.isArchived}
                                            />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-16 text-center text-zoru-ink-muted">
                                        No WhatsApp projects found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-zoru-line flex items-center justify-between">
                    <span className="text-xs text-zoru-ink-muted">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}
                            className="border-zoru-line bg-zoru-surface text-zoru-ink hover:bg-zoru-surface hover:text-zoru-ink disabled:opacity-40">
                            <Link href={createPageURL(currentPage - 1)}>Previous</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}
                            className="border-zoru-line bg-zoru-surface text-zoru-ink hover:bg-zoru-surface hover:text-zoru-ink disabled:opacity-40">
                            <Link href={createPageURL(currentPage + 1)}>Next</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function WhatsAppProjectsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" /></div>}>
            <WhatsAppProjectsContent />
        </Suspense>
    );
}
