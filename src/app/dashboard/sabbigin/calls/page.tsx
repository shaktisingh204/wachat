/**
 * SabBigin call log. Reuses the `crm_activities` collection, filtered to
 * `type: 'call'`. No dialer integration here; this is a lightweight log
 * view that links into the full CRM activity detail.
 */

import Link from 'next/link';
import { Phone, Plus } from 'lucide-react';

import {
    Badge,
    Card,
    EmptyState,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    cn,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listCrmActivities } from '@/app/actions/crm-activity.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

/** Map an activity status to a 20ui Badge tone so colour only carries meaning. */
function statusTone(status: string): BadgeTone {
    switch (status.toLowerCase()) {
        case 'completed':
        case 'done':
            return 'success';
        case 'overdue':
            return 'danger';
        case 'in_progress':
        case 'in progress':
            return 'info';
        default:
            return 'neutral';
    }
}

export default async function SabbiginCallsPage() {
    const { items, total } = await listCrmActivities({
        type: 'call',
        page: 1,
        pageSize: 50,
    });

    return (
        <EntityListShell
            title="Calls"
            subtitle={`${total.toLocaleString()} call${total === 1 ? '' : 's'} logged`}
            primaryAction={
                <Link
                    href="/dashboard/crm/activity/new?type=call"
                    className={cn('u-btn', 'u-btn--outline', 'u-btn--sm')}
                >
                    <Plus size={13} aria-hidden="true" />
                    <span className="u-btn__label">Log a call</span>
                </Link>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/calls" />

                {items.length === 0 ? (
                    <EmptyState
                        icon={Phone}
                        title="No calls logged yet"
                        description="Calls you log against contacts and deals will appear here."
                        action={
                            <Link
                                href="/dashboard/crm/activity/new?type=call"
                                className={cn('u-btn', 'u-btn--outline', 'u-btn--sm')}
                            >
                                <Plus size={13} aria-hidden="true" />
                                <span className="u-btn__label">Log a call</span>
                            </Link>
                        }
                    />
                ) : (
                    <Card padding="none" className="overflow-hidden">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Subject</Th>
                                    <Th>Status</Th>
                                    <Th>Date</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {items.map((a) => {
                                    const id = String((a as { _id: string })._id);
                                    const subject = (a as { subject?: string }).subject ?? 'Call';
                                    const due = (a as { dueDate?: string }).dueDate;
                                    const status = (a as { status?: string }).status ?? 'open';
                                    return (
                                        <Tr key={id}>
                                            <Td truncate>
                                                <Link
                                                    href={`/dashboard/crm/activity/${id}`}
                                                    className="font-medium text-[var(--st-text)] hover:underline"
                                                >
                                                    {subject}
                                                </Link>
                                            </Td>
                                            <Td>
                                                <Badge tone={statusTone(status)}>{status}</Badge>
                                            </Td>
                                            <Td>
                                                <span className="text-[var(--st-text-secondary)]">
                                                    {due ? new Date(due).toLocaleString() : 'No date'}
                                                </span>
                                            </Td>
                                        </Tr>
                                    );
                                })}
                            </TBody>
                        </Table>
                    </Card>
                )}
            </div>
        </EntityListShell>
    );
}
