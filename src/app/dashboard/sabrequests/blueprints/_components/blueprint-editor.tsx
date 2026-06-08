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
    Settings2,
    Workflow,
    FileJson,
    GitBranch,
    Plus,
    Trash2,
    Archive,
    Save,
    ArrowLeft,
} from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardBody,
    Field,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Switch,
    Textarea,
    Label,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
    AlertDialog,
    AlertDialogTrigger,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/sabcrm/20ui';
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

const APPROVER_KINDS: { value: NonNullable<BlueprintStage['approverKind']>; label: string }[] = [
    { value: 'user', label: 'Specific user' },
    { value: 'role', label: 'Role' },
    { value: 'manager_of_requester', label: 'Manager of requester' },
    { value: 'conditional', label: 'Conditional' },
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
            setErr(`Form schema JSON is invalid: ${String(e)}`);
            setBusy(false);
            return;
        }
        try {
            routingRules = JSON.parse(routingRulesText || '[]');
        } catch (e) {
            setErr(`Routing rules JSON is invalid: ${String(e)}`);
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
            setErr(res.error ?? 'We couldn’t save this blueprint. Please try again.');
            return;
        }
        router.push(`/dashboard/sabrequests/blueprints/${res.data._id}`);
        router.refresh();
    }

    async function remove() {
        if (!initial) return;
        setBusy(true);
        setErr(null);
        const res = await deleteBlueprint(initial._id);
        setBusy(false);
        if (!res.ok) {
            setErr(res.error ?? 'We couldn’t archive this blueprint. Please try again.');
            return;
        }
        router.push('/dashboard/sabrequests/blueprints');
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>Blueprint</PageEyebrow>
                    <PageTitle>
                        {mode === 'create' ? 'New blueprint' : initial?.name || 'Edit blueprint'}
                    </PageTitle>
                    <PageDescription>
                        Configure the form, approval stages, and routing for this request
                        type.
                    </PageDescription>
                    {mode === 'edit' && initial?.published === false ? (
                        <span className="mt-1 inline-flex">
                            <Badge tone="neutral" kind="outline">
                                Draft
                            </Badge>
                        </span>
                    ) : null}
                </PageHeaderHeading>
                <PageActions>
                    <Button variant="ghost" asChild>
                        <a href="/dashboard/sabrequests/blueprints">
                            <ArrowLeft size={16} aria-hidden="true" />
                            Back
                        </a>
                    </Button>
                    {mode === 'edit' ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={busy}>
                                    <Archive size={16} aria-hidden="true" />
                                    Archive
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Archive this blueprint?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        New requests can no longer be submitted against it.
                                        Existing requests are unaffected.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Keep blueprint</AlertDialogCancel>
                                    <AlertDialogAction onClick={remove}>
                                        Archive
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : null}
                    <Button variant="primary" disabled={busy || !name.trim()} onClick={save}>
                        <Save size={16} aria-hidden="true" />
                        {busy ? 'Saving…' : 'Save'}
                    </Button>
                </PageActions>
            </PageHeader>

            {err ? (
                <Card padding="md" className="border-[var(--st-danger)]">
                    <p className="text-sm text-[var(--st-danger)]" role="alert">
                        {err}
                    </p>
                </Card>
            ) : null}

            <Card padding="md" className="flex flex-col gap-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings2 size={16} aria-hidden="true" />
                        Basics
                    </CardTitle>
                    <CardDescription>
                        Name and classify this blueprint, then publish when it is ready.
                    </CardDescription>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Field label="Name" required>
                            <Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Time-off request"
                            />
                        </Field>
                        <Field label="Category">
                            <Input
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="procurement, time_off, it_access…"
                            />
                        </Field>
                        <Field label="Icon" help="An emoji or icon name shown on the picker.">
                            <Input
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="📝"
                            />
                        </Field>
                        <Field label="Overall SLA" help="Total minutes allowed before breach.">
                            <Input
                                type="number"
                                inputMode="numeric"
                                value={slaMins}
                                onChange={(e) => setSlaMins(e.target.value)}
                                placeholder="1440"
                            />
                        </Field>
                    </div>
                    <Field label="Description">
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What this request is for and who should submit it."
                        />
                    </Field>
                    <div className="flex items-center gap-2">
                        <Switch
                            checked={published}
                            onCheckedChange={setPublished}
                            id="published"
                        />
                        <Label htmlFor="published">Published</Label>
                    </div>
                </CardBody>
            </Card>

            <Card padding="md" className="flex flex-col gap-4">
                <CardHeader className="flex items-start justify-between gap-3">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Workflow size={16} aria-hidden="true" />
                            Approval stages
                        </CardTitle>
                        <CardDescription>
                            Requests move through these stages in order until approved.
                        </CardDescription>
                    </div>
                    <Button variant="outline" onClick={addStage}>
                        <Plus size={16} aria-hidden="true" />
                        Add stage
                    </Button>
                </CardHeader>
                <CardBody className="flex flex-col gap-3">
                    {stages.length === 0 ? (
                        <p className="rounded-[var(--st-radius-md)] border border-dashed border-[var(--st-border)] px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">
                            Add at least one stage so requests can be approved.
                        </p>
                    ) : (
                        stages.map((s, i) => (
                            <Card key={i} padding="md" className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
                                        <Badge tone="accent" kind="soft">
                                            {i + 1}
                                        </Badge>
                                        {s.name || `Stage ${i + 1}`}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        onClick={() => removeStage(i)}
                                        aria-label={`Remove stage ${i + 1}`}
                                    >
                                        <Trash2 size={16} aria-hidden="true" />
                                        Remove
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <Field label="Name">
                                        <Input
                                            value={s.name}
                                            onChange={(e) =>
                                                updateStage(i, { name: e.target.value })
                                            }
                                        />
                                    </Field>
                                    <Field label="Approver">
                                        <Select
                                            value={s.approverKind}
                                            onValueChange={(v) =>
                                                updateStage(i, {
                                                    approverKind: v as BlueprintStage['approverKind'],
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {APPROVER_KINDS.map((k) => (
                                                    <SelectItem key={k.value} value={k.value}>
                                                        {k.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                    {s.approverKind === 'user' ? (
                                        <Field label="Approver user id">
                                            <Input
                                                value={s.approverId ?? ''}
                                                onChange={(e) =>
                                                    updateStage(i, {
                                                        approverId: e.target.value,
                                                    })
                                                }
                                            />
                                        </Field>
                                    ) : s.approverKind === 'role' ? (
                                        <Field label="Approver role">
                                            <Input
                                                value={s.approverRole ?? ''}
                                                onChange={(e) =>
                                                    updateStage(i, {
                                                        approverRole: e.target.value,
                                                    })
                                                }
                                            />
                                        </Field>
                                    ) : s.approverKind === 'conditional' ? (
                                        <Field
                                            label="Conditional expression"
                                            help="e.g. formData.amount > 10000 ? userId1 : userId2"
                                        >
                                            <Input
                                                value={s.conditionalExpr ?? ''}
                                                onChange={(e) =>
                                                    updateStage(i, {
                                                        conditionalExpr: e.target.value,
                                                    })
                                                }
                                            />
                                        </Field>
                                    ) : null}
                                    <Field label="Stage SLA" help="Minutes for this stage.">
                                        <Input
                                            type="number"
                                            inputMode="numeric"
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
                                    </Field>
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
                                            <Field label="Escalate to user id">
                                                <Input
                                                    value={s.escalateToUserId ?? ''}
                                                    onChange={(e) =>
                                                        updateStage(i, {
                                                            escalateToUserId: e.target.value,
                                                        })
                                                    }
                                                />
                                            </Field>
                                        </div>
                                    ) : null}
                                </div>
                            </Card>
                        ))
                    )}
                </CardBody>
            </Card>

            <Card padding="md" className="flex flex-col gap-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileJson size={16} aria-hidden="true" />
                        Form schema
                    </CardTitle>
                    <CardDescription>
                        {`Shape: { "fields": [{ "key", "label", "type" }] } — type is one of text, number, textarea, select, date, file.`}
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <Textarea
                        rows={10}
                        value={formSchemaText}
                        onChange={(e) => setFormSchemaText(e.target.value)}
                        className="font-mono text-xs"
                        aria-label="Form schema JSON"
                    />
                </CardBody>
            </Card>

            <Card padding="md" className="flex flex-col gap-4">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <GitBranch size={16} aria-hidden="true" />
                        Routing rules
                    </CardTitle>
                    <CardDescription>
                        {`Array of { label, expr, startStageIdx }. The expression evaluator is deferred — use a "default:" prefix to pick a default starting stage.`}
                    </CardDescription>
                </CardHeader>
                <CardBody>
                    <Textarea
                        rows={6}
                        value={routingRulesText}
                        onChange={(e) => setRoutingRulesText(e.target.value)}
                        className="font-mono text-xs"
                        aria-label="Routing rules JSON"
                    />
                </CardBody>
            </Card>
        </div>
    );
}
