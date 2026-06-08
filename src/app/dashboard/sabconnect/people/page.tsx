/**
 * SabConnect, employee directory.
 *
 * Reads from the existing `crm_employees` collection via the
 * `getSabConnectPeople` action. We deliberately do not ship a new "people"
 * Rust crate yet, there is already an HRM source of truth.
 */

import Link from 'next/link';
import { Users, Building2, IdCard } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    Card,
    CardBody,
    Avatar,
    Badge,
    EmptyState,
    StatCard,
} from '@/components/sabcrm/20ui';

import { getSabConnectPeople } from '@/app/actions/sabconnect.actions';

export const dynamic = 'force-dynamic';

export default async function SabConnectPeoplePage() {
    const people = await getSabConnectPeople();

    const departments = new Set(
        people.map((p) => p.department).filter((d): d is string => Boolean(d)),
    );
    const withTitle = people.filter((p) => p.title).length;

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Connect</PageEyebrow>
                    <PageTitle>People</PageTitle>
                    <PageDescription>
                        Browse the employee directory. Select a person to open their profile.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>

            {people.length === 0 ? (
                <Card variant="outlined" className="min-h-[240px]">
                    <EmptyState
                        icon={Users}
                        title="No employees yet"
                        description="Add employees in HRM and they appear here automatically."
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <StatCard
                            label="People"
                            value={people.length}
                            icon={Users}
                            accent="#3b7af5"
                        />
                        <StatCard
                            label="Departments"
                            value={departments.size}
                            icon={Building2}
                            accent="#7c3aed"
                        />
                        <StatCard
                            label="With a job title"
                            value={withTitle}
                            icon={IdCard}
                            accent="#1f9d55"
                        />
                    </div>

                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {people.map((p) => {
                            const displayName = p.name ?? p.email ?? 'Unnamed';
                            return (
                                <li key={p._id}>
                                    <Link
                                        href={`/dashboard/crm/hr/employees/${p._id}`}
                                        aria-label={`Open profile for ${displayName}`}
                                        className="block rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                    >
                                        <Card variant="interactive" className="h-full">
                                            <CardBody className="flex items-center gap-3 p-3">
                                                <Avatar name={displayName} shape="round" />
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-semibold text-[var(--st-text)]">
                                                        {displayName}
                                                    </span>
                                                    {p.title ? (
                                                        <span className="truncate text-xs text-[var(--st-text-secondary)]">
                                                            {p.title}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {p.department ? (
                                                    <Badge
                                                        tone="neutral"
                                                        kind="outline"
                                                        className="ml-auto shrink-0"
                                                    >
                                                        {p.department}
                                                    </Badge>
                                                ) : null}
                                            </CardBody>
                                        </Card>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </div>
    );
}
