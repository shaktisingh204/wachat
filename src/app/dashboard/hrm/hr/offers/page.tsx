'use client';
import { fmtDate, fmtINR } from '@/lib/utils';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Input, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * HR Offers — list page (§1B canonical contract).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import { EnumFilterField } from '@/components/crm/enum-filter-field';

import { deleteOffer, getOffers } from '@/app/actions/crm-offers.actions';
import type { CrmOfferDoc, CrmOfferStatus } from '@/lib/rust-client/crm-offers';

const BASE = '/dashboard/hrm/hr/offers';

const STATUS_TONE: Record<CrmOfferStatus, StatusTone> = {
    draft: 'amber',
    sent: 'blue',
    accepted: 'green',
    rejected: 'red',
    expired: 'red',
    withdrawn: 'neutral',
    archived: 'neutral',
};

function pretty(s: string | undefined): string {
    if (!s) return '—';
    return s.replace(/_/g, ' ');
}





export default function OffersListPage() {
    const [offers, setOffers] = React.useState<CrmOfferDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmOfferStatus | 'all'
    >('all');
    const [jobFilter, setJobFilter] = React.useState('');
    const [pendingDelete, setPendingDelete] = React.useState<
        CrmOfferDoc | null
    >(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getOffers({
                q: search.trim() || undefined,
                status: statusFilter === 'all' ? undefined : statusFilter,
                jobId: jobFilter.trim() || undefined,
                limit: 100,
            });
            setOffers(res.items ?? []);
        } catch {
            setOffers([]);
        } finally {
            setIsLoading(false);
        }
    }, [search, statusFilter, jobFilter]);

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
            const result = await deleteOffer(id);
            if (result.success) {
                toast({ title: 'Offer deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not delete offer.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <>
            <EntityListShell
                    title="Offers"
                    subtitle="Offer letters sent to candidates and their response status."
                    primaryAction={
                        <Button asChild>
                            <Link href={`${BASE}/new`}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New offer
                            </Link>
                        </Button>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search offers…',
                    }}
                    filters={
                        <>
                            <EnumFilterField
                                enumName="offerStatus"
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as CrmOfferStatus | 'all')}
                                allLabel="All statuses"
                            />
                            <Input
                                value={jobFilter}
                                onChange={(e) => setJobFilter(e.target.value)}
                                placeholder="Job id…"
                                className="h-9 w-[180px]"
                            />
                        </>
                    }
                    loading={isLoading && offers.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                    <Th className="text-[var(--st-text-secondary)]">Candidate</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Job</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Salary</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Status</Th>
                                    <Th className="text-[var(--st-text-secondary)]">Sent</Th>
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
                                ) : offers.length === 0 ? (
                                    <Tr className="border-[var(--st-border)]">
                                        <Td
                                            colSpan={6}
                                            className="h-24 text-center text-[var(--st-text-secondary)]"
                                        >
                                            No offers match this filter.
                                        </Td>
                                    </Tr>
                                ) : (
                                    offers.map((o) => {
                                        const status = (o.status ?? 'draft') as CrmOfferStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <Tr key={o._id} className="border-[var(--st-border)]">
                                                <Td className="font-medium text-[var(--st-text)]">
                                                    <Link
                                                        href={`${BASE}/${o._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {o.candidateName || o.candidateId}
                                                    </Link>
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {o.jobTitle || o.jobId || '—'}
                                                </Td>
                                                <Td className="font-mono text-[12px] text-[var(--st-text)]">
                                                    {fmtINR(o.salaryAmount, o.salaryCurrency)}{' '}
                                                    <span className="text-[var(--st-text-secondary)]">
                                                        / {pretty(o.salaryPeriod)}
                                                    </span>
                                                </Td>
                                                <Td>
                                                    <StatusPill label={pretty(status)} tone={tone} />
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {fmtDate(o.sentAt)}
                                                </Td>
                                                <Td className="text-right">
                                                    <Button variant="ghost" size="icon" asChild>
                                                        <Link href={`${BASE}/${o._id}/edit`}>
                                                            <Edit className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setPendingDelete(o)}
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
                        <AlertDialogTitle>Delete offer?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting this offer to{' '}
                            <strong>
                                {pendingDelete?.candidateName ?? pendingDelete?.candidateId}
                            </strong>{' '}
                            removes it from the active offers list. Audit trail is
                            preserved.
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
