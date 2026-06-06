'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
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

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';

import { MessageSquare, LoaderCircle, Archive } from 'lucide-react';
import { AdminArchiveProjectButton } from '@/components/zoruui-domain/admin-archive-project-button';

const PROJECTS_PER_PAGE = 20;

const STATUS_STYLES: Record<string, string> = {
    approved: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    verified: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    pending: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    failed: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    rejected: 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    'partial failure': 'bg-[var(--st-bg-muted)] text-[var(--st-text)] border-[var(--st-border)]',
    unknown: 'bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)] border-[var(--st-border)]',
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
                <h1 className="text-2xl font-bold text-[var(--st-text)]">WhatsApp Projects</h1>
                <p className="text-sm text-[var(--st-text-secondary)] mt-1">All connected WhatsApp Business Accounts across the platform.</p>
            </div>

            {/* Table card */}
            <div className="rounded-2xl border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--st-border)] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        <span className="font-medium text-[var(--st-text)] text-sm">
                            Connected Accounts
                            <span className="ml-2 text-[var(--st-text-secondary)] font-normal">({totalProjects})</span>
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
                            <tr className="border-b border-[var(--st-border)]">
                                {['Project', 'Owner', 'WABA ID', 'Status', ''].map((h, i) => (
                                    <th key={i} className={`px-6 py-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wider ${i === 4 ? 'text-right' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--st-border)]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-[var(--st-text-secondary)]" />
                                    </td>
                                </tr>
                            ) : projects.length > 0 ? (
                                projects.map(project => (
                                    <tr key={project._id.toString()} className={`hover:bg-[var(--st-bg-secondary)] transition-colors ${project.isArchived ? 'opacity-60' : ''}`}>
                                        <td className="px-6 py-3.5 font-medium text-[var(--st-text)]">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/wachat?projectId=${project._id}`}
                                                    className="hover:underline text-[var(--st-text)] font-medium"
                                                >
                                                    {project.name}
                                                </Link>
                                                {project.isArchived && (
                                                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-2 py-0.5 text-[10px] font-medium text-[var(--st-text-secondary)]">
                                                        <Archive className="h-3 w-3" />
                                                        Archived
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5">
                                            <p className="font-medium text-[var(--st-text)]">{project.owner?.name || '—'}</p>
                                            <p className="text-xs text-[var(--st-text-secondary)]">{project.owner?.email || '—'}</p>
                                        </td>
                                        <td className="px-6 py-3.5 font-mono text-xs text-[var(--st-text-secondary)]">{project.wabaId || '—'}</td>
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
                                    <td colSpan={5} className="px-6 py-16 text-center text-[var(--st-text-secondary)]">
                                        No WhatsApp projects found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 border-t border-[var(--st-border)] flex items-center justify-between">
                    <span className="text-xs text-[var(--st-text-secondary)]">Page {currentPage} of {totalPages > 0 ? totalPages : 1}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild disabled={currentPage <= 1}
                            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40">
                            <Link href={createPageURL(currentPage - 1)}>Previous</Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild disabled={currentPage >= totalPages}
                            className="border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)] disabled:opacity-40">
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
        <Suspense fallback={<div className="p-8 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" /></div>}>
            <WhatsAppProjectsContent />
        </Suspense>
    );
}
