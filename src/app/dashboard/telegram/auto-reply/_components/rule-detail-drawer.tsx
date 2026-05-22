'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Textarea,
  cn,
} from '@/components/zoruui';
import {
  Loader2,
  RefreshCw,
  Play,
  Activity,
  FileText } from 'lucide-react';

/**
 * Read-only detail drawer for an auto-reply rule with three view
 * "modes": Overview, Test, and Runs. We avoid the `Tabs` primitive
 * per project style — instead, a segmented-button row switches modes.
 */

import * as React from 'react';

import {
    listAutoReplyRunsAction,
    testAutoReplyRuleAction,
} from '@/app/actions/telegram-auto-reply.actions';
import type {
    EvalStep,
    RuleAction,
    RuleRow,
    RunRow,
    SimulatedMessage,
} from '../_types';
import { actionLabel, conditionLabel, triggerSummary } from './rule-helpers';

type Mode = 'overview' | 'test' | 'runs';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rule: RuleRow | null;
    projectId: string;
}

export function RuleDetailDrawer({ open, onOpenChange, rule, projectId }: Props) {
    const [mode, setMode] = React.useState<Mode>('overview');

    React.useEffect(() => {
        if (open) setMode('overview');
    }, [open, rule?._id]);

    if (!rule) {
        return (
            <ZoruDrawer open={open} onOpenChange={onOpenChange}>
                <ZoruDrawerContent />
            </ZoruDrawer>
        );
    }

    return (
        <ZoruDrawer open={open} onOpenChange={onOpenChange}>
            <ZoruDrawerContent className="max-h-[92vh]">
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>{rule.name}</ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        {triggerSummary(rule.trigger)} ·{' '}
                        <Badge
                            variant={rule.status === 'enabled' ? 'success' : 'ghost'}
                        >
                            {rule.status}
                        </Badge>
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>

                <div className="px-6 pb-3">
                    <div role="tablist" className="inline-flex rounded-md border bg-card p-0.5">
                        {(
                            [
                                ['overview', 'Overview', FileText],
                                ['test', 'Test', Play],
                                ['runs', 'Runs', Activity],
                            ] as const
                        ).map(([key, label, Icon]) => (
                            <button
                                key={key}
                                role="tab"
                                aria-selected={mode === key}
                                onClick={() => setMode(key)}
                                className={cn(
                                    'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm',
                                    mode === key
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-y-auto px-6 pb-6">
                    {mode === 'overview' && <OverviewPane rule={rule} />}
                    {mode === 'test' && (
                        <TestPane rule={rule} projectId={projectId} />
                    )}
                    {mode === 'runs' && (
                        <RunsPane rule={rule} projectId={projectId} />
                    )}
                </div>
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}

function OverviewPane({ rule }: { rule: RuleRow }) {
    return (
        <div className="grid gap-4">
            <Card>
                <ZoruCardContent className="space-y-2 p-4 text-sm">
                    <Row label="Priority" value={rule.priority} />
                    <Row label="Bot" value={rule.botId ?? 'All bots'} />
                    <Row label="Status" value={rule.status} />
                    <Row
                        label="Fired (7d)"
                        value={rule.fired7d.toLocaleString()}
                    />
                    <Row
                        label="Total runs"
                        value={rule.runCount.toLocaleString()}
                    />
                    <Row
                        label="Error count"
                        value={rule.errorCount.toLocaleString()}
                    />
                    <Row
                        label="Last fired"
                        value={
                            rule.lastRunAt
                                ? new Date(rule.lastRunAt).toLocaleString()
                                : 'Never'
                        }
                    />
                </ZoruCardContent>
            </Card>

            <section>
                <h4 className="mb-2 text-sm font-semibold">Trigger</h4>
                <Card>
                    <ZoruCardContent className="p-4 text-sm">
                        <p>{triggerSummary(rule.trigger)}</p>
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/40 p-2 text-xs">
                            {JSON.stringify(rule.trigger, null, 2)}
                        </pre>
                    </ZoruCardContent>
                </Card>
            </section>

            <section>
                <h4 className="mb-2 text-sm font-semibold">Conditions</h4>
                {rule.conditions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No conditions — fires whenever the trigger matches.
                    </p>
                ) : (
                    <ul className="space-y-1 text-sm">
                        {rule.conditions.map((c, i) => (
                            <li key={i} className="rounded-md border bg-card/60 p-2">
                                <span className="font-medium">
                                    {conditionLabel(c.kind)}
                                </span>{' '}
                                <span className="text-xs text-muted-foreground">
                                    {c.payload !== null && c.payload !== undefined
                                        ? JSON.stringify(c.payload)
                                        : ''}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section>
                <h4 className="mb-2 text-sm font-semibold">Actions</h4>
                {rule.actions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No actions.</p>
                ) : (
                    <ol className="space-y-1 text-sm">
                        {rule.actions.map((a, i) => (
                            <li key={i} className="rounded-md border bg-card/60 p-2">
                                <Badge variant="ghost">#{i + 1}</Badge>{' '}
                                <span className="font-medium">{actionLabel(a.kind)}</span>
                            </li>
                        ))}
                    </ol>
                )}
            </section>

            <section>
                <h4 className="mb-2 text-sm font-semibold">Cooldown</h4>
                <div className="text-sm">
                    {rule.cooldown.perChatSeconds && (
                        <p>Per chat: every {rule.cooldown.perChatSeconds}s</p>
                    )}
                    {rule.cooldown.perRuleSeconds && (
                        <p>Per rule: every {rule.cooldown.perRuleSeconds}s</p>
                    )}
                    {rule.cooldown.perDayLimit && (
                        <p>Per day limit: {rule.cooldown.perDayLimit} fires</p>
                    )}
                    {!rule.cooldown.perChatSeconds &&
                        !rule.cooldown.perRuleSeconds &&
                        !rule.cooldown.perDayLimit && (
                            <p className="text-muted-foreground">No cooldown.</p>
                        )}
                </div>
            </section>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right tabular-nums">{value}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Test pane
// ---------------------------------------------------------------------------

function TestPane({ rule, projectId }: { rule: RuleRow; projectId: string }) {
    const [msg, setMsg] = React.useState<SimulatedMessage>({
        text: '',
        hasMedia: false,
        isGroup: false,
        isFirstMessage: false,
    });
    const [running, setRunning] = React.useState(false);
    const [matched, setMatched] = React.useState<boolean | null>(null);
    const [steps, setSteps] = React.useState<EvalStep[]>([]);
    const [actions, setActions] = React.useState<RuleAction[]>([]);
    const [err, setErr] = React.useState<string | null>(null);

    async function run() {
        setRunning(true);
        setErr(null);
        const res = await testAutoReplyRuleAction(rule._id, {
            projectId,
            simulatedMessage: msg,
        });
        setRunning(false);
        if (res.error) {
            setErr(res.error);
            return;
        }
        setMatched(res.matched);
        setSteps(res.steps);
        setActions(res.actionsThatWouldFire);
    }

    return (
        <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1">
                    <Label>Simulated text</Label>
                    <Textarea
                        rows={3}
                        value={msg.text ?? ''}
                        onChange={(e) =>
                            setMsg((m) => ({ ...m, text: e.target.value }))
                        }
                        placeholder="hello"
                    />
                </div>
                <div className="space-y-1">
                    <Label>Chat type</Label>
                    <Select
                        value={msg.isGroup ? 'group' : 'private'}
                        onValueChange={(v) =>
                            setMsg((m) => ({ ...m, isGroup: v === 'group' }))
                        }
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="private">Private (DM)</ZoruSelectItem>
                            <ZoruSelectItem value="group">Group</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label>Sender tag (optional)</Label>
                    <Input
                        value={msg.senderTag ?? ''}
                        onChange={(e) =>
                            setMsg((m) => ({ ...m, senderTag: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label>Sender role (optional)</Label>
                    <Input
                        value={msg.senderRole ?? ''}
                        onChange={(e) =>
                            setMsg((m) => ({ ...m, senderRole: e.target.value }))
                        }
                    />
                </div>
                <div className="space-y-1">
                    <Label>Language (optional)</Label>
                    <Input
                        value={msg.languageCode ?? ''}
                        onChange={(e) =>
                            setMsg((m) => ({ ...m, languageCode: e.target.value }))
                        }
                        placeholder="en"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={msg.hasMedia ?? false}
                        onCheckedChange={(v) =>
                            setMsg((m) => ({ ...m, hasMedia: v }))
                        }
                    />
                    <span className="text-sm">Message has media</span>
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={msg.isFirstMessage ?? false}
                        onCheckedChange={(v) =>
                            setMsg((m) => ({ ...m, isFirstMessage: v }))
                        }
                    />
                    <span className="text-sm">First message from contact</span>
                </div>
            </div>

            <div>
                <Button onClick={run} disabled={running}>
                    {running ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Play className="mr-2 h-4 w-4" />
                    )}
                    Run test
                </Button>
            </div>

            {err && (
                <p className="text-sm text-destructive" role="alert">
                    {err}
                </p>
            )}

            {matched !== null && (
                <div className="space-y-3">
                    <Badge variant={matched ? 'success' : 'ghost'}>
                        {matched ? 'Rule matched' : 'Rule did not match'}
                    </Badge>
                    <div className="rounded-md border bg-card/60 p-3">
                        <h5 className="mb-2 text-sm font-semibold">
                            Evaluation steps
                        </h5>
                        <ol className="space-y-1 text-sm">
                            {steps.map((s, i) => (
                                <li
                                    key={i}
                                    className="flex items-start gap-2"
                                >
                                    <Badge
                                        variant={s.passed ? 'success' : 'danger'}
                                    >
                                        {s.stage}
                                    </Badge>
                                    <div>
                                        <p>{s.label}</p>
                                        {s.detail && (
                                            <p className="text-xs text-muted-foreground">
                                                {s.detail}
                                            </p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                    {matched && actions.length > 0 && (
                        <div className="rounded-md border bg-card/60 p-3">
                            <h5 className="mb-2 text-sm font-semibold">
                                Actions that would fire
                            </h5>
                            <ol className="space-y-1 text-sm">
                                {actions.map((a, i) => (
                                    <li key={i}>
                                        {i + 1}. {actionLabel(a.kind)}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Runs pane
// ---------------------------------------------------------------------------

function RunsPane({ rule, projectId }: { rule: RuleRow; projectId: string }) {
    const [runs, setRuns] = React.useState<RunRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [cursor, setCursor] = React.useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    const load = React.useCallback(
        async (reset: boolean, useCursor?: string) => {
            setLoading(true);
            const res = await listAutoReplyRunsAction(rule._id, projectId, {
                cursor: reset ? undefined : useCursor,
                limit: 25,
            });
            setLoading(false);
            if (res.error) {
                setErr(res.error);
                return;
            }
            setErr(null);
            setRuns((prev) => (reset ? res.runs : [...prev, ...res.runs]));
            setCursor(res.nextCursor);
            setHasMore(Boolean(res.nextCursor) && res.runs.length > 0);
        },
        [rule._id, projectId],
    );

    React.useEffect(() => {
        void load(true);
    }, [load]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    Recent fires for this rule.
                </p>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => load(true)}
                    disabled={loading}
                >
                    <RefreshCw
                        className={cn('mr-1 h-3.5 w-3.5', loading && 'animate-spin')}
                    />
                    Refresh
                </Button>
            </div>

            {err && (
                <p className="text-sm text-destructive" role="alert">
                    {err}
                </p>
            )}

            {runs.length === 0 && !loading ? (
                <p className="text-sm text-muted-foreground">No fires yet.</p>
            ) : (
                <ul className="space-y-1 text-sm">
                    {runs.map((r) => (
                        <li
                            key={r._id}
                            className="rounded-md border bg-card/60 p-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {r.triggerSummary || rule.name}
                                </span>
                                <Badge
                                    variant={
                                        r.status === 'fired' ? 'success' : 'danger'
                                    }
                                >
                                    {r.status}
                                </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                {new Date(r.firedAt).toLocaleString()} · chat{' '}
                                {r.chatId ?? '—'} · {r.actionsCount} actions
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {hasMore && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => load(false, cursor)}
                    disabled={loading}
                >
                    Load more
                </Button>
            )}
        </div>
    );
}
