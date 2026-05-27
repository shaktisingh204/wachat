/**
 * `/dashboard/sabrequests` — SabRequests inbox.
 *
 * Two tabs:
 *   1. **My requests** — every request I've submitted (`mine=true`).
 *   2. **Awaiting my approval** — requests where I am the resolved
 *      approver of the currently active stage (`awaitingMe=true`).
 *
 * Filters by blueprint, status, SLA breach.
 *
 * Renders with ZoruUI primitives only. Server Component on the page
 * shell; an internal client island handles filter state.
 */
import * as React from 'react';
import Link from 'next/link';

import { Button } from '@/components/zoruui';
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
        <div className="zoruui flex flex-col gap-6 p-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">SabRequests</h1>
                    <p className="text-sm text-zoru-ink-muted">
                        Submit, track, and approve workflows powered by blueprints.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/dashboard/sabrequests/blueprints">
                            Manage blueprints
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/dashboard/sabrequests/new">New request</Link>
                    </Button>
                </div>
            </header>
            <RequestsInbox
                mine={mineRes.data ?? []}
                awaiting={awaitingRes.data ?? []}
                blueprints={blueprintsRes.data ?? []}
            />
        </div>
    );
}
