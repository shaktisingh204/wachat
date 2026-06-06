import { Button, Card, CardBody, CardHeader, CardTitle } from '@/components/sabcrm/20ui/compat';
import {
  notFound,
  redirect } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  Paperclip,
  Pencil,
  } from 'lucide-react';

/**
 * Task detail — `/dashboard/crm/tasks/[id]`.
 *
 * Server component. Hits `getTaskById` (Rust-backed) and renders the
 * task overview, checklist (read-only), attachments and notes.
 */

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { PinButton } from '@/components/crm/pin-button';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { AssignmentControl } from '@/components/crm/assignment-control';
import { getSession } from '@/app/actions/user.actions';
import { getTaskById } from '@/app/actions/crm-tasks-rust.actions';
import type { CrmTaskStatus } from '@/lib/rust-client/crm-tasks';

import { TaskDetailActions } from '../_components/task-detail-actions';

export const dynamic = 'force-dynamic';

const BASE = '/dashboard/crm/tasks';

const STATUS_TONE: Record<CrmTaskStatus, StatusTone> = {
    'To-Do': 'amber',
    'In Progress': 'blue',
    'Completed': 'green',
    archived: 'neutral',
};

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function extractName(url: string): string {
    try {
        const path = new URL(url, 'http://x').pathname;
        return decodeURIComponent(path.split('/').pop() ?? '') || url;
    } catch {
        return url;
    }
}

function Field({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-3 gap-3 border-b border-[var(--st-border)]/60 py-2 last:border-0">
            <dt className="col-span-1 text-[12.5px] text-[var(--st-text-secondary)]">{label}</dt>
            <dd className="col-span-2 text-[13px] text-[var(--st-text)]">{value ?? '—'}</dd>
        </div>
    );
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps) {
    const { id } = await params;

    const session = await getSession();
    if (!session?.user) redirect('/login');

    const task = await getTaskById(id);
    if (!task) notFound();

    const status = (task.status ?? 'To-Do') as CrmTaskStatus;
    const tone = STATUS_TONE[status] ?? 'neutral';
    const checklist = task.checklist ?? [];
    const attachments = task.attachments ?? [];

    return (
        <EntityDetailShell
            eyebrow="TASK"
            title={task.title}
            back={{ href: BASE, label: 'Tasks' }}
            actions={
                <div className="flex items-center gap-2">
                    <PinButton entityType="task" entityId={id} title={task.title} />
                    <Button asChild>
                        <Link href={`${BASE}/${id}/edit`}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                        </Link>
                    </Button>
                    <TaskDetailActions taskId={id} status={status} />
                </div>
            }
            rightRail={
                <Card>
                    <CardHeader>
                        <CardTitle>People</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <AssignmentControl
                            entityType="task"
                            entityId={id}
                            currentAssigneeId={task.assignedTo ?? null}
                        />
                    </CardBody>
                </Card>
            }
        >

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Overview</CardTitle>
                        <StatusPill label={status} tone={tone} />
                    </div>
                </CardHeader>
                <CardBody>
                    <dl>
                        <Field label="Title" value={task.title} />
                        <Field label="Priority" value={task.priority ?? '—'} />
                        <Field label="Type" value={task.type ?? '—'} />
                        <Field label="Due date" value={fmtDate(task.dueDate)} />
                        <Field label="Assigned to" value={task.assignedTo ?? '—'} />
                        <Field
                            label="Linked"
                            value={
                                task.linkedKind
                                    ? `${task.linkedKind} · ${task.linkedId ?? '—'}`
                                    : '—'
                            }
                        />
                        <Field
                            label="Reminders"
                            value={
                                Array.isArray(task.reminders) && task.reminders.length > 0
                                    ? task.reminders.join(', ')
                                    : '—'
                            }
                        />
                        <Field label="Created" value={fmtDate(task.createdAt)} />
                    </dl>
                </CardBody>
            </Card>

            {task.description ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Description</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                            {task.description}
                        </p>
                    </CardBody>
                </Card>
            ) : null}

            <Card>
                <CardHeader>
                    <CardTitle>Checklist</CardTitle>
                </CardHeader>
                <CardBody>
                    {checklist.length === 0 ? (
                        <p className="text-[13px] text-[var(--st-text-secondary)]">
                            No checklist items.
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2 text-[13px]">
                            {checklist.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <CheckCircle2
                                        className={`mt-0.5 h-4 w-4 ${
                                            item.done
                                                ? 'text-[var(--st-text)]'
                                                : 'text-[var(--st-text-secondary)]'
                                        }`}
                                    />
                                    <span
                                        className={
                                            item.done
                                                ? 'text-[var(--st-text-secondary)] line-through'
                                                : 'text-[var(--st-text)]'
                                        }
                                    >
                                        {item.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardBody>
            </Card>

            {attachments.length > 0 ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Attachments</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <ul className="flex flex-col gap-1.5">
                            {attachments.map((url, idx) => (
                                <li
                                    key={`${url}-${idx}`}
                                    className="flex items-center gap-2 text-[13px]"
                                >
                                    <Paperclip className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="max-w-full truncate text-[var(--st-text)] underline-offset-2 hover:underline"
                                    >
                                        {extractName(url)}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </CardBody>
                </Card>
            ) : null}
        </EntityDetailShell>
    );
}
