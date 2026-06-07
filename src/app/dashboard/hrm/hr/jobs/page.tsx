'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Jobs — list page.
 *
 * Canonical §1B contract: `EntityListShell` +
 * `Ui20Table` with a search box, status / employment-type / department
 * filters, and inline delete via `AlertDialog`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { deleteJob, getJobs } from '@/app/actions/crm-jobs.actions';
import type {
    CrmJobDoc,
    CrmJobEmploymentType,
    CrmJobStatus,
} from '@/lib/rust-client/crm-jobs';

const BASE = '/dashboard/hrm/hr/jobs';

// §1E.sweep: jobStatus Select kept — 'filled' slug not in enum; jobEmploymentType Select kept — 'intern' slug differs from enum 'internship'. Resolve Rust DTO first.
const STATUS_OPTIONS: Array<{ value: CrmJobStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'on_hold', label: 'On hold' },
    { value: 'filled', label: 'Filled' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: Array<{
    value: CrmJobEmploymentType | 'all';
    label: string;
}> = [
    { value: 'all', label: 'All types' },
    { value: 'full_time', label: 'Full-time' },
    { value: 'part_time', label: 'Part-time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Intern' },
    { value: 'temporary', label: 'Temporary' },
];

const STATUS_TONE: Record<CrmJobStatus, StatusTone> = {
    draft: 'amber',
    open: 'green',
    on_hold: 'amber',
    filled: 'blue',
    closed: 'red',
    archived: 'neutral',
};

function pretty(s: string | undefined): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}

export default function JobsListPage() {
    const [jobs, setJobs] = React.useState<CrmJobDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmJobStatus | 'all'
    >('all');
    const [typeFilter, setTypeFilter] = React.useState<
        CrmJobEmploymentType | 'all'
    >('all');
    const [departmentFilter, setDepartmentFilter] = React.useState('');
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmJobDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getJobs({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                employmentType: typeFilter === 'all' ? undefined : typeFilter,
                departmentId: departmentFilter.trim() || undefined,
                limit: 100,
            });
            setJobs(res.items ?? []);
        } catch {
            setJobs([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, typeFilter, departmentFilter]);

    React.useEffect(() => {
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deleteJob(id);
            if (result.success) {
                toast({ title: 'Job deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete job.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Jobs"
                    subtitle="Open requisitions and hiring pipelines."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New job
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search jobs…',
                    }}
                    filters={
                        <>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmJobStatus | 'all')
                                }
                            >
                                <SelectTrigger className="h-9 w-[160px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={typeFilter}
                                onValueChange={(v) =>
                                    setTypeFilter(
                                        v as CrmJobEmploymentType | 'all',
                                    )
                                }
                            >
                                <SelectTrigger className="h-9 w-[160px]">
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TYPE_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                value={departmentFilter}
                                onChange={(e) =>
                                    setDepartmentFilter(e.target.value)
                                }
                                placeholder="Department id…"
                                className="h-9 w-[180px]"
                            />
                        </>
                    }
                    loading={isLoading && jobs.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Title</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Department</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Type</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Openings</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : jobs.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No jobs match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    jobs.map((j) => {
                                        const status = (j.status ?? 'draft') as CrmJobStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        const openings = j.openings ?? 0;
                                        const filled = j.filled ?? 0;
                                        return (
                                            <Tr key={j._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${j._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {j.title}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {j.departmentName || j.departmentId || '—'}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {pretty(j.employmentType as string)}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {filled}/{openings}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={pretty(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${j._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(j)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                    </Button>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>
            </EntityListShell>

            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete job?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.title}&rdquo; will close the
                            requisition. Candidates already linked to this job remain
                            in the candidate pipeline.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
