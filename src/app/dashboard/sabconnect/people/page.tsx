/**
 * SabConnect — employee directory.
 *
 * Reads from the existing `crm_employees` collection via the
 * `getSabConnectPeople` action. We deliberately don't ship a new "people"
 * Rust crate yet — there's already an HRM source of truth.
 */

import Link from 'next/link';

import {
    PageHeader,
    ZoruPageHeading,
    ZoruPageTitle,
    ZoruPageDescription,
    Card,
    CardContent,
    Avatar,
    AvatarFallback,
    EmptyState,
} from '@/components/sabcrm/20ui/compat';

import { getSabConnectPeople } from '@/app/actions/sabconnect.actions';

export const dynamic = 'force-dynamic';

export default async function SabConnectPeoplePage() {
    const people = await getSabConnectPeople();

    return (
        <div className="flex w-full flex-col gap-6">
            <PageHeader>
                <ZoruPageHeading>
                    <ZoruPageTitle>People</ZoruPageTitle>
                    <ZoruPageDescription>
                        Browse the employee directory. Click a person to open their profile.
                    </ZoruPageDescription>
                </ZoruPageHeading>
            </PageHeader>

            {people.length === 0 ? (
                <EmptyState
                    title="No employees yet"
                    description="Add employees via HRM to populate the directory."
                />
            ) : (
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {people.map((p) => {
                        const initial = (p.name ?? p.email ?? 'U').charAt(0).toUpperCase();
                        return (
                            <li key={p._id}>
                                <Link
                                    href={`/dashboard/crm/hr/employees/${p._id}`}
                                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-accent"
                                >
                                    <Card>
                                        <CardContent className="flex items-center gap-3 p-3">
                                            <Avatar>
                                                <AvatarFallback>{initial}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-zoru-text">
                                                    {p.name ?? p.email ?? 'Unnamed'}
                                                </span>
                                                {p.title ? (
                                                    <span className="text-xs text-zoru-muted">
                                                        {p.title}
                                                        {p.department ? ` · ${p.department}` : ''}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </CardContent>
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
