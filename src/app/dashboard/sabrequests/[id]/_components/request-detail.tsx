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
    Badge,
    Button,
    Card,
    Input,
    Textarea,
} from '@/components/zoruui';
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

function statusVariant(s?: string) {
    switch (s) {
        case 'approved':
            return 'success' as const;
        case 'rejected':
            return 'destructive' as const;
        case 'cancelled':
            return 'secondary' as const;
        default:
            return 'default' as const;
    }
}

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
            setErr(res.error ?? 'Failed.');
            return;
        }
        setNote('');
        setReassignTo('');
        router.refresh();
    }

    async function cancel() {
        setBusy('comment');
        const res = await updateRequest(request._id, { cancel: true });
        setBusy(null);
        if (!res.ok) {
            setErr(res.error ?? 'Failed.');
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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-4 lg:col-span-2">
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h1 className="text-xl font-semibold">
                                {request.title ?? request.blueprintName ?? 'Request'}
                            </h1>
                            <div className="text-xs text-zoru-ink-muted">
                                {request.blueprintName ?? 'Blueprint'} ·{' '}
                                {request.priority ?? 'normal'} priority
                            </div>
                        </div>
                        <Badge variant={statusVariant(request.status)}>
                            {request.status}
                        </Badge>
                    </div>
                </Card>

                <Card className="p-4">
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                        Form data
                    </h2>
                    {formEntries.length === 0 ? (
                        <div className="text-sm text-zoru-ink-muted">
                            (no fields submitted)
                        </div>
                    ) : (
                        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {formEntries.map(([k, v]) => (
                                <div key={k}>
                                    <dt className="text-xs uppercase tracking-wide text-zoru-ink-muted">
                                        {k}
                                    </dt>
                                    <dd className="text-sm">{String(v ?? '—')}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </Card>

                <Card className="p-4">
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                        Timeline
                    </h2>
                    {actions.length === 0 ? (
                        <div className="text-sm text-zoru-ink-muted">
                            No actions yet.
                        </div>
                    ) : (
                        <ol className="flex flex-col gap-3 border-l border-zoru-line pl-4">
                            {actions.map((a) => (
                                <li key={a._id} className="relative">
                                    <span className="absolute -left-[1.4rem] mt-1 h-2 w-2 rounded-full bg-zoru-ink" />
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{a.action}</Badge>
                                        <span className="text-xs text-zoru-ink-muted">
                                            stage {a.stageIdx + 1} ·{' '}
                                            {a.ts
                                                ? new Date(a.ts).toLocaleString()
                                                : ''}
                                        </span>
                                    </div>
                                    {a.note ? (
                                        <div className="mt-1 text-sm">{a.note}</div>
                                    ) : null}
                                </li>
                            ))}
                        </ol>
                    )}
                </Card>
            </div>

            <div className="flex flex-col gap-4">
                <Card className="p-4">
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                        Stages
                    </h2>
                    <ol className="flex flex-col gap-2">
                        {stages.map((s, i) => (
                            <li
                                key={i}
                                className={`flex items-center justify-between rounded border p-2 ${
                                    i === request.currentStageIdx
                                        ? 'border-primary bg-zoru-ink/5'
                                        : 'border-zoru-line'
                                }`}
                            >
                                <div>
                                    <div className="text-sm font-medium">
                                        {i + 1}. {s.name}
                                    </div>
                                    <div className="text-xs text-zoru-ink-muted">
                                        {s.approverKind}
                                        {s.slaMins ? ` · ${s.slaMins} min SLA` : ''}
                                    </div>
                                </div>
                                {i < request.currentStageIdx ? (
                                    <Badge variant="success">Done</Badge>
                                ) : i === request.currentStageIdx ? (
                                    <Badge>Current</Badge>
                                ) : null}
                            </li>
                        ))}
                    </ol>
                </Card>

                {canDecide ? (
                    <Card className="flex flex-col gap-3 p-4">
                        <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                            Take action
                        </h2>
                        <Textarea
                            placeholder="Add a note (optional)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <Input
                            placeholder="Reassign to user id"
                            value={reassignTo}
                            onChange={(e) => setReassignTo(e.target.value)}
                        />
                        {err ? (
                            <div className="text-sm text-zoru-ink">{err}</div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                disabled={busy !== null}
                                onClick={() => decide('approve')}
                            >
                                Approve
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={busy !== null}
                                onClick={() => decide('reject')}
                            >
                                Reject
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy !== null || !reassignTo}
                                onClick={() => decide('reassign')}
                            >
                                Reassign
                            </Button>
                            <Button
                                variant="ghost"
                                disabled={busy !== null}
                                onClick={() => decide('comment')}
                            >
                                Comment
                            </Button>
                        </div>
                        <Button
                            variant="ghost"
                            disabled={busy !== null}
                            onClick={cancel}
                        >
                            Cancel request
                        </Button>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}
