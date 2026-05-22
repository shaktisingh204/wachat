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
} from '@/components/zoruui';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2 } from 'lucide-react';

/**
 * Drawer-based editor for an auto-reply rule. Sections:
 *  1. Basics — name, bot scope, status, priority
 *  2. Trigger — kind + payload
 *  3. Conditions — list with add/remove
 *  4. Actions — ordered list with add/remove
 *  5. Cooldown — perChatSeconds / perRuleSeconds / perDayLimit
 *
 * The form is fully local state; the page wires it up to the create/
 * update server actions.
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';

import type {
    ActionKind,
    ConditionKind,
    Cooldown,
    RuleAction,
    RuleCondition,
    RuleRow,
    RuleTrigger,
    TriggerKind,
    UpsertBody,
} from '../_types';

import {
    ACTION_KINDS,
    CONDITION_KINDS,
    TRIGGER_KINDS,
    defaultAction,
    defaultCondition,
    defaultTrigger,
} from './rule-helpers';

export interface BotOption {
    id: string;
    label: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** When set, the drawer is in edit mode. */
    existing?: RuleRow | null;
    bots: BotOption[];
    saving: boolean;
    onSave: (body: Omit<UpsertBody, 'projectId'>) => Promise<void>;
}

interface FormState {
    name: string;
    botId: string; // '' = all bots
    status: 'enabled' | 'disabled';
    priority: number;
    trigger: RuleTrigger;
    conditions: RuleCondition[];
    actions: RuleAction[];
    cooldown: Cooldown;
}

const EMPTY: FormState = {
    name: '',
    botId: '',
    status: 'enabled',
    priority: 100,
    trigger: defaultTrigger(),
    conditions: [],
    actions: [defaultAction('reply_text')],
    cooldown: {},
};

function fromRule(rule: RuleRow): FormState {
    return {
        name: rule.name,
        botId: rule.botId ?? '',
        status: rule.status,
        priority: rule.priority,
        trigger: rule.trigger ?? defaultTrigger(),
        conditions: rule.conditions ?? [],
        actions: rule.actions ?? [],
        cooldown: rule.cooldown ?? {},
    };
}

export function RuleEditorDrawer({
    open,
    onOpenChange,
    existing,
    bots,
    saving,
    onSave,
}: Props) {
    const [form, setForm] = React.useState<FormState>(EMPTY);
    const [err, setErr] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!open) return;
        setErr(null);
        setForm(existing ? fromRule(existing) : EMPTY);
    }, [open, existing]);

    function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function setTrigger(t: Partial<RuleTrigger>) {
        setForm((f) => ({ ...f, trigger: { ...f.trigger, ...t } }));
    }

    function setCondition(i: number, c: Partial<RuleCondition>) {
        setForm((f) => ({
            ...f,
            conditions: f.conditions.map((x, idx) => (idx === i ? { ...x, ...c } : x)),
        }));
    }
    function addCondition() {
        setForm((f) => ({ ...f, conditions: [...f.conditions, defaultCondition()] }));
    }
    function removeCondition(i: number) {
        setForm((f) => ({
            ...f,
            conditions: f.conditions.filter((_, idx) => idx !== i),
        }));
    }

    function setAction(i: number, a: Partial<RuleAction>) {
        setForm((f) => ({
            ...f,
            actions: f.actions.map((x, idx) => (idx === i ? { ...x, ...a } : x)),
        }));
    }
    function setActionPayload(i: number, key: string, value: unknown) {
        setForm((f) => ({
            ...f,
            actions: f.actions.map((x, idx) =>
                idx === i
                    ? {
                          ...x,
                          payload: { ...(x.payload as object | null), [key]: value },
                      }
                    : x,
            ),
        }));
    }
    function addAction() {
        setForm((f) => ({ ...f, actions: [...f.actions, defaultAction('reply_text')] }));
    }
    function removeAction(i: number) {
        setForm((f) => ({
            ...f,
            actions: f.actions.filter((_, idx) => idx !== i),
        }));
    }
    function moveAction(i: number, delta: number) {
        setForm((f) => {
            const next = [...f.actions];
            const j = i + delta;
            if (j < 0 || j >= next.length) return f;
            [next[i], next[j]] = [next[j], next[i]];
            return { ...f, actions: next };
        });
    }

    function validate(): string | null {
        if (!form.name.trim()) return 'Name is required.';
        if (!form.trigger.kind) return 'Pick a trigger kind.';
        if (form.trigger.kind === 'regex' && !form.trigger.payload) {
            return 'Regex trigger needs a pattern.';
        }
        return null;
    }

    async function submit() {
        const v = validate();
        if (v) {
            setErr(v);
            return;
        }
        setErr(null);
        await onSave({
            name: form.name.trim(),
            botId: form.botId || null,
            status: form.status,
            priority: form.priority,
            trigger: form.trigger,
            conditions: form.conditions,
            actions: form.actions,
            cooldown: form.cooldown,
        });
    }

    return (
        <ZoruDrawer open={open} onOpenChange={onOpenChange}>
            <ZoruDrawerContent className="max-h-[92vh]">
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>
                        {existing ? 'Edit auto-reply rule' : 'New auto-reply rule'}
                    </ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        Rules are evaluated in priority order; lower priority numbers run first.
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>

                <div className="overflow-y-auto px-6 pb-4">
                    <div className="grid gap-6">
                        {/* 1. Basics */}
                        <Section title="1. Basics">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Name">
                                    <Input
                                        value={form.name}
                                        onChange={(e) => patch('name', e.target.value)}
                                        placeholder="Welcome reply"
                                    />
                                </Field>
                                <Field label="Bot scope">
                                    <Select
                                        value={form.botId || 'all'}
                                        onValueChange={(v) => patch('botId', v === 'all' ? '' : v)}
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue placeholder="All bots" />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="all">All bots in project</ZoruSelectItem>
                                            {bots.map((b) => (
                                                <ZoruSelectItem key={b.id} value={b.id}>
                                                    {b.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                <Field label="Priority (lower runs first)">
                                    <Input
                                        type="number"
                                        value={form.priority}
                                        onChange={(e) =>
                                            patch('priority', Number(e.target.value) || 0)
                                        }
                                    />
                                </Field>
                                <Field label="Enabled">
                                    <div className="flex h-10 items-center gap-2">
                                        <Switch
                                            checked={form.status === 'enabled'}
                                            onCheckedChange={(v) =>
                                                patch('status', v ? 'enabled' : 'disabled')
                                            }
                                        />
                                        <span className="text-sm text-muted-foreground">
                                            {form.status === 'enabled' ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </Field>
                            </div>
                        </Section>

                        {/* 2. Trigger */}
                        <Section title="2. Trigger">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field label="Kind">
                                    <Select
                                        value={form.trigger.kind}
                                        onValueChange={(v) => {
                                            const kind = v as TriggerKind;
                                            setTrigger({
                                                kind,
                                                payload:
                                                    kind === 'keyword' || kind === 'contains_any'
                                                        ? []
                                                        : kind === 'business_hours'
                                                          ? { startHour: 9, endHour: 18 }
                                                          : kind === 'first_message' ||
                                                              kind === 'media_only'
                                                            ? null
                                                            : '',
                                            });
                                        }}
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {TRIGGER_KINDS.map((t) => (
                                                <ZoruSelectItem key={t.value} value={t.value}>
                                                    {t.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                <Field label="Case sensitive">
                                    <div className="flex h-10 items-center gap-2">
                                        <Switch
                                            checked={form.trigger.caseSensitive ?? false}
                                            onCheckedChange={(v) =>
                                                setTrigger({ caseSensitive: v })
                                            }
                                            disabled={
                                                form.trigger.kind === 'business_hours' ||
                                                form.trigger.kind === 'first_message' ||
                                                form.trigger.kind === 'media_only'
                                            }
                                        />
                                        <span className="text-sm text-muted-foreground">
                                            {form.trigger.caseSensitive ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </Field>
                            </div>
                            <div className="mt-3">
                                <TriggerPayloadEditor
                                    trigger={form.trigger}
                                    onChange={(payload) => setTrigger({ payload })}
                                />
                            </div>
                        </Section>

                        {/* 3. Conditions */}
                        <Section title="3. Conditions (all must pass)">
                            <div className="grid gap-2">
                                {form.conditions.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No conditions — the rule fires whenever the trigger matches.
                                    </p>
                                )}
                                {form.conditions.map((c, i) => (
                                    <div
                                        key={i}
                                        className="flex flex-col gap-2 rounded-md border bg-card/60 p-3 sm:flex-row sm:items-end"
                                    >
                                        <div className="flex-1">
                                            <Label>Condition</Label>
                                            <Select
                                                value={c.kind}
                                                onValueChange={(v) =>
                                                    setCondition(i, {
                                                        ...defaultCondition(v as ConditionKind),
                                                    })
                                                }
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {CONDITION_KINDS.map((opt) => (
                                                        <ZoruSelectItem
                                                            key={opt.value}
                                                            value={opt.value}
                                                        >
                                                            {opt.label}
                                                        </ZoruSelectItem>
                                                    ))}
                                                </ZoruSelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex-1">
                                            <ConditionPayloadEditor
                                                condition={c}
                                                onChange={(payload) =>
                                                    setCondition(i, { payload })
                                                }
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeCondition(i)}
                                            title="Remove condition"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addCondition}>
                                    <Plus className="mr-1 h-4 w-4" /> Add condition
                                </Button>
                            </div>
                        </Section>

                        {/* 4. Actions */}
                        <Section title="4. Actions">
                            <div className="grid gap-2">
                                {form.actions.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        No actions yet — add at least one to make the rule useful.
                                    </p>
                                )}
                                {form.actions.map((a, i) => (
                                    <Card key={i}>
                                        <ZoruCardContent className="space-y-3 p-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="ghost">#{i + 1}</Badge>
                                                <div className="flex-1 min-w-[180px]">
                                                    <Select
                                                        value={a.kind}
                                                        onValueChange={(v) =>
                                                            setAction(i, {
                                                                ...defaultAction(v as ActionKind),
                                                            })
                                                        }
                                                    >
                                                        <ZoruSelectTrigger>
                                                            <ZoruSelectValue />
                                                        </ZoruSelectTrigger>
                                                        <ZoruSelectContent>
                                                            {ACTION_KINDS.map((opt) => (
                                                                <ZoruSelectItem
                                                                    key={opt.value}
                                                                    value={opt.value}
                                                                >
                                                                    {opt.label}
                                                                </ZoruSelectItem>
                                                            ))}
                                                        </ZoruSelectContent>
                                                    </Select>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => moveAction(i, -1)}
                                                    title="Move up"
                                                    disabled={i === 0}
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => moveAction(i, 1)}
                                                    title="Move down"
                                                    disabled={i === form.actions.length - 1}
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeAction(i)}
                                                    title="Remove action"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <ActionPayloadEditor
                                                action={a}
                                                onChange={(k, v) => setActionPayload(i, k, v)}
                                            />
                                        </ZoruCardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" size="sm" onClick={addAction}>
                                    <Plus className="mr-1 h-4 w-4" /> Add action
                                </Button>
                            </div>
                        </Section>

                        {/* 5. Cooldown */}
                        <Section title="5. Cooldown (optional)">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Field label="Per chat (seconds)">
                                    <Input
                                        type="number"
                                        value={form.cooldown.perChatSeconds ?? ''}
                                        onChange={(e) =>
                                            patch('cooldown', {
                                                ...form.cooldown,
                                                perChatSeconds: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        placeholder="e.g. 60"
                                    />
                                </Field>
                                <Field label="Per rule (seconds)">
                                    <Input
                                        type="number"
                                        value={form.cooldown.perRuleSeconds ?? ''}
                                        onChange={(e) =>
                                            patch('cooldown', {
                                                ...form.cooldown,
                                                perRuleSeconds: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        placeholder="e.g. 5"
                                    />
                                </Field>
                                <Field label="Per day limit (fires)">
                                    <Input
                                        type="number"
                                        value={form.cooldown.perDayLimit ?? ''}
                                        onChange={(e) =>
                                            patch('cooldown', {
                                                ...form.cooldown,
                                                perDayLimit: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                        placeholder="e.g. 1000"
                                    />
                                </Field>
                            </div>
                        </Section>

                        {err && (
                            <p className="text-sm text-destructive" role="alert">
                                {err}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t bg-background p-4">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {existing ? 'Save rule' : 'Create rule'}
                    </Button>
                </div>
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}

// ---------------------------------------------------------------------------
//  Small layout helpers
// ---------------------------------------------------------------------------

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold">{title}</h3>
            <div>{children}</div>
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Trigger payload editor
// ---------------------------------------------------------------------------

function TriggerPayloadEditor({
    trigger,
    onChange,
}: {
    trigger: RuleTrigger;
    onChange: (payload: unknown) => void;
}) {
    const kind = trigger.kind;
    if (kind === 'keyword' || kind === 'contains_any') {
        const list = Array.isArray(trigger.payload) ? (trigger.payload as string[]) : [];
        return (
            <Field
                label={
                    kind === 'keyword'
                        ? 'Keywords (one per line or comma-separated)'
                        : 'Phrases (one per line or comma-separated)'
                }
            >
                <Textarea
                    rows={4}
                    value={list.join('\n')}
                    onChange={(e) =>
                        onChange(
                            e.target.value
                                .split(/[\n,]/)
                                .map((p) => p.trim())
                                .filter(Boolean),
                        )
                    }
                    placeholder={'hello\nhi\nhey'}
                />
            </Field>
        );
    }
    if (kind === 'exact' || kind === 'starts_with' || kind === 'regex') {
        return (
            <Field
                label={
                    kind === 'regex' ? 'Pattern (PCRE-style)' : 'Value'
                }
            >
                <Input
                    value={typeof trigger.payload === 'string' ? trigger.payload : ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={kind === 'regex' ? '^/start' : ''}
                />
            </Field>
        );
    }
    if (kind === 'business_hours') {
        const p = (trigger.payload ?? {}) as {
            startHour?: number;
            endHour?: number;
        };
        return (
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Start hour (0–23, UTC)">
                    <Input
                        type="number"
                        min={0}
                        max={23}
                        value={p.startHour ?? 9}
                        onChange={(e) =>
                            onChange({
                                ...p,
                                startHour: Number(e.target.value),
                            })
                        }
                    />
                </Field>
                <Field label="End hour (0–24, UTC)">
                    <Input
                        type="number"
                        min={0}
                        max={24}
                        value={p.endHour ?? 18}
                        onChange={(e) =>
                            onChange({ ...p, endHour: Number(e.target.value) })
                        }
                    />
                </Field>
            </div>
        );
    }
    return (
        <p className="text-xs text-muted-foreground">
            This trigger has no extra payload.
        </p>
    );
}

// ---------------------------------------------------------------------------
//  Condition payload editor
// ---------------------------------------------------------------------------

function ConditionPayloadEditor({
    condition,
    onChange,
}: {
    condition: RuleCondition;
    onChange: (payload: unknown) => void;
}) {
    if (condition.kind === 'contact_has_tag') {
        return (
            <Field label="Tag">
                <Input
                    value={typeof condition.payload === 'string' ? condition.payload : ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="vip"
                />
            </Field>
        );
    }
    if (condition.kind === 'sender_role') {
        return (
            <Field label="Role">
                <Input
                    value={typeof condition.payload === 'string' ? condition.payload : ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="agent / customer / admin"
                />
            </Field>
        );
    }
    if (condition.kind === 'time_window') {
        const p = (condition.payload ?? {}) as {
            startHour?: number;
            endHour?: number;
        };
        return (
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    min={0}
                    max={23}
                    value={p.startHour ?? 0}
                    onChange={(e) =>
                        onChange({ ...p, startHour: Number(e.target.value) })
                    }
                    aria-label="Start hour"
                />
                <Input
                    type="number"
                    min={0}
                    max={24}
                    value={p.endHour ?? 24}
                    onChange={(e) =>
                        onChange({ ...p, endHour: Number(e.target.value) })
                    }
                    aria-label="End hour"
                />
            </div>
        );
    }
    return (
        <p className="text-xs text-muted-foreground">No payload needed.</p>
    );
}

// ---------------------------------------------------------------------------
//  Action payload editor
// ---------------------------------------------------------------------------

function ActionPayloadEditor({
    action,
    onChange,
}: {
    action: RuleAction;
    onChange: (key: string, value: unknown) => void;
}) {
    const p = (action.payload ?? {}) as Record<string, any>;
    switch (action.kind) {
        case 'reply_text':
            return (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Field label="Text">
                        <Textarea
                            rows={3}
                            value={p.text ?? ''}
                            onChange={(e) => onChange('text', e.target.value)}
                            placeholder="Hi {{first_name}}, thanks for reaching out!"
                        />
                    </Field>
                    <Field label="Parse mode">
                        <Select
                            value={p.parseMode ?? 'plain'}
                            onValueChange={(v) => onChange('parseMode', v)}
                        >
                            <ZoruSelectTrigger className="w-[140px]">
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="plain">Plain</ZoruSelectItem>
                                <ZoruSelectItem value="markdown">Markdown</ZoruSelectItem>
                                <ZoruSelectItem value="html">HTML</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </Field>
                </div>
            );
        case 'reply_media':
            return (
                <div className="grid gap-3">
                    <Field label="Media file (from SabFiles)">
                        <div className="flex items-center gap-2">
                            <Input
                                value={p.url ?? ''}
                                readOnly
                                placeholder="Pick a file from your SabFiles library"
                            />
                            <SabFilePickerButton
                                accept="all"
                                onPick={(pick) => {
                                    onChange('fileId', pick.id);
                                    onChange('url', pick.url);
                                    onChange('mime', pick.mime);
                                    onChange('name', pick.name);
                                }}
                            >
                                Pick file
                            </SabFilePickerButton>
                        </div>
                    </Field>
                    <Field label="Caption (optional)">
                        <Textarea
                            rows={2}
                            value={p.caption ?? ''}
                            onChange={(e) => onChange('caption', e.target.value)}
                        />
                    </Field>
                </div>
            );
        case 'forward_to_chat':
            return (
                <Field label="Destination chat id">
                    <Input
                        value={p.chatId ?? ''}
                        onChange={(e) => onChange('chatId', e.target.value)}
                        placeholder="@channel or -100…"
                    />
                </Field>
            );
        case 'tag_contact':
        case 'remove_tag':
            return (
                <Field label="Tag">
                    <Input
                        value={p.tag ?? ''}
                        onChange={(e) => onChange('tag', e.target.value)}
                        placeholder="lead / vip"
                    />
                </Field>
            );
        case 'assign_agent':
            return (
                <Field label="Agent user id">
                    <Input
                        value={p.agentUserId ?? ''}
                        onChange={(e) => onChange('agentUserId', e.target.value)}
                        placeholder="agent ObjectId"
                    />
                </Field>
            );
        case 'run_flow':
            return (
                <Field label="Flow id">
                    <Input
                        value={p.flowId ?? ''}
                        onChange={(e) => onChange('flowId', e.target.value)}
                        placeholder="ObjectId of the SabFlow / telegram-flows record"
                    />
                </Field>
            );
        case 'set_variable':
            return (
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Key">
                        <Input
                            value={p.key ?? ''}
                            onChange={(e) => onChange('key', e.target.value)}
                        />
                    </Field>
                    <Field label="Value">
                        <Input
                            value={p.value ?? ''}
                            onChange={(e) => onChange('value', e.target.value)}
                        />
                    </Field>
                </div>
            );
        case 'http_call':
            return (
                <div className="grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                        <Field label="Method">
                            <Select
                                value={p.method ?? 'POST'}
                                onValueChange={(v) => onChange('method', v)}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                                        <ZoruSelectItem key={m} value={m}>
                                            {m}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="URL">
                            <Input
                                value={p.url ?? ''}
                                onChange={(e) => onChange('url', e.target.value)}
                                placeholder="https://example.com/webhook"
                            />
                        </Field>
                    </div>
                    <Field label="Headers (one per line, key: value)">
                        <Textarea
                            rows={2}
                            value={p.headers ?? ''}
                            onChange={(e) => onChange('headers', e.target.value)}
                            placeholder="Authorization: Bearer …"
                        />
                    </Field>
                    <Field label="Body">
                        <Textarea
                            rows={3}
                            value={p.body ?? ''}
                            onChange={(e) => onChange('body', e.target.value)}
                            placeholder='{"text":"{{message.text}}"}'
                        />
                    </Field>
                </div>
            );
        case 'do_nothing':
        default:
            return (
                <p className="text-xs text-muted-foreground">No payload.</p>
            );
    }
}
