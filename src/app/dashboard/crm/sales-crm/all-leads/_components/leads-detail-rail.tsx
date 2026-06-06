'use client';

import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle, Skeleton } from '@/components/sabcrm/20ui/compat';
import { use } from 'react';
import {
  formatDistanceToNow } from 'date-fns';

/**
 * Right-rail composition for the lead detail page. Renders the three
 * stacked cards (Pipeline · Activity stats · Related entities with
 * counts) plus the inline-edit popovers wired against the same lead.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';

import {
    InlineOwnerEdit,
    InlineStageEdit,
    InlineStatusEdit,
} from './leads-inline-edits';
import type { CrmLead, WithId } from '@/lib/definitions';
import type { CrmLeadRelatedCounts } from '@/app/actions/crm-leads.actions.types';

export interface LeadsDetailRailProps {
    leadId: string;
    lead: WithId<CrmLead>;
    countsPromise: Promise<CrmLeadRelatedCounts>;
    onSaved: () => void;
}

export function LeadsDetailRail({
    leadId,
    lead,
    countsPromise,
    onSaved,
}: LeadsDetailRailProps) {
    const status = (lead.status as string) || 'New';
    return (
        <>
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Pipeline</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-3 text-sm">
                    <RailRow label="Pipeline">
                        {lead.pipelineId ? (
                            <EntityPickerChip entity="pipeline" id={lead.pipelineId} />
                        ) : (
                            <span className="text-zoru-ink-muted">—</span>
                        )}
                    </RailRow>
                    <RailRow label="Stage">
                        <InlineStageEdit
                            leadId={leadId}
                            stage={lead.stage ?? null}
                            onSaved={onSaved}
                        />
                    </RailRow>
                    <RailRow label="Owner">
                        <InlineOwnerEdit
                            leadId={leadId}
                            ownerId={lead.assignedTo ? String(lead.assignedTo) : null}
                            onSaved={onSaved}
                        />
                    </RailRow>
                    <RailRow label="Status">
                        <InlineStatusEdit
                            leadId={leadId}
                            status={status}
                            onSaved={onSaved}
                        />
                    </RailRow>
                </ZoruCardContent>
            </Card>

            <Card>
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
                                ? new Date(lead.nextFollowUp).toLocaleDateString('en-US', { timeZone: 'UTC' })
                                : 'Not set'
                        }
                    />
                    <Stat label="Lead score" value={(lead as any).leadScore ?? '—'} />
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Related</ZoruCardTitle>
                </ZoruCardHeader>
                <React.Suspense
                    fallback={
                        <ZoruCardContent className="space-y-2 text-sm">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </ZoruCardContent>
                    }
                >
                    <RelatedCardsContent leadId={leadId} countsPromise={countsPromise} />
                </React.Suspense>
            </Card>
        </>
    );
}

function RelatedCardsContent({
    leadId,
    countsPromise,
}: {
    leadId: string;
    countsPromise: Promise<CrmLeadRelatedCounts>;
}) {
    const counts = use(countsPromise);
    return (
        <ZoruCardContent className="space-y-2 text-sm">
            <RelatedLink
                label="Deals"
                count={counts.deals}
                href={`/dashboard/crm/sales-crm/deals?leadId=${leadId}`}
            />
            <RelatedLink
                label="Tasks"
                count={counts.tasks}
                href={`/dashboard/crm/sales-crm/tasks?linkedKind=lead&linkedId=${leadId}`}
            />
            <RelatedLink
                label="Tickets"
                count={counts.tickets}
                href={`/dashboard/sabdesk?leadId=${leadId}`}
            />
            <RelatedLink
                label="Quotations"
                count={counts.quotations}
                href={`/dashboard/crm/sales-crm/quotations?leadId=${leadId}`}
            />
        </ZoruCardContent>
    );
}

function RailRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-zoru-ink-muted">{label}</span>
            {children}
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

function RelatedLink({
    label,
    count,
    href,
}: {
    label: string;
    count: number;
    href: string;
}) {
    return (
        <Link
            href={href}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-zoru-ink hover:bg-zoru-surface-2"
        >
            <span>{label}</span>
            <Badge variant={count > 0 ? 'info' : 'default'}>{count}</Badge>
        </Link>
    );
}

export default LeadsDetailRail;
