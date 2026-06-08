/**
 * `/dashboard/requests/new` - pick a blueprint, fill its form, submit.
 *
 * Step 1: blueprint picker (lists published blueprints scoped to user).
 * Step 2: client form that walks the blueprint's `formSchema` and posts
 * to `createRequest`. SabFilePickerButton handles any attachment fields.
 */
import * as React from 'react';

import {
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
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
        <div className="20ui flex flex-col gap-6 p-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>New request</PageTitle>
                    <PageDescription>
                        Pick a blueprint, fill in the form, and submit for approval.
                    </PageDescription>
                </PageHeaderHeading>
            </PageHeader>
            <NewRequestClient
                blueprints={blueprints.data ?? []}
                preselectedId={sp.blueprintId}
            />
        </div>
    );
}
