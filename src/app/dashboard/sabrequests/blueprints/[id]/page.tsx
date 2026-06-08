/**
 * `/dashboard/requests/blueprints/[id]` - edit an existing blueprint.
 */
import * as React from 'react';
import { notFound } from 'next/navigation';

import { getBlueprintById } from '@/app/actions/sabrequests.actions';
import { BlueprintEditor } from '../_components/blueprint-editor';

export const dynamic = 'force-dynamic';

export default async function BlueprintDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const res = await getBlueprintById(id);
    if (!res.ok || !res.data) {
        notFound();
    }
    return (
        <div className="20ui flex flex-col gap-6 p-6">
            <BlueprintEditor mode="edit" initial={res.data} />
        </div>
    );
}
