/**
 * SabBigin call log — reuses the `crm_activities` collection, filtered to
 * `type: 'call'`. No dialer integration here; this is a lightweight log
 * view that links into the full CRM activity detail.
 */

import Link from 'next/link';

import { Button, Card } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listCrmActivities } from '@/app/actions/crm-activity.actions';

import { SabbiginNav } from '../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

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
                <Button asChild size="sm" variant="outline">
                    <Link href="/dashboard/crm/activity/new?type=call">Log a call</Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/calls" />

                {items.length === 0 ? (
                    <Card className="p-6 text-sm text-zoru-ink-muted">No calls logged yet.</Card>
                ) : (
                    <Card className="overflow-hidden p-0">
                        <ul className="divide-y divide-zoru-border">
                            {items.map((a) => {
                                const id = String((a as { _id: string })._id);
                                const subject = (a as { subject?: string }).subject ?? 'Call';
                                const due = (a as { dueDate?: string }).dueDate;
                                const status = (a as { status?: string }).status ?? 'open';
                                return (
                                    <li key={id}>
                                        <Link
                                            href={`/dashboard/crm/activity/${id}`}
                                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zoru-surface-2"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-zoru-ink">{subject}</p>
                                                <p className="truncate text-xs text-zoru-ink-muted">
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
