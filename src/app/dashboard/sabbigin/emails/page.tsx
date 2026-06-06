/**
 * SabBigin emails — a thin composer / pointer to the existing email module.
 *
 * No bespoke SMTP plumbing here. We surface a "Compose" CTA and a recent
 * email-type activity list, then link into the full CRM email tooling
 * for the heavy lifting.
 */

import Link from 'next/link';
import { Mail } from 'lucide-react';

import { Button, Card } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listCrmActivities } from '@/app/actions/crm-activity.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

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
                <Button asChild size="sm">
                    <Link href="/dashboard/crm/activity/new?type=email">
                        <Mail className="mr-1 h-3.5 w-3.5" />
                        Compose
                    </Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/emails" />

                {items.length === 0 ? (
                    <Card className="p-6 text-sm text-[var(--st-text-secondary)]">
                        No emails logged yet. Use the Compose button to draft one in the full email module.
                    </Card>
                ) : (
                    <Card className="overflow-hidden p-0">
                        <ul className="divide-y divide-[var(--st-border)]">
                            {items.map((a) => {
                                const id = String((a as { _id: string })._id);
                                const subject = (a as { subject?: string }).subject ?? 'Email';
                                const due = (a as { dueDate?: string }).dueDate;
                                const status = (a as { status?: string }).status ?? 'open';
                                return (
                                    <li key={id}>
                                        <Link
                                            href={`/dashboard/crm/activity/${id}`}
                                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--st-bg-muted)]"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-[var(--st-text)]">{subject}</p>
                                                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                                    {status} · {due ? new Date(due).toLocaleString() : 'No date'}
                                                </p>
                                            </div>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </Card>
                )}
            </div>
        </EntityListShell>
    );
}
