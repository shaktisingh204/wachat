import * as React from 'react';
import Link from 'next/link';
import { BellRing } from 'lucide-react';

import {
    Button,
    Card,
    CardBody,
    EmptyState,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
} from '@/components/sabcrm/20ui';

import { listSabmonitorAlertPolicies } from '@/app/actions/sabmonitor.actions';
import { StatusBadge } from '../_components/status-badge';

export const dynamic = 'force-dynamic';

export default async function AlertPoliciesPage(): Promise<React.JSX.Element> {
    const res = await listSabmonitorAlertPolicies();
    return (
        <div className="flex flex-col gap-4">
            <PageHeader compact>
                <PageHeaderHeading>
                    <PageTitle>Alert policies</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabmonitor/alert-policies/new">
                        <Button variant="primary">New policy</Button>
                    </Link>
                </PageActions>
            </PageHeader>
            <Card padding="none">
                <CardBody className="p-0">
                    {res.items.length === 0 ? (
                        <EmptyState
                            icon={BellRing}
                            title="No alert policies yet"
                            description="Create your first policy to route check failures to your channels."
                            action={
                                <Link href="/dashboard/sabmonitor/alert-policies/new">
                                    <Button variant="primary">New policy</Button>
                                </Link>
                            }
                        />
                    ) : (
                        <ul className="divide-y divide-[var(--st-border)]">
                            {res.items.map((p) => (
                                <li
                                    key={p._id}
                                    className="flex items-center justify-between p-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <Link
                                            className="text-sm font-medium text-[var(--st-text)] hover:underline"
                                            href={`/dashboard/sabmonitor/alert-policies/${p._id}`}
                                        >
                                            {p.name}
                                        </Link>
                                        <span className="text-[12px] text-[var(--st-text-secondary)]">
                                            {(p.channels ?? []).length} channels,{' '}
                                            {(p.checkIds ?? []).length} checks
                                        </span>
                                    </div>
                                    <StatusBadge status={p.status} />
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>
        </div>
    );
}
