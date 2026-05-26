/**
 * `/dashboard/requests/new` — pick a blueprint, fill its form, submit.
 *
 * Step 1: blueprint picker (lists published blueprints scoped to user).
 * Step 2: client form that walks the blueprint's `formSchema` and posts
 * to `createRequest`. SabFilePickerButton handles any attachment fields.
 */
import * as React from 'react';

import { listBlueprints } from '@/app/actions/sabrequests.actions';
import { NewRequestClient } from './new-request-client';

export const dynamic = 'force-dynamic';

export default async function NewRequestPage({
    searchParams,
}: {
    searchParams: Promise<{ blueprintId?: string }>;
}) {
    const sp = await searchParams;
    const blueprints = await listBlueprints({ published: true, limit: 100 });
    return (
        <div className="zoruui flex flex-col gap-6 p-6">
            <header>
                <h1 className="text-2xl font-semibold">New request</h1>
                <p className="text-sm text-muted-foreground">
                    Pick a blueprint, fill in the form, and submit for approval.
                </p>
            </header>
            <NewRequestClient
                blueprints={blueprints.data ?? []}
                preselectedId={sp.blueprintId}
            />
        </div>
    );
}
