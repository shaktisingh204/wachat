'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  useParams,
  useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles } from 'lucide-react';

/**
 * Contact detail page (§1D.2).
 *
 * Layout (per `<EntityDetailShell>`):
 *   • Header: status pill, back link, eyebrow, title, 9-button action group.
 *   • Main column: Overview · Address · Social · Notes · Attachments · Tags · Custom fields
 *     (extracted into `<ContactDetailBody>` to stay under the 600-line scope cap).
 *   • Right rail: Linked account chip · Owner chip · Lifetime stats · Related entities.
 *   • Footer link: /[contactId]/activity renders <EntityAuditTimeline>.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { statusToTone } from '@/components/crm/status-pill';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';
import { ContactDetailActions } from '../_components/contacts-detail-actions';
import { ContactDetailBody } from '../_components/contacts-detail-body';

import {
    deleteCrmContact,
    getCrmContactById,
    updateCrmContact,
} from '@/app/actions/crm.actions';
import type { CrmContact } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const CONTACT_STATUSES = [
    { value: 'new_lead', label: 'New lead' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'unqualified', label: 'Unqualified' },
    { value: 'customer', label: 'Customer' },
    { value: 'imported', label: 'Imported' },
] as const;

function formatStatusLabel(status: string | undefined): string {
    if (!status) return 'New lead';
    const map: Record<string, string> = {
        new_lead: 'New lead',
        contacted: 'Contacted',
        qualified: 'Qualified',
        unqualified: 'Unqualified',
        customer: 'Customer',
        imported: 'Imported',
        archived: 'Archived',
    };
    return map[status] ?? status;
}

function statusBadgeTone(
    status: string | undefined,
): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
    const tone = statusToTone(status);
    if (tone === 'amber') return 'amber';
    if (tone === 'red') return 'red';
    if (tone === 'green') return 'green';
    if (tone === 'blue') return 'blue';
    return 'neutral';
}

export default function ContactDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useZoruToast();

    const contactId = (params?.contactId as string) || '';

    const [contact, setContact] = React.useState<WithId<CrmContact> | null>(
        null,
    );
    const [isPending, startTransition] = React.useTransition();
    const [archiveOpen, setArchiveOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [composeOpen, setComposeOpen] = React.useState(false);

    const refresh = React.useCallback(() => {
        if (!contactId) return;
        startTransition(async () => {
            const data = await getCrmContactById(contactId);
            setContact(data);
        });
    }, [contactId]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const handleStatusChange = React.useCallback(
        async (next: string) => {
            if (!contactId || !contact || next === contact.status) return;
            const fd = new FormData();
            fd.set('contactId', contactId);
            fd.set('name', contact.name);
            fd.set('email', contact.email);
            fd.set('status', next);
            const res = await updateCrmContact({}, fd);
            if (!res.error) {
                toast({
                    title: `Status set to ${formatStatusLabel(next)}`,
                });
                refresh();
            } else {
                toast({
                    title: 'Status change failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [contactId, contact, refresh, toast],
    );

    const handleArchive = React.useCallback(async () => {
        if (!contactId || !contact) return;
        const archived =
            (contact.status as string)?.toLowerCase() === 'archived';
        const fd = new FormData();
        fd.set('contactId', contactId);
        fd.set('name', contact.name);
        fd.set('email', contact.email);
        fd.set('status', archived ? 'new_lead' : 'archived');
        const res = await updateCrmContact({}, fd);
        if (!res.error) {
            toast({
                title: archived ? 'Contact restored' : 'Contact archived',
            });
            refresh();
        } else {
            toast({
                title: archived ? 'Restore failed' : 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveOpen(false);
    }, [contactId, contact, refresh, toast]);

    const handleDelete = React.useCallback(async () => {
        if (!contactId) return;
        const res = await deleteCrmContact(contactId);
        if (res.success) {
            toast({ title: 'Contact deleted' });
            router.push('/dashboard/crm/sales-crm/contacts');
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteOpen(false);
    }, [contactId, router, toast]);

    if (isPending && !contact) {
        return (
            <div className="flex w-full flex-col gap-6">
                <ZoruSkeleton className="h-10 w-72" />
                <ZoruSkeleton className="h-[500px] w-full" />
            </div>
        );
    }

    if (!contact) {
        return (
            <div className="flex w-full flex-col gap-4">
                <h1 className="text-xl font-semibold">Contact not found</h1>
                <p className="text-sm text-zoru-ink-muted">
                    The contact you&apos;re looking for has been removed or you
                    don&apos;t have access.
                </p>
                <ZoruButton asChild variant="outline" className="w-fit">
                    <Link href="/dashboard/crm/sales-crm/contacts">
                        Back to contacts
                    </Link>
                </ZoruButton>
            </div>
        );
    }

    const status = (contact.status as string) || 'new_lead';
    const tone = statusBadgeTone(status);
    const archived = status.toLowerCase() === 'archived';

    return (
        <>
            <ComposeEmailDialog
                isOpen={composeOpen}
                onOpenChange={setComposeOpen}
                initialTo={contact.email ?? ''}
                initialSubject={`Hello ${contact.name}`}
            />

            <EntityDetailShell
                back={{
                    href: '/dashboard/crm/sales-crm/contacts',
                    label: 'Back to Contacts',
                }}
                eyebrow="CONTACT"
                title={contact.name || contact.email || 'Untitled contact'}
                status={{ label: formatStatusLabel(status), tone }}
                actions={
                    <ContactDetailActions
                        contactId={contactId}
                        email={contact.email}
                        phone={contact.phone}
                        archived={archived}
                        onComposeEmail={() => setComposeOpen(true)}
                        onArchive={() => setArchiveOpen(true)}
                        onDelete={() => setDeleteOpen(true)}
                    />
                }
                rightRail={
                    <>
                        {/* Linked & owner */}
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Links</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zoru-ink-muted">Account</span>
                                    {contact.accountId ? (
                                        <EntityPickerChip
                                            entity="client"
                                            id={String(contact.accountId)}
                                            fallback="Linked"
                                        />
                                    ) : (
                                        <span className="text-zoru-ink-muted">—</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-zoru-ink-muted">Owner</span>
                                    {contact.owner ? (
                                        <EntityPickerChip
                                            entity="user"
                                            id={contact.owner}
                                            fallback="Unassigned"
                                        />
                                    ) : contact.assignedTo ? (
                                        <EntityPickerChip
                                            entity="user"
                                            id={String(contact.assignedTo)}
                                            fallback="Unassigned"
                                        />
                                    ) : (
                                        <span className="text-zoru-ink-muted">
                                            Unassigned
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-1 pt-1">
                                    <span className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                        Set status
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {CONTACT_STATUSES.map((s) => (
                                            <button
                                                key={s.value}
                                                type="button"
                                                onClick={() =>
                                                    void handleStatusChange(s.value)
                                                }
                                                aria-pressed={status === s.value}
                                                className={[
                                                    'rounded-full border px-2 py-0.5 text-[11.5px]',
                                                    status === s.value
                                                        ? 'border-zoru-primary bg-zoru-primary/10 text-zoru-ink'
                                                        : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink',
                                                ].join(' ')}
                                            >
                                                {s.label}
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
                                    label="Lifecycle"
                                    value={contact.lifecycleStage ?? '—'}
                                />
                                <Stat
                                    label="Created"
                                    value={
                                        contact.createdAt
                                            ? formatDistanceToNow(
                                                  new Date(contact.createdAt),
                                                  { addSuffix: true },
                                              )
                                            : '—'
                                    }
                                />
                                <Stat
                                    label="Last activity"
                                    value={
                                        contact.lastActivity
                                            ? formatDistanceToNow(
                                                  new Date(contact.lastActivity),
                                                  { addSuffix: true },
                                              )
                                            : '—'
                                    }
                                />
                                <Stat
                                    label="Last updated"
                                    value={
                                        contact.updatedAt
                                            ? formatDistanceToNow(
                                                  new Date(contact.updatedAt),
                                                  { addSuffix: true },
                                              )
                                            : '—'
                                    }
                                />
                                <Stat
                                    label="Lead score"
                                    value={contact.leadScore ?? '—'}
                                />
                            </ZoruCardContent>
                        </ZoruCard>

                        {/* Related entities */}
                        <ZoruCard>
                            <ZoruCardHeader>
                                <ZoruCardTitle>Related</ZoruCardTitle>
                            </ZoruCardHeader>
                            <ZoruCardContent className="space-y-2 text-sm">
                                <RelatedLink
                                    label="Deals"
                                    href={`/dashboard/crm/sales-crm/deals?contactId=${contactId}`}
                                />
                                <RelatedLink
                                    label="Tickets"
                                    href={`/dashboard/crm/tickets?contactId=${contactId}`}
                                />
                                <RelatedLink
                                    label="Tasks"
                                    href={`/dashboard/crm/tasks?contactId=${contactId}`}
                                />
                                <RelatedLink
                                    label="Invoices"
                                    href={`/dashboard/crm/sales/invoices?contactId=${contactId}`}
                                />
                                {/* TODO 1D.2: live counts on related entities deferred — no aggregator endpoint yet. */}
                            </ZoruCardContent>
                        </ZoruCard>
                    </>
                }
            >
                <ContactDetailBody
                    contact={contact}
                    contactId={contactId}
                    formatStatusLabel={formatStatusLabel}
                />
            </EntityDetailShell>

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title={
                    archived
                        ? 'Restore this contact?'
                        : 'Archive this contact?'
                }
                description={
                    archived
                        ? `"${contact.name}" will be restored to your active list.`
                        : `"${contact.name}" will be hidden from default views. You can restore it later.`
                }
                confirmLabel={archived ? 'Restore' : 'Archive'}
                confirmTone="primary"
                onConfirm={handleArchive}
            />
            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title="Delete this contact permanently?"
                description="This permanently removes the contact and cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

/* ─── Tiny helpers ───────────────────────────────────────────────────── */

function Stat({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
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
