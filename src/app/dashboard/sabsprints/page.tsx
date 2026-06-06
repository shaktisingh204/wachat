import * as React from 'react';

import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '@/components/sabcrm/20ui';

export const dynamic = 'force-dynamic';

export default function SabSprintsRootPage() {
    return (
        <div className="ui20 mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
            <Card>
                <CardHeader>
                    <CardTitle>SabSprints</CardTitle>
                    <CardDescription>
                        Scrum-style project workspace - pick a project to open its backlog, sprints, and epics.
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <p className="text-sm text-[var(--st-text-secondary)]">
                        SabSprints projects are scoped to a SabNode workspace project ID. Open one from the
                        Projects switcher in the top bar to land on
                        <code className="mx-1 rounded bg-[var(--st-bg-secondary)] px-1 py-0.5">
                            /dashboard/sabsprints/&lt;projectId&gt;/backlog
                        </code>
                        .
                    </p>
                </CardBody>
            </Card>
        </div>
    );
}
