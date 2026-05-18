'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
import {
  Copy,
  Mail,
  Phone,
  RefreshCcw } from 'lucide-react';

/**
 * Lead duplicates page.
 *
 * Calls `findCrmLeadDuplicates()` and renders a flat list of duplicate
 * groups (each sharing the same normalised email or phone). Per scope-
 * cap rules in §1D — the per-group merge wizard is deferred to a
 * follow-up commit; only the list-and-link surface ships here.
 *
 * The merge button is intentionally absent — see TODO 1D.x below.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import {
    findCrmLeadDuplicates,
    type DuplicateGroup,
} from '@/app/actions/crm-leads.actions';

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 0,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

export default function LeadDuplicatesPage() {
    const { toast } = useZoruToast();
    const [groups, setGroups] = React.useState<DuplicateGroup[]>([]);
    const [isPending, startTransition] = React.useTransition();
    const [loaded, setLoaded] = React.useState(false);

    const refresh = React.useCallback(() => {
        startTransition(async () => {
            try {
                const next = await findCrmLeadDuplicates();
                setGroups(next ?? []);
                setLoaded(true);
            } catch (e) {
                toast({
                    title: 'Could not load duplicates',
                    description: e instanceof Error ? e.message : 'Unknown error',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    return (
        <EntityListShell
            title="Find duplicates"
            subtitle="Leads sharing the same email or phone within your tenant."
            viewSwitcher={
                <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={isPending}
                >
                    <RefreshCcw
                        className={['h-3.5 w-3.5', isPending ? 'animate-spin' : ''].join(' ')}
                    />
                    Rescan
                </ZoruButton>
            }
            primaryAction={
                <ZoruButton asChild variant="outline" size="sm">
                    <Link href="/dashboard/crm/sales-crm/all-leads">Back to leads</Link>
                </ZoruButton>
            }
            empty={
                !isPending && loaded && groups.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 p-4">
                        <Copy className="h-8 w-8 text-zoru-ink-muted" />
                        <h3 className="text-base font-medium text-zoru-ink">
                            No duplicates found
                        </h3>
                        <p className="max-w-sm text-sm text-zoru-ink-muted">
                            Every lead in your tenant has a unique email and phone (or those
                            fields are blank). Nice job keeping the pipeline tidy.
                        </p>
                    </div>
                ) : null
            }
            loading={isPending && groups.length === 0}
        >
            <div className="flex flex-col gap-3">
                {groups.map((group) => (
                    <ZoruCard key={`${group.key}-${group.value}`}>
                        <ZoruCardHeader>
                            <ZoruCardTitle className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-2 text-[14px]">
                                    {group.key === 'email' ? (
                                        <Mail className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                    ) : (
                                        <Phone className="h-3.5 w-3.5 text-zoru-ink-muted" />
                                    )}
                                    <span className="truncate font-mono">{group.value}</span>
                                </span>
                                <ZoruBadge variant="info">
                                    {group.leads.length} match{group.leads.length === 1 ? '' : 'es'}
                                </ZoruBadge>
                            </ZoruCardTitle>
                        </ZoruCardHeader>
                        <ZoruCardContent>
                            <ul className="flex flex-col gap-1.5">
                                {group.leads.map((lead) => {
                                    const status = lead.status ?? 'New';
                                    return (
                                        <li
                                            key={lead._id}
                                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zoru-line bg-zoru-bg p-2.5"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <Link
                                                    href={`/dashboard/crm/sales-crm/all-leads/${lead._id}`}
                                                    className="block truncate text-[13px] font-medium text-zoru-ink hover:underline"
                                                >
                                                    {lead.title || lead.contactName || 'Untitled'}
                                                </Link>
                                                <p className="truncate text-[11.5px] text-zoru-ink-muted">
                                                    {lead.contactName}
                                                    {lead.company ? ` · ${lead.company}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[12.5px] text-zoru-ink">
                                                    {formatMoney(lead.value, lead.currency)}
                                                </span>
                                                <StatusPill
                                                    label={status}
                                                    tone={statusToTone(status)}
                                                />
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            {/* TODO 1D.x: Merge wizard deferred — list-only ships per scope cap. */}
                        </ZoruCardContent>
                    </ZoruCard>
                ))}

                {isPending && groups.length === 0 ? (
                    <ZoruSkeleton className="h-32 w-full" />
                ) : null}
            </div>
        </EntityListShell>
    );
}
