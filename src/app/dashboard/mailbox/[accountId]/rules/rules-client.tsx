'use client';

/**
 * Filter rules CRUD.
 *
 * Each rule has:
 *   - conditions: field (from|to|subject|body) + op (contains|equals|…) + value
 *   - actions: type (move|label|forward|delete|markRead|star) + value
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Plus, Trash2 } from 'lucide-react';

import {
    createMailRule,
    deleteMailRule,
    updateMailRule,
} from '@/app/actions/mailbox.actions';
import type {
    MailRuleAction,
    MailRuleActionType,
    MailRuleCondition,
    MailRuleConditionField,
    MailRuleConditionOp,
    MailRuleDoc,
} from '@/lib/rust-client/mail-rules';
import type { MailFolderDoc } from '@/lib/rust-client/mail-folders';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Switch, useToast } from '@/components/sabcrm/20ui';

const FIELDS: { id: MailRuleConditionField; label: string }[] = [
    { id: 'from', label: 'From' },
    { id: 'to', label: 'To' },
    { id: 'subject', label: 'Subject' },
    { id: 'body', label: 'Body' },
    { id: 'hasAttachment', label: 'Has attachment' },
];

const OPS: { id: MailRuleConditionOp; label: string }[] = [
    { id: 'contains', label: 'contains' },
    { id: 'equals', label: 'equals' },
    { id: 'startsWith', label: 'starts with' },
    { id: 'endsWith', label: 'ends with' },
    { id: 'regex', label: 'regex' },
];

const ACTION_TYPES: { id: MailRuleActionType; label: string }[] = [
    { id: 'move', label: 'Move to folder' },
    { id: 'label', label: 'Add label' },
    { id: 'forward', label: 'Forward to' },
    { id: 'markRead', label: 'Mark read' },
    { id: 'star', label: 'Star' },
    { id: 'delete', label: 'Delete' },
];

interface DraftCondition extends MailRuleCondition {
    key: string;
}
interface DraftAction extends MailRuleAction {
    key: string;
}

export interface RulesClientProps {
    accountId: string;
    initialRules: MailRuleDoc[];
    folders: MailFolderDoc[];
}

export function RulesClient({
    accountId,
    initialRules,
    folders,
}: RulesClientProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [name, setName] = React.useState('');
    const [matchMode, setMatchMode] = React.useState<'all' | 'any'>('all');
    const [conditions, setConditions] = React.useState<DraftCondition[]>([
        { key: 'c-0', field: 'from', op: 'contains', value: '' },
    ]);
    const [actions, setActions] = React.useState<DraftAction[]>([
        { key: 'a-0', type: 'markRead' },
    ]);
    const [submitting, setSubmitting] = React.useState(false);
    const [busyId, setBusyId] = React.useState<string | null>(null);

    const renderActionValue = (action: MailRuleAction) => {
        if (action.type === 'move') {
            const folder = folders.find((f) => f._id === action.value);
            return folder ? `→ ${folder.name}` : '→ (folder)';
        }
        if (action.value) return `→ ${action.value}`;
        return '';
    };

    const resetForm = () => {
        setName('');
        setMatchMode('all');
        setConditions([{ key: `c-${Date.now()}`, field: 'from', op: 'contains', value: '' }]);
        setActions([{ key: `a-${Date.now()}`, type: 'markRead' }]);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setSubmitting(true);
        const res = await createMailRule({
            accountId,
            name: name.trim(),
            matchMode,
            conditions: conditions.map(({ key: _k, ...c }) => c),
            actions: actions.map(({ key: _k, ...a }) => a),
            enabled: true,
        });
        setSubmitting(false);
        if (!res.ok) {
            toast({ title: 'Save failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Rule created' });
        resetForm();
        router.refresh();
    };

    const handleToggleEnabled = async (rule: MailRuleDoc, enabled: boolean) => {
        const id = rule._id!;
        setBusyId(id);
        const res = await updateMailRule(id, accountId, { enabled });
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
            return;
        }
        router.refresh();
    };

    const handleDelete = async (rule: MailRuleDoc) => {
        if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
        setBusyId(rule._id!);
        const res = await deleteMailRule(rule._id!, accountId);
        setBusyId(null);
        if (!res.ok) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Rule deleted' });
        router.refresh();
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        New rule
                    </CardTitle>
                    <CardDescription>
                        When conditions match, run the listed actions on incoming mail.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="rule-name">Name</Label>
                            <Input
                                id="rule-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Newsletters → Archive"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Match mode</Label>
                            <Select
                                value={matchMode}
                                onValueChange={(v) => setMatchMode(v as 'all' | 'any')}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Match ALL conditions</SelectItem>
                                    <SelectItem value="any">Match ANY condition</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Conditions</Label>
                        {conditions.map((c, idx) => (
                            <div
                                key={c.key}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-[10rem_8rem_1fr_auto]"
                            >
                                <Select
                                    value={c.field}
                                    onValueChange={(v) =>
                                        setConditions((prev) =>
                                            prev.map((x, i) =>
                                                i === idx ? { ...x, field: v as MailRuleConditionField } : x,
                                            ),
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {FIELDS.map((f) => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={c.op}
                                    onValueChange={(v) =>
                                        setConditions((prev) =>
                                            prev.map((x, i) =>
                                                i === idx ? { ...x, op: v as MailRuleConditionOp } : x,
                                            ),
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {OPS.map((o) => (
                                            <SelectItem key={o.id} value={o.id}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input
                                    placeholder="value"
                                    value={c.value ?? ''}
                                    onChange={(e) =>
                                        setConditions((prev) =>
                                            prev.map((x, i) =>
                                                i === idx ? { ...x, value: e.target.value } : x,
                                            ),
                                        )
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        setConditions((prev) => prev.filter((_, i) => i !== idx))
                                    }
                                    disabled={conditions.length === 1}
                                    aria-label="Remove condition"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setConditions((prev) => [
                                    ...prev,
                                    {
                                        key: `c-${Date.now()}-${prev.length}`,
                                        field: 'subject',
                                        op: 'contains',
                                        value: '',
                                    },
                                ])
                            }
                        >
                            <Plus className="mr-1 h-3 w-3" />
                            Add condition
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Actions</Label>
                        {actions.map((a, idx) => {
                            const needsFolder = a.type === 'move';
                            const needsText = a.type === 'label' || a.type === 'forward';
                            return (
                                <div
                                    key={a.key}
                                    className="grid grid-cols-1 gap-2 sm:grid-cols-[14rem_1fr_auto]"
                                >
                                    <Select
                                        value={a.type}
                                        onValueChange={(v) =>
                                            setActions((prev) =>
                                                prev.map((x, i) =>
                                                    i === idx ? { ...x, type: v as MailRuleActionType, value: '' } : x,
                                                ),
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ACTION_TYPES.map((t) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {needsFolder ? (
                                        <Select
                                            value={a.value ?? ''}
                                            onValueChange={(v) =>
                                                setActions((prev) =>
                                                    prev.map((x, i) => (i === idx ? { ...x, value: v } : x)),
                                                )
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Pick folder" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {folders.map((f) => (
                                                    <SelectItem key={f._id} value={f._id!}>
                                                        {f.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : needsText ? (
                                        <Input
                                            placeholder={a.type === 'forward' ? 'forward@example.com' : 'label'}
                                            value={a.value ?? ''}
                                            onChange={(e) =>
                                                setActions((prev) =>
                                                    prev.map((x, i) =>
                                                        i === idx ? { ...x, value: e.target.value } : x,
                                                    ),
                                                )
                                            }
                                        />
                                    ) : (
                                        <div />
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                            setActions((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                        disabled={actions.length === 1}
                                        aria-label="Remove action"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            );
                        })}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                                setActions((prev) => [
                                    ...prev,
                                    { key: `a-${Date.now()}-${prev.length}`, type: 'markRead' },
                                ])
                            }
                        >
                            <Plus className="mr-1 h-3 w-3" />
                            Add action
                        </Button>
                    </div>

                    <Separator />
                    <div>
                        <Button type="button" onClick={handleCreate} disabled={submitting}>
                            <Plus className="mr-2 h-4 w-4" />
                            {submitting ? 'Saving…' : 'Save rule'}
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {initialRules.length === 0 ? (
                <EmptyState
                    icon={<Filter className="h-8 w-8" />}
                    title="No rules yet"
                    description="Create a rule above to triage incoming mail automatically."
                />
            ) : (
                <div className="flex flex-col gap-3">
                    {initialRules.map((r) => {
                        const id = r._id!;
                        const busy = busyId === id;
                        return (
                            <Card key={id}>
                                <CardBody className="flex flex-col gap-2 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{r.name}</span>
                                                <Badge variant="secondary">
                                                    {r.matchMode === 'any' ? 'any' : 'all'}
                                                </Badge>
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {(r.conditions ?? []).map((c, i) => (
                                                    <Badge key={i} variant="outline">
                                                        {c.field} {c.op} {c.value ?? ''}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {(r.actions ?? []).map((a, i) => (
                                                    <Badge key={i}>
                                                        {a.type} {renderActionValue(a)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Label className="text-xs">Enabled</Label>
                                            <Switch
                                                checked={r.enabled !== false}
                                                disabled={busy}
                                                onCheckedChange={(v) => handleToggleEnabled(r, v)}
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                disabled={busy}
                                                onClick={() => handleDelete(r)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
