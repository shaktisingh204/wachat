import {
  notFound,
  redirect } from 'next/navigation';

/**
 * Edit time log — server wrapper around `<TimeLogForm initialData={...} />`.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSession } from '@/app/actions/user.actions';
import { getTimeLogById } from '@/app/actions/crm-time-logs.actions';

import { TimeLogForm } from '../../_components/time-log-form';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/time-tracking/time-logs';

interface PageProps {
    params: Promise<{ logId: string }>;
}

export default async function EditTimeLogPage({ params }: PageProps) {
    const { logId } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const log = await getTimeLogById(logId);
    if (!log) notFound();

    const title = log.description || 'Untitled session';

    return (
        <EntityDetailShell
            eyebrow="TIME LOG"
            title={`Edit · ${title}`}
            back={{ href: `${BASE}/${logId}`, label: 'Back to detail' }}
        >
            <TimeLogForm initialData={log} />
        </EntityDetailShell>
    );
}
