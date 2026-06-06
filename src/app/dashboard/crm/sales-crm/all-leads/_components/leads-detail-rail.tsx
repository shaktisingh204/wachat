'use client';

import { Badge, Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/components/sabcrm/20ui';
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
                <CardHeader>
                    <CardTitle>Pipeline</CardTitle>
                </CardHeader>
                <CardBody className="space-y-3 text-sm">
                    <RailRow label="Pipeline">
                        {lead.pipelineId ? (
                            <EntityPickerChip entity="pipeline" id={lead.pipelineId} />
                        ) : (
                            <span className="text-[var(--st-text-secondary)]">—</span>
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
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Activity stats</CardTitle>
                </CardHeader>
                <CardBody className="space-y-2 text-sm">
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
                </CardBody>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Related</CardTitle>
                </CardHeader>
                <React.Suspense
                    fallback={
                        <CardBody className="space-y-2 text-sm">
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                            <Skeleton className="h-9 w-full" />
                        </CardBody>
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
        <CardBody className="space-y-2 text-sm">
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
        </CardBody>
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
            <span className="text-[var(--st-text-secondary)]">{label}</span>
            {children}
        </div>
    );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--st-text-secondary)]">{label}</span>
            <span className="text-[var(--st-text)]">{value}</span>
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
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
        >
            <span>{label}</span>
            <Badge variant={count > 0 ? 'info' : 'default'}>{count}</Badge>
        </Link>
    );
}

export default LeadsDetailRail;
