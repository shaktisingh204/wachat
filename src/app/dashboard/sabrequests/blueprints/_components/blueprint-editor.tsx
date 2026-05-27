'use client';

/**
 * Blueprint editor — name + category + form schema (raw JSON) + stages
 * (typed editor) + routing rules (raw JSON). Lean by design — the
 * production form builder will land in a follow-up; today we expose
 * enough surface for admins to configure approval workflows.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
    Badge,
    Button,
    Card,
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
    createBlueprint,
    deleteBlueprint,
    updateBlueprint,
} from '@/app/actions/sabrequests.actions';
import type { BlueprintStage, RequestBlueprintDoc } from '@/lib/rust-client/sabrequests-blueprints';

interface Props {
    mode: 'create' | 'edit';
    initial?: RequestBlueprintDoc;
}

const APPROVER_KINDS: BlueprintStage['approverKind'][] = [
    'user',
    'role',
    'manager_of_requester',
    'conditional',
];

export function BlueprintEditor({ mode, initial }: Props) {
    const router = useRouter();
    const [name, setName] = React.useState(initial?.name ?? '');
    const [description, setDescription] = React.useState(
        initial?.description ?? '',
    );
    const [category, setCategory] = React.useState(
        initial?.category ?? 'custom',
    );
    const [icon, setIcon] = React.useState(initial?.icon ?? '');
    const [slaMins, setSlaMins] = React.useState(
        initial?.slaMins ? String(initial.slaMins) : '',
    );
    const [published, setPublished] = React.useState(initial?.published ?? false);
    const [formSchemaText, setFormSchemaText] = React.useState(
        JSON.stringify(initial?.formSchema ?? { fields: [] }, null, 2),
    );
    const [stages, setStages] = React.useState<BlueprintStage[]>(
        initial?.stages ?? [],
    );
    const [routingRulesText, setRoutingRulesText] = React.useState(
        JSON.stringify(initial?.routingRules ?? [], null, 2),
    );
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState<string | null>(null);

    function updateStage(i: number, patch: Partial<BlueprintStage>) {
        setStages((cur) =>
            cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)),
        );
    }
    function addStage() {
        setStages((cur) => [
            ...cur,
            { name: `Stage ${cur.length + 1}`, approverKind: 'user' },
        ]);
    }
    function removeStage(i: number) {
        setStages((cur) => cur.filter((_, idx) => idx !== i));
    }

    async function save() {
        setBusy(true);
        setErr(null);
        let formSchema: unknown = {};
        let routingRules: unknown[] = [];
        try {
            formSchema = JSON.parse(formSchemaText || '{}');
        } catch (e) {
            setErr(`formSchema JSON is invalid: ${String(e)}`);
            setBusy(false);
            return;
        }
        try {
            routingRules = JSON.parse(routingRulesText || '[]');
        } catch (e) {
            setErr(`routingRules JSON is invalid: ${String(e)}`);
            setBusy(false);
            return;
        }
        const payload = {
            name,
            description,
            category,
            icon,
            formSchema,
            stages,
            routingRules: routingRules as never,
            slaMins: slaMins ? Number(slaMins) : undefined,
            published,
        };
        const res =
            mode === 'create'
                ? await createBlueprint(payload)
                : await updateBlueprint(initial!._id, payload);
        setBusy(false);
        if (!res.ok || !res.data) {
            setErr(res.error ?? 'Failed.');
            return;
        }
        router.push(`/dashboard/requests/blueprints/${res.data._id}`);
        router.refresh();
    }

    async function remove() {
        if (!initial) return;
        if (
            !window.confirm('Archive this blueprint? Existing requests are unaffected.')
        )
            return;
        setBusy(true);
        const res = await deleteBlueprint(initial._id);
        setBusy(false);
        if (!res.ok) {
            setErr(res.error ?? 'Failed.');
            return;
        }
        router.push('/dashboard/requests/blueprints');
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">
                        {mode === 'create' ? 'New blueprint' : initial?.name}
                    </h1>
                    {mode === 'edit' && initial?.published === false ? (
                        <Badge variant="secondary">Draft</Badge>
                    ) : null}
                </div>
                <div className="flex gap-2">
                    {mode === 'edit' ? (
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={remove}
                        >
                            Archive
                        </Button>
                    ) : null}
                    <Button disabled={busy || !name.trim()} onClick={save}>
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </header>

            <Card className="flex flex-col gap-3 p-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Basics
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                        <Label>Name *</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label>Category</Label>
                        <Input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="procurement / time_off / it_access / custom"
                        />
                    </div>
                    <div>
                        <Label>Icon</Label>
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            placeholder="emoji or icon name"
                        />
                    </div>
                    <div>
                        <Label>Overall SLA (minutes)</Label>
                        <Input
                            type="number"
                            value={slaMins}
                            onChange={(e) => setSlaMins(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                    <Label>Description</Label>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Switch
                        checked={published}
                        onCheckedChange={setPublished}
                        id="published"
                    />
                    <Label htmlFor="published">Published</Label>
                </div>
            </Card>

            <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                        Approval stages
                    </h2>
                    <Button variant="outline" onClick={addStage}>
                        Add stage
                    </Button>
                </div>
                {stages.length === 0 ? (
                    <div className="text-sm text-zoru-ink-muted">
                        Add at least one stage so requests can be approved.
                    </div>
                ) : (
                    stages.map((s, i) => (
                        <Card key={i} className="flex flex-col gap-2 p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    Stage {i + 1}
                                </span>
                                <Button
                                    variant="ghost"
                                    onClick={() => removeStage(i)}
                                >
                                    Remove
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        value={s.name}
                                        onChange={(e) =>
                                            updateStage(i, { name: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Approver kind</Label>
                                    <Select
                                        value={s.approverKind}
                                        onValueChange={(v) =>
                                            updateStage(i, {
                                                approverKind: v as BlueprintStage['approverKind'],
                                            })
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {APPROVER_KINDS.map((k) => (
                                                <ZoruSelectItem key={k} value={k}>
                                                    {k}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </div>
                                {s.approverKind === 'user' ? (
                                    <div>
                                        <Label>Approver user id</Label>
                                        <Input
                                            value={s.approverId ?? ''}
                                            onChange={(e) =>
                                                updateStage(i, {
                                                    approverId: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                ) : s.approverKind === 'role' ? (
                                    <div>
                                        <Label>Approver role</Label>
                                        <Input
                                            value={s.approverRole ?? ''}
                                            onChange={(e) =>
                                                updateStage(i, {
                                                    approverRole: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                ) : s.approverKind === 'conditional' ? (
                                    <div>
                                        <Label>Conditional expression</Label>
                                        <Input
                                            value={s.conditionalExpr ?? ''}
                                            onChange={(e) =>
                                                updateStage(i, {
                                                    conditionalExpr: e.target.value,
                                                })
                                            }
                                            placeholder="formData.amount > 10000 ? userId1 : userId2"
                                        />
                                    </div>
                                ) : null}
                                <div>
                                    <Label>SLA (minutes)</Label>
                                    <Input
                                        type="number"
                                        value={
                                            s.slaMins != null ? String(s.slaMins) : ''
                                        }
                                        onChange={(e) =>
                                            updateStage(i, {
                                                slaMins: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={!!s.escalateOnBreach}
                                        onCheckedChange={(v) =>
                                            updateStage(i, { escalateOnBreach: v })
                                        }
                                        id={`esc-${i}`}
                                    />
                                    <Label htmlFor={`esc-${i}`}>
                                        Escalate on SLA breach
                                    </Label>
                                </div>
                                {s.escalateOnBreach ? (
                                    <div className="md:col-span-2">
                                        <Label>Escalate to user id</Label>
                                        <Input
                                            value={s.escalateToUserId ?? ''}
                                            onChange={(e) =>
                                                updateStage(i, {
                                                    escalateToUserId: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                ) : null}
                            </div>
                        </Card>
                    ))
                )}
            </Card>

            <Card className="flex flex-col gap-3 p-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Form schema (JSON)
                </h2>
                <p className="text-xs text-zoru-ink-muted">
                    {`Shape: { "fields": [{ "key", "label", "type" }] } — type ∈ text, number, textarea, select, date, file.`}
                </p>
                <Textarea
                    rows={10}
                    value={formSchemaText}
                    onChange={(e) => setFormSchemaText(e.target.value)}
                    className="font-mono text-xs"
                />
            </Card>

            <Card className="flex flex-col gap-3 p-4">
                <h2 className="text-sm font-medium uppercase tracking-wide text-zoru-ink-muted">
                    Routing rules (JSON)
                </h2>
                <p className="text-xs text-zoru-ink-muted">
                    Array of {`{ label, expr, startStageIdx }`}. Expression
                    evaluator is deferred — use `default:` prefix to pick a
                    default starting stage.
                </p>
                <Textarea
                    rows={6}
                    value={routingRulesText}
                    onChange={(e) => setRoutingRulesText(e.target.value)}
                    className="font-mono text-xs"
                />
            </Card>

            {err ? <div className="text-sm text-zoru-ink">{err}</div> : null}
        </div>
    );
}
