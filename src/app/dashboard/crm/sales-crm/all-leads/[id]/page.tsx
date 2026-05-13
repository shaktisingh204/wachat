'use client';

/**
 * Lead detail page (§1D.2).
 *
 * Layout (per `<EntityDetailShell>`):
 *   • Header: status pill, back link, eyebrow, title, action group (8+ buttons).
 *   • Main column: Overview · Money summary · Notes composer · Attachments.
 *   • Right rail: Pipeline · Stage · Owner · Lifetime stats · Related entities.
 *   • Footer: <EntityAuditTimeline entityKind="lead" entityId={id} />.
 *
 * Lead is the root of the sales chain → no <LineageRail>.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCardHeader,
    ZoruCardTitle,
    ZoruProgress,
    ZoruSkeleton,
    useZoruToast,
} from '@/components/zoruui';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';
import { LeadDetailActions } from '../_components/leads-detail-actions';

import {
    archiveCrmLead,
    changeCrmLeadStatus,
    deleteCrmLead,
    getCrmLeadById,
    unarchiveCrmLead,
} from '@/app/actions/crm-leads.actions';
import { convertLeadToAccount } from '@/app/actions/worksuite/conversions.actions';
import type { CrmLead } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const LEAD_STATUSES = [
    'New',
    'Contacted',
    'Qualified',
    'Unqualified',
    'Converted',
] as const;

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 2,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useZoruToast();

    const leadId = (params?.id as string) || '';

    const [lead, setLead] = React.useState<WithId<CrmLead> | null>(null);
    const [isPending, startTransition] = React.useTransition();
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [composeOpen, setComposeOpen] = React.useState(false);
    const [converting, setConverting] = React.useState(false);

    const refresh = React.useCallback(() => {
        if (!leadId) return;
        startTransition(async () => {
            const data = await getCrmLeadById(leadId);
            setLead(data);
        });
    }, [leadId]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const handleStatusChange = React.useCallback(
        async (next: string) => {
            if (!leadId || !lead || next === lead.status) return;
            const res = await changeCrmLeadStatus(leadId, next);
            if (res.success) {
                toast({ title: `Status set to ${next}` });
                refresh();
            } else {
                toast({
                    title: 'Status change failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [leadId, lead, refresh, toast],
    );

    const handleArchive = React.useCallback(async () => {
        if (!leadId || !lead) return;
        const archived = (lead.status as string)?.toLowerCase() === 'archived';
        const res = archived
            ? await unarchiveCrmLead(leadId)
            : await archiveCrmLead(leadId);
        if (res.success) {
            toast({ title: archived ? 'Lead restored' : 'Lead archived' });
            refresh();
        } else {
            toast({
                title: archived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveOpen(false);
    }, [leadId, lead, refresh, toast]);

    const handleDelete = React.useCallback(async () => {
        if (!leadId) return;
        const res = await deleteCrmLead(leadId);
        if (res.success) {
            toast({ title: 'Lead deleted' });
            router.push('/dashboard/crm/sales-crm/all-leads');
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteOpen(false);
    }, [leadId, router, toast]);

    const handleConvert = React.useCallback(async () => {
        if (!leadId) return;
        setConverting(true);
        const res = await convertLeadToAccount(leadId);
        setConverting(false);
        if (res.success && res.accountId) {
            toast({ title: 'Lead converted to account' });
            router.push(`/dashboard/crm/accounts/${res.accountId}`);
        } else {
            toast({
                title: 'Conversion failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [leadId, router, toast]);

    if (isPending && !lead) {
        return (
            <div className="flex w-full flex-col gap-6">
                <ZoruSkeleton className="h-10 w-72" />
                <ZoruSkeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="flex w-full flex-col gap-4">
                <h1 className="text-xl font-semibold">Lead not found</h1>
                <p className="text-sm text-zoru-ink-muted">
                    The lead you're looking for has been removed or you don't have access.
                </p>
                <ZoruButton asChild variant="outline" className="w-fit">
                    <Link href="/dashboard/crm/sales-crm/all-leads">Back to leads</Link>
                </ZoruButton>
            </div>
        );
    }

    const status = (lead.status as string) || 'New';
    const tone = statusToTone(status);
    const archived = status.toLowerCase() === 'archived';
    const probability = (lead as any).probabilityPct ?? 0;
    const expectedClose = (lead as any).expectedClose
        ? new Date((lead as any).expectedClose)
        : null;
    return (
        <>
            <ComposeEmailDialog
                isOpen={composeOpen}
                onOpenChange={setComposeOpen}
                initialTo={lead.email ?? ''}
                initialSubject={`Re: ${lead.title}`}
            />

            <EntityDetailShell
                back={{ href: '/dashboard/crm/sales-crm/all-leads', label: 'Back to All Leads' }}
                eyebrow="LEAD"
                title={lead.title || lead.contactName || 'Untitled lead'}
                status={{ label: status, tone: tone === 'amber' ? 'amber' : tone === 'red' ? 'red' : tone === 'green' ? 'green' : tone === 'blue' ? 'blue' : 'neutral' }}
                /* audit timeline is server-only; the dedicated /activity route renders <EntityAuditTimeline>. */
                actions={
                    <LeadDetailActions
                        leadId={leadId}
                        email={lead.email}
                        phone={lead.phone}
                        archived={archived}
                        converted={status === 'Converted'}
                        converting={converting}
                        onConvert={handleConvert}
                        onComposeEmail={() => setComposeOpen(true)}
                        onArchive={() => setArchiveOpen(true)}
                        onDelete={() => setDeleteOpen(true)}
                    />
                }
                rightRail={
                    <>
                        {/* Pipeline & stage */}
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Pipeline</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zoru-ink-muted">Pipeline</span>
                                    {lead.pipelineId ? (
                                        <EntityPickerChip entity="pipeline" id={lead.pipelineId} />
                                    ) : (
                                        <span className="text-zoru-ink-muted">—</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zoru-ink-muted">Stage</span>
                                    {lead.stage ? (
                                        <StatusPill label={lead.stage} tone={statusToTone(lead.stage)} />
                                    ) : (
                                        <span className="text-zoru-ink-muted">—</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zoru-ink-muted">Owner</span>
                                    {lead.assignedTo ? (
                                        <EntityPickerChip
                                            entity="user"
                                            id={String(lead.assignedTo)}
                                            fallback="Unassigned"
                                        />
                                    ) : (
                                        <span className="text-zoru-ink-muted">Unassigned</span>
                                    )}
                                </div>
                                <div className="space-y-1 pt-1">
                                    <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                        Set status
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {LEAD_STATUSES.map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => void handleStatusChange(s)}
                                                aria-pressed={status === s}
                                                className={[
                                                    'rounded-full border px-2 py-0.5 text-[11.5px]',
                                                    status === s
                                                        ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-ink'
                                                        : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
                                                ].join(' ')}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </ZoruCardContent>
                        </ZoruCard>

                        {/* Lifetime stats */}
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Activity stats</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-2 text-sm">
                                <Stat
                                    label="Created"
                                    value={
                                        lead.createdAt
                                            ? formatDistanceToNow(new Date(lead.createdAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'
                                    }
                                />
                                <Stat
                                    label="Last updated"
                                    value={
                                        lead.updatedAt
                                            ? formatDistanceToNow(new Date(lead.updatedAt), {
                                                  addSuffix: true,
                                              })
                                            : '—'
                                    }
                                />
                                <Stat
                                    label="Next follow-up"
                                    value={
                                        lead.nextFollowUp
                                            ? new Date(lead.nextFollowUp).toLocaleDateString()
                                            : 'Not set'
                                    }
                                />
                                <Stat
                                    label="Lead score"
                                    value={(lead as any).leadScore ?? '—'}
                                />
                            </ZoruCardContent>
                        </ZoruCard>

                        {/* Related entities — currently links only; counts deferred to a follow-up */}
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Related</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-2 text-sm">
                                <RelatedLink
                                    label="Deals"
                                    href={`/dashboard/crm/deals?leadId=${leadId}`}
                                />
                                <RelatedLink
                                    label="Tasks"
                                    href={`/dashboard/crm/tasks?leadId=${leadId}`}
                                />
                                <RelatedLink
                                    label="Tickets"
                                    href={`/dashboard/crm/tickets?leadId=${leadId}`}
                                />
                                {/* TODO 1D.2: live counts on related entities deferred — no aggregator endpoint yet. */}
                            </ZoruCardContent>
                        </ZoruCard>
                    </>
                }
            >
                {/* ─── Overview ─────────────────────────────────────────── */}
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Overview</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Contact" value={lead.contactName} />
                        <Field
                            label="Email"
                            value={
                                lead.email ? (
                                    <a className="hover:underline" href={`mailto:${lead.email}`}>
                                        {lead.email}
                                    </a>
                                ) : (
                                    '—'
                                )
                            }
                        />
                        <Field
                            label="Phone"
                            value={
                                lead.phone ? (
                                    <a className="hover:underline" href={`tel:${lead.phone}`}>
                                        {lead.phone}
                                    </a>
                                ) : (
                                    '—'
                                )
                            }
                        />
                        <Field label="Company" value={lead.company || '—'} />
                        <Field
                            label="Website"
                            value={
                                lead.website ? (
                                    <a
                                        className="hover:underline"
                                        href={lead.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {lead.website}
                                    </a>
                                ) : (
                                    '—'
                                )
                            }
                        />
                        <Field
                            label="Source"
                            value={
                                lead.source ? (
                                    <ZoruBadge variant="secondary">{lead.source}</ZoruBadge>
                                ) : (
                                    '—'
                                )
                            }
                        />
                        <Field label="Country" value={lead.country || '—'} />
                        <Field
                            label="Industry"
                            value={(lead as any).industry || '—'}
                        />
                        {lead.description ? (
                            <div className="space-y-1 sm:col-span-2">
                                <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Notes
                                </p>
                                <p className="whitespace-pre-line text-sm text-zoru-ink">
                                    {lead.description}
                                </p>
                            </div>
                        ) : null}
                    </ZoruCardContent>
                </ZoruCard>

                {/* ─── Money summary ────────────────────────────────────── */}
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Money</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field
                            label="Estimated value"
                            value={
                                <span className="font-mono text-base text-zoru-ink">
                                    {formatMoney(lead.value, lead.currency)}
                                </span>
                            }
                        />
                        <Field label="Currency" value={lead.currency || 'INR'} />
                        <Field
                            label="Expected close"
                            value={expectedClose ? expectedClose.toLocaleDateString() : '—'}
                        />
                        <div className="sm:col-span-3">
                            <div className="flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
                                <span>Probability</span>
                                <span>{probability}%</span>
                            </div>
                            <ZoruProgress value={probability} className="mt-1" />
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                {/* ─── Inline notes composer (lightweight; persisted into lead.description) ─ */}
                <ZoruCard>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Add note</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        {/* TODO 1D.2: full notes timeline + attachments deferred —
                            crm-notes accepts only contact|account|deal record types
                            (no 'lead' yet); switching it without breaking callers
                            needs a separate diff. For now we surface the existing
                            description content above and link out to Edit for changes. */}
                        <p className="text-sm text-zoru-ink-muted">
                            Use{' '}
                            <Link
                                className="underline"
                                href={`/dashboard/crm/sales-crm/all-leads/${leadId}/edit`}
                            >
                                Edit
                            </Link>{' '}
                            to capture additional notes on this lead until inline notes ship for the
                            <code className="mx-1 rounded bg-zoru-surface-2 px-1">lead</code>
                            record type.
                        </p>
                    </ZoruCardContent>
                </ZoruCard>
            </EntityDetailShell>

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title={archived ? 'Restore this lead?' : 'Archive this lead?'}
                description={
                    archived
                        ? `"${lead.title}" will be restored to your active list.`
                        : `"${lead.title}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={archived ? 'Restore' : 'Archive'}
                confirmTone="primary"
                onConfirm={handleArchive}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this lead permanently?"
                description="This permanently removes the lead and cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

/* ─── Tiny helpers ───────────────────────────────────────────────────── */

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                {label}
            </p>
            <div className="text-sm text-zoru-ink">{value}</div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-zoru-ink-muted">{label}</span>
            <span className="text-zoru-ink">{value}</span>
        </div>
    );
}

function RelatedLink({ label, href }: { label: string; href: string }) {
    return (
        <Link
            href={href}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-zoru-ink hover:bg-zoru-surface-2"
        >
            <span>{label}</span>
            <Sparkles className="h-3.5 w-3.5 text-zoru-ink-muted" />
        </Link>
    );
}
