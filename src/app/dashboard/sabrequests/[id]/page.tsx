/**
 * `/dashboard/requests/[id]` — single-request detail.
 *
 * Shows the submitted form data, the timeline of stage actions, the
 * current approver, and (when the caller is the current approver)
 * approve/reject/reassign/comment buttons.
 */
import * as React from 'react';
import { notFound } from 'next/navigation';

import {
    getRequestById,
    listStageActions,
    getBlueprintById,
} from '@/app/actions/sabrequests.actions';
import { RequestDetail } from './_components/request-detail';

export const dynamic = 'force-dynamic';

export default async function RequestDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const reqRes = await getRequestById(id);
    if (!reqRes.ok || !reqRes.data) {
        notFound();
    }
    const [actionsRes, bpRes] = await Promise.all([
        listStageActions(id),
        getBlueprintById(reqRes.data.blueprintId),
    ]);
    return (
        <div className="zoruui p-6">
            <RequestDetail
                request={reqRes.data}
                blueprint={bpRes.data ?? null}
                actions={actionsRes.data ?? []}
            />
        </div>
    );
}
