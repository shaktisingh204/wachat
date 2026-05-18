'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2 } from 'lucide-react';

/**
 * <AutomationForm /> — create + edit form for CRM Automations.
 *
 * Binds to the `saveAutomation` server action via `useActionState`. The
 * "nodes" table is a simple linear sequence: trigger node is implicit
 * (set via `trigger` + `conditions`), and each row is one action that
 * runs in order. This is intentionally a slimmer surface than the old
 * block-graph editor — for branching flows the `/docs` page links to the
 * advanced editor.
 */

import { saveAutomation } from '@/app/actions/crm-automations.actions';
import type {
    CrmAutomationDoc,
    CrmAutomationStatus,
} from '@/lib/rust-client/crm-automations';

const BASE = '/dashboard/crm/automations';

const TRIGGER_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'manual', label: 'Manual' },
    { value: 'tag_added', label: 'Tag added to contact' },
    { value: 'lead_created', label: 'Lead created' },
    { value: 'deal_stage_changed', label: 'Deal stage changed' },
    { value: 'form_submitted', label: 'Form submitted' },
    { value: 'webhook', label: 'Webhook' },
];

const NODE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'action_send_email', label: 'Send email' },
    { value: 'action_add_tag', label: 'Add tag' },
    { value: 'action_remove_tag', label: 'Remove tag' },
    { value: 'action_create_task', label: 'Create task' },
    { value: 'action_assign_user', label: 'Assign to user' },
    { value: 'action_webhook', label: 'Call webhook' },
    { value: 'delay', label: 'Wait / delay' },
    { value: 'condition', label: 'Condition (if/else)' },
];

const STATUS_OPTIONS: Array<{ value: CrmAutomationStatus; label: string }> = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'archived', label: 'Archived' },
];

interface NodeRow {
    id: string;
    type: string;
    label: string;
    config: string; // free-text config (JSON or comma-separated)
}

interface AutomationFormProps {
    initialData?: CrmAutomationDoc | null;
}

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Save className="mr-2 h-4 w-4" />
            )}
            {isEditing ? 'Save changes' : 'Create automation'}
        </ZoruButton>
    );
}

function deriveInitialNodes(doc?: CrmAutomationDoc | null): NodeRow[] {
    if (!doc?.nodes?.length) return [];
    return doc.nodes
        .filter((n) => !n.type?.startsWith('trigger'))
        .map((n) => {
            const data = (n.data ?? {}) as Record<string, unknown>;
            const label =
                typeof data.label === 'string' ? (data.label as string) : n.type;
            // Strip label from config for display
            const { label: _omit, ...rest } = data;
            void _omit;
            return {
                id: n.id,
                type: n.type,
                label,
                config: Object.keys(rest).length ? JSON.stringify(rest) : '',
            };
        });
}

function deriveInitialTrigger(doc?: CrmAutomationDoc | null): {
    trigger: string;
    conditions: string;
} {
    if (!doc?.nodes?.length) return { trigger: 'manual', conditions: '' };
    const trig = doc.nodes.find((n) => n.type?.startsWith('trigger'));
    if (!trig) return { trigger: 'manual', conditions: '' };
    const data = (trig.data ?? {}) as Record<string, unknown>;
    const trigger = trig.type.replace(/^trigger_/, '') || 'manual';
    const conditions =
        typeof data.conditions === 'string' ? (data.conditions as string) : '';
    return { trigger, conditions };
}

export function AutomationForm({ initialData }: AutomationFormProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const isEditing = !!initialData?._id;

    const [state, formAction] = useActionState(saveAutomation, initialState);

    const initialTrig = deriveInitialTrigger(initialData);
    const [trigger, setTrigger] = useState<string>(initialTrig.trigger);
    const [status, setStatus] = useState<CrmAutomationStatus>(
        initialData?.status ?? 'draft',
    );
    const [nodes, setNodes] = useState<NodeRow[]>(() =>
        deriveInitialNodes(initialData),
    );

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Saved', description: state.message });
            const id = state.id ?? initialData?._id;
            if (id) router.push(`${BASE}/${id}`);
            else router.push(BASE);
        }
        if (state?.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, router, initialData?._id]);

    const addNode = () =>
        setNodes((prev) => [
            ...prev,
            {
                id: `node-${Date.now()}-${prev.length}`,
                type: 'action_send_email',
                label: 'Send email',
                config: '',
            },
        ]);

    const removeNode = (idx: number) =>
        setNodes((prev) => prev.filter((_, i) => i !== idx));

    const updateNode = <K extends keyof NodeRow>(
        idx: number,
        key: K,
        value: NodeRow[K],
    ) =>
        setNodes((prev) =>
            prev.map((n, i) => (i === idx ? { ...n, [key]: value } : n)),
        );

    const moveNode = (idx: number, dir: -1 | 1) =>
        setNodes((prev) => {
            const j = idx + dir;
            if (j < 0 || j >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[j]] = [copy[j], copy[idx]];
            return copy;
        });

    const nodesJson = JSON.stringify(
        nodes.map((n) => {
            let parsedConfig: Record<string, unknown> = {};
            if (n.config?.trim()) {
                try {
                    const c = JSON.parse(n.config);
                    if (c && typeof c === 'object' && !Array.isArray(c)) {
                        parsedConfig = c as Record<string, unknown>;
                    } else {
                        parsedConfig = { value: n.config };
                    }
                } catch {
                    parsedConfig = { value: n.config };
                }
            }
            return {
                id: n.id,
                type: n.type,
                label: n.label,
                data: { ...parsedConfig, label: n.label },
            };
        }),
    );

    return (
        <ZoruCard className="p-6">
            <form action={formAction} className="flex flex-col gap-6">
                {isEditing ? (
                    <input
                        type="hidden"
                        name="automationId"
                        value={initialData!._id}
                    />
                ) : null}
                <input type="hidden" name="trigger" value={trigger} />
                <input type="hidden" name="status" value={status} />
                <input type="hidden" name="nodes" value={nodesJson} />

                {/* Name + Status */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="name">Automation name *</ZoruLabel>
                        <ZoruInput
                            id="name"
                            name="name"
                            required
                            placeholder="e.g. Welcome new leads"
                            defaultValue={initialData?.name ?? ''}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                        <ZoruSelect
                            value={status}
                            onValueChange={(v) => setStatus(v as CrmAutomationStatus)}
                        >
                            <ZoruSelectTrigger id="status-trigger">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="description">Description</ZoruLabel>
                    <ZoruTextarea
                        id="description"
                        name="description"
                        rows={2}
                        placeholder="What does this automation do?"
                        defaultValue={initialData?.description ?? ''}
                    />
                </div>

                {/* Trigger + Conditions */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="trigger-trigger">Trigger</ZoruLabel>
                        <ZoruSelect value={trigger} onValueChange={setTrigger}>
                            <ZoruSelectTrigger id="trigger-trigger">
                                <ZoruSelectValue placeholder="Trigger" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TRIGGER_OPTIONS.map((o) => (
                                    <ZoruSelectItem key={o.value} value={o.value}>
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div className="space-y-1.5">
                        <ZoruLabel htmlFor="conditions">Conditions</ZoruLabel>
                        <ZoruInput
                            id="conditions"
                            name="conditions"
                            placeholder="e.g. tag=hot lead"
                            defaultValue={initialTrig.conditions}
                        />
                    </div>
                </div>

                {/* Actions (free-form notes for the engine) */}
                <div className="space-y-1.5">
                    <ZoruLabel htmlFor="actions">Action notes</ZoruLabel>
                    <ZoruTextarea
                        id="actions"
                        name="actions"
                        rows={2}
                        placeholder="Free-form notes attached to the trigger. Use the node table below for executable steps."
                    />
                </div>

                {/* Nodes table */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <ZoruLabel>Nodes (executed in order)</ZoruLabel>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={addNode}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add node
                        </ZoruButton>
                    </div>
                    {nodes.length === 0 ? (
                        <div className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-6 text-center text-[12.5px] text-zoru-ink-muted">
                            No nodes yet. Add one to start building the automation.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {nodes.map((n, idx) => (
                                <div
                                    key={n.id}
                                    className="grid grid-cols-1 gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-3 sm:grid-cols-[auto_180px_1fr_2fr_auto]"
                                >
                                    <div className="flex flex-col items-center justify-center gap-1 self-center">
                                        <button
                                            type="button"
                                            onClick={() => moveNode(idx, -1)}
                                            disabled={idx === 0}
                                            className="text-zoru-ink-muted hover:text-zoru-ink disabled:opacity-30"
                                            aria-label="Move up"
                                        >
                                            <GripVertical className="h-4 w-4" />
                                        </button>
                                        <span className="font-mono text-[10px] text-zoru-ink-muted">
                                            {idx + 1}
                                        </span>
                                    </div>
                                    <ZoruSelect
                                        value={n.type}
                                        onValueChange={(v) =>
                                            updateNode(idx, 'type', v)
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue placeholder="Type" />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {NODE_TYPE_OPTIONS.map((o) => (
                                                <ZoruSelectItem
                                                    key={o.value}
                                                    value={o.value}
                                                >
                                                    {o.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                    <ZoruInput
                                        placeholder="Label"
                                        value={n.label}
                                        onChange={(e) =>
                                            updateNode(idx, 'label', e.target.value)
                                        }
                                    />
                                    <ZoruInput
                                        placeholder='Config (JSON, e.g. {"templateId":"X"})'
                                        value={n.config}
                                        onChange={(e) =>
                                            updateNode(idx, 'config', e.target.value)
                                        }
                                    />
                                    <ZoruButton
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeNode(idx)}
                                        aria-label="Remove node"
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </ZoruButton>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <ZoruButton variant="ghost" asChild>
                        <Link href={BASE}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to automations
                        </Link>
                    </ZoruButton>
                    <SubmitButton isEditing={isEditing} />
                </div>
            </form>
        </ZoruCard>
    );
}
