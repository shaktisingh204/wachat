import { fmtDate } from '@/lib/utils';
'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Button,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
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

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : fmtDate(d);
}

export default function PoliciesListPage() {
    const [policies, setPolicies] = React.useState<CrmPolicyDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<CrmPolicyStatus | 'all'>('all');
    const [categoryFilter, setCategoryFilter] = React.useState<CrmPolicyCategory | 'all'>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmPolicyDoc | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

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
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Version</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Effective</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Review</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={7} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : policies.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={7}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No policies match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    policies.map((p) => {
                                        const status = (p.status ?? 'draft') as CrmPolicyStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={p._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${p._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {p.name}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {p.version ?? '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="capitalize text-zoru-ink">
                                                    {categoryLabel(p.category)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={statusLabel(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(p.effectiveDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(p.reviewDate)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
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
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })
                                )}
                            </ZoruTableBody>
                        </Table>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete policy?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will hide it from
                            the active policy list. Acknowledgement records remain in audit.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
