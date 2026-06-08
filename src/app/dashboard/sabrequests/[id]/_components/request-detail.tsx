'use client';

/**
 * Request detail view — form data + stage timeline + action buttons.
 *
 * The "Approve / Reject / Reassign / Comment" buttons are only enabled
 * when the request is `pending` AND the current stage's approver is
 * the calling user. (The page server-side returns 404 for
 * non-tenant-scope rows; this client-side gate is a UX nudge.)
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    FileText,
    History,
    ListChecks,
    Gavel,
    CheckCircle2,
    XCircle,
    UserCog,
    MessageSquare,
    Ban,
    type LucideIcon,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    Field,
    Input,
    Textarea,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import {
    decideRequest,
    updateRequest,
} from '@/app/actions/sabrequests.actions';
import type { RequestBlueprintDoc } from '@/lib/rust-client/sabrequests-blueprints';
import type { RequestInstanceDoc, StageActionKind } from '@/lib/rust-client/sabrequests-instances';
import type { StageActionDoc } from '@/lib/rust-client/sabrequests-stage-actions';

interface Props {
    request: RequestInstanceDoc;
    blueprint: RequestBlueprintDoc | null;
    actions: StageActionDoc[];
}

function statusTone(s?: string): BadgeTone {
    switch (s) {
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'cancelled':
            return 'neutral';
        case 'pending':
            return 'warning';
        default:
            return 'neutral';
    }
}

const ACTION_TONE: Record<string, BadgeTone> = {
    approve: 'success',
    reject: 'danger',
    reassign: 'info',
    comment: 'neutral',
};

export function RequestDetail({ request, blueprint, actions }: Props) {
    const router = useRouter();
    const [note, setNote] = React.useState('');
    const [reassignTo, setReassignTo] = React.useState('');
    const [busy, setBusy] = React.useState<StageActionKind | null>(null);
    const [err, setErr] = React.useState<string | null>(null);

    async function decide(action: StageActionKind) {
        setBusy(action);
        setErr(null);
        const res = await decideRequest(request._id, {
            action,
            note,
            reassignTo: action === 'reassign' ? reassignTo : undefined,
        });
        setBusy(null);
        if (!res.ok) {
            setErr(res.error ?? 'We couldn’t record that action. Please try again.');
            return;
        }
        setNote('');
        setReassignTo('');
        router.refresh();
    }

    async function cancel() {
        setBusy('comment');
        setErr(null);
        const res = await updateRequest(request._id, { cancel: true });
        setBusy(null);
        if (!res.ok) {
            setErr(res.error ?? 'We couldn’t cancel this request. Please try again.');
            return;
        }
        router.refresh();
    }

    const formEntries = Object.entries(
        (request.formData as Record<string, unknown>) ?? {},
    );
    const stages = blueprint?.stages ?? [];
    const canDecide = request.status === 'pending';

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1.5">
                    <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
                        <a href="/dashboard/sabrequests">
                            <ArrowLeft size={16} aria-hidden="true" />
                            Back to inbox
                        </a>
                    </Button>
                    <h1 className="text-xl font-semibold tracking-tight text-[var(--st-text)]">
                        {request.title ?? request.blueprintName ?? 'Request'}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        <span>{request.blueprintName ?? 'Blueprint'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{request.priority ?? 'normal'} priority</span>
                    </div>
                </div>
                <Badge tone={statusTone(request.status)} dot>
                    {request.status ?? 'unknown'}
                </Badge>
            </header>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="flex flex-col gap-6 lg:col-span-2">
                    <Card padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText size={16} aria-hidden="true" />
                                Form data
                            </CardTitle>
                        </CardHeader>
                        <CardBody>
                            {formEntries.length === 0 ? (
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    No fields were submitted with this request.
                                </p>
                            ) : (
                                <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {formEntries.map(([k, v]) => (
                                        <div key={k} className="flex flex-col gap-0.5">
                                            <dt className="text-xs font-medium text-[var(--st-text-secondary)]">
                                                {k}
                                            </dt>
                                            <dd className="text-sm text-[var(--st-text)]">
                                                {String(v ?? '—')}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                        </CardBody>
                    </Card>

                    <Card padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History size={16} aria-hidden="true" />
                                Timeline
                            </CardTitle>
                        </CardHeader>
                        <CardBody>
                            {actions.length === 0 ? (
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    No actions have been taken yet.
                                </p>
                            ) : (
                                <ol className="flex flex-col gap-4 border-l border-[var(--st-border)] pl-5">
                                    {actions.map((a) => (
                                        <li key={a._id} className="relative">
                                            <span
                                                aria-hidden="true"
                                                className="absolute -left-[1.65rem] mt-1 h-2.5 w-2.5 rounded-full border-2 border-[var(--st-surface)] bg-[var(--st-accent)]"
                                            />
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge
                                                    tone={ACTION_TONE[a.action] ?? 'neutral'}
                                                    kind="soft"
                                                >
                                                    {a.action}
                                                </Badge>
                                                <span className="text-xs tabular-nums text-[var(--st-text-secondary)]">
                                                    Stage {a.stageIdx + 1}
                                                    {a.ts
                                                        ? ` · ${new Date(a.ts).toLocaleString()}`
                                                        : ''}
                                                </span>
                                            </div>
                                            {a.note ? (
                                                <p className="mt-1 text-sm text-[var(--st-text)]">
                                                    {a.note}
                                                </p>
                                            ) : null}
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </CardBody>
                    </Card>
                </div>

                <div className="flex flex-col gap-6">
                    <Card padding="md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ListChecks size={16} aria-hidden="true" />
                                Stages
                            </CardTitle>
                        </CardHeader>
                        <CardBody>
                            {stages.length === 0 ? (
                                <p className="text-sm text-[var(--st-text-secondary)]">
                                    This blueprint has no configured stages.
                                </p>
                            ) : (
                                <ol className="flex flex-col gap-2">
                                    {stages.map((s, i) => {
                                        const current = i === request.currentStageIdx;
                                        const done = i < (request.currentStageIdx ?? 0);
                                        return (
                                            <li
                                                key={i}
                                                className={[
                                                    'flex items-center justify-between gap-2 rounded-[var(--st-radius-md)] border p-2.5 transition-colors',
                                                    current
                                                        ? 'border-[var(--st-accent)] bg-[var(--st-accent-soft)]'
                                                        : 'border-[var(--st-border)]',
                                                ].join(' ')}
                                            >
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-medium text-[var(--st-text)]">
                                                        {i + 1}. {s.name}
                                                    </span>
                                                    <span className="text-xs text-[var(--st-text-secondary)]">
                                                        {s.approverKind}
                                                        {s.slaMins
                                                            ? ` · ${s.slaMins} min SLA`
                                                            : ''}
                                                    </span>
                                                </div>
                                                {done ? (
                                                    <Badge tone="success" kind="soft">
                                                        Done
                                                    </Badge>
                                                ) : current ? (
                                                    <Badge tone="accent">Current</Badge>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ol>
                            )}
                        </CardBody>
                    </Card>

                    {canDecide ? (
                        <Card padding="md" className="flex flex-col gap-4">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Gavel size={16} aria-hidden="true" />
                                    Take action
                                </CardTitle>
                            </CardHeader>
                            <CardBody className="flex flex-col gap-3">
                                <Field label="Note" help="Optional — shown on the timeline.">
                                    <Textarea
                                        placeholder="Add a note"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </Field>
                                <Field label="Reassign to user id">
                                    <Input
                                        placeholder="user_…"
                                        value={reassignTo}
                                        onChange={(e) => setReassignTo(e.target.value)}
                                    />
                                </Field>
                                {err ? (
                                    <p
                                        className="rounded-[var(--st-radius-md)] bg-[var(--st-danger-soft)] px-3 py-2 text-sm text-[var(--st-danger)]"
                                        role="alert"
                                    >
                                        {err}
                                    </p>
                                ) : null}
                                <div className="grid grid-cols-2 gap-2">
                                    <ActionButton
                                        variant="primary"
                                        icon={CheckCircle2}
                                        label="Approve"
                                        disabled={busy !== null}
                                        onClick={() => decide('approve')}
                                    />
                                    <ActionButton
                                        variant="danger"
                                        icon={XCircle}
                                        label="Reject"
                                        disabled={busy !== null}
                                        onClick={() => decide('reject')}
                                    />
                                    <ActionButton
                                        variant="outline"
                                        icon={UserCog}
                                        label="Reassign"
                                        disabled={busy !== null || !reassignTo}
                                        onClick={() => decide('reassign')}
                                    />
                                    <ActionButton
                                        variant="ghost"
                                        icon={MessageSquare}
                                        label="Comment"
                                        disabled={busy !== null}
                                        onClick={() => decide('comment')}
                                    />
                                </div>
                                <Button
                                    variant="ghost"
                                    disabled={busy !== null}
                                    onClick={cancel}
                                    className="text-[var(--st-danger)]"
                                >
                                    <Ban size={16} aria-hidden="true" />
                                    Cancel request
                                </Button>
                            </CardBody>
                        </Card>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function ActionButton({
    variant,
    icon: Icon,
    label,
    disabled,
    onClick,
}: {
    variant: 'primary' | 'danger' | 'outline' | 'ghost';
    icon: LucideIcon;
    label: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <Button variant={variant} disabled={disabled} onClick={onClick}>
            <Icon size={16} aria-hidden="true" />
            {label}
        </Button>
    );
}
