'use client';
import { fmtDate } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Policies — list page.
 *
 * Settings-style list with search + status + category filters and an
 * inline-rendered table. The "New policy" CTA links to the dedicated
 * `/new` page (the form is large enough that a dialog would feel cramped).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deletePolicy,
    getPolicies,
} from '@/app/actions/crm-policies.actions';
import type {
    CrmPolicyDoc,
    CrmPolicyStatus,
    CrmPolicyCategory,
} from '@/lib/rust-client/crm-policies';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

const BASE = '/dashboard/hrm/hr/policies';

const STATUS_TONE: Record<CrmPolicyStatus, StatusTone> = {
    draft: 'amber',
    published: 'green',
    under_review: 'blue',
    archived: 'neutral',
    obsolete: 'red',
};

function statusLabel(s: string): string {
    return s.replace(/_/g, ' ');
}

function categoryLabel(c?: string): string {
    if (!c) return '—';
    return c.replace(/_/g, ' ');
}



export default function PoliciesListPage() {
    const [policies, setPolicies] = React.useState<CrmPolicyDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmPolicyStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = React.useState<CrmPolicyCategory | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmPolicyDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getPolicies({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                category: categoryFilter === 'all' ? undefined : categoryFilter,
                limit: 100,
            });
            setPolicies(res.items ?? []);
        } catch {
            setPolicies([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, categoryFilter]);

    React.useEffect(() => {
        // Debounce server fetch on filter changes — keep it tight (250ms)
        // so the page feels responsive without spamming the Rust backend.
        const t = window.setTimeout(() => {
            void refresh();
        }, 250);
        return () => window.clearTimeout(t);
    }, [refresh]);

    const handleDelete = () => {
        if (!pendingDelete) return;
        const id = pendingDelete._id;
        startDeleteTransition(async () => {
            const result = await deletePolicy(id);
            if (result.success) {
                toast({ title: 'Policy deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete policy.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Policies"
                    subtitle="Company policies, handbooks and versioned guidelines."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New policy
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search policies…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="policyDocStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as CrmPolicyStatus | 'all')}
                                allLabel="All statuses"
                            />
                            <EnumFilterField
                                enumName="policyDocCategory"
                                value={categoryFilter}
                                onChange={(v) => setCategoryFilter(v as CrmPolicyCategory | 'all')}
                                allLabel="All categories"
                            />
                        </>
                    }
                    loading={isLoading && policies.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Version</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Category</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Effective</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Review</Th>
                                    <Th className="text-[var(--st-text-secondary)] text-right">Actions</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {isLoading ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                        </Td>
                                    </Tr>
                                ) : policies.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={7}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No policies match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    policies.map((p) => {
                                        const status = (p.status ?? 'draft') as CrmPolicyStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={p._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${p._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {p.name}
                                                    </Link>
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {p.version ?? '—'}
                                                </Td>
                                                <Td className="capitalize text-[var(--st-text)]">
                                                    {categoryLabel(p.category)}
                                                </Td>
                                                <Td>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(p.effectiveDate)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(p.reviewDate)}
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${p._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(p)}
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
                        <AlertDialogTitle>Delete policy?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will hide it from
                            the active policy list. Acknowledgement records remain in audit.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
