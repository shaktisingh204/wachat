import { fmtDate, fmtINR } from '@/lib/utils';
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
  Input,
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
    const { toast } = useZoruToast();

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
                    <div className="overflow-x-auto rounded-lg border border-zoru-line">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="text-zoru-ink-muted">Candidate</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Job</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Salary</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Sent</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell colSpan={6} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : offers.length === 0 ? (
                                    <ZoruTableRow className="border-zoru-line">
                                        <ZoruTableCell
                                            colSpan={6}
                                            className="h-24 text-center text-zoru-ink-muted"
                                        >
                                            No offers match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    offers.map((o) => {
                                        const status = (o.status ?? 'draft') as CrmOfferStatus;
                                        const tone = STATUS_TONE[status] ?? 'neutral';
                                        return (
                                            <ZoruTableRow key={o._id} className="border-zoru-line">
                                                <ZoruTableCell className="font-medium text-zoru-ink">
                                                    <Link
                                                        href={`${BASE}/${o._id}`}
                                                        className="hover:underline"
                                                    >
                                                        {o.candidateName || o.candidateId}
                                                    </Link>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {o.jobTitle || o.jobId || '—'}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                                                    {fmtINR(o.salaryAmount, o.salaryCurrency)}{' '}
                                                    <span className="text-zoru-ink-muted">
                                                        / {pretty(o.salaryPeriod)}
                                                    </span>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <StatusPill label={pretty(status)} tone={tone} />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {fmtDate(o.sentAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
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
                        <ZoruAlertDialogTitle>Delete offer?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting this offer to{' '}
                            <strong>
                                {pendingDelete?.candidateName ?? pendingDelete?.candidateId}
                            </strong>{' '}
                            removes it from the active offers list. Audit trail is
                            preserved.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
