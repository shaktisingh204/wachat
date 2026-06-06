/**
 * SabConnect, employee directory.
 *
 * Reads from the existing `crm_employees` collection via the
 * `getSabConnectPeople` action. We deliberately do not ship a new "people"
 * Rust crate yet, there is already an HRM source of truth.
 */

import Link from 'next/link';
import { Users } from 'lucide-react';

import {
    PageHeader,
    PageHeading,
    PageTitle,
    PageDescription,
    Card,
    CardBody,
    Avatar,
    AvatarFallback,
    EmptyState,
} from '@/components/sabcrm/20ui';

import { getSabConnectPeople } from '@/app/actions/sabconnect.actions';

export const dynamic = 'force-dynamic';

export default async function SabConnectPeoplePage() {
    const people = await getSabConnectPeople();

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <PageHeading>
                    <PageTitle>People</PageTitle>
                    <PageDescription>
                        Browse the employee directory. Click a person to open their profile.
                    </PageDescription>
                </PageHeading>
            </PageHeader>

            {people.length === 0 ? (
                <EmptyState
                    icon={Users}
                    title="No employees yet"
                    description="Add employees via HRM to populate the directory."
                />
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {people.map((p) => {
                        const displayName = p.name ?? p.email ?? 'Unnamed';
                        const initial = displayName.charAt(0).toUpperCase();
                        return (
                            <li key={p._id}>
                                <Link
                                    href={`/dashboard/crm/hr/employees/${p._id}`}
                                    aria-label={`Open profile for ${displayName}`}
                                    className="block rounded-[var(--st-radius)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]"
                                >
                                    <Card variant="interactive">
                                        <CardBody className="flex items-center gap-3 p-3">
                                            <Avatar>
                                                <AvatarFallback>{initial}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-[var(--st-text)]">
                                                    {displayName}
                                                </span>
                                                {p.title ? (
                                                    <span className="text-xs text-[var(--st-text-secondary)]">
                                                        {p.title}
                                                        {p.department ? `, ${p.department}` : ''}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </CardBody>
                                    </Card>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
