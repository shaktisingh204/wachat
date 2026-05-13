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
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckSquare } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { TaskForm } from '../_components/tasks-form';
import { getSession } from '@/app/actions/user.actions';
import type { TaskLinkedKind } from '@/app/actions/crm-tasks.actions';

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
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href="/dashboard/crm/sales-crm/tasks"
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Tasks
                </Link>
            </div>

            <CrmPageHeader
                title="New Task"
                subtitle={
                    linkedKind && linkedKind !== 'none' && linkedId
                        ? `Creating from ${linkedKind} ${linkedId.slice(-6)}`
                        : 'Track a call, meeting, follow-up, or to-do.'
                }
                icon={CheckSquare}
            />

            <TaskForm
                mode="create"
                prefill={prefill}
                currentUserId={currentUserId}
            />
        </div>
    );
}
