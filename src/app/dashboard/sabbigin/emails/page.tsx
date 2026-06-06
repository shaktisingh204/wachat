/**
 * SabBigin emails. A thin composer / pointer to the existing email module.
 *
 * No bespoke SMTP plumbing here. We surface a "Compose" CTA and a recent
 * email-type activity list, then link into the full CRM email tooling
 * for the heavy lifting.
 */

import Link from 'next/link';
import { Mail } from 'lucide-react';

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
        case 'sent':
            return 'success';
        case 'overdue':
        case 'bounced':
            return 'danger';
        case 'in_progress':
        case 'in progress':
            return 'info';
        default:
            return 'neutral';
    }
}

export default async function SabbiginEmailsPage() {
    const { items, total } = await listCrmActivities({
        type: 'email',
        page: 1,
        pageSize: 25,
    });

    return (
        <EntityListShell
            title="Emails"
            subtitle={`${total.toLocaleString()} email${total === 1 ? '' : 's'} logged`}
            primaryAction={
                <Link
                    href="/dashboard/crm/activity/new?type=email"
                    className={cn('u-btn', 'u-btn--primary', 'u-btn--sm')}
                >
                    <Mail size={13} aria-hidden="true" />
                    <span className="u-btn__label">Compose</span>
                </Link>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/emails" />

                {items.length === 0 ? (
                    <EmptyState
                        icon={Mail}
                        title="No emails logged yet"
                        description="Use the Compose button to draft one in the full email module."
                        action={
                            <Link
                                href="/dashboard/crm/activity/new?type=email"
                                className={cn('u-btn', 'u-btn--primary', 'u-btn--sm')}
                            >
                                <Mail size={13} aria-hidden="true" />
                                <span className="u-btn__label">Compose</span>
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
                                    const subject = (a as { subject?: string }).subject ?? 'Email';
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
