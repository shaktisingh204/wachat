/**
 * `/dashboard/sabrequests` - SabRequests inbox.
 *
 * Two tabs:
 *   1. **My requests** - every request I've submitted (`mine=true`).
 *   2. **Awaiting my approval** - requests where I am the resolved
 *      approver of the currently active stage (`awaitingMe=true`).
 *
 * Filters by blueprint, status, SLA breach.
 *
 * Renders with 20ui primitives only. Server Component on the page
 * shell; an internal client island handles filter state.
 */
import * as React from 'react';
import Link from 'next/link';

import {
    Button,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';
import { listBlueprints, listRequests } from '@/app/actions/sabrequests.actions';
import { RequestsInbox } from './_components/requests-inbox';

export const dynamic = 'force-dynamic';

export default async function RequestsIndexPage() {
    const [mineRes, awaitingRes, blueprintsRes] = await Promise.all([
        listRequests({ mine: true, limit: 50 }),
        listRequests({ awaitingMe: true, limit: 50 }),
        listBlueprints({ published: true, limit: 100 }),
    ]);

    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>SabRequests</PageTitle>
                    <PageDescription>
                        Submit, track, and approve workflows powered by blueprints.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/sabrequests/blueprints">
                        <Button variant="outline">Manage blueprints</Button>
                    </Link>
                    <Link href="/dashboard/sabrequests/new">
                        <Button variant="primary">New request</Button>
                    </Link>
                </PageActions>
            </PageHeader>
            <RequestsInbox
                mine={mineRes.data ?? []}
                awaiting={awaitingRes.data ?? []}
                blueprints={blueprintsRes.data ?? []}
            />
        </div>
    );
}
