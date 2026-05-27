'use client';

/**
 * `/dashboard/crm/sales-crm/tasks/new` — create form.
 *
 * Reads `?linkedKind=&linkedId=` from the query string and pre-fills the
 * linked-entity discriminator on `<TaskForm>`. Optional `?title=` adds a
 * quick title pre-fill (e.g. from a "Convert to task" link on another
 * entity's detail page).
 *
 * The current user id is plumbed in via the session client component so
 * <TaskForm> can default the assignee picker.
 */

import * as React from 'react';
import { useSearchParams } from 'next/navigation';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { TaskForm } from '../_components/tasks-form';
import { getSession } from '@/app/actions/user.actions';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions.types';

const VALID_KINDS: TaskLinkedKind[] = [
    'lead',
    'deal',
    'client',
    'contact',
    'ticket',
    'invoice',
    'none',
];

export default function NewTaskPage() {
    const params = useSearchParams();
    const linkedKindRaw = params.get('linkedKind') ?? '';
    const linkedId = params.get('linkedId') ?? '';
    const title = params.get('title') ?? '';

    const linkedKind: TaskLinkedKind | undefined = VALID_KINDS.includes(
        linkedKindRaw as TaskLinkedKind,
    )
        ? (linkedKindRaw as TaskLinkedKind)
        : undefined;

    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    React.useEffect(() => {
        getSession()
            .then((s) => {
                if (s?.user?._id) setCurrentUserId(String(s.user._id));
            })
            .catch(() => {
                /* default assignee will simply remain unset */
            });
    }, []);

    const prefill =
        linkedKind || linkedId || title
            ? {
                  linkedKind,
                  linkedId,
                  title: title || undefined,
              }
            : null;

    return (
        <EntityListShell
            title="New Task"
            subtitle={
                linkedKind && linkedKind !== 'none' && linkedId
                    ? `Creating from ${linkedKind} ${linkedId.slice(-6)}`
                    : 'Track a call, meeting, follow-up, or to-do.'
            }
        >
            <TaskForm
                mode="create"
                prefill={prefill}
                currentUserId={currentUserId}
            />
        </EntityListShell>
    );
}
