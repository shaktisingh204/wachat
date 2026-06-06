'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Progress,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useParams,
  useRouter,
  useSearchParams } from 'next/navigation';
import { Plus,
  Sparkles } from 'lucide-react';

/**
 * Lead detail page (§1D.2 + follow-up additions).
 *
 * Layout (per `<EntityDetailShell>`):
 *   • Header: status pill, back link, eyebrow, title, action group.
 *   • Main column: Overview · Money summary · Tags · Notes timeline.
 *   • Right rail: Pipeline · Activity stats · Related entities with
 *     live counts. Inline-edit popovers for Owner / Stage / Status.
 *   • Quick-add Task button opens an inline dialog.
 *
 * `?print=1` collapses the page into a single-column print-friendly
 * view via `<LeadsPrintView>`.
 *
 * Lead is the root of the sales chain → no <LineageRail>.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { statusToTone } from '@/components/crm/status-pill';
import { ComposeEmailDialog } from '@/components/zoruui-domain/crm-compose-email-dialog';
import { CrmNotes } from '@/components/zoruui-domain/crm-notes';
import { LeadDetailActions } from '../_components/leads-detail-actions';
import { LeadTagsChips } from '../_components/leads-tags-chip';
import { LeadsAddTaskDialog } from '../_components/leads-add-task-dialog';
import { LeadsDetailRail } from '../_components/leads-detail-rail';
import { LeadsPrintView } from '../_components/leads-print-view';

import {
    archiveCrmLead,
    deleteCrmLead,
    getCrmLeadById,
    getCrmLeadRelatedCounts,
    unarchiveCrmLead,
    type CrmLeadRelatedCounts,
} from '@/app/actions/crm-leads.actions';
import { convertLeadToAccount } from '@/app/actions/worksuite/conversions.actions';
import type { CrmLead } from '@/lib/definitions';
import type { WithId } from 'mongodb';

/** Max value we store without overflow — 10 billion. Values above this are
 *  displayed in compact notation to prevent layout break. */
const MAX_DISPLAY_FULL = 9_999_999_999;

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    const v = value ?? 0;
    try {
        // For astronomically large values use compact notation so the string
        // stays short and cannot overflow the layout.
        if (Math.abs(v) > MAX_DISPLAY_FULL) {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: ccy,
                notation: 'compact',
                maximumFractionDigits: 2,
            }).format(v);
        }
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 2,
        }).format(v);
    } catch {
        if (Math.abs(v) > MAX_DISPLAY_FULL) {
            return `${ccy} ${v.toExponential(2)}`;
        }
        return `${ccy} ${v.toLocaleString('en-IN')}`;
    }
}

const EMPTY_COUNTS: CrmLeadRelatedCounts = {
    deals: 0,
    tasks: 0,
    tickets: 0,
    quotations: 0,
};

export default function LeadDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useZoruToast();

    const leadId = (params?.id as string) || '';
    const isPrint = searchParams?.get('print') === '1';

    const [lead, setLead] = React.useState<WithId<CrmLead> | null>(null);
    const [countsPromise, setCountsPromise] = React.useState<Promise<CrmLeadRelatedCounts>>(() => Promise.resolve(EMPTY_COUNTS));
    const [isPending, startTransition] = React.useTransition();
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [composeOpen, setComposeOpen] = React.useState(false);
    const [addTaskOpen, setAddTaskOpen] = React.useState(false);
    const [converting, setConverting] = React.useState(false);

    const refresh = React.useCallback(() => {
        if (!leadId) return;
        setCountsPromise(getCrmLeadRelatedCounts(leadId).then(res => res ?? EMPTY_COUNTS));
        startTransition(async () => {
            const data = await getCrmLeadById(leadId);
            setLead(data);
        });
    }, [leadId]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

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
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-[500px] w-full" />
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
                <Button asChild variant="outline" className="w-fit">
                    <Link href="/dashboard/crm/sales-crm/all-leads">Back to leads</Link>
                </Button>
            </div>
        );
    }

    if (isPrint) {
        return <LeadsPrintView lead={lead} />;
    }

    const status = (lead.status as string) || 'New';
    const tone = statusToTone(status);
    const archived = status.toLowerCase() === 'archived';
    const probability = (lead as any).probabilityPct ?? 0;
    const expectedClose = (lead as any).expectedClose
        ? new Date((lead as any).expectedClose)
        : null;

    // Existing notes embedded on the lead document (legacy schema mirrors
    // the contact/account/deal pattern).
    const existingNotes = ((lead as any).notes ?? []) as {
        content: string;
        createdAt: Date | string;
        author: string;
    }[];

    const tags = ((lead as any).tags ?? []) as string[];

    // Quick-create Deal href — uses ?fromKind=lead which the deal form
    // already understands (see crm-deals.actions §13.5).
    const convertToDealHref =
        `/dashboard/crm/sales-crm/deals/new` +
        `?fromKind=lead&fromId=${encodeURIComponent(leadId)}` +
        `&title=${encodeURIComponent(lead.title ?? '')}` +
        `&amount=${encodeURIComponent(String(lead.value ?? 0))}` +
        (lead.source ? `&leadSource=${encodeURIComponent(lead.source)}` : '');

    return (
        <>
            <ComposeEmailDialog
                isOpen={composeOpen}
                onOpenChange={setComposeOpen}
                initialTo={lead.email ?? ''}
                initialSubject={`Re: ${lead.title}`}
            />
            <LeadsAddTaskDialog
                leadId={leadId}
                open={addTaskOpen}
                onOpenChange={setAddTaskOpen}
                onCreated={refresh}
            />

            <EntityDetailShell
                back={{ href: '/dashboard/crm/sales-crm/all-leads', label: 'Back to All Leads' }}
                eyebrow="LEAD"
                title={lead.title || lead.contactName || 'Untitled lead'}
                status={{
                    label: status,
                    tone:
                        tone === 'amber'
                            ? 'amber'
                            : tone === 'red'
                              ? 'red'
                              : tone === 'green'
                                ? 'green'
                                : tone === 'blue'
                                  ? 'blue'
                                  : 'neutral',
                }}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href={convertToDealHref}>
                                <Sparkles className="h-3.5 w-3.5" /> Convert to Deal
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAddTaskOpen(true)}
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Task
                        </Button>
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
                    </div>
                }
                rightRail={
                    <LeadsDetailRail
                        leadId={leadId}
                        lead={lead}
                        countsPromise={countsPromise}
                        onSaved={refresh}
                    />
                }
            >
                {/* ─── Overview ─────────────────────────────────────────── */}
                <Card>
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
                                    <Badge variant="secondary">{lead.source}</Badge>
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
                </Card>

                {/* ─── Money summary ────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Money</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field
                            label="Estimated value"
                            value={
                                <span className="block truncate font-mono text-base text-zoru-ink" title={formatMoney(lead.value, lead.currency)}>
                                    {formatMoney(lead.value, lead.currency)}
                                </span>
                            }
                        />
                        <Field label="Currency" value={lead.currency || 'INR'} />
                        <Field
                            label="Expected close"
                            value={expectedClose ? expectedClose.toLocaleDateString('en-US', { timeZone: 'UTC' }) : '—'}
                        />
                        <div className="sm:col-span-3">
                            <div className="flex items-center justify-between text-[12.5px] text-zoru-ink-muted">
                                <span>Probability</span>
                                <span>{probability}%</span>
                            </div>
                            <Progress value={probability} className="mt-1" />
                        </div>
                    </ZoruCardContent>
                </Card>

                {/* ─── Tags ─────────────────────────────────────────────── */}
                <Card>
                    <ZoruCardHeader>
                        <ZoruCardTitle>Tags</ZoruCardTitle>
                    </ZoruCardHeader>
                    <ZoruCardContent>
                        <LeadTagsChips
                            leadId={leadId}
                            tags={tags}
                            onTagsChanged={refresh}
                        />
                    </ZoruCardContent>
                </Card>

                {/* ─── Notes timeline composer ─────────────────────────── */}
                <CrmNotes
                    recordId={leadId}
                    recordType="lead"
                    notes={existingNotes.map((n) => ({
                        content: n.content,
                        author: n.author,
                        createdAt: new Date(n.createdAt as Date),
                    }))}
                />
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
