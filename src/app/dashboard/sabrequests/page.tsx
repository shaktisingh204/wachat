/**
 * `/dashboard/sabrequests` — SabRequests inbox.
 *
 * Two tabs:
 *   1. **Awaiting my approval** — requests where I am the resolved approver of
 *      the currently active stage (`awaitingMe=true`).
 *   2. **My requests** — every request I have submitted (`mine=true`).
 *
 * A KPI strip summarises my open workload; the inbox island handles search +
 * blueprint/status/SLA filters in memory over the lists handed in here.
 */
import * as React from 'react';

import {
    Button,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    StatCard,
} from '@/components/sabcrm/20ui';
import { Inbox, Clock, CheckCircle2, LayoutTemplate, Plus, Settings2 } from 'lucide-react';
import { listBlueprints, listRequests } from '@/app/actions/sabrequests.actions';
import { RequestsInbox } from './_components/requests-inbox';

export const dynamic = 'force-dynamic';

export default async function RequestsIndexPage() {
    const [mineRes, awaitingRes, blueprintsRes] = await Promise.all([
        listRequests({ mine: true, limit: 50 }),
        listRequests({ awaitingMe: true, limit: 50 }),
        listBlueprints({ published: true, limit: 100 }),
    ]);

    const mine = mineRes.data ?? [];
    const awaiting = awaitingRes.data ?? [];
    const blueprints = blueprintsRes.data ?? [];

    const mineApproved = mine.filter((r) => r.status === 'approved').length;

    return (
        <div className="flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Requests</PageTitle>
                    <PageDescription>
                        Submit, track, and approve form-based workflows driven by blueprints.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="outline" iconLeft={Settings2} asChild>
                        <a href="/dashboard/sabrequests/blueprints">
                            <Settings2 size={16} aria-hidden="true" />
                            Manage blueprints
                        </a>
                    </Button>
                    <Button variant="primary" iconLeft={Plus} asChild>
                        <a href="/dashboard/sabrequests/new">
                            <Plus size={16} aria-hidden="true" />
                            New request
                        </a>
                    </Button>
                </PageActions>
            </PageHeader>

            <section
                aria-label="Inbox summary"
                className="grid grid-cols-2 gap-3 md:grid-cols-4"
            >
                <StatCard
                    label="Awaiting my approval"
                    value={awaiting.length}
                    icon={Clock}
                    accent="#d97706"
                />
                <StatCard
                    label="My requests"
                    value={mine.length}
                    icon={Inbox}
                    accent="#3b7af5"
                />
                <StatCard
                    label="My approved"
                    value={mineApproved}
                    icon={CheckCircle2}
                    accent="#1f9d55"
                />
                <StatCard
                    label="Published blueprints"
                    value={blueprints.length}
                    icon={LayoutTemplate}
                    accent="#7c3aed"
                />
            </section>

            <RequestsInbox
                mine={mine}
                awaiting={awaiting}
                blueprints={blueprints}
            />
        </div>
    );
}
