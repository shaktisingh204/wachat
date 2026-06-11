/**
 * SabBigin emails. A thin composer / pointer to the existing email module.
 *
 * No bespoke SMTP plumbing here. We surface a "Compose" CTA and a recent
 * email-type activity list, then link into the full CRM email tooling
 * for the heavy lifting.
 */

import Link from 'next/link';
import { Mail, MailCheck, Send } from 'lucide-react';

import {
    Badge,
    Card,
    EmptyState,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import { listCrmActivities } from '@/app/actions/crm-activity.actions';

import { formatDateTime } from '../_components/sabbigin-data';

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

function isSent(status: string): boolean {
    const s = status.toLowerCase();
    return s === 'sent' || s === 'completed' || s === 'done';
}

export default async function SabbiginEmailsPage() {
    const { items, total } = await listCrmActivities({
        type: 'email',
        page: 1,
        pageSize: 25,
    });

    const sent = items.filter((a) => isSent((a as { status?: string }).status ?? '')).length;

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>Emails</PageTitle>
                    <PageDescription>
                        {total.toLocaleString()} email{total === 1 ? '' : 's'} logged against your records.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/crm/activity/new?type=email"
                        className="u-btn u-btn--primary u-btn--sm"
                    >
                        <Send size={13} aria-hidden="true" />
                        <span className="u-btn__label">Compose</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                <StatCard label="Emails logged" value={total} icon={Mail} accent="#3b7af5" />
                <StatCard label="Sent" value={sent} icon={MailCheck} accent="#1f9d55" />
            </div>

            {items.length === 0 ? (
                <Card padding="none" className="flex min-h-[240px] items-center justify-center">
                    <EmptyState
                        icon={Mail}
                        title="No emails logged yet"
                        description="Use Compose to draft one in the full email module."
                        action={
                            <Link
                                href="/dashboard/crm/activity/new?type=email"
                                className="u-btn u-btn--outline u-btn--sm"
                            >
                                <Send size={13} aria-hidden="true" />
                                <span className="u-btn__label">Compose</span>
                            </Link>
                        }
                    />
                </Card>
            ) : (
                <Card padding="none" className="overflow-hidden">
                    <Table density="comfortable" hover>
                        <THead>
                            <Tr>
                                <Th>Subject</Th>
                                <Th>Status</Th>
                                <Th align="right">Date</Th>
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
                                                className="-mx-1 flex items-center gap-2.5 rounded-[var(--st-radius-sm)] px-1 py-0.5 font-medium text-[var(--st-text)] transition-colors hover:text-[var(--st-accent)]"
                                            >
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] text-[var(--st-text-secondary)]">
                                                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                                                </span>
                                                <span className="truncate">{subject}</span>
                                            </Link>
                                        </Td>
                                        <Td>
                                            <Badge tone={statusTone(status)} kind="soft">
                                                {status}
                                            </Badge>
                                        </Td>
                                        <Td align="right" className="tabular-nums text-[var(--st-text-secondary)]">
                                            {formatDateTime(due)}
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </TBody>
                    </Table>
                </Card>
            )}
        </div>
    );
}
